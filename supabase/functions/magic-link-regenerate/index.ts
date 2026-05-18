// supabase/functions/magic-link-regenerate/index.ts
// POST /functions/v1/magic-link-regenerate
//
// Sprint 4.7.A — Régénération d'un lien magique expiré ou révoqué.
//
// L'agent reprend le même `kyc_case_id` + `contact_id` et obtient un
// NOUVEAU token (l'ancien token devient invalide car la row contient
// désormais le nouveau).
//
// Input :
//   { magic_link_id: string, expiration_days?: number }
//
// Output :
//   { magic_link_id, token, url, expires_at, status: 'pending' }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { signMagicLinkToken, expiryFromDays } from '../_shared/magic-link-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RegenRequest {
  magic_link_id: string
  expiration_days?: number
}

const PUBLIC_DOMAIN = Deno.env.get('MEGGA_KYC_PUBLIC_DOMAIN') ?? 'kyc.megga.ch'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { profile, supabase } = auth

  let body: RegenRequest
  try {
    body = (await req.json()) as RegenRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!body.magic_link_id) {
    return new Response(JSON.stringify({ error: 'magic_link_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const expirationDays = Math.min(Math.max(body.expiration_days ?? 7, 1), 30)

  // Vérifie ownership + statut éligible à la regen
  const { data: link, error: linkErr } = await supabase
    .from('kyc_magic_links')
    .select('id, agency_id, status, kyc_case_id, contact_id')
    .eq('id', body.magic_link_id)
    .single()

  if (linkErr || !link) {
    return new Response(JSON.stringify({ error: 'Link not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (link.agency_id !== profile.agency_id) {
    return new Response(JSON.stringify({ error: 'forbidden: cross-agency access' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (link.status === 'submitted') {
    return new Response(
      JSON.stringify({ error: 'Cannot regenerate a submitted link' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Génère le nouveau token + update la row
  const exp = expiryFromDays(expirationDays)
  let newToken: string
  try {
    newToken = await signMagicLinkToken({ id: link.id, exp: exp.unix })
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'HMAC secret misconfigured',
        details: err instanceof Error ? err.message : 'unknown',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const { data: updated, error: updErr } = await supabase
    .from('kyc_magic_links')
    .update({
      token: newToken,
      status: 'pending',
      expires_at: exp.iso,
      sent_at: new Date().toISOString(),
      opened_at: null,
      uploaded_at: null,
      expired_at: null,
      client_ip: null,
      client_user_agent: null,
    })
    .eq('id', link.id)
    .select('id, status, expires_at, sent_at')
    .single()

  if (updErr || !updated) {
    return new Response(
      JSON.stringify({ error: 'regen update failed', details: updErr?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({
      magic_link_id: updated.id,
      token: newToken,
      url: `https://${PUBLIC_DOMAIN}/${newToken}`,
      expires_at: updated.expires_at,
      status: updated.status,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
