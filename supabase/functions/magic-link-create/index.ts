// supabase/functions/magic-link-create/index.ts
// POST /functions/v1/magic-link-create
//
// Sprint 4.7.A — Création d'un lien magique KYC par un agent.
//
// Input body :
//   {
//     kyc_case_id: string,
//     contact_id: string,
//     mode: 'libre' | 'verifiee',
//     channels: ('email' | 'sms')[],
//     custom_message?: string (max 500),
//     expiration_days?: number (default 7, max 30)
//   }
//
// Output (200) :
//   {
//     magic_link_id: string,
//     token: string,
//     url: string,                 // kyc.megga.ch/<token>
//     expires_at: string (ISO),
//     status: 'pending'
//   }
//
// L'envoi Email/SMS est délégué à Sprint 4.7.E — cette fonction se contente
// de créer la row + retourner le token. Le caller front lance l'envoi dans
// un 2e appel (ou un trigger DB qui pousse vers une queue).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { signMagicLinkToken, expiryFromDays } from '../_shared/magic-link-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateRequest {
  kyc_case_id: string
  contact_id: string
  mode?: 'libre' | 'verifiee'
  channels?: ('email' | 'sms')[]
  custom_message?: string | null
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
  const { user, profile, supabase } = auth

  let body: CreateRequest
  try {
    body = (await req.json()) as CreateRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Validation input
  if (!body.kyc_case_id || !body.contact_id) {
    return new Response(JSON.stringify({ error: 'kyc_case_id and contact_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const mode = body.mode ?? 'libre'
  if (mode !== 'libre' && mode !== 'verifiee') {
    return new Response(JSON.stringify({ error: 'mode must be libre or verifiee' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const channels = body.channels?.length ? body.channels : ['email']
  for (const c of channels) {
    if (c !== 'email' && c !== 'sms') {
      return new Response(JSON.stringify({ error: 'channels must be email/sms' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }
  const customMessage = body.custom_message?.trim()
  if (customMessage && customMessage.length > 500) {
    return new Response(JSON.stringify({ error: 'custom_message > 500 chars' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const expirationDays = Math.min(Math.max(body.expiration_days ?? 7, 1), 30)

  // Vérification que le kyc_case appartient bien à l'agence de l'agent
  const { data: kycCase, error: kycErr } = await supabase
    .from('kyc_cases')
    .select('id, agency_id, contact_id')
    .eq('id', body.kyc_case_id)
    .single()

  if (kycErr || !kycCase) {
    return new Response(JSON.stringify({ error: 'kyc_case_id not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (kycCase.agency_id !== profile.agency_id) {
    return new Response(JSON.stringify({ error: 'forbidden: cross-agency access' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  // Cohérence : le contact doit correspondre à celui du dossier
  if (kycCase.contact_id !== body.contact_id) {
    return new Response(
      JSON.stringify({ error: 'contact_id does not match kyc_case.contact_id' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Création de la row + token signé HMAC en 2 étapes :
  // 1. INSERT temporaire avec un token placeholder (pour récupérer l'UUID)
  // 2. UPDATE avec le token signé qui inclut l'UUID
  const placeholder = crypto.randomUUID()
  const exp = expiryFromDays(expirationDays)

  const { data: inserted, error: insertErr } = await supabase
    .from('kyc_magic_links')
    .insert({
      token: placeholder, // temporaire, remplacé juste après
      agency_id: profile.agency_id,
      kyc_case_id: body.kyc_case_id,
      contact_id: body.contact_id,
      mode,
      channels,
      custom_message: customMessage || null,
      expires_at: exp.iso,
      created_by: user.id,
    })
    .select('id, agency_id, mode, status, expires_at, sent_at')
    .single()

  if (insertErr || !inserted) {
    return new Response(
      JSON.stringify({ error: 'insert failed', details: insertErr?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  let token: string
  try {
    token = await signMagicLinkToken({ id: inserted.id, exp: exp.unix })
  } catch (err) {
    // Rollback : on supprime la row temporaire si la signature plante
    await supabase.from('kyc_magic_links').delete().eq('id', inserted.id)
    return new Response(
      JSON.stringify({
        error: 'HMAC secret misconfigured',
        details: err instanceof Error ? err.message : 'unknown',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const { error: updateErr } = await supabase
    .from('kyc_magic_links')
    .update({ token })
    .eq('id', inserted.id)

  if (updateErr) {
    await supabase.from('kyc_magic_links').delete().eq('id', inserted.id)
    return new Response(
      JSON.stringify({ error: 'token update failed', details: updateErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({
      magic_link_id: inserted.id,
      token,
      url: `https://${PUBLIC_DOMAIN}/${token}`,
      expires_at: inserted.expires_at,
      status: inserted.status,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
