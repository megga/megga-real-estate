// supabase/functions/seller-portal-action/index.ts
// POST /functions/v1/seller-portal-action
//
// Espace vendeur (Phase 2) — actions par lien personnel (token seller_portals, sans compte).
// Déployée --no-verify-jwt (cf. deploy.yml) : endpoint public, sécurisé par le token.
//
// L'AGENT RESTE COPILOTE : une décision d'offre est ENREGISTRÉE (activity_event
// actor_kind='system') et TRANSMISE à l'agent qui l'exécute dans le CRM. Le token ne
// mute JAMAIS crm_offers / transactions directement → un lien fuité ne peut, au pire,
// que journaliser une intention que l'agent revoit (blast radius minimal, human-in-the-loop).
//
// Body :
//   { token, action: 'offer_decision', offerId?, decision: 'accept'|'counter'|'refuse', counterAmount? }
//   { token, action: 'save_preferences', preferences: {...} }
//   { token, action: 'get_preferences' }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type Decision = 'accept' | 'counter' | 'refuse'
const DECISIONS: Decision[] = ['accept', 'counter', 'refuse']
const DECISION_LABEL: Record<Decision, string> = {
  accept: "Le vendeur souhaite accepter l'offre",
  counter: 'Le vendeur souhaite faire une contre-offre',
  refuse: "Le vendeur souhaite refuser l'offre",
}

const LANGUES = ['fr', 'de', 'en', 'it']
const CANAUX = ['whatsapp', 'tel', 'email']
const PREAVIS = ['jour', '24h', '48h']

interface PrefsInput {
  notif_offre?: boolean
  notif_visite?: boolean
  notif_retour?: boolean
  notif_resume?: boolean
  jours?: unknown
  creneaux?: unknown
  preavis?: unknown
  langue?: unknown
  canal?: unknown
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const token = String(body.token ?? '').trim()
  const action = String(body.action ?? '')
  if (!token) return json({ error: 'token required' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // ── Validation du token → portail (actif, non expiré) ──────────────────
  const { data: portal, error: pErr } = await supabase
    .from('seller_portals')
    .select('id, agency_id, contact_id, property_id, agent_id, status, expires_at, created_at, view_count')
    .eq('token', token)
    .single()

  // ── Lecture du portail (get_data) : statut structuré en 200 pour piloter l'écran
  //    invalide / expiré / révoqué côté page, indépendamment des codes HTTP. Toutes les
  //    lectures passent par ici (service_role, scopé au token) — JAMAIS d'accès anon RLS.
  if (action === 'get_data') {
    if (pErr || !portal) return json({ ok: false, reason: 'invalid' })
    if (portal.status === 'revoked') return json({ ok: false, reason: 'revoked' })
    if (portal.status !== 'active' || new Date(portal.expires_at) < new Date()) {
      return json({ ok: false, reason: 'expired' })
    }
    return await loadPortalData(supabase, portal)
  }

  // ── Écritures : token strict (contrat 401/410 inchangé) ────────────────
  if (pErr || !portal) return json({ error: 'Invalid link' }, 401)
  if (portal.status !== 'active' || new Date(portal.expires_at) < new Date()) {
    return json({ error: 'Link expired or revoked' }, 410)
  }

  // ── Décision d'offre : enregistrer + transmettre (aucune mutation directe) ──
  if (action === 'offer_decision') {
    const decision = String(body.decision ?? '') as Decision
    if (!DECISIONS.includes(decision)) return json({ error: 'invalid decision' }, 400)

    const offerId = typeof body.offerId === 'string' && body.offerId ? body.offerId : null
    let counterAmount: number | null = null
    if (decision === 'counter') {
      const n = Number(body.counterAmount)
      if (!Number.isFinite(n) || n <= 0) return json({ error: 'counterAmount required for counter' }, 400)
      counterAmount = Math.round(n)
    }

    const { error: aErr } = await supabase.from('activity_events').insert({
      agency_id: portal.agency_id,
      actor_id: null,
      actor_kind: 'system',
      action: 'seller_offer_decision',
      entity_type: 'crm_offer',
      entity_id: offerId,
      category: 'deal',
      severity: 'info',
      object_label: DECISION_LABEL[decision],
      metadata: {
        source: 'seller_portal',
        portal_id: portal.id,
        contact_id: portal.contact_id,
        property_id: portal.property_id,
        agent_id: portal.agent_id,
        offer_id: offerId,
        decision,
        counter_amount: counterAmount,
      },
    })
    if (aErr) return json({ error: 'Could not record decision' }, 500)

    return json({ ok: true, transmitted: true })
  }

  // ── Sauvegarde des préférences (upsert sur portal_id) ──────────────────
  if (action === 'save_preferences') {
    const p = (body.preferences ?? {}) as PrefsInput
    const asStrArray = (v: unknown, max: number) =>
      Array.isArray(v) ? v.slice(0, max).map((x) => String(x)) : []

    const row = {
      portal_id: portal.id,
      agency_id: portal.agency_id,
      notif_offre: p.notif_offre ?? true,
      notif_visite: p.notif_visite ?? true,
      notif_retour: p.notif_retour ?? true,
      notif_resume: p.notif_resume ?? true,
      jours: asStrArray(p.jours, 7),
      creneaux: asStrArray(p.creneaux, 3),
      preavis: PREAVIS.includes(String(p.preavis)) ? String(p.preavis) : '24h',
      langue: LANGUES.includes(String(p.langue)) ? String(p.langue) : 'fr',
      canal: CANAUX.includes(String(p.canal)) ? String(p.canal) : 'whatsapp',
      updated_at: new Date().toISOString(),
    }
    const { error: uErr } = await supabase
      .from('seller_preferences')
      .upsert(row, { onConflict: 'portal_id' })
    if (uErr) return json({ error: 'Could not save preferences' }, 500)

    return json({ ok: true })
  }

  // ── Lecture des préférences (hydratation à l'ouverture) ────────────────
  if (action === 'get_preferences') {
    const { data: prefs } = await supabase
      .from('seller_preferences')
      .select('notif_offre, notif_visite, notif_retour, notif_resume, jours, creneaux, preavis, langue, canal')
      .eq('portal_id', portal.id)
      .maybeSingle()
    return json({ ok: true, preferences: prefs ?? null })
  }

  return json({ error: 'unknown action' }, 400)
})

// ── Assemblage des données de lecture du portail ───────────────────────────
// service_role, strictement scopé au property_id/contact_id du token validé.
// Renvoie les lignes brutes ; l'assemblage final (KPIs, mapping) reste côté hook.
async function loadPortalData(
  supabase: SupabaseClient,
  portal: {
    id: string
    contact_id: string
    property_id: string
    agent_id: string
    created_at: string
    view_count: number | null
  },
) {
  // Vue (fire & forget)
  supabase
    .from('seller_portals')
    .update({ last_viewed_at: new Date().toISOString(), view_count: (portal.view_count ?? 0) + 1 })
    .eq('id', portal.id)
    .then(() => {})

  const [propertyRes, transactionRes, visitsRes, agentRes, eventsRes, sellerLeadRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id, title, address, city, canton, postal_code, price, rooms, surface_m2, type, photos, status, condition, created_at')
      .eq('id', portal.property_id)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('id, stage, status, price_offered, price_final, mandate_type, created_at')
      .eq('property_id', portal.property_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('visits')
      .select('id, scheduled_at, completed_at, status, feedback_buyer, rating')
      .eq('property_id', portal.property_id)
      .order('scheduled_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name, phone, email, avatar_url')
      .eq('id', portal.agent_id)
      .maybeSingle(),
    supabase
      .from('activity_events')
      .select('id, action, metadata, created_at')
      .or(`entity_id.eq.${portal.property_id},entity_id.eq.${portal.contact_id}`)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('seller_leads')
      .select('estimation_min, estimation_max, estimation_median, estimation_confidence, comparable_count')
      .eq('contact_id', portal.contact_id)
      .eq('property_id', portal.property_id)
      .limit(1)
      .maybeSingle(),
  ])

  // Offres RÉELLES depuis crm_offers — remplace la synthèse 0/1. Le lien est crm_offers.deal_id
  // (= transactions.id ; c'est la colonne que l'app peuple, cf useOffers — transaction_id est
  // vestigiale/NULL). Scopé à la transaction du bien du token.
  let offers: unknown[] = []
  const txId = (transactionRes.data as { id?: string } | null)?.id ?? null
  if (txId) {
    const { data: offerRows } = await supabase
      .from('crm_offers')
      .select('id, amount, status, kind, parent_offer_id, conditions, created_at')
      .eq('deal_id', txId)
      .order('created_at', { ascending: false })
    offers = offerRows ?? []
  }

  return json({
    ok: true,
    portal: { id: portal.id, created_at: portal.created_at, view_count: (portal.view_count ?? 0) + 1, property_id: portal.property_id },
    property: propertyRes.data,
    transaction: transactionRes.data,
    visits: visitsRes.data ?? [],
    agent: agentRes.data,
    events: eventsRes.data ?? [],
    sellerLead: sellerLeadRes.data,
    offers,
  })
}
