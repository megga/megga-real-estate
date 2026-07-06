// supabase/functions/buyer-reception-create/index.ts
// POST /functions/v1/buyer-reception-create   (auth agent requise)
//
// L'agent transmet une SÉLECTION de biens (matches) à un acheteur via un lien
// privé (magic link HMAC, sans compte). Marque les matches comme envoyés
// (canal 'reception') puis mint le lien. Le lien est ensuite partagé par
// WhatsApp / copié — jamais d'email (cf. handoff).
//
// Body : { contact_id, match_ids: string[], channel?: 'whatsapp'|'link', expiration_days?: number }
// → { ok, linkId, token, expiresAt }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { signMagicLinkToken, expiryFromDays } from '../_shared/magic-link-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { profile, supabase } = auth

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const contactId = String(body.contact_id ?? '').trim()
  const matchIds = Array.isArray(body.match_ids) ? body.match_ids.map((x) => String(x)).filter((x) => UUID_RE.test(x)) : []
  const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'link'
  const days = Number.isFinite(Number(body.expiration_days)) ? Math.min(90, Math.max(1, Number(body.expiration_days))) : 30

  if (!UUID_RE.test(contactId)) return json({ error: 'contact_id required' }, 400)
  if (!matchIds.length) return json({ error: 'match_ids required' }, 400)

  // ── Cloisonnement : le contact ET les matches appartiennent à l'agence ──
  const { data: contact } = await supabase
    .from('contacts').select('id, agency_id').eq('id', contactId).maybeSingle()
  if (!contact || contact.agency_id !== profile.agency_id) return json({ error: 'contact not found' }, 404)

  const { data: matches } = await supabase
    .from('matches').select('id, contact_id, agency_id, status')
    .in('id', matchIds).eq('agency_id', profile.agency_id).eq('contact_id', contactId)
  const validIds = (matches ?? []).map((m) => m.id as string)
  if (!validIds.length) return json({ error: 'no valid match in selection' }, 400)

  // ── Transmission : les matches encore 'suggested' passent 'sent' (canal reception)
  const toSend = (matches ?? []).filter((m) => m.status === 'suggested').map((m) => m.id as string)
  if (toSend.length) {
    await supabase.from('matches')
      .update({ status: 'sent', sent_via: 'reception', sent_at: new Date().toISOString() })
      .in('id', toSend)
  }

  // ── Mint du lien (id d'abord → payload HMAC) ──
  const linkId = crypto.randomUUID()
  const exp = expiryFromDays(days)
  let token: string
  try {
    token = await signMagicLinkToken({ id: linkId, exp: exp.unix, p: profile.id })
  } catch {
    return json({ error: 'Server misconfigured: reception link secret missing' }, 500)
  }

  const { error: insErr } = await supabase.from('buyer_reception_links').insert({
    id: linkId,
    token,
    agency_id: profile.agency_id,
    contact_id: contactId,
    agent_id: profile.id,
    match_ids: validIds,
    status: 'pending',
    channel,
    expires_at: exp.iso,
    created_by: profile.id,
  })
  if (insErr) return json({ error: 'Could not create reception link' }, 500)

  // Audit best-effort (l'agent a transmis une sélection).
  supabase.from('activity_events').insert({
    agency_id: profile.agency_id,
    actor_id: profile.id,
    actor_kind: 'user',
    action: 'reception_link_created',
    entity_type: 'contact',
    entity_id: contactId,
    category: 'deal',
    severity: 'info',
    metadata: { link_id: linkId, count: validIds.length, channel },
  }).then(() => {})

  return json({ ok: true, linkId, token, expiresAt: exp.iso, count: validIds.length })
})
