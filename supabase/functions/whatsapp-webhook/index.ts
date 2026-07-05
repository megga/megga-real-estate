// supabase/functions/whatsapp-webhook/index.ts
// Réception des webhooks WhatsApp entrants (OpenWA en Phase 1).
// AUCUNE AUTH SUPABASE — validation via signature HMAC (x-openwa-signature).
//
// Pipeline : signature → parse (gateway) → map contact par numéro →
// insert idempotent whatsapp_messages → audit activity_events.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, verifyHmac, allowedPriorStatuses, type SendConfig, type StatusUpdate } from '../_shared/whatsapp-gateway.ts'
import { extractPairingCode, isPairingCodeValid, parseConfirmation, isPendingActionValid, isUndoCommand, stageLabel } from '../_shared/whatsapp-agent-router.ts'
import { fetchMetaMedia } from '../_shared/whatsapp-media.ts'
import { transcribe } from '../_shared/whatsapp-transcribe.ts'
import { readDocument, describeInboundMedia, ID_DOC_REDACTION_FR } from '../_shared/vision.ts'
import { isWhatsAppEnabled } from '../_shared/whatsapp-config.ts'
import { toWhatsAppText } from '../_shared/whatsapp-format.ts'
import { meggaProse } from '../_shared/megga-prose.ts'
import { execUpdatePipeline, executeRecordOffer, executeOpenKycCase, executeSendKycLink, executeSendClientEmail, executePublishToPortals, executeWithdrawFromPortals, type ActionCtx } from '../_shared/whatsapp-actions.ts'
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
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Kill-switch : si MEGGA WhatsApp est coupé (app_config.whatsapp_enabled='false'),
  // on ACK 200 (pas de rejeu Meta) mais on ne traite/stocke/répond rien.
  if (!(await isWhatsAppEnabled(admin))) {
    return new Response(JSON.stringify({ ok: true, disabled: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const msg = provider.parseInbound(payload)
  if (!msg) {
    // Events `statuses` Meta (sent/delivered/read/failed) : progression monotone du
    // statut des SORTANTS + alerte agent si un message client n'est pas délivré.
    // Tout autre event non-message reste ignoré (200 pour ne pas déclencher de rejeu).
    const updates = provider.parseStatusUpdates?.(payload) ?? []
    if (updates.length > 0) {
      const applied = await applyStatusUpdates(admin, provider, updates)
      return new Response(JSON.stringify({ ok: true, statuses: applied }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

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
      // Anti-brute-force (P2 sécu) : un numéro non vérifié qui inonde le webhook tente de
      // deviner un code d'appairage en attente. Plafond par numéro source — au-delà de
      // PAIRING_GUESS_LIMIT messages entrants sur 15 min, on n'essaie plus l'appairage (le
      // message retombe en branche client, jamais perdu). Requête couverte par
      // idx_wa_messages_wafrom_created ; .limit() évite tout count:exact (CLAUDE.md §7).
      // Combiné au code à 8 chiffres cryptographique, rend le brute-force en ligne infaisable.
      const PAIRING_GUESS_LIMIT = 10
      const guessSince = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data: recentGuesses } = await admin
        .from('whatsapp_messages')
        .select('id')
        .eq('wa_from', msg.fromPhone)
        .eq('direction', 'inbound')
        .gt('created_at', guessSince)
        .limit(PAIRING_GUESS_LIMIT + 1)

      if ((recentGuesses?.length ?? 0) <= PAIRING_GUESS_LIMIT) {
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
      }
      // Code à 8 chiffres mais SANS correspondance en attente (ou numéro throttlé) : ce
      // n'était pas un appairage. On NE court-circuite PAS — on laisse filer vers la
      // branche client (sinon un vrai message client réductible à 8 chiffres serait perdu).
    }
  }
  // ── fin routage agent — sinon, branche client ci-dessous ──

  // 3. Résolution numéro → contact via RPC (normalize_phone = 9 derniers chiffres,
  //    robuste au format national/E.164 ; n'identifie QUE si le numéro désigne UN
  //    SEUL contact, sinon laisse orphelin). Le trigger trg_backlink_whatsapp
  //    rétro-liera de toute façon à la création/maj du contact.
  let contactId: string | null = null
  let agencyId: string | null = null
  try {
    const { data: resolved } = await admin
      .rpc('resolve_contact_by_phone', { p_phone: msg.fromPhone })
      .maybeSingle()
    if (resolved) {
      const r = resolved as { id: string; agency_id: string }
      contactId = r.id; agencyId = r.agency_id
    }
  } catch { /* résolution best-effort, non bloquant */ }

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
      const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
      const geminiModel = Deno.env.get('GEMINI_MODEL') || undefined
      // Garde résidence (parité avec le chemin client) : on CLASSE d'abord le média.
      // Une pièce d'identité n'est JAMAIS recopiée dans le prompt DeepSeek ni stockée en
      // clair — seul un libellé neutre entre dans le fil, et sa lecture réelle passe par le
      // dossier KYC (attach_kyc_document, OCR structuré dédié qui re-fetch par mediaId).
      // Les autres documents (mandat, contrat, capture) gardent l'OCR complet dont
      // dépendent read_document / file_document. Coût : 1 appel de classification en plus
      // par document non-identité (chemin agent, faible volume).
      const desc = await describeInboundMedia(bytes, mime, geminiKey, { model: geminiModel })
      if (desc.ok && desc.data?.kind === 'id_document') {
        userText = userText ? `${userText}\n\n${ID_DOC_REDACTION_FR}` : ID_DOC_REDACTION_FR
        // inboundDocText reste null → aucun OCR d'identité transmis au cerveau ni aux outils.
        await admin.from('whatsapp_messages')
          .update({ transcript: ID_DOC_REDACTION_FR })
          .eq('provider', provider.name).eq('provider_message_id', msg.providerMessageId)
      } else {
        // Classification non concluante (desc.ok=false) ⇒ on retombe sur l'OCR complet :
        // dégradation gracieuse, l'exposition résiduelle se limite à une pièce d'identité
        // ET une classification en échec, au lieu de l'OCR systématique d'avant.
        const doc = await readDocument(bytes, mime, geminiKey, { model: geminiModel })
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
      // Apprentissage T2 : un brouillon client REJETÉ → on le mémorise (1 par
      // agent×contact, upsert) pour l'apparier au prochain message envoyé à ce
      // contact (paire contrastive). Best-effort, non bloquant.
      if (pendingAction.tool === 'send_client_message') {
        const pargs = pendingAction.args as Record<string, unknown>
        const rcid = String(pargs.contact_id ?? '')
        const rdraft = String(pargs.body ?? '').trim()
        if (rcid && rdraft) {
          await admin.from('whatsapp_rejected_drafts').upsert({
            profile_id: agentLink.profile_id, agency_id: agentLink.agency_id,
            contact_id: rcid, draft: rdraft, created_at: new Date().toISOString(),
          }, { onConflict: 'profile_id,contact_id' }).then(() => {}, () => {})
        }
      }
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
  const outText = toWhatsAppText(meggaProse(reply)) // style maison (meggaProse) puis Markdown DeepSeek (**gras**) → WhatsApp (*gras*)
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
  const sreq = provider.buildSendTextRequest({ toPhone, body: toWhatsAppText(meggaProse(body)) }, sendConfig)
  try {
    const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
    return sres.ok
  } catch { return false }
}

// ── Statuts de livraison (sent/delivered/read/failed) ──────────────────────
// Applique les events `statuses` Meta aux SORTANTS. Monotone via allowedPriorStatuses :
// un event en retard (delivered après read) ou un rejeu ne matche aucune ligne → no-op.
// Premier passage à `failed` : delivery_error posé, audit, et alerte WhatsApp à l'agent
// lié si le message visait un client — un échec d'envoi ne doit JAMAIS rester muet.
async function applyStatusUpdates(
  admin: SupabaseClient,
  provider: ReturnType<typeof getProvider>,
  updates: StatusUpdate[],
): Promise<number> {
  let applied = 0
  for (const u of updates) {
    const patch: Record<string, unknown> = {
      status: u.status,
      status_updated_at: u.timestamp ?? new Date().toISOString(),
    }
    if (u.status === 'failed') {
      patch.delivery_error = u.errorCode === 131047
        ? '131047 — fenêtre 24h fermée (le client doit écrire en premier)'
        : [u.errorCode, u.errorDetail].filter(Boolean).join(' — ') || 'échec de livraison'
    }
    const { data: rows, error } = await admin
      .from('whatsapp_messages')
      .update(patch)
      .eq('provider', provider.name)
      .eq('provider_message_id', u.providerMessageId)
      .eq('direction', 'outbound')
      .in('status', allowedPriorStatuses(u.status))
      .select('id, contact_id, agency_id')
    if (error) {
      console.error('wa status update failed:', error.message.slice(0, 120))
      continue
    }
    if (!rows || rows.length === 0) continue // rejeu / hors ordre / message inconnu
    applied++
    if (u.status === 'failed') await notifyDeliveryFailure(admin, provider, rows[0], u)
  }
  return applied
}

// Après un échec de livraison : audit TOUJOURS, puis alerte WhatsApp à l'agent vérifié
// de l'agence si le sortant visait un CLIENT (contact_id). Best-effort, PII-safe
// (aucun numéro ni contenu en logs). Appelée uniquement sur la PREMIÈRE transition vers
// failed (l'UPDATE monotone ne renvoie une ligne qu'une fois) → pas de double alerte.
async function notifyDeliveryFailure(
  admin: SupabaseClient,
  provider: ReturnType<typeof getProvider>,
  row: { id: string; contact_id: string | null; agency_id: string | null },
  u: StatusUpdate,
): Promise<void> {
  try {
    await admin.from('activity_events').insert({
      agency_id: row.agency_id,
      actor_id: null,
      actor_kind: 'system',
      action: 'whatsapp_delivery_failed',
      entity_type: row.contact_id ? 'contact' : 'whatsapp_message',
      entity_id: row.contact_id,
      category: 'contact',
      severity: 'warn',
      metadata: { code: u.errorCode },
    })
  } catch { /* non bloquant */ }

  if (!row.contact_id || !row.agency_id) return
  const { data: link } = await admin
    .from('whatsapp_agent_links')
    .select('wa_number')
    .eq('agency_id', row.agency_id)
    .eq('verified', true)
    .limit(1)
    .maybeSingle()
  if (!link?.wa_number) return

  let who = 'ton client'
  const { data: c } = await admin.from('contacts')
    .select('first_name, last_name').eq('id', row.contact_id).maybeSingle()
  const name = c ? `${(c.first_name ?? '').trim()} ${(c.last_name ?? '').trim()}`.trim() : ''
  if (name) who = name
  const reason = u.errorCode === 131047
    ? "sa fenêtre de 24h est fermée — il doit t'écrire d'abord"
    : 'erreur de livraison WhatsApp'
  await sendWhatsAppText(provider, link.wa_number, `⚠️ Ton message à ${who} n'a pas été délivré : ${reason}.`)
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
    const sreq = provider.buildSendTextRequest({ toPhone: String(contact.phone).replace(/\D/g, ''), body: toWhatsAppText(meggaProse(text)) }, sendConfig)
    let outId: string | null = null
    try {
      const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
      if (!sres.ok) return t(lang, 'sendFail24h')
      const sbody = await sres.json().catch(() => ({}))
      outId = provider.parseSendResult(sres.status, sbody).providerMessageId
    } catch { return t(lang, 'sendFailNet') }
    // Persiste le message client envoyé (fil + corpus de voix). Idempotent, non bloquant.
    // sent_by_profile_id = l'agent qui a validé l'envoi → mimétisme de voix PAR AGENT
    // (apprentissage T2 par l'exemple ; cf. agent-style.ts fetchClientVoiceSamples).
    await admin.from('whatsapp_messages').upsert({
      provider: provider.name,
      provider_message_id: outId ?? `local-clientmsg-${contactId}-${Date.now()}`,
      direction: 'outbound', wa_from: sendConfig.metaPhoneNumberId ?? 'megga',
      wa_to: String(contact.phone).replace(/\D/g, ''), contact_id: contactId,
      agency_id: agentLink.agency_id, body: text, status: 'received', is_agent_error: false,
      sent_by_profile_id: agentLink.profile_id,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true }).then(() => {}, () => {})
    try {
      await admin.from('activity_events').insert({
        agency_id: agentLink.agency_id, actor_id: null, actor_kind: 'ai',
        action: 'whatsapp_ai_send_client_message', entity_type: 'contact', entity_id: contactId, category: 'contact',
        severity: 'info', metadata: { via: 'whatsapp', profile_id: agentLink.profile_id },
      })
    } catch { /* non bloquant */ }
    // Apprentissage T2 : si un brouillon a été REJETÉ récemment (<1h) pour ce contact
    // et que le message envoyé DIFFÈRE → apparie (rejeté → envoyé) comme correction.
    // Consomme le brouillon dans tous les cas. Best-effort, non bloquant.
    try {
      const { data: rej } = await admin.from('whatsapp_rejected_drafts')
        .select('draft, created_at')
        .eq('profile_id', agentLink.profile_id).eq('contact_id', contactId).maybeSingle()
      if (rej) {
        const fresh = Date.now() - Date.parse(rej.created_at as string) < 60 * 60 * 1000
        const draft = String(rej.draft ?? '').trim()
        if (fresh && draft && draft !== text.trim()) {
          await admin.from('whatsapp_message_corrections').insert({
            profile_id: agentLink.profile_id, agency_id: agentLink.agency_id,
            contact_id: contactId, megga_draft: draft, agent_final: text,
          })
        }
        await admin.from('whatsapp_rejected_drafts').delete()
          .eq('profile_id', agentLink.profile_id).eq('contact_id', contactId)
      }
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
    // Capture sent_at : un vrai dossier vient de partir → marquer les matches
    // correspondants 'sent' (réactivité aval ; les matches marché portent
    // market_listing_id, les internes property_id → on couvre les deux).
    try {
      // Garde UUID (défense en profondeur) : les ids sont interpolés dans le filtre
      // PostgREST .or() → on n'accepte que des UUID, jamais une valeur qui pourrait
      // corrompre l'expression (virgule/parenthèse), quelle que soit la provenance.
      const sentIds = Array.isArray(pending.args.listing_ids)
        ? (pending.args.listing_ids as unknown[]).filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x))
        : []
      const sentContactId = String(pending.args.contact_id ?? '')
      if (sentIds.length && sentContactId) {
        const inList = `(${sentIds.join(',')})`
        await admin.from('matches')
          .update({ status: 'sent', sent_via: 'whatsapp', sent_at: new Date().toISOString() })
          .eq('agency_id', agentLink.agency_id).eq('contact_id', sentContactId).eq('status', 'suggested')
          .or(`property_id.in.${inList},market_listing_id.in.${inList}`)
      }
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
  if (pending.tool === 'publish_to_portals') {
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id, lang }
    return executePublishToPortals(ctx, pending.args)
  }
  if (pending.tool === 'withdraw_from_portals') {
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id, lang }
    return executeWithdrawFromPortals(ctx, pending.args)
  }
  return t(lang, 'unknownAction')
}
