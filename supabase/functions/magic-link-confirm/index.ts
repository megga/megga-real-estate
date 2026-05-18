// supabase/functions/magic-link-confirm/index.ts
// POST /functions/v1/magic-link-confirm?token=<token>
//
// Sprint 4.7.A — Endpoint PUBLIC (sans auth) — confirmation finale du client.
//
// Le client clique "Tout confirmer et envoyer" → on marque le lien comme
// `submitted` et on bascule le KycDossier en `to-review` pour que l'agent
// puisse valider les pièces et débloquer le pipeline.
//
// Optionnel body :
//   { confirmations: { upload_id: string }[] }  // pour confirmer chaque pièce
//
// Output (200) :
//   { status: 'submitted', confirmed_at: ISO, magic_link_id: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ConfirmBody {
  confirmations?: { upload_id: string }[]
}

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

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return new Response(JSON.stringify({ error: 'token query param required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const verify = await verifyMagicLinkToken(token)
  if (!verify.valid || !verify.payload) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired link', reason: verify.reason }),
      { status: verify.reason === 'expired' ? 410 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  const magicLinkId = verify.payload.id

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Charge le lien
  const { data: link, error: linkErr } = await supabase
    .from('kyc_magic_links')
    .select('id, token, agency_id, kyc_case_id, status, expires_at')
    .eq('id', magicLinkId)
    .single()

  if (linkErr || !link) {
    return new Response(JSON.stringify({ error: 'Link not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (link.token !== token) {
    return new Response(JSON.stringify({ error: 'Token superseded' }), {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (new Date(link.expires_at) <= new Date()) {
    await supabase
      .from('kyc_magic_links')
      .update({ status: 'expired', expired_at: new Date().toISOString() })
      .eq('id', magicLinkId)
    return new Response(JSON.stringify({ error: 'Link expired' }), {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (link.status === 'submitted') {
    // Idempotent : pas d'erreur, on retourne le status actuel
    return new Response(
      JSON.stringify({ status: 'submitted', magic_link_id: link.id, idempotent: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Vérifie qu'il y a au moins 1 upload (sinon "submit vide" — refus)
  const { count: uploadsCount } = await supabase
    .from('kyc_magic_link_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('magic_link_id', link.id)

  if (!uploadsCount || uploadsCount === 0) {
    return new Response(
      JSON.stringify({ error: 'Aucune pièce uploadée — impossible de confirmer' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Parse body optionnel (confirmations par pièce)
  let body: ConfirmBody = {}
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      body = (await req.json()) as ConfirmBody
    }
  } catch {
    // pas grave — body optionnel
  }

  const confirmedAt = new Date().toISOString()

  // Marque toutes les pièces confirmées (ou seulement celles passées en body)
  if (Array.isArray(body.confirmations) && body.confirmations.length > 0) {
    const uploadIds = body.confirmations.map((c) => c.upload_id).filter((x) => typeof x === 'string')
    if (uploadIds.length > 0) {
      await supabase
        .from('kyc_magic_link_uploads')
        .update({ confirmed_by_client: true, confirmed_at: confirmedAt })
        .in('id', uploadIds)
        .eq('magic_link_id', link.id)
    }
  } else {
    // Pas de granularité — confirme toutes les pièces du lien
    await supabase
      .from('kyc_magic_link_uploads')
      .update({ confirmed_by_client: true, confirmed_at: confirmedAt })
      .eq('magic_link_id', link.id)
  }

  // Transition status → submitted
  const { error: updErr } = await supabase
    .from('kyc_magic_links')
    .update({ status: 'submitted', confirmed_at: confirmedAt })
    .eq('id', link.id)

  if (updErr) {
    return new Response(
      JSON.stringify({ error: 'submit update failed', details: updErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Bascule le KycDossier en 'pending' (mode 'to-review' — l'agent doit valider).
  // Si le dossier était 'none' (jamais ouvert), on passe à 'pending'.
  // Si déjà 'verified' / 'failed', on ne touche pas (cas legacy).
  await supabase
    .from('kyc_cases')
    .update({ dossier_status: 'pending' })
    .eq('id', link.kyc_case_id)
    .in('dossier_status', ['none', 'pending'])

  return new Response(
    JSON.stringify({
      status: 'submitted',
      magic_link_id: link.id,
      confirmed_at: confirmedAt,
      uploads_confirmed: uploadsCount,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
