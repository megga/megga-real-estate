// ═══════════════════════════════════════════════════════════════════════════
// property-photo-r2 — Broker agent-auth : miroir des photos de biens vers R2
// ═══════════════════════════════════════════════════════════════════════════
//
// Repurpose du pipeline R2 (photo-processor) pour les photos des biens AGENCE
// (`properties`), maintenant que la marketplace est désactivée. Le navigateur ne
// peut PAS appeler photo-processor (service_role only — les clés R2 ne doivent
// jamais être exposées), donc ce broker :
//   1. requireAgentAuth → `profile.agency_id` de confiance ;
//   2. vérifie que le bien appartient à l'agence de l'agent (anti cross-tenant) ;
//   3. ré-invoque photo-processor (function-to-function, service role) avec un
//      `keyPrefix` DÉRIVÉ SERVER-SIDE — jamais fourni par le client ;
//   4. renvoie les URLs R2 `detail` (servies depuis img.megga.ch, egress gratuit).
//
// Le bucket R2 est public/unsigned → les URLs renvoyées sont finales et entrent
// telles quelles dans `properties.photos[]` (toutes les surfaces de rendu sont
// URL-agnostic). Les bytes mirrorés sont DÉJÀ strippés EXIF côté client (nLPD) ;
// photo-processor les ré-encode en JPEG, ce qui re-strippe par construction.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_PHOTOS = 10

interface BrokerRequest {
  propertyId: string
  photoUrls: string[]
  /** Sous-espace de clé R2 (enum fermé, jamais un chemin libre). Défaut 'photos'. */
  kind?: 'photos' | 'floorplan'
}

interface Variant { id: string; thumb?: string; detail?: string; hero?: string }

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Hash déterministe (djb2 → base36) : un retry du même batch ré-écrit les mêmes
// clés R2 (idempotent, pas d'orphelins), un nouvel upload a de nouvelles URLs.
function hash36(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1. Auth agent → agency_id de confiance (jamais un id fourni par le client).
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { profile, supabase } = auth

  let body: BrokerRequest
  try {
    body = await req.json() as BrokerRequest
  } catch {
    return json({ success: false, error: 'invalid JSON body' }, 400)
  }

  const { propertyId, photoUrls } = body
  const kind = body.kind === 'floorplan' ? 'floorplan' : 'photos'

  if (!propertyId || !UUID_RE.test(propertyId)) return json({ success: false, error: 'propertyId invalide' }, 400)
  if (!Array.isArray(photoUrls) || photoUrls.length === 0) return json({ success: false, error: 'photoUrls[] requis' }, 400)
  if (photoUrls.length > MAX_PHOTOS) return json({ success: false, error: `max ${MAX_PHOTOS} photos` }, 400)

  // Anti-SSRF : les URLs doivent pointer EXACTEMENT vers le bucket de staging
  // Supabase (là où le hook a uploadé). Refuse tout host arbitraire / IP interne
  // (169.254.x, localhost, ports internes) — l'agent ne choisit pas la source.
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')
  if (!supabaseUrl) return json({ success: false, error: 'server misconfigured' }, 500)
  const stagingPrefix = `${supabaseUrl}/storage/v1/object/public/property-photos/`
  if (!photoUrls.every((u) => typeof u === 'string' && u.startsWith(stagingPrefix))) {
    return json({ success: false, error: 'photoUrls hors bucket de staging' }, 400)
  }

  // 2. Ownership : le bien doit appartenir à l'agence de l'agent.
  const { data: property, error: propErr } = await supabase
    .from('properties')
    .select('id, agency_id')
    .eq('id', propertyId)
    .maybeSingle()
  if (propErr) return json({ success: false, error: 'lookup failed' }, 500)
  if (!property || property.agency_id !== profile.agency_id) {
    return json({ success: false, error: 'forbidden' }, 403)
  }

  // 3. keyPrefix DÉRIVÉ SERVER-SIDE — uuid en minuscules (accord avec la regex
  //    lowercase de photo-processor), batchId déterministe (idempotent au retry).
  const batchId = hash36(photoUrls.join('|'))
  const keyPrefix = `properties/${propertyId.toLowerCase()}/${kind}/${batchId}`

  // 4. Appel photo-processor (service role). Edge-to-edge : on forwarde la clé de
  //    service de l'env (même valeur que photo-processor lit → branche d'égalité).
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
  if (!serviceKey) return json({ success: false, error: 'server misconfigured' }, 500)

  let procJson: { success?: boolean; photos_cf?: Variant[] }
  try {
    const procRes = await fetch(`${supabaseUrl}/functions/v1/photo-processor`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: propertyId, photoUrls, keyPrefix }),
    })
    procJson = await procRes.json() as { success?: boolean; photos_cf?: Variant[] }
  } catch (e) {
    return json({ success: false, error: `R2 mirror failed: ${(e as Error).message?.slice(0, 120)}` }, 502)
  }

  if (!procJson.success || !Array.isArray(procJson.photos_cf)) {
    return json({ success: false, error: 'R2 mirror failed' }, 502)
  }

  // URL servie depuis R2 par photo (detail, repli hero/thumb). Ordre = input.
  const photos = procJson.photos_cf
    .map((v) => v.detail ?? v.hero ?? v.thumb)
    .filter((u): u is string => typeof u === 'string')

  if (photos.length === 0) return json({ success: false, error: 'no R2 url produced' }, 502)

  return json({ success: true, photos, photos_cf: procJson.photos_cf })
})
