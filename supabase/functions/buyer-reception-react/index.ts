// supabase/functions/buyer-reception-react/index.ts
// POST /functions/v1/buyer-reception-react   (public — déployée --no-verify-jwt)
//
// L'acheteur réagit à un bien de sa sélection (♥ intéressé / ✕ écarté + motif).
// Token HMAC vérifié en crypto d'abord, puis la RPC record_buyer_reaction met à
// jour le match (→ triggers response_at + audit) sous attribution 'reception'.
// SA réaction = SA propre action ; l'agent reste HITL pour l'action suivante.
//
// Body : { token, match_id, reaction: 'interested'|'rejected', motif?, note? }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REACTIONS = ['interested', 'rejected']

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const token = String(body.token ?? '').trim()
  const matchId = String(body.match_id ?? '').trim()
  const reaction = String(body.reaction ?? '')
  const motif = body.motif != null ? String(body.motif).slice(0, 240) : null
  const note = body.note != null ? String(body.note).slice(0, 1000) : null
  if (!token) return json({ error: 'token required' }, 400)
  if (!UUID_RE.test(matchId)) return json({ error: 'match_id required' }, 400)
  if (!REACTIONS.includes(reaction)) return json({ error: 'invalid reaction' }, 400)

  // 1) Crypto d'abord.
  const v = await verifyMagicLinkToken(token)
  if (!v.valid || !v.payload) return json({ error: v.reason === 'expired' ? 'Link expired' : 'Invalid link' }, v.reason === 'expired' ? 410 : 401)
  const linkId = v.payload.id

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  // 2) Validation du lien (jeton stocké / statut / expiry) avant mutation.
  //
  // Les trois garde-fous doivent être ICI et pas seulement dans `buyer-reception-get` :
  // c'est le point d'ÉCRITURE. Sans eux le retrait d'un lien ne tenait qu'une requête —
  // `record_buyer_reaction` finit par `update buyer_reception_links set status='reacted'`
  // sans condition, donc un POST sur un lien retiré effaçait le retrait lui-même et
  // rouvrait la lecture. Refuser avant l'appel est ce qui rend le retrait durable.
  const { data: link } = await supabase
    .from('buyer_reception_links').select('id, token, status, expires_at').eq('id', linkId).maybeSingle()
  if (!link) return json({ error: 'Invalid link' }, 401)
  // Le jeton stocké fait foi : une signature valide ne suffit pas. Le réécrire retire
  // le lien sans attendre `expires_at`, y compris pour l'écriture — sinon un porteur
  // de jeton périmé continuait de basculer les matches et d'injecter du texte libre.
  if (link.token !== token) return json({ error: 'Invalid link' }, 401)
  // 'revoked' (retrait par l'agence) meurt comme 'expired', et sous le même 410 :
  // distinguer les deux apprendrait au porteur du jeton qu'il a été repéré.
  if (link.status === 'revoked' || link.status === 'expired') return json({ error: 'Link expired' }, 410)
  if (new Date(link.expires_at) < new Date()) return json({ error: 'Link expired' }, 410)

  // 3) RPC atomique : met à jour le match (triggers) + le lien.
  const { error } = await supabase.rpc('record_buyer_reaction', {
    p_link_id: linkId,
    p_match_id: matchId,
    p_reaction: reaction,
    p_motif: motif,
    p_note: note,
  })
  if (error) {
    const msg = String(error.message || '')
    if (msg.includes('match_not_in_selection')) return json({ error: 'match not in selection' }, 403)
    // `link_revoked` rend le MÊME 410 que `link_expired`, et ce n'est pas une commodité :
    // sans cette ligne, un retrait survenu entre la lecture ci-dessus et l'appel RPC tombait
    // dans le repli 500 — le seul code que ne produit aucun autre état terminal. La réponse
    // signait donc la révocation à celui qui porte le jeton, exactement ce que le refus
    // indifférencié cherche à éviter. Accessoirement, elle remontait un 5xx au monitoring
    // pour un refus parfaitement nominal.
    if (msg.includes('link_revoked') || msg.includes('link_expired')) return json({ error: 'Link expired' }, 410)
    return json({ error: 'Could not record reaction' }, 500)
  }

  return json({ ok: true, transmitted: true })
})
