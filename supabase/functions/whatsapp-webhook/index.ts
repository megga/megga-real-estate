// supabase/functions/whatsapp-webhook/index.ts
// Réception des webhooks WhatsApp entrants (OpenWA en Phase 1).
// AUCUNE AUTH SUPABASE — validation via signature HMAC (x-openwa-signature).
//
// Pipeline : signature → parse (gateway) → map contact par numéro →
// insert idempotent whatsapp_messages → audit activity_events.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, verifyHmac, type SendConfig } from '../_shared/whatsapp-gateway.ts'
import { extractPairingCode, isPairingCodeValid, parseConfirmation, isPendingActionValid, isUndoCommand, stageLabel } from '../_shared/whatsapp-agent-router.ts'
import { fetchMetaMedia } from '../_shared/whatsapp-media.ts'
import { transcribe } from '../_shared/whatsapp-transcribe.ts'
import { readDocument } from '../_shared/vision.ts'
import { toWhatsAppText } from '../_shared/whatsapp-format.ts'
import { execUpdatePipeline, executeRecordOffer, executeOpenKycCase, executeSendKycLink, executeSendClientEmail, type ActionCtx } from '../_shared/whatsapp-actions.ts'
import { asWaLang, detectLang, t, type WaLang, undoneStage, undoneAuto, undoNoun } from '../_shared/whatsapp-i18n.ts'

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
      category: 'contact', // 'messaging' n'est pas dans activity_events_category_check
      severity: 'info',
    })
  } catch { /* non bloquant */ }

  // Coches bleues côté client : son message est vu par l'agence (pas de « typing » —
  // MEGGA ne répond pas automatiquement au client, capture seule / human-in-the-loop).
  await markRead(provider, msg.providerMessageId, false)

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
  // Coches bleues + « typing… » dès réception : l'agent voit que MEGGA a lu et prépare.
  await markRead(provider, msg.providerMessageId, true)
  let reply = "Désolé, je n'ai pas pu traiter ta demande pour le moment."
  let replyIsError = false

  // C2 : voix sur le chemin agent — si l'agent envoie un vocal, on le transcrit AVANT
  // de traiter (Deepgram), et on stocke le transcript sur le message (historique C1 + audit).
  let userText = (msg.body ?? '').trim()
  // Texte du document entrant déjà extrait (OCR Gemini ci-dessous) — transmis tel quel à l'agent
  // pour que les outils read_document / file_document le réutilisent sans re-fetch Meta ni 2e OCR.
  let inboundDocText: string | null = null
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

  // Lecture de document/image (Gemini Vision) : si l'agent envoie une capture, une photo
  // ou un PDF, MEGGA en lit le contenu et l'ajoute au message — MÊME s'il y a une légende
  // (« ajoute ça aux notes de X » + screenshot). Texte extrait stocké comme transcript
  // (audit + historique C1). read_document est provider-swappable (_shared/vision.ts).
  if (msg.mediaId && (msg.mediaType === 'image' || msg.mediaType === 'document')) {
    try {
      const { bytes, mime } = await fetchMetaMedia(msg.mediaId, {
        metaToken: Deno.env.get('META_WHATSAPP_TOKEN') ?? '',
        apiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
      })
      const doc = await readDocument(bytes, mime, Deno.env.get('GEMINI_API_KEY') ?? '', {
        model: Deno.env.get('GEMINI_MODEL') || undefined,
      })
      if (doc.ok && doc.text) {
        const extract = doc.text.trim().slice(0, 6000)
        inboundDocText = extract // réutilisé par read_document / file_document (pas de 2e OCR)
        userText = userText
          ? `${userText}\n\n[Document reçu — contenu lu]:\n${extract}`
          : `[Document reçu — contenu lu]:\n${extract}`
        await admin.from('whatsapp_messages')
          .update({ transcript: extract })
          .eq('provider', provider.name).eq('provider_message_id', msg.providerMessageId)
      }
    } catch (err) {
      console.error('whatsapp agent document read failed:', (err as Error)?.name ?? 'error')
    }
  }

  // L3 — undo différé : « /annuler » dans la fenêtre rejoue le dernier payload_undo.
  // Placé AVANT la gestion des pending (une action venant de partir en auto prime).
  if (isUndoCommand(userText)) {
    const { data: last } = await admin
      .from('whatsapp_recent_auto_actions')
      .select('id, tool, payload_undo, undo_until')
      .eq('profile_id', agentLink.profile_id)
      .is('undone_at', null)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    const lang = detectLang(userText)
    if (last && Date.parse(last.undo_until) > Date.now()) {
      // Consommation gagnant-unique (anti double-undo) : on pose undone_at en filtrant NULL.
      const { data: claimed } = await admin.from('whatsapp_recent_auto_actions')
        .update({ undone_at: new Date().toISOString() })
        .eq('id', last.id).is('undone_at', null).select('id')
      if (claimed && claimed.length > 0) {
        const undoReply = await rollbackAutoAction(admin, agentLink, last as UndoRow, lang)
        if (undoReply) {
          await sendWhatsAppText(provider, msg.fromPhone, undoReply)
          return
        }
        // Rollback impossible OU outil sans branche : LIBÉRER le verrou pour ne pas brûler le
        // slot (un /annuler honnête doit pouvoir re-tenter). On NE return PAS : flux normal.
        await admin.from('whatsapp_recent_auto_actions').update({ undone_at: null }).eq('id', last.id)
      }
    }
    // Rien d'annulable : on NE return PAS — le message suit le flux normal (le cerveau répondra).
  }

  const { data: pendingAction } = await admin
    .from('whatsapp_pending_actions')
    .select('id, tool, args, summary, expires_at')
    .eq('profile_id', agentLink.profile_id)
    .maybeSingle()

  if (pendingAction) {
    const decision = parseConfirmation(userText)
    const valid = isPendingActionValid(pendingAction.expires_at)
    const lang = asWaLang((pendingAction.args as Record<string, unknown>)?.__lang)
    // F3 : consommation gagnant-unique. Deux « oui » concurrents lisent la même ligne ;
    // un seul DELETE renvoie une ligne → seul lui exécute/répond, l'autre s'arrête.
    const { data: claimed } = await admin
      .from('whatsapp_pending_actions').delete().eq('id', pendingAction.id).select('id')
    if (!claimed || claimed.length === 0) return // une autre invocation gère cette attente
    if (decision === 'yes' && valid) {
      try {
        await admin.from('whatsapp_confirmation_log').insert({
          profile_id: agentLink.profile_id, agency_id: agentLink.agency_id,
          tool: pendingAction.tool as string, outcome: 'yes',
        })
      } catch { /* journal non bloquant */ }
      reply = await executePending(admin, provider, agentLink, pendingAction, lang)
    } else if (decision === 'no') {
      try {
        await admin.from('whatsapp_confirmation_log').insert({
          profile_id: agentLink.profile_id, agency_id: agentLink.agency_id,
          tool: pendingAction.tool as string, outcome: 'no',
        })
      } catch { /* journal non bloquant */ }
      reply = t(lang, 'cancelled')
    } else if (!valid) {
      reply = t(lang, 'expired')
    } else {
      // F18 : message non lié alors qu'une action attendait → on l'écarte et on le DIT.
      const brain = await callAgentBrain(agentLink, msg, userText, lang, inboundDocText)
      reply = `${t(lang, 'setAside')}\n\n${brain.reply}`
      replyIsError = brain.isError
    }
  } else {
    const brain = await callAgentBrain(agentLink, msg, userText, detectLang(userText), inboundDocText)
    reply = brain.reply
    replyIsError = brain.isError
  }

  // Envoi de la réponse à l'agent (fenêtre 24h ouverte) + log outbound + audit.
  const sendConfig: SendConfig = {
    metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
    metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
    metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
  }
  const outText = toWhatsAppText(reply) // Markdown DeepSeek (**gras**) → syntaxe WhatsApp (*gras*)
  const sendReq = provider.buildSendTextRequest({ toPhone: msg.fromPhone, body: outText }, sendConfig)
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
    body: outText,
    status: 'received',
    is_agent_error: replyIsError,
  }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })

  try {
    await admin.from('activity_events').insert({
      agency_id: agentLink.agency_id,
      actor_id: null, // coherence : actor_kind 'ai' => actor_id NULL ; agent en metadata
      actor_kind: 'ai',
      action: 'whatsapp_agent_copilot_reply',
      entity_type: 'whatsapp_message',
      category: 'ai',
      severity: 'info',
      metadata: { via: 'whatsapp', profile_id: agentLink.profile_id },
    })
  } catch { /* non bloquant */ }
}

// Appelle le cerveau agentique (whatsapp-agent) en service-role et renvoie son texte.
// agencyId N'EST PAS transmis : l'agent le re-dérive depuis le lien vérifié (anti-forge).
async function callAgentBrain(
  agentLink: { profile_id: string; agency_id: string | null },
  msg: { fromPhone: string; body: string | null; providerMessageId: string; mediaId: string | null; mediaType: string | null },
  messageText: string,
  lang: WaLang,
  inboundDocText: string | null = null,
): Promise<{ reply: string; isError: boolean }> {
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
        // ocrText : texte du document déjà lu par le webhook (réutilisé par read_document /
        // file_document sans re-fetch Meta ni 2e OCR). null si la pièce n'a rien donné.
        inboundMedia:
          msg.mediaId && (msg.mediaType === 'image' || msg.mediaType === 'document')
            ? { mediaId: msg.mediaId, messageId: msg.providerMessageId, ocrText: inboundDocText }
            : null,
      }),
      signal: AbortSignal.timeout(90_000), // tâche de fond : large, mais jamais infini
    })
    const data = await r.json().catch(() => ({}))
    const reply = (data?.reply as string) || t(lang, 'cantProcess')
    // isError si l'agent l'a flaggé OU s'il n'a renvoyé aucun reply (échec/HTTP KO) :
    // dans les deux cas la réponse est dégradée → exclue de la mémoire C1 (anti-écho).
    return { reply, isError: !!data?.isError || !data?.reply }
  } catch (err) {
    console.error('whatsapp-agent call failed:', (err as Error)?.name ?? 'error')
    return { reply: t(lang, 'cantProcessNow'), isError: true }
  }
}

// Envoi d'un texte WhatsApp à un numéro (fenêtre 24h requise, sinon template Meta).
async function sendWhatsAppText(
  provider: ReturnType<typeof getProvider>, toPhone: string, body: string,
): Promise<boolean> {
  const sendConfig: SendConfig = {
    metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
    metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
    metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
  }
  const sreq = provider.buildSendTextRequest({ toPhone, body: toWhatsAppText(body) }, sendConfig)
  try {
    const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
    return sres.ok
  } catch { return false }
}

// Accusé de lecture (coches bleues) + « typing… » optionnel. Best-effort, Meta only
// (buildMarkReadRequest absent sur OpenWA → no-op via l'appel optionnel).
async function markRead(
  provider: ReturnType<typeof getProvider>, messageId: string, typing: boolean,
): Promise<void> {
  const config: SendConfig = {
    metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
    metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
    metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
  }
  const req = provider.buildMarkReadRequest?.(messageId, config, { typing })
  if (!req) return
  try {
    await fetch(req.url, { method: req.method, headers: req.headers, body: req.body, signal: AbortSignal.timeout(5000) })
  } catch (err) {
    console.error('whatsapp mark-read failed:', (err as Error)?.name ?? 'error')
  }
}

type UndoRow = { id: string; tool: string; payload_undo: unknown }

/** Rejoue le payload_undo d'une action auto. Renvoie le texte de confirmation, ou null si
 *  l'outil n'a pas de branche de rollback (→ le handler relâche le verrou, slot non brûlé).
 *  N'est appelé QUE sur un undo déjà réclamé (gagnant-unique). */
async function rollbackAutoAction(
  admin: SupabaseClient, agentLink: { profile_id: string; agency_id: string | null }, row: UndoRow, lang: WaLang,
): Promise<string | null> {
  const agencyId = agentLink.agency_id
  const p = (row.payload_undo ?? {}) as Record<string, unknown>
  // category ∈ {kyc,deal,contact,bien,doc,auth,settings,ai}. 'deal' pour une transaction
  // (cohérent P3), 'contact' pour les écritures liées contact.
  const audit = async (category: string, entityType: string, entityId: string | null, label: string) => {
    await admin.from('activity_events').insert({
      agency_id: agencyId, actor_id: null, actor_kind: 'ai',
      action: 'wa_undo', entity_type: entityType, entity_id: entityId,
      object_label: label.slice(0, 500), category, severity: 'info',
      metadata: { via: 'whatsapp', mode: 'undo', profile_id: agentLink.profile_id, tool: row.tool },
    })
  }

  if (row.tool === 'update_pipeline') {
    const tx = String(p.transaction_id ?? ''), old = String(p.old_stage ?? '')
    if (!tx || !old) return null
    // Revert via la RPC d'attribution (GUC 'ai' + via='whatsapp') pour que le
    // stage_change émis par le trigger trg_transaction_lifecycle garde l'attribution
    // MEGGA AI, cohérente avec l'aller. RETURNS integer = nb de lignes affectées.
    const { data: moved, error } = await admin.rpc('wa_move_transaction_stage', {
      p_transaction_id: tx, p_stage: old, p_agency_id: agencyId, p_profile_id: agentLink.profile_id,
    })
    if (error) { console.error('undo update_pipeline failed:', error.message.slice(0, 120)); return null }
    if (!moved || moved === 0) return null  // rien d'affecté (déjà supprimé / autre agence) → pas de fausse confirmation
    await audit('deal', 'transaction', tx, `undo → ${old}`)  // 'deal' = cohérent avec le P3
    return undoneStage(lang, stageLabel(old, lang))
  }
  if (row.tool === 'create_contact') {
    const id = String(p.contact_id ?? ''); if (!id) return null
    const { data: done, error } = await admin.from('contacts').delete().eq('id', id).eq('agency_id', agencyId).select('id')
    if (error) { console.error('undo create_contact failed:', error.message.slice(0, 120)); return null }
    if (!done || done.length === 0) return null  // rien d'affecté (déjà supprimé / autre agence) → pas de fausse confirmation
    await audit('contact', 'contact', null, 'undo création contact')
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
  if (row.tool === 'schedule_visit') {
    const id = String(p.visit_id ?? ''); if (!id) return null
    const { data: done, error } = await admin.from('visits').delete().eq('id', id).eq('agency_id', agencyId).select('id')
    if (error) { console.error('undo schedule_visit failed:', error.message.slice(0, 120)); return null }
    if (!done || done.length === 0) return null  // rien d'affecté (déjà supprimé / autre agence) → pas de fausse confirmation
    await audit('contact', 'visit', id, 'undo visite')
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
  if (row.tool === 'create_reminder') {
    const id = String(p.reminder_id ?? ''); if (!id) return null
    const { data: done, error } = await admin.from('reminders').delete().eq('id', id).eq('agency_id', agencyId).select('id')
    if (error) { console.error('undo create_reminder failed:', error.message.slice(0, 120)); return null }
    if (!done || done.length === 0) return null  // rien d'affecté (déjà supprimé / autre agence) → pas de fausse confirmation
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
  if (row.tool === 'qualify_lead') {
    const cid = String(p.contact_id ?? ''); if (!cid) return null
    // Cohérence (tout ou rien) : supprimer d'abord la recherche créée, puis restaurer le contact.
    if (p.created_search_id) {
      const { error: dErr } = await admin.from('client_searches').delete().eq('id', String(p.created_search_id)).eq('agency_id', agencyId)
      if (dErr) { console.error('undo qualify_lead (search) failed:', dErr.message.slice(0, 120)); return null }
    }
    const { data: done, error: uErr } = await admin.from('contacts')
      .update({ tags: (p.old_tags ?? []) as unknown, search_criteria: p.old_search_criteria ?? null })
      .eq('id', cid).eq('agency_id', agencyId).select('id')
    if (uErr) { console.error('undo qualify_lead (contacts) failed:', uErr.message.slice(0, 120)); return null }
    if (!done || done.length === 0) return null
    await audit('contact', 'contact', cid, 'undo qualification')
    return undoneAuto(lang, undoNoun(lang, row.tool))
  }
  return null // outil sans branche → le handler relâchera le verrou
}

// Exécute une action confirmée (send_client_message, update_pipeline, record_offer,
// send_listings). Garde agence AU SQL ou via l'exécuteur partagé.
async function executePending(
  admin: SupabaseClient,
  provider: ReturnType<typeof getProvider>,
  agentLink: { profile_id: string; agency_id: string | null },
  pending: { tool: string; args: Record<string, unknown> },
  lang: WaLang,
): Promise<string> {
  if (pending.tool === 'send_client_message') {
    if (!agentLink.agency_id) return t(lang, 'noAgencySend')
    const contactId = String(pending.args.contact_id ?? '')
    const text = String(pending.args.body ?? '')
    if (!contactId || !text) return t(lang, 'actionIncompleteSend')
    // Garde agence au niveau SQL : pas de match (ou agency_id NULL) => introuvable.
    const { data: contact } = await admin
      .from('contacts').select('id, phone')
      .eq('id', contactId)
      .eq('agency_id', agentLink.agency_id)
      .maybeSingle()
    if (!contact || !contact.phone) return t(lang, 'contactNotFoundSend')
    const sendConfig: SendConfig = {
      metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
      metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
      metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
    }
    const sreq = provider.buildSendTextRequest({ toPhone: String(contact.phone).replace(/\D/g, ''), body: toWhatsAppText(text) }, sendConfig)
    let outId: string | null = null
    try {
      const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
      if (!sres.ok) return t(lang, 'sendFail24h')
      const sbody = await sres.json().catch(() => ({}))
      outId = provider.parseSendResult(sres.status, sbody).providerMessageId
    } catch { return t(lang, 'sendFailNet') }
    // Persiste le message client envoyé (fil + corpus de voix). Idempotent, non bloquant.
    await admin.from('whatsapp_messages').upsert({
      provider: provider.name,
      provider_message_id: outId ?? `local-clientmsg-${contactId}-${Date.now()}`,
      direction: 'outbound', wa_from: sendConfig.metaPhoneNumberId ?? 'megga',
      wa_to: String(contact.phone).replace(/\D/g, ''), contact_id: contactId,
      agency_id: agentLink.agency_id, body: text, status: 'received', is_agent_error: false,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true }).then(() => {}, () => {})
    try {
      await admin.from('activity_events').insert({
        agency_id: agentLink.agency_id, actor_id: null, actor_kind: 'ai',
        action: 'whatsapp_ai_send_client_message', entity_type: 'contact', entity_id: contactId, category: 'contact',
        severity: 'info', metadata: { via: 'whatsapp', profile_id: agentLink.profile_id },
      })
    } catch { /* non bloquant */ }
    return t(lang, 'clientMsgSent')
  }
  // Outils CRM internes confirmés (ex. update_pipeline) : on délègue à l'exécuteur
  // partagé, scopé agence au SQL. L'agence vient du lien vérifié (jamais du body).
  if (pending.tool === 'update_pipeline') {
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id, lang }
    return execUpdatePipeline(ctx, pending.args)
  }
  if (pending.tool === 'record_offer') {
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id, lang }
    return executeRecordOffer(ctx, pending.args)
  }
  if (pending.tool === 'send_listings') {
    // Payload figé au stash (validé + formaté) : { contact_id, phone, text }. On envoie tel quel.
    if (!agentLink.agency_id) return t(lang, 'noAgencySend')
    const phone = String(pending.args.phone ?? '').replace(/\D/g, '')
    const text = String(pending.args.text ?? '')
    if (!phone || !text) return t(lang, 'selectionIncomplete')
    const sent = await sendWhatsAppText(provider, phone, text)
    if (!sent) return t(lang, 'sendFail24h')
    // Persiste le message client envoyé (fil + corpus de voix). Idempotent, non bloquant.
    await admin.from('whatsapp_messages').upsert({
      provider: provider.name,
      provider_message_id: `local-listings-${String(pending.args.contact_id ?? '')}-${Date.now()}`,
      direction: 'outbound', wa_from: Deno.env.get('META_PHONE_NUMBER_ID') ?? 'megga',
      wa_to: phone, contact_id: String(pending.args.contact_id ?? '') || null,
      agency_id: agentLink.agency_id, body: text, status: 'received', is_agent_error: false,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true }).then(() => {}, () => {})
    try {
      await admin.from('activity_events').insert({
        agency_id: agentLink.agency_id, actor_id: null, actor_kind: 'ai',
        action: 'whatsapp_ai_send_listings', entity_type: 'contact',
        entity_id: String(pending.args.contact_id ?? '') || null, category: 'contact',
        severity: 'info', metadata: { via: 'whatsapp', profile_id: agentLink.profile_id },
      })
    } catch { /* non bloquant */ }
    return t(lang, 'listingsSent')
  }
  if (pending.tool === 'open_kyc_case') {
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id, lang }
    return executeOpenKycCase(ctx, pending.args)
  }
  if (pending.tool === 'send_kyc_link') {
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id, lang }
    return executeSendKycLink(ctx, pending.args)
  }
  if (pending.tool === 'send_client_email') {
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id, lang }
    return executeSendClientEmail(ctx, pending.args)
  }
  return t(lang, 'unknownAction')
}
