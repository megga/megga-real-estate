// supabase/functions/whatsapp-webhook/index.ts
// Réception des webhooks WhatsApp entrants (OpenWA en Phase 1).
// AUCUNE AUTH SUPABASE — validation via signature HMAC (x-openwa-signature).
//
// Pipeline : signature → parse (gateway) → map contact par numéro →
// insert idempotent whatsapp_messages → audit activity_events.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, verifyHmac, type SendConfig } from '../_shared/whatsapp-gateway.ts'
import { extractPairingCode, isPairingCodeValid, parseConfirmation, isPendingActionValid } from '../_shared/whatsapp-agent-router.ts'
import { fetchMetaMedia } from '../_shared/whatsapp-media.ts'
import { transcribe } from '../_shared/whatsapp-transcribe.ts'

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
      // Dédup : insert inbound idempotent ; si rejeu Meta, on s'arrête (pas de double action).
      const { data: insertedRows } = await admin.from('whatsapp_messages').upsert({
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
        .select('id')
      if (!insertedRows || insertedRows.length === 0) {
        return new Response(JSON.stringify({ ok: true, routed: 'agent_duplicate' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // F12/F6 : ACK Meta IMMÉDIATEMENT. Le cerveau IA + l'envoi peuvent prendre
      // plusieurs secondes ; si on attend avant de répondre 200, Meta considère l'event
      // en échec et REJOUE (tempête de rejeux + double traitement). On traite donc en
      // tâche de fond (EdgeRuntime.waitUntil garde l'instance vivante après la réponse).
      const bg = processAgentMessage(admin, provider, agentLink, msg)
      const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
      if (edge?.waitUntil) edge.waitUntil(bg)
      else await bg // fallback (local/typecheck) : pas de waitUntil disponible

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
        try { await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) }) } catch { /* */ }

        return new Response(JSON.stringify({ ok: true, routed: 'pairing' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // Code à 6 chiffres mais SANS correspondance en attente : ce n'était pas un
      // appairage. On NE court-circuite PAS — on laisse filer vers la branche client
      // (sinon un vrai message client réductible à 6 chiffres serait perdu).
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

  // Repli : numéro inconnu => rattacher à une agence par défaut si configurée,
  // sinon log (le message reste en base mais sans agence = invisible en CRM).
  if (!agencyId) {
    const fallback = Deno.env.get('WHATSAPP_FALLBACK_AGENCY_ID')
    if (fallback) agencyId = fallback
    else console.warn('whatsapp inbound: numéro inconnu, message sans agence:', msg.fromPhone.slice(-4))
  }

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
      media_id: msg.mediaId,
      media_mime: msg.mediaMime,
      // L1 : un entrant avec média à récupérer passe en file de traitement.
      processing_status: msg.mediaId ? 'pending' : 'done',
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

// ── Helpers Phase 4A ────────────────────────────────────────────────
// Traitement de fond d'un message agent (appelé via EdgeRuntime.waitUntil) :
// gère l'action en attente (confirm) OU appelle le cerveau, puis envoie la réponse.
async function processAgentMessage(
  admin: SupabaseClient,
  provider: ReturnType<typeof getProvider>,
  agentLink: { profile_id: string; agency_id: string | null },
  msg: { fromPhone: string; body: string | null; providerMessageId: string; mediaId: string | null; mediaType: string | null },
): Promise<void> {
  let reply = "Désolé, je n'ai pas pu traiter ta demande pour le moment."

  // C2 : voix sur le chemin agent — si l'agent envoie un vocal, on le transcrit AVANT
  // de traiter (Deepgram), et on stocke le transcript sur le message (historique C1 + audit).
  let userText = (msg.body ?? '').trim()
  if (!userText && msg.mediaId && msg.mediaType === 'audio') {
    try {
      const { bytes, mime } = await fetchMetaMedia(msg.mediaId, {
        metaToken: Deno.env.get('META_WHATSAPP_TOKEN') ?? '',
        apiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
      })
      const t = await transcribe(bytes, mime, Deno.env.get('DEEPGRAM_API_KEY') ?? '')
      userText = (t.transcript ?? '').trim()
      if (userText) {
        await admin.from('whatsapp_messages')
          .update({ transcript: userText, transcript_lang: t.lang })
          .eq('provider', provider.name).eq('provider_message_id', msg.providerMessageId)
      }
    } catch (err) {
      console.error('whatsapp agent voice transcription failed:', (err as Error)?.name ?? 'error')
    }
  }

  const { data: pendingAction } = await admin
    .from('whatsapp_pending_actions')
    .select('id, tool, args, summary, expires_at')
    .eq('profile_id', agentLink.profile_id)
    .maybeSingle()

  if (pendingAction) {
    const decision = parseConfirmation(userText)
    const valid = isPendingActionValid(pendingAction.expires_at)
    // F3 : consommation gagnant-unique. Deux « oui » concurrents lisent la même ligne ;
    // un seul DELETE renvoie une ligne → seul lui exécute/répond, l'autre s'arrête.
    const { data: claimed } = await admin
      .from('whatsapp_pending_actions').delete().eq('id', pendingAction.id).select('id')
    if (!claimed || claimed.length === 0) return // une autre invocation gère cette attente
    if (decision === 'yes' && valid) {
      reply = await executePending(admin, provider, agentLink, pendingAction)
    } else if (decision === 'no') {
      reply = "C'est annulé, je n'ai rien envoyé."
    } else if (!valid) {
      reply = 'La demande en attente a expiré. Redis-moi ce que tu veux faire.'
    } else {
      // F18 : message non lié alors qu'une action attendait → on l'écarte et on le DIT.
      const brain = await callAgentBrain(agentLink, msg, userText)
      reply = `(J'ai mis de côté l'action en attente, non confirmée.)\n\n${brain}`
    }
  } else {
    reply = await callAgentBrain(agentLink, msg, userText)
  }

  // Envoi de la réponse à l'agent (fenêtre 24h ouverte) + log outbound + audit.
  const sendConfig: SendConfig = {
    metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
    metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
    metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
  }
  const sendReq = provider.buildSendTextRequest({ toPhone: msg.fromPhone, body: reply }, sendConfig)
  let outId: string | null = null
  try {
    const sres = await fetch(sendReq.url, { method: sendReq.method, headers: sendReq.headers, body: sendReq.body, signal: AbortSignal.timeout(8000) })
    const sbody = await sres.json().catch(() => ({}))
    outId = provider.parseSendResult(sres.status, sbody).providerMessageId
  } catch (err) {
    console.error('whatsapp agent reply send failed:', (err as Error)?.name ?? 'error')
  }

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
}

// Appelle le cerveau agentique (whatsapp-agent) en service-role et renvoie son texte.
// agencyId N'EST PAS transmis : l'agent le re-dérive depuis le lien vérifié (anti-forge).
async function callAgentBrain(
  agentLink: { profile_id: string; agency_id: string | null },
  msg: { fromPhone: string; body: string | null; providerMessageId: string },
  messageText: string,
): Promise<string> {
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        profileId: agentLink.profile_id,
        waNumber: msg.fromPhone,
        message: messageText,
        currentMessageId: msg.providerMessageId,
      }),
      signal: AbortSignal.timeout(90_000), // tâche de fond : large, mais jamais infini
    })
    const data = await r.json().catch(() => ({}))
    return (data?.reply as string) || "Désolé, je n'ai pas pu traiter ta demande."
  } catch (err) {
    console.error('whatsapp-agent call failed:', (err as Error)?.name ?? 'error')
    return "Désolé, je n'ai pas pu traiter ta demande pour le moment."
  }
}

// Exécute une action confirmée (Phase 4A : send_client_message). Garde agence AU SQL.
async function executePending(
  admin: SupabaseClient,
  provider: ReturnType<typeof getProvider>,
  agentLink: { profile_id: string; agency_id: string | null },
  pending: { tool: string; args: Record<string, unknown> },
): Promise<string> {
  if (pending.tool === 'send_client_message') {
    if (!agentLink.agency_id) return "Ton compte n'a pas d'agence, envoi impossible."
    const contactId = String(pending.args.contact_id ?? '')
    const text = String(pending.args.body ?? '')
    if (!contactId || !text) return "Action incomplète, je n'ai rien envoyé."
    // Garde agence au niveau SQL : pas de match (ou agency_id NULL) => introuvable.
    const { data: contact } = await admin
      .from('contacts').select('id, phone')
      .eq('id', contactId)
      .eq('agency_id', agentLink.agency_id)
      .maybeSingle()
    if (!contact || !contact.phone) return 'Contact introuvable dans ton agence, rien envoyé.'
    const sendConfig: SendConfig = {
      metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
      metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
      metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
    }
    const sreq = provider.buildSendTextRequest({ toPhone: String(contact.phone).replace(/\D/g, ''), body: text }, sendConfig)
    try {
      const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
      if (!sres.ok) return "L'envoi au client a échoué (fenêtre 24h ou numéro non autorisé ?)."
    } catch { return "L'envoi au client a échoué (réseau)." }
    try {
      await admin.from('activity_events').insert({
        agency_id: agentLink.agency_id, actor_id: agentLink.profile_id, actor_kind: 'ai',
        action: 'whatsapp_ai_send_client_message', entity_type: 'contact', entity_id: contactId, category: 'messaging',
      })
    } catch { /* non bloquant */ }
    return '✅ Message envoyé au client.'
  }
  return "Type d'action inconnu, rien fait."
}
