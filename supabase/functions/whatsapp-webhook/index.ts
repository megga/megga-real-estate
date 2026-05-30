// supabase/functions/whatsapp-webhook/index.ts
// Réception des webhooks WhatsApp entrants (OpenWA en Phase 1).
// AUCUNE AUTH SUPABASE — validation via signature HMAC (x-openwa-signature).
//
// Pipeline : signature → parse (gateway) → map contact par numéro →
// insert idempotent whatsapp_messages → audit activity_events.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, verifyHmac, type SendConfig } from '../_shared/whatsapp-gateway.ts'
import { extractPairingCode, isPairingCodeValid } from '../_shared/whatsapp-agent-router.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-openwa-signature, x-openwa-idempotency-key, x-openwa-retry-count, x-openwa-delivery-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Handshake de vérification webhook Meta (GET) ──
  // Meta envoie ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… → on
  // renvoie le challenge si le token correspond. (OpenWA n'utilise jamais GET.)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? ''
    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
      return new Response(challenge ?? '', { status: 200, headers: corsHeaders })
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  // 1. Body brut + détection du provider via l'en-tête de signature
  const rawBody = await req.text()
  const metaSig = req.headers.get('x-hub-signature-256')
  const openwaSig = req.headers.get('x-openwa-signature')

  let providerName: 'meta' | 'openwa'
  let signatureValid: boolean
  if (metaSig) {
    // Meta : X-Hub-Signature-256 = sha256=HMAC-SHA256(app_secret, rawBody)
    providerName = 'meta'
    const appSecret = Deno.env.get('META_APP_SECRET') ?? ''
    if (!appSecret) {
      console.error('META_APP_SECRET not configured')
      return new Response('Server misconfigured', { status: 500, headers: corsHeaders })
    }
    signatureValid = await verifyHmac(rawBody, metaSig, appSecret)
  } else {
    // OpenWA : x-openwa-signature = sha256=HMAC-SHA256(webhook_secret, rawBody)
    providerName = 'openwa'
    const secret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET') ?? ''
    if (!secret) {
      console.error('WHATSAPP_WEBHOOK_SECRET not configured')
      return new Response('Server misconfigured', { status: 500, headers: corsHeaders })
    }
    signatureValid = await verifyHmac(rawBody, openwaSig ?? '', secret)
  }
  if (!signatureValid) return new Response('Invalid signature', { status: 401, headers: corsHeaders })

  // 2. Parse + normalisation via la couche gateway (provider détecté)
  let payload: unknown
  try { payload = JSON.parse(rawBody) } catch { return new Response('Bad JSON', { status: 400, headers: corsHeaders }) }
  const provider = getProvider(providerName)
  const msg = provider.parseInbound(payload)
  if (!msg) {
    return new Response(JSON.stringify({ ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── 2bis. Résolution d'expéditeur AGENT (Phase 3) — AVANT la branche client ──
  // Si le numéro est un agent vérifié → MEGGA AI répond (lecture seule).
  // Si le corps est un code d'appairage en attente → on lie le compte.
  // Sinon → on tombe dans la branche client (étape 3 ci-dessous).
  {
    // a) Agent déjà vérifié ?
    const { data: agentLink } = await admin
      .from('whatsapp_agent_links')
      .select('profile_id, agency_id, verified')
      .eq('wa_number', msg.fromPhone)
      .eq('verified', true)
      .maybeSingle()

    if (agentLink) {
      // Log inbound de l'agent (pas de contact_id).
      await admin.from('whatsapp_messages').upsert({
        provider: provider.name,
        provider_message_id: msg.providerMessageId,
        session_id: msg.sessionId,
        direction: 'inbound',
        wa_from: msg.fromPhone,
        wa_to: msg.toPhone,
        agency_id: agentLink.agency_id,
        body: msg.body,
        media_type: msg.mediaType,
        status: 'received',
        wa_timestamp: msg.timestamp,
        raw: msg.raw,
      }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })

      // MEGGA AI (ai-copilot) avec l'identité agence de l'agent. action 'chat'
      // exige un Bearer → service-role. La réponse texte est dans `result`.
      let reply = "Désolé, je n'ai pas pu traiter votre demande pour le moment."
      try {
        const aiRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-copilot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            action: 'chat',
            message: msg.body ?? '',
            context: { agency_id: agentLink.agency_id },
            language: 'fr',
          }),
        })
        const aiData = await aiRes.json().catch(() => ({}))
        // ai-copilot renvoie { result, action, usage } — le texte est dans `result`.
        if (aiData?.result) reply = String(aiData.result)
      } catch (err) {
        console.error('ai-copilot call failed:', err)
      }

      // Renvoyer la réponse sur le WhatsApp de l'agent (fenêtre 24h ouverte).
      const sendConfig: SendConfig = {
        metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
        metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
        metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
      }
      const sendReq = provider.buildSendTextRequest({ toPhone: msg.fromPhone, body: reply }, sendConfig)
      let outId: string | null = null
      try {
        const sres = await fetch(sendReq.url, { method: sendReq.method, headers: sendReq.headers, body: sendReq.body })
        const sbody = await sres.json().catch(() => ({}))
        outId = provider.parseSendResult(sres.status, sbody).providerMessageId
      } catch (err) {
        console.error('whatsapp agent reply send failed:', err)
      }

      // Log outbound + audit (best-effort).
      await admin.from('whatsapp_messages').upsert({
        provider: provider.name,
        provider_message_id: outId ?? `local-agent-${msg.providerMessageId}`,
        direction: 'outbound',
        wa_from: sendConfig.metaPhoneNumberId ?? 'megga',
        wa_to: msg.fromPhone,
        agency_id: agentLink.agency_id,
        body: reply,
        status: 'received',
      }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })

      try {
        await admin.from('activity_events').insert({
          agency_id: agentLink.agency_id,
          actor_id: agentLink.profile_id,
          actor_kind: 'ai',
          action: 'whatsapp_agent_copilot_reply',
          entity_type: 'whatsapp_message',
          category: 'messaging',
        })
      } catch { /* non bloquant */ }

      return new Response(JSON.stringify({ ok: true, routed: 'agent' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // b) Code d'appairage en attente ?
    const code = extractPairingCode(msg.body)
    if (code) {
      const { data: pending } = await admin
        .from('whatsapp_agent_links')
        .select('id, pairing_expires_at')
        .eq('pairing_code', code)
        .eq('verified', false)
        .maybeSingle()

      if (pending && isPairingCodeValid(pending.pairing_expires_at)) {
        await admin
          .from('whatsapp_agent_links')
          .update({ wa_number: msg.fromPhone, verified: true, pairing_code: null, verified_at: new Date().toISOString() })
          .eq('id', pending.id)

        const sendConfig: SendConfig = {
          metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
          metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
          metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
        }
        const okMsg = '✅ Votre WhatsApp est lié à MEGGA. Posez-moi vos questions : « Mes RDV demain ? », « Résume le dossier Dubois »…'
        const sreq = provider.buildSendTextRequest({ toPhone: msg.fromPhone, body: okMsg }, sendConfig)
        try { await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body }) } catch { /* */ }

        return new Response(JSON.stringify({ ok: true, routed: 'pairing' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // Code présent mais invalide/expiré : un code n'est pas un message client.
      return new Response(JSON.stringify({ ok: true, routed: 'pairing_invalid' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }
  // ── fin routage agent — sinon, branche client ci-dessous ──

  // 3. Mapping best-effort : numéro → contact (et son agence)
  let contactId: string | null = null
  let agencyId: string | null = null
  try {
    const tail = msg.fromPhone.slice(-9)
    const { data: contact } = await admin
      .from('contacts')
      .select('id, agency_id')
      .ilike('phone', `%${tail}`)
      .limit(1)
      .maybeSingle()
    if (contact) { contactId = contact.id; agencyId = contact.agency_id }
  } catch { /* mapping best-effort, non bloquant */ }

  // 4. Insert idempotent (ON CONFLICT via upsert sur la contrainte unique)
  const { error: insErr } = await admin
    .from('whatsapp_messages')
    .upsert({
      provider: provider.name,
      provider_message_id: msg.providerMessageId,
      session_id: msg.sessionId,
      direction: 'inbound',
      wa_from: msg.fromPhone,
      wa_to: msg.toPhone,
      contact_id: contactId,
      agency_id: agencyId,
      body: msg.body,
      media_type: msg.mediaType,
      media_url: msg.mediaUrl,
      status: 'received',
      wa_timestamp: msg.timestamp,
      raw: msg.raw,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })

  if (insErr) {
    console.error('whatsapp_messages insert error:', insErr.message)
    return new Response('DB error', { status: 500, headers: corsHeaders })
  }

  // 5. Audit (best-effort, non bloquant). Colonnes vérifiées sur activity_events.
  try {
    await admin.from('activity_events').insert({
      agency_id: agencyId,
      actor_id: null,
      actor_kind: 'system',
      action: 'whatsapp_message_received',
      entity_type: contactId ? 'contact' : 'whatsapp_message',
      entity_id: contactId,
      category: 'messaging',
    })
  } catch { /* non bloquant */ }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
