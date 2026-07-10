// supabase/functions/whatsapp-webhook/index.ts
// Réception des webhooks WhatsApp entrants (OpenWA en Phase 1).
// AUCUNE AUTH SUPABASE — validation via signature HMAC (x-openwa-signature).
//
// Pipeline : signature → parse (gateway) → map contact par numéro →
// insert idempotent whatsapp_messages → audit activity_events.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, verifyHmac, allowedPriorStatuses, type SendConfig, type SendResult, type StatusUpdate } from '../_shared/whatsapp-gateway.ts'
import { sendWithRetry } from '../_shared/whatsapp-retry.ts'
import { resolveTriageAgencyId, ensureLeadForInboundPhone, triageLeadName, isTriageEligible } from '../_shared/whatsapp-lead-triage.ts'
import { buildTemplateMessage, type WaTemplateContext, type WaTemplateKey } from '../_shared/whatsapp-templates.ts'
import { extractPairingCode, isPairingCodeValid, parseConfirmation, isPendingActionValid, isUndoCommand, stageLabel } from '../_shared/whatsapp-agent-router.ts'
import { fetchMetaMedia } from '../_shared/whatsapp-media.ts'
import { transcribe } from '../_shared/whatsapp-transcribe.ts'
import { readDocument, describeInboundMedia, ID_DOC_REDACTION_FR } from '../_shared/vision.ts'
import { isWhatsAppEnabled } from '../_shared/whatsapp-config.ts'
import { toWhatsAppText } from '../_shared/whatsapp-format.ts'
import { meggaProse } from '../_shared/megga-prose.ts'
import { execUpdatePipeline, executeRecordOffer, executeOpenKycCase, executeSendKycLink, executeSendClientEmail, executePublishToPortals, executeWithdrawFromPortals, type ActionCtx } from '../_shared/whatsapp-actions.ts'
import { asWaLang, detectLang, t, type WaLang, undoneStage, undoStateChanged, undoneAuto, undoNoun } from '../_shared/whatsapp-i18n.ts'

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
      // message retombe en branche client, jamais perdu). is_agent_error=false est un no-op
      // sémantique ici (le flag ne marque QUE les réponses SORTANTES en échec, jamais un
      // entrant) mais REQUIS pour que le planner utilise l'index partiel
      // idx_wa_messages_wafrom_created (… WHERE wa_from IS NOT NULL AND is_agent_error=false) :
      // sans cette égalité, le prédicat ne l'implique pas → seq scan (CLAUDE.md §7).
      // .limit() évite tout count:exact. Combiné au code à 8 chiffres cryptographique,
      // rend le brute-force en ligne infaisable.
      const PAIRING_GUESS_LIMIT = 10
      const guessSince = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data: recentGuesses } = await admin
        .from('whatsapp_messages')
        .select('id')
        .eq('wa_from', msg.fromPhone)
        .eq('direction', 'inbound')
        .eq('is_agent_error', false)
        .gt('created_at', guessSince)
        .limit(PAIRING_GUESS_LIMIT + 1)

      if ((recentGuesses?.length ?? 0) <= PAIRING_GUESS_LIMIT) {
        const { data: pending } = await admin
          .from('whatsapp_agent_links')
          .select('id, agency_id, pairing_expires_at')
          .eq('pairing_code', code)
          .eq('verified', false)
          .maybeSingle()

        if (pending && isPairingCodeValid(pending.pairing_expires_at)) {
          // Trace idempotente de l'entrant d'appairage AVANT tout. Sans elle, un REJEU
          // séquentiel de ce message — le numéro étant désormais vérifié, il route en branche
          // AGENT — insèrerait un provider_message_id neuf → le code à 8 chiffres partirait au
          // cerveau IA (réponse parasite). En posant la ligne ici, l'upsert de la branche
          // agent au rejeu trouve le doublon → 'agent_duplicate', pas d'appel IA. Best-effort.
          await admin.from('whatsapp_messages').upsert({
            provider: provider.name,
            provider_message_id: msg.providerMessageId,
            session_id: msg.sessionId,
            direction: 'inbound',
            wa_from: msg.fromPhone,
            wa_to: msg.toPhone,
            agency_id: pending.agency_id,
            body: msg.body,
            status: 'received',
            wa_timestamp: msg.timestamp,
            raw: msg.raw,
          }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true }).then(() => {}, () => {})

          // Bascule du lien en compare-and-swap : `.eq('verified', false)` ferme la course
          // TOCTOU entre le SELECT ci-dessus et cet UPDATE. Sur deux livraisons CONCURRENTES du
          // même code, seule la 1re bascule ; la 2e voit 0 ligne → court-circuit sans 2e « ✅ lié ».
          const { data: verifiedRows } = await admin
            .from('whatsapp_agent_links')
            .update({ wa_number: msg.fromPhone, verified: true, pairing_code: null, verified_at: new Date().toISOString() })
            .eq('id', pending.id)
            .eq('verified', false)
            .select('id')
          if (!verifiedRows || verifiedRows.length === 0) {
            return new Response(JSON.stringify({ ok: true, routed: 'pairing_duplicate' }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

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

  // Triage numéros inconnus → leads. On ne touche à RIEN pour un numéro déjà résolu (connu :
  // agencyId hérité du contact). Pour un INCONNU, on ne dérive l'agence de rattachement
  // (server-side, garde cross-tenant — cf. resolveTriageAgencyId) et on ne crée un lead QUE si
  // l'inbound est ÉLIGIBLE (numéro réel + body texte non vide). Un média-seul / body vide
  // (démarchage/bruit) reste ORPHELIN (agency_id null) → HORS de la file d'avis LPD (pas d'envoi
  // auto au bruit). Un vrai message d'un inconnu → agence + lead + compréhension/qualif/avis LPD.
  // AUCUN envoi au prospect ici (HITL préservé — la branche client ne fait que markRead).
  let leadCreated = false
  if (!contactId && !agencyId && isTriageEligible(msg.fromPhone, msg.body)) {
    // Best-effort : les 2 appels réseau du triage (RPC agence + upsert lead) ne doivent JAMAIS
    // faire échouer le webhook. Une erreur Postgres est déjà gérée en {error} → null ; on borne
    // aussi les erreurs TRANSPORT (DNS/timeout) sinon le handler rejette → 500 → retries Meta/openwa.
    // Mode d'échec sûr : le message est inséré tel quel (orphelin), le back-link trigger rattrapera.
    try {
      // wa_to = numéro Business composé par le client → attribution déterministe par agence
      // (registre agency_wa_numbers) ; sinon repli sur l'heuristique de comptage.
      agencyId = await resolveTriageAgencyId(admin, (k) => Deno.env.get(k), msg.toPhone)
      if (!agencyId) {
        console.warn('whatsapp inbound: numéro inconnu, agence indéterminable, message orphelin:', msg.fromPhone.slice(-4))
      } else {
        const { firstName, lastName } = triageLeadName(msg.fromPhone)
        const triage = await ensureLeadForInboundPhone(admin, { agencyId, phone: msg.fromPhone, firstName, lastName })
        if (triage.contactId) { contactId = triage.contactId; leadCreated = triage.created }
      }
    } catch (e) {
      console.warn('whatsapp inbound: triage best-effort échoué:', String((e as Error)?.message ?? 'error').slice(0, 80))
    }
  }

  // Triage : si un lead vient d'être créé pour ce prospect entrant, on le trace (actor 'ai',
  // severity 'warn' → remonte en notif priorisée « cloche ») pour que l'agent le voie.
  // ÉMIS AVANT le gate d'idempotence ci-dessous, PAS après : `leadCreated=true` n'appartient
  // qu'au gagnant de ensure_wa_inbound_lead (RPC atomique → exactement UNE livraison l'obtient,
  // concurrente ou séquentielle) ; or le gagnant du gate d'INSERT (transaction séparée) peut
  // être une AUTRE livraison. Émettre après le gate ferait avaler la cloche quand un doublon
  // concurrent remporte l'insert. Émettre ici = cloche exactement une fois, sans risque de
  // doublon (une seule livraison a jamais leadCreated=true).
  if (leadCreated && contactId) {
    try {
      await admin.from('activity_events').insert({
        agency_id: agencyId,
        actor_id: null,
        actor_kind: 'ai',
        action: 'whatsapp_inbound_lead_created',
        entity_type: 'contact',
        entity_id: contactId,
        category: 'contact',
        severity: 'warn',
        metadata: { via: 'whatsapp', phase: 'inbound-triage' },
      })
    } catch { /* non bloquant */ }
  }

  // 4. Insert idempotent (ON CONFLICT via upsert sur la contrainte unique) + GATE
  //    d'idempotence. Meta REJOUE un webhook non acquitté à temps (ou batche en double) :
  //    sur un même provider_message_id, l'upsert ON CONFLICT DO NOTHING ne renvoie AUCUNE
  //    ligne. On court-circuite alors AVANT tout effet de bord non idempotent (audit
  //    `whatsapp_message_received` dupliqué, markRead) — même garde que la branche agent
  //    (routed:'agent_duplicate'). Race-safe : sur deux livraisons concurrentes, une seule
  //    remporte le RETURNING, l'autre voit 0 ligne et s'arrête. (Le triage lead en amont est
  //    déjà idempotent : ensure_wa_inbound_lead = ON CONFLICT DO NOTHING → created=false au
  //    rejeu, pas de doublon de lead ni d'event.)
  const { data: insertedRows, error: insErr } = await admin
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
    .select('id')

  if (insErr) {
    console.error('whatsapp_messages insert error:', insErr.message)
    return new Response('DB error', { status: 500, headers: corsHeaders })
  }
  if (!insertedRows || insertedRows.length === 0) {
    return new Response(JSON.stringify({ ok: true, routed: 'client_duplicate' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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

  // Action en attente de confirmation ? Chargée AVANT l'undo différé pour lever l'ambiguïté
  // de « annule » : si un pending attend, « annule/non » doit le REFUSER (géré plus bas) et
  // NON déclencher l'undo d'une action auto antérieure.
  const { data: pendingAction } = await admin
    .from('whatsapp_pending_actions')
    .select('id, tool, args, summary, expires_at')
    .eq('profile_id', agentLink.profile_id)
    .maybeSingle()

  // L3 — undo différé : « /annuler » dans la fenêtre rejoue le dernier payload_undo.
  // Prioritaire SAUF quand un pending attend ET que ce message le refuse (parseConfirmation
  // === 'no', ex. « annule », « non ») : dans ce cas le « non » vise le pending, pas l'undo.
  // Le « /annuler » explicite (parseConfirmation === 'none') reste un undo même avec pending.
  if (isUndoCommand(userText) && !(pendingAction && parseConfirmation(userText) === 'no')) {
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
          await sendWhatsAppText(provider, msg.fromPhone, undoReply, { retry: true })
          return
        }
        // Rollback impossible OU outil sans branche : LIBÉRER le verrou pour ne pas brûler le
        // slot (un /annuler honnête doit pouvoir re-tenter). On NE return PAS : flux normal.
        await admin.from('whatsapp_recent_auto_actions').update({ undone_at: null }).eq('id', last.id)
      }
    }
    // Rien d'annulable : on NE return PAS — le message suit le flux normal (le cerveau répondra).
  }

  if (pendingAction) {
    const decision = parseConfirmation(userText)
    const valid = isPendingActionValid(pendingAction.expires_at)
    const lang = asWaLang((pendingAction.args as Record<string, unknown>)?.__lang)
    // F3 : consommation gagnant-unique. Deux « oui » concurrents lisent la même ligne ;
    // un seul DELETE renvoie une ligne → seul lui exécute/répond, l'autre s'arrête.
    const { data: claimed } = await admin
      .from('whatsapp_pending_actions').delete().eq('id', pendingAction.id).select('id')
    if (!claimed || claimed.length === 0) {
      // Course perdue : une autre invocation a déjà consommé cette attente (gagnant-unique).
      // On n'AVALE PAS notre message — le pending n'existe plus, on le traite comme un message
      // normal (le cerveau répond ; s'il re-stashe, stashPending est atomique → pas de corruption).
      const brain = await callAgentBrain(agentLink, msg, userText, lang, inboundDocText)
      reply = brain.reply
      replyIsError = brain.isError
    } else if (decision === 'yes' && valid) {
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
  // Réponse AGENT-facing : retry court (réseau/5xx/429, jamais 131047). En tentative unique,
  // la réponse du copilote était perdue au moindre aléa Meta ; un doublon vers l'agent est
  // inoffensif. sendWhatsAppText applique meggaProse+toWhatsAppText (identique à outText).
  const outId = (await sendWhatsAppText(provider, msg.fromPhone, reply, { retry: true })).providerMessageId

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
    is_automated: true, // réponse générée par le copilote (MEGGA→agent) : jamais du corpus de voix
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
// Renvoie le SendResult complet : le provider_message_id, persisté sur les sortants
// clients, est ce qui permet aux events `statuses` (applyStatusUpdates) de suivre la
// livraison et d'alerter au premier failed — un envoi sans id est invisible à la boucle.
// opts.retry : rejoue les erreurs transitoires (réseau/5xx/429, jamais 131047). À n'activer
// que sur les envois AGENT-facing (réponse copilote, alerte, confirmation d'undo), où un
// doublon est inoffensif. Les envois CLIENT (send_listings) restent en tentative unique
// (défaut) : l'API Meta n'est pas idempotente → un retry pourrait doublonner côté client.
async function sendWhatsAppText(
  provider: ReturnType<typeof getProvider>, toPhone: string, body: string,
  opts?: { retry?: boolean },
): Promise<SendResult> {
  const sendConfig: SendConfig = {
    metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
    metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
    metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
  }
  const sreq = provider.buildSendTextRequest({ toPhone, body: toWhatsAppText(meggaProse(body)) }, sendConfig)
  return sendWithRetry(sreq, (s, b) => provider.parseSendResult(s, b), { maxAttempts: opts?.retry ? 3 : 1 })
}

// Envoi d'une image WhatsApp par URL publique (photo R2) — Meta télécharge le lien,
// pas d'upload média. ok=false si le provider ne le supporte pas (OpenWA legacy).
async function sendWhatsAppImage(
  provider: ReturnType<typeof getProvider>, toPhone: string, link: string, caption?: string,
): Promise<SendResult> {
  if (!provider.buildSendImageRequest) return { ok: false, providerMessageId: null, error: 'unsupported' }
  const sendConfig: SendConfig = {
    metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
    metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
    metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
  }
  // Même normalisation que le texte (meggaProse + syntaxe WhatsApp) : la légende
  // est un message client comme un autre.
  const sreq = provider.buildSendImageRequest(
    { toPhone, link, caption: caption ? toWhatsAppText(meggaProse(caption)) : undefined },
    sendConfig,
  )
  try {
    const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
    return provider.parseSendResult(sres.status, await sres.json().catch(() => ({})))
  } catch { return { ok: false, providerMessageId: null, error: 'network' } }
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
      .select('id, contact_id, agency_id, media_type')
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
// (aucun numéro ni contenu en logs). L'UPDATE monotone ne fait transiter chaque MESSAGE
// vers failed qu'une fois → pas de double alerte PAR message ; mais un send_listings =
// jusqu'à 6 messages (texte + 5 photos) qui, hors fenêtre 24h, échouent tous → sans
// garde, 6 alertes quasi identiques. THROTTLE : on n'envoie qu'UNE alerte WhatsApp par
// contact sur une courte fenêtre (l'audit, lui, reste exhaustif). Le libellé distingue
// photo vs message (un échec photo isolé ≠ « ton message n'a pas été délivré », sinon
// l'agent croit toute la sélection perdue et la renvoie → doublons chez le client).
async function notifyDeliveryFailure(
  admin: SupabaseClient,
  provider: ReturnType<typeof getProvider>,
  row: { id: string; contact_id: string | null; agency_id: string | null; media_type: string | null },
  u: StatusUpdate,
): Promise<void> {
  // 131047 = fenêtre 24h fermée → TOUTE la conversation est bloquée (texte + photos),
  // pas seulement ce message : on parle alors du « message » global, jamais d'« une
  // photo » (sinon on sous-estime la panne au 1er event traité s'il vise une photo).
  // Autres codes = échec propre à ce média → libellé fidèle (photo vs message).
  const windowClosed = u.errorCode === 131047
  const isPhoto = row.media_type === 'image' && !windowClosed

  // Une alerte WhatsApp a-t-elle DÉJÀ RÉELLEMENT été émise pour ce contact récemment ?
  // (marqueur alert_sent=true posé plus bas UNIQUEMENT après un envoi réussi). Throttle
  // cross-invocation : un send_listings hors fenêtre = jusqu'à 6 échecs → 1 seule alerte.
  let alreadyAlerted = false
  if (row.contact_id) {
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: recent } = await admin.from('activity_events')
      .select('id')
      .eq('action', 'whatsapp_delivery_failed')
      .eq('entity_id', row.contact_id)
      .filter('metadata->>alert_sent', 'eq', 'true')
      .gte('created_at', since)
      .limit(1)
    alreadyAlerted = !!(recent && recent.length)
  }

  // Envoi de l'alerte D'ABORD (si un agent vérifié existe et pas déjà alerté) → on
  // connaît alors le VRAI résultat. Si l'envoi échoue, alert_sent reste false : l'échec
  // suivant du lot ne sera PAS throttlé et retentera (jamais de silence sur un raté).
  let alertSent = false
  if (row.contact_id && row.agency_id && !alreadyAlerted) {
    const { data: link } = await admin
      .from('whatsapp_agent_links')
      .select('wa_number')
      .eq('agency_id', row.agency_id)
      .eq('verified', true)
      .limit(1)
      .maybeSingle()
    const waNumber = link?.wa_number ?? null
    if (waNumber) {
      let who = 'ton client'
      const { data: c } = await admin.from('contacts')
        .select('first_name, last_name').eq('id', row.contact_id).maybeSingle()
      const name = c ? `${(c.first_name ?? '').trim()} ${(c.last_name ?? '').trim()}`.trim() : ''
      if (name) who = name
      const reason = windowClosed
        ? "sa fenêtre de 24h est fermée — il doit t'écrire d'abord"
        : 'erreur de livraison WhatsApp'
      const what = isPhoto ? 'Une photo envoyée à' : 'Ton message à'
      // PAS de retry ici : cette alerte part depuis applyStatusUpdates, AWAITÉ avant le 200
      // rendu à Meta sur les events `statuses`. Un retry (~25 s) retarderait l'ACK → Meta
      // rejouerait le webhook (voire throttlerait l'abonnement). L'alerte est best-effort
      // (alert_sent audité, re-tentée au prochain `failed` du lot) : tentative unique.
      const res = await sendWhatsAppText(provider, waNumber, `⚠️ ${what} ${who} n'a pas été délivré${isPhoto ? 'e' : ''} : ${reason}.`)
      alertSent = res.ok
    }
  }

  // Audit TOUJOURS (trail exhaustif), alert_sent = alerte réellement partie ou non.
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
      metadata: { code: u.errorCode, media_type: row.media_type, alert_sent: alertSent },
    })
  } catch { /* non bloquant */ }
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
    const setStage = String(p.new_stage ?? '')  // l'étape que l'action auto avait posée
    if (!tx || !old) return null
    // Check d'état : ne défaire QUE si le dossier est ENCORE à l'étape posée par MEGGA. Si
    // l'agent ou un trigger (ex. offre acceptée → signed) l'a déplacé entre-temps, revenir à
    // `old` écraserait ce changement plus récent → on refuse honnêtement. (Payloads anciens
    // sans new_stage : check sauté = rétro-compatible.)
    if (setStage) {
      const { data: cur } = await admin.from('transactions')
        .select('stage').eq('id', tx).eq('agency_id', agencyId).maybeSingle()
      if (!cur) return null
      if (cur.stage !== setStage) return undoStateChanged(lang)
    }
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

// Contexte de remplissage des variables d'un template (prénom client + nom agent).
async function templateCtx(
  admin: SupabaseClient,
  agentLink: { profile_id: string; agency_id: string | null },
  contactId: string,
): Promise<WaTemplateContext> {
  const [{ data: c }, { data: prof }] = await Promise.all([
    admin.from('contacts').select('first_name').eq('id', contactId).maybeSingle(),
    admin.from('profiles').select('full_name').eq('id', agentLink.profile_id).maybeSingle(),
  ])
  return {
    clientFirstName: (c?.first_name as string | null) ?? undefined,
    agentName: (prof?.full_name as string | null) ?? undefined,
  }
}

// Fenêtre 24h fermée : PROPOSE (HITL) l'envoi d'un template de relance approuvé. Renvoie le
// message de proposition (et stashe la pending send_template) si un template est configuré,
// sinon null → le caller retombe sur l'échec habituel. INERTE tant qu'aucun template n'est
// activé (Meta approuvé + env WA_TEMPLATE_* posé) : buildTemplateMessage renvoie alors null.
async function offerTemplateFallback(
  admin: SupabaseClient,
  agentLink: { profile_id: string; agency_id: string | null },
  contactId: string,
  lang: WaLang,
): Promise<string | null> {
  if (!agentLink.agency_id) return null
  const { data: contact } = await admin.from('contacts')
    .select('phone').eq('id', contactId).eq('agency_id', agentLink.agency_id).maybeSingle()
  const phone = String(contact?.phone ?? '').replace(/\D/g, '')
  if (!phone) return null
  const tmsg = buildTemplateMessage('followup', phone, await templateCtx(admin, agentLink, contactId), (k) => Deno.env.get(k))
  if (!tmsg) return null // aucun template approuvé configuré → repli gracieux
  // Numéro WhatsApp de l'agent (colonne pending.wa_number NOT NULL) : lu sur son lien vérifié.
  const { data: link } = await admin.from('whatsapp_agent_links')
    .select('wa_number').eq('profile_id', agentLink.profile_id).eq('verified', true).maybeSingle()
  const agentNumber = String(link?.wa_number ?? '').replace(/\D/g, '')
  if (!agentNumber) return null
  // Le slot pending vient d'être consommé (executePending). On stashe la proposition ; sur
  // collision (course concurrente, UNIQUE profile_id → 23505), on retombe sur l'échec.
  const { error } = await admin.from('whatsapp_pending_actions').insert({
    profile_id: agentLink.profile_id, agency_id: agentLink.agency_id, wa_number: agentNumber,
    tool: 'send_template',
    args: { contact_id: contactId, __template_key: 'followup', __lang: lang },
    summary: t(lang, 'templateOffer'),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  })
  if (error) return null
  return t(lang, 'templateOffer')
}

// Exécute une action confirmée (send_client_message, send_template, update_pipeline,
// record_offer, send_listings). Garde agence AU SQL ou via l'exécuteur partagé.
async function executePending(
  admin: SupabaseClient,
  provider: ReturnType<typeof getProvider>,
  agentLink: { profile_id: string; agency_id: string | null },
  pending: { tool: string; args: Record<string, unknown> },
  lang: WaLang,
): Promise<string> {
  if (pending.tool === 'send_template') {
    if (!agentLink.agency_id) return t(lang, 'noAgencySend')
    const contactId = String(pending.args.contact_id ?? '')
    const key = String(pending.args.__template_key ?? 'followup') as WaTemplateKey
    if (!contactId) return t(lang, 'actionIncompleteSend')
    const { data: contact } = await admin.from('contacts')
      .select('id, phone').eq('id', contactId).eq('agency_id', agentLink.agency_id).maybeSingle()
    if (!contact || !contact.phone) return t(lang, 'contactNotFoundSend')
    const phone = String(contact.phone).replace(/\D/g, '')
    const tmsg = buildTemplateMessage(key, phone, await templateCtx(admin, agentLink, contactId), (k) => Deno.env.get(k))
    if (!tmsg || !provider.buildSendTemplateRequest) return t(lang, 'sendFail24h')
    const sendConfig: SendConfig = {
      metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
      metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
      metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
    }
    const sreq = provider.buildSendTemplateRequest(tmsg, sendConfig)
    let outId: string | null = null
    try {
      const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
      if (!sres.ok) return t(lang, 'sendFail24h')
      const sbody = await sres.json().catch(() => ({}))
      outId = provider.parseSendResult(sres.status, sbody).providerMessageId
    } catch { return t(lang, 'sendFailNet') }
    await admin.from('whatsapp_messages').upsert({
      provider: provider.name,
      provider_message_id: outId ?? `local-template-${contactId}-${Date.now()}`,
      direction: 'outbound', wa_from: sendConfig.metaPhoneNumberId ?? 'megga',
      wa_to: phone, contact_id: contactId, agency_id: agentLink.agency_id,
      body: `[template: ${key}]`, status: 'received', is_agent_error: false,
      sent_by_profile_id: agentLink.profile_id,
      is_automated: true, // template Meta (boilerplate) : jamais du corpus de voix
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true }).then(() => {}, () => {})
    try {
      await admin.from('activity_events').insert({
        agency_id: agentLink.agency_id, actor_id: null, actor_kind: 'ai',
        action: 'whatsapp_ai_send_template', entity_type: 'contact', entity_id: contactId,
        category: 'contact', severity: 'info',
        metadata: { via: 'whatsapp', profile_id: agentLink.profile_id, template_key: key },
      })
    } catch { /* non bloquant */ }
    return t(lang, 'templateSent')
  }
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
      if (!sres.ok) {
        // Fenêtre 24h fermée (ex. 131047) : si un template de relance approuvé est configuré,
        // on PROPOSE de l'envoyer (HITL, l'agent confirme — jamais d'auto-envoi de contenu non
        // validé). Inerte tant qu'aucun template n'est activé (Meta approuvé + env posé).
        const offer = await offerTemplateFallback(admin, agentLink, contactId, lang)
        return offer ?? t(lang, 'sendFail24h')
      }
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
    // Payload figé au stash (validé + formaté) : { contact_id, phone, text, images }. On envoie tel quel.
    if (!agentLink.agency_id) return t(lang, 'noAgencySend')
    const phone = String(pending.args.phone ?? '').replace(/\D/g, '')
    const text = String(pending.args.text ?? '')
    if (!phone || !text) return t(lang, 'selectionIncomplete')
    const contactId = String(pending.args.contact_id ?? '') || null
    const waFrom = Deno.env.get('META_PHONE_NUMBER_ID') ?? 'megga'
    const sent = await sendWhatsAppText(provider, phone, text)
    if (!sent.ok) return t(lang, 'sendFail24h')
    // Persiste le texte envoyé avec son id provider RÉEL (repli local si le parse n'en
    // rend pas) : c'est lui qui rattache les statuses Meta (delivered/read/failed) à la
    // ligne — avec un id local, un échec 131047 resterait muet. On AWAIT (au lieu de
    // fire-and-forget) : la ligne existe avant que les events statuses n'arrivent (fenêtre
    // de course réduite) et un échec DB est LOGGÉ, plus avalé. Idempotent, non bloquant.
    const persist = async (
      row: Record<string, unknown>, label: string,
    ): Promise<void> => {
      try {
        const { error } = await admin.from('whatsapp_messages')
          .upsert(row, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })
        if (error) console.error(`send_listings ${label} persist failed:`, error.message.slice(0, 120))
      } catch (e) { console.error(`send_listings ${label} persist threw:`, (e as Error)?.name ?? 'error') }
    }
    await persist({
      provider: provider.name,
      provider_message_id: sent.providerMessageId ?? `local-listings-${contactId ?? 'x'}-${Date.now()}`,
      direction: 'outbound', wa_from: waFrom,
      wa_to: phone, contact_id: contactId,
      agency_id: agentLink.agency_id, body: text, status: 'received', is_agent_error: false,
      is_automated: true, // texte send_listings (« Bonjour X, voici une sélection… ») = boilerplate, hors corpus de voix
    }, 'text')
    // Photos : la 1re de chaque bien, en messages image après le texte. Best-effort au
    // sens où le texte est déjà parti — mais PAS muet : on compte les tentatives réelles
    // (imagesAttempted) vs les succès (photosSent) et on le dit à l'agent si l'écart
    // existe (WYSIWYG : le prompt annonçait « +N photos »). Re-garde https à l'exécution
    // (défense en profondeur) : jamais d'URL non-https relayée à Meta.
    let photosSent = 0
    let imagesAttempted = 0
    const images = Array.isArray(pending.args.images) ? (pending.args.images as Array<Record<string, unknown>>).slice(0, 5) : []
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      const url = typeof img.url === 'string' && img.url.startsWith('https://') ? img.url : null
      if (!url) continue
      imagesAttempted++
      const caption = typeof img.caption === 'string' ? img.caption.slice(0, 300) : undefined
      const ires = await sendWhatsAppImage(provider, phone, url, caption)
      if (!ires.ok) { console.error('send_listings photo failed:', url.slice(0, 120)); continue }
      photosSent++
      // Chaque image persistée avec son id provider → visible dans le fil client et
      // couverte par la même boucle de statuts/alerte que le texte.
      await persist({
        provider: provider.name,
        provider_message_id: ires.providerMessageId ?? `local-listings-img-${contactId ?? 'x'}-${Date.now()}-${i}`,
        direction: 'outbound', wa_from: waFrom,
        wa_to: phone, contact_id: contactId,
        agency_id: agentLink.agency_id, body: caption ?? null,
        media_type: 'image', media_url: url,
        status: 'received', is_agent_error: false,
        is_automated: true, // légende de photo send_listings = boilerplate, hors corpus de voix
      }, 'photo')
    }
    try {
      await admin.from('activity_events').insert({
        agency_id: agentLink.agency_id, actor_id: null, actor_kind: 'ai',
        action: 'whatsapp_ai_send_listings', entity_type: 'contact',
        entity_id: contactId, category: 'contact',
        severity: 'info', metadata: { via: 'whatsapp', profile_id: agentLink.profile_id, photos_sent: photosSent, photos_attempted: imagesAttempted },
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
    // Retour honnête à l'agent : si des photos annoncées n'ont pas pu partir (Meta a
    // rejeté le lien, réseau, ou provider sans image), on le DIT — jamais « tout envoyé »
    // en silence (invariant « aucun échec d'envoi muet », ici au niveau requête).
    if (imagesAttempted > 0 && photosSent < imagesAttempted) {
      const missing = imagesAttempted - photosSent
      return lang === 'en'
        ? `✅ Text sent to the client — but ${missing}/${imagesAttempted} photo${imagesAttempted > 1 ? 's' : ''} couldn't go through (only the text arrived).`
        : `✅ Texte envoyé au client — mais ${missing}/${imagesAttempted} photo${imagesAttempted > 1 ? 's' : ''} n'${missing > 1 ? 'ont' : 'a'} pas pu partir (seul le texte est arrivé).`
    }
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
    return executePublishToPortals(ctx, pending.args).then((r) => r.message)
  }
  if (pending.tool === 'withdraw_from_portals') {
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id, lang }
    return executeWithdrawFromPortals(ctx, pending.args).then((r) => r.message)
  }
  return t(lang, 'unknownAction')
}
