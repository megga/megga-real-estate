// supabase/functions/buyer-reception-get/index.ts
// POST /functions/v1/buyer-reception-get   (public — déployée --no-verify-jwt)
// Jeton dans le corps JSON ; `?token=` reste accepté pour compatibilité, mais les
// journaux d'accès de la plateforme enregistrent l'URL complète — le corps évite ça.
//
// Charge la sélection transmise à l'acheteur (page réception mobile). Token HMAC
// vérifié en crypto AVANT tout accès DB (aucune fuite de timing). service_role,
// strictement scopé au lien du token. PII minimale : prénom du contact + infos
// publiques de l'agent. Renvoie un statut structuré en 200 (invalid/expired) pour
// piloter l'écran, comme le portail vendeur.
//
// Retrait d'un lien : la signature HMAC porte une expiration jusqu'à 90 jours, donc
// le seul moyen de couper l'accès avant terme est en base — jeton stocké et statut
// font foi (mêmes gardes que magic-link-get).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

interface BienOut {
  match_id: string
  status: string
  reaction_motif: string | null
  title: string
  quartier: string | null
  addr: string
  transaction: 'vente' | 'location'
  price: number | null
  rent: number | null
  rooms: number | null
  area: number | null
  floor: number | null
  year: number | null
  charges: number | null
  price_per_m2: number | null
  features: string[]
  desc: string | null
  photos: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Le CORPS d'abord, la query seulement en repli : les journaux de requêtes de la
  // plateforme conservent l'URL entière, donc un jeton en query y reste écrit pour
  // toute sa durée de vie. L'unique appelant (`useBuyerReception`) poste déjà un
  // corps ; le repli ne sert qu'aux liens ouverts en GET à la main.
  const url = new URL(req.url)
  let token = ''
  if (req.method === 'POST') {
    try { token = String(((await req.json()) as { token?: string }).token ?? '') } catch { /* ignore */ }
  }
  if (!token) token = url.searchParams.get('token') ?? ''
  token = token.trim()
  if (!token) return json({ ok: false, reason: 'invalid' })

  // 1) Crypto d'abord — pas de DB si le token est faux/expiré.
  const v = await verifyMagicLinkToken(token)
  if (!v.valid || !v.payload) return json({ ok: false, reason: v.reason === 'expired' ? 'expired' : 'invalid' })
  const linkId = v.payload.id

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  const { data: link } = await supabase
    .from('buyer_reception_links')
    .select('id, token, agency_id, contact_id, agent_id, match_ids, status, expires_at')
    .eq('id', linkId)
    .maybeSingle()
  if (!link) return json({ ok: false, reason: 'invalid' })

  // Le jeton STOCKÉ fait foi : une signature valide ne suffit pas. Réécrire
  // `token` sur la ligne tue l'ancien jeton sans attendre `expires_at`. Rendu
  // 'invalid' (et non un motif propre) pour ne pas distinguer, côté acheteur,
  // un lien remplacé d'un lien inexistant.
  if (link.token !== token) return json({ ok: false, reason: 'invalid' })

  // 'expired' est le seul statut de retrait que le CHECK de la table autorise
  // (pending|viewed|reacted|expired) : le poser à la main coupe le lien tout de
  // suite. 'reacted' continue de servir — l'acheteur revient relire sa sélection.
  if (link.status === 'expired') return json({ ok: false, reason: 'expired' })
  if (new Date(link.expires_at) < new Date()) return json({ ok: false, reason: 'expired' })

  // Marque « vu » au 1er accès (idempotent) + IP/UA forensiques.
  if (link.status === 'pending') {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null
    supabase.from('buyer_reception_links')
      .update({ status: 'viewed', viewed_at: new Date().toISOString(), client_ip: ip, client_user_agent: req.headers.get('user-agent'), updated_at: new Date().toISOString() })
      .eq('id', link.id).eq('status', 'pending').then(() => {})
  }

  const matchIds = (link.match_ids ?? []) as string[]
  const [contactRes, agentRes, matchesRes] = await Promise.all([
    supabase.from('contacts').select('first_name').eq('id', link.contact_id).maybeSingle(),
    link.agent_id
      ? supabase.from('profiles').select('full_name, phone, avatar_url, agency_id').eq('id', link.agent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('matches').select('id, property_id, market_listing_id, status, reaction_motif, score').in('id', matchIds),
  ])

  const matches = matchesRes.data ?? []
  const propIds = matches.map((m) => m.property_id).filter(Boolean) as string[]
  const mlIds = matches.map((m) => m.market_listing_id).filter(Boolean) as string[]

  const [propsRes, mlRes, agencyRes] = await Promise.all([
    propIds.length
      ? supabase.from('properties').select('id, title, address, city, canton, postal_code, transaction_type, price, rooms, surface_m2, bedrooms, bathrooms, features, photos, type, year_built, description').in('id', propIds)
      : Promise.resolve({ data: [] }),
    mlIds.length
      ? supabase.from('market_listings').select('id, title, address, city, canton, postal_code, transaction_type, price, current_price, price_per_m2, rooms, surface_m2, features, photos, photos_cf, type, year_built, charges_monthly').in('id', mlIds)
      : Promise.resolve({ data: [] }),
    supabase.from('agencies').select('name').eq('id', link.agency_id).maybeSingle(),
  ])
  const props = new Map((propsRes.data ?? []).map((p) => [p.id as string, p]))
  const mls = new Map((mlRes.data ?? []).map((m) => [m.id as string, m]))

  const num = (x: unknown): number | null => (x == null || Number.isNaN(Number(x)) ? null : Number(x))
  const arr = (x: unknown): string[] => (Array.isArray(x) ? (x as unknown[]).filter((s): s is string => typeof s === 'string' && !!s) : [])

  const items: BienOut[] = []
  for (const m of matches) {
    const isMarket = !!m.market_listing_id
    const b = isMarket ? mls.get(m.market_listing_id as string) : props.get(m.property_id as string)
    if (!b) continue
    const tx: 'vente' | 'location' = b.transaction_type === 'rent' ? 'location' : 'vente'
    const eff = isMarket ? (num((b as Record<string, unknown>).current_price) ?? num(b.price)) : num(b.price)
    const cf = isMarket ? arr((b as Record<string, unknown>).photos_cf) : []
    const photos = (cf.length ? cf : arr(b.photos)).slice(0, 12)
    items.push({
      match_id: m.id as string,
      status: m.status as string,
      reaction_motif: (m.reaction_motif as string) ?? null,
      title: String(b.title ?? 'Bien'),
      quartier: (b.city as string) ?? null,
      addr: [b.address, [b.postal_code, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || String(b.city ?? ''),
      transaction: tx,
      price: tx === 'vente' ? eff : null,
      rent: tx === 'location' ? eff : null,
      rooms: num(b.rooms),
      area: num(b.surface_m2),
      floor: null,
      year: num(b.year_built),
      charges: isMarket ? num((b as Record<string, unknown>).charges_monthly) : null,
      price_per_m2: isMarket ? num((b as Record<string, unknown>).price_per_m2) : (eff && num(b.surface_m2) ? Math.round(eff / Number(b.surface_m2)) : null),
      features: arr(b.features),
      desc: (b as Record<string, unknown>).description ? String((b as Record<string, unknown>).description) : null,
      photos,
    })
  }
  // Préserve l'ordre de la sélection.
  const order = new Map(matchIds.map((id, i) => [id, i]))
  items.sort((a, z) => (order.get(a.match_id) ?? 1e9) - (order.get(z.match_id) ?? 1e9))

  const agent = agentRes.data as { full_name?: string; phone?: string; avatar_url?: string } | null
  return json({
    ok: true,
    status: link.status,
    contact: { firstName: (contactRes.data?.first_name as string) ?? '' },
    agent: agent ? { name: agent.full_name ?? '', phone: agent.phone ?? null, avatar: agent.avatar_url ?? null, agency: agencyRes.data?.name ?? null } : null,
    items,
  })
})
