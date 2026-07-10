// supabase/functions/whatsapp-process/index.ts
// Orchestrateur cron — traite les conversations WhatsApp entrantes en 3 phases :
//   1. Média/voix : téléchargement Meta → R2 + transcription Deepgram (file durable).
//   2. Compréhension : insight MEGGA par contact (DeepSeek), péremption dérivée.
//   3. Compliance : avis LPD une fois par numéro client.
// Appelé UNIQUEMENT par pg_cron en service-role. verify_jwt=false (config.toml + déploiement
// --no-verify-jwt) : la plateforme rejette la clé service-role legacy quand verify_jwt=true
// (UNAUTHORIZED_LEGACY_JWT). La garde se fait DANS la fonction (Bearer comparé à
// app_config.service_role_key, cf. ci-dessous).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.17'
import { fetchMetaMedia, buildMediaKey } from '../_shared/whatsapp-media.ts'
import { transcribe } from '../_shared/whatsapp-transcribe.ts'
import { describeInboundMedia, threadTextFor, isReadableDocMime } from '../_shared/vision.ts'
import { buildThreadDigest, buildMessages, comprehend, type ThreadMessage, type ConversationInsight } from '../_shared/whatsapp-comprehend.ts'
import { logDeepSeekUsageWith } from '../_shared/ai-usage.ts'
import { getProvider, type SendConfig } from '../_shared/whatsapp-gateway.ts'
import { mapCriteria, computeMissing, isSearchable, mergeCriteria, criteriaDelta, type LeadCriteria } from '../_shared/whatsapp-lead.ts'
import { deriveFollowups, persistFollowups } from '../_shared/whatsapp-followups.ts'
import { isWhatsAppEnabled } from '../_shared/whatsapp-config.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH = 10            // messages média réclamés / tick (chaque op peut être lente)
const MAX_RETRIES = 3
const MAX_VISION_BYTES = 12 * 1024 * 1024  // au-delà : on garde le média mais on ne le lit pas (coût/latence)
const INSIGHT_BATCH = 5     // contacts ré-analysés / tick (borne coût DeepSeek + temps)
const NOTICE_BATCH = 10     // avis LPD envoyés / tick
const BUDGET_MS = 90_000    // budget temps : on rend la main avant la limite edge (~150s)

const NOTICE_TEXT =
  'Bonjour, cette conversation est suivie via notre outil de gestion (MEGGA) pour traiter ' +
  'votre demande. Vos données sont traitées conformément à la LPD ; vous pouvez en demander ' +
  'la consultation ou la suppression à tout moment.'

function json(o: unknown, c: number): Response {
  return new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } })
}

// Comparaison à temps constant (anti timing-attack sur le secret service-role).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const LOCK_JOB = 'whatsapp-process'
const LOCK_TTL_MS = 120_000  // > BUDGET_MS : filet anti-crash ; le release explicite libère avant.

/** Lease atomique en base (anti-chevauchement du cron, cf. migration 20260705130000).
 *  Décroche le verrou par UPDATE conditionnel (locked_until < now). Fail-open si l'infra de
 *  verrou est absente/en erreur (disponibilité > optimisation anti-chevauchement). */
async function claimProcessLock(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin.from('whatsapp_cron_locks')
    .update({ locked_until: new Date(Date.now() + LOCK_TTL_MS).toISOString() })
    .eq('job', LOCK_JOB)
    .lt('locked_until', new Date().toISOString())
    .select('job')
  if (error) { console.error('cron lock claim error (fail-open):', error.message.slice(0, 120)); return true }
  return !!(data && data.length > 0)
}
/** Relâche le lease (best-effort). Le TTL couvre les crashs. */
async function releaseProcessLock(admin: SupabaseClient): Promise<void> {
  await admin.from('whatsapp_cron_locks')
    .update({ locked_until: new Date(Date.now() - 1000).toISOString() })
    .eq('job', LOCK_JOB)
    .then(() => {}, () => {})
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // Garde service-role : pg_cron envoie Bearer <service_role_key d'app_config>. verify_jwt=FALSE
  // (clé legacy rejetée sinon) — on compare le token reçu à app_config (même source que le cron),
  // comparaison à temps constant. Non forgeable sans la clé service-role.
  {
    const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
    const expectedKey = (cfg?.value as string | undefined) ?? ''
    const providedKey = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!expectedKey || !safeEqual(providedKey, expectedKey)) return json({ error: 'Forbidden' }, 403)
  }

  // Kill-switch : coupé → on rend la main sans rien traiter (média/insight/avis).
  if (!(await isWhatsAppEnabled(admin))) return json({ ok: true, disabled: true }, 200)

  // Anti-chevauchement : on ne traite que si on décroche le lease (le budget 90s dépasse
  // l'intervalle cron 60s → sinon deux instances tourneraient en parallèle). Sinon main rendue.
  if (!(await claimProcessLock(admin))) return json({ ok: true, skipped: 'locked' }, 200)

  const t0 = Date.now()
  const overBudget = () => Date.now() - t0 > BUDGET_MS
  const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
  const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
  const metaPhoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID') ?? ''
  const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY') ?? ''
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY') ?? ''
  const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

  const r2 = new AwsClient({
    accessKeyId: (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim(),
    secretAccessKey: (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim(),
    region: 'auto', service: 's3',
  })
  const r2Account = (Deno.env.get('CF_ACCOUNT_ID') ?? '').trim()
  const r2Bucket = Deno.env.get('R2_BUCKET_NAME') ?? Deno.env.get('R2_BUCKET') ?? 'megga-market'

  // ── Phase 1 : média + transcription (file durable, reprise sur échec). ──
  const { data: jobs, error } = await admin.rpc('claim_whatsapp_jobs', { p_batch: BATCH })
  if (error) { await releaseProcessLock(admin); return json({ error: error.message }, 500) }

  let done = 0, failed = 0
  for (const m of (jobs ?? []) as Array<Record<string, unknown>>) {
    if (overBudget()) break  // reste 'processing' → repris au tick suivant (>5 min)
    const id = m.id as string
    try {
      const patch: Record<string, unknown> = { processing_status: 'done', last_error: null }
      if (m.media_id && metaToken) {
        const { bytes, mime } = await fetchMetaMedia(m.media_id as string, { metaToken, apiVersion })
        const key = buildMediaKey((m.agency_id as string) ?? 'unknown', id, (m.media_mime as string) ?? mime)
        await r2.fetch(`https://${r2Account}.r2.cloudflarestorage.com/${r2Bucket}/${key}`, {
          method: 'PUT', body: bytes, headers: { 'Content-Type': mime || 'application/octet-stream' },
        })
        patch.media_r2_key = key
        if (mime && !m.media_mime) patch.media_mime = mime
        if ((mime ?? '').startsWith('audio/') && deepgramKey) {
          const t = await transcribe(bytes, mime, deepgramKey)
          patch.transcript = t.transcript
          patch.transcript_lang = t.lang
          patch.transcript_confidence = t.confidence
        } else if (geminiKey && isReadableDocMime(mime) && bytes.length <= MAX_VISION_BYTES) {
          // Image/PDF entrant : Gemini Vision classe + résume → rangé dans `transcript`
          // (le digest le lit → l'insight « voit » le média). Garde-fou résidence : une
          // pièce d'identité n'est jamais recopiée (threadTextFor redacte). Best-effort.
          const u = await describeInboundMedia(bytes, mime, geminiKey)
          if (u.ok && u.data) {
            patch.transcript = threadTextFor(u.data)
            patch.media_kind = u.data.kind
          }
        }
      }
      await admin.from('whatsapp_messages').update(patch).eq('id', id)
      done++
    } catch (e) {
      const rc = ((m.retry_count as number) ?? 0) + 1
      await admin.from('whatsapp_messages').update({
        processing_status: rc >= MAX_RETRIES ? 'failed' : 'pending',
        retry_count: rc,
        last_error: String((e as Error)?.message ?? 'error').slice(0, 300),
      }).eq('id', id)
      failed++
    }
  }

  // ── Phase 2 : compréhension MEGGA (DeepSeek) des conversations actives. ──
  // Échec d'un insight = on garde l'ancien, réessai au prochain tick (jamais bloquant).
  let insights = 0
  if (deepseekKey && !overBudget()) {
    const { data: stale } = await admin.rpc('whatsapp_stale_insight_contacts', { p_limit: INSIGHT_BATCH })
    for (const c of (stale ?? []) as Array<{ contact_id: string; agency_id: string; last_message_at: string }>) {
      if (overBudget()) break
      try {
        const { data: thread } = await admin
          .from('whatsapp_messages')
          .select('direction, body, transcript, created_at')
          .eq('contact_id', c.contact_id)
          .order('created_at', { ascending: true })
          .limit(30)
        const digest = buildThreadDigest((thread ?? []) as ThreadMessage[])
        if (!digest) continue
        const insight = await comprehend(buildMessages(digest), deepseekKey, (usage, latencyMs) =>
          logDeepSeekUsageWith(admin, usage, {
            edgeFunction: 'whatsapp-process', module: 'whatsapp-comprehend',
            latencyMs, agencyId: c.agency_id,
          }))
        await admin.from('whatsapp_conversation_insights').upsert({
          contact_id: c.contact_id, agency_id: c.agency_id,
          summary: insight.summary, intent: insight.intent, entities: insight.entities,
          commitments: insight.commitments, objections: insight.objections,
          sentiment: insight.sentiment, urgency: insight.urgency, language: insight.language,
          next_action: insight.next_action,
          model: 'deepseek-chat', source_message_count: (thread ?? []).length,
          source_last_message_at: c.last_message_at, generated_at: new Date().toISOString(),
        }, { onConflict: 'contact_id' })
        insights++
        // Phase 4B : MEGGA qualifie le lead en autonomie (crée/enrichit + matching).
        if (insight.lead) {
          try { await qualifyLead(admin, c.agency_id, c.contact_id, insight, digest) }
          catch (e) { console.error('whatsapp lead qualify failed:', String((e as Error)?.message ?? 'error').slice(0, 120)) }
        }
        // Engagements actionnables : transforme les commitments/next_action en
        // suggestions de suivi datées (l'agent accepte → vrai rappel). Best-effort.
        try {
          const followups = deriveFollowups(insight, { nowISO: new Date().toISOString() })
          if (followups.length) await persistFollowups(admin, c.agency_id, c.contact_id, followups, c.last_message_at)
        } catch (e) {
          console.error('whatsapp followups failed:', String((e as Error)?.message ?? 'error').slice(0, 120))
        }
      } catch (e) {
        console.error('whatsapp insight failed:', String((e as Error)?.message ?? 'error').slice(0, 120))
      }
    }
  }

  // ── Phase 3 : avis LPD au premier message d'un client (une fois par numéro). ──
  let notices = 0
  if (metaToken && metaPhoneNumberId && !overBudget()) {
    const { data: pendingNotices } = await admin.rpc('whatsapp_pending_notices', { p_limit: NOTICE_BATCH })
    const provider = getProvider('meta')
    const cfg: SendConfig = { metaToken, metaPhoneNumberId, metaApiVersion: apiVersion }
    for (const n of (pendingNotices ?? []) as Array<{ agency_id: string; wa_phone: string }>) {
      if (overBudget()) break
      try {
        const sreq = provider.buildSendTextRequest({ toPhone: n.wa_phone, body: NOTICE_TEXT }, cfg)
        await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
      } catch (e) {
        console.error('whatsapp notice send failed:', String((e as Error)?.message ?? 'error').slice(0, 80))
      }
      // Une tentative par numéro : on enregistre l'avis quoi qu'il arrive (la fenêtre
      // 24h de whatsapp_pending_notices borne déjà les renvois).
      await admin.from('whatsapp_notices').upsert(
        { agency_id: n.agency_id, wa_phone: n.wa_phone },
        { onConflict: 'agency_id,wa_phone', ignoreDuplicates: true },
      )
      notices++
    }
  }

  // L3 : purge des médias R2 TRAITÉS (transcript/description NON VIDE) > 30 j (minimisation
  // nLPD). Tous types : audio (transcrit Deepgram) ET images/PDF (décrits Gemini, y compris
  // pièces d'identité dont le transcript est déjà redacté). La copie R2 ne sert qu'au
  // traitement — media_url pointe vers Meta (éphémère), le CRM n'affiche jamais depuis R2 et
  // aucun code ne relit media_r2_key après coup → purger ne casse aucun affichage.
  // Best-effort, borné, FIFO. Un transcript vide = traitement raté → on GARDE l'objet
  // (re-tentable / vérifiable). Durcissement futur : purge immédiate des id_document +
  // exclusion des objets en échec persistant (poison-pill) au-delà de N tentatives.
  try {
    const { data: stale } = await admin.from('whatsapp_messages')
      .select('id, media_r2_key')
      .not('media_r2_key', 'is', null)
      .not('transcript', 'is', null)
      .neq('transcript', '')
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(20)
    for (const m of (stale ?? []) as Array<{ id: string; media_r2_key: string }>) {
      const key = m.media_r2_key
      if (!key) continue
      const del = await r2.fetch(`https://${r2Account}.r2.cloudflarestorage.com/${r2Bucket}/${key}`, { method: 'DELETE' })
      // R2 DELETE → 204 (supprimé) ou 404 (déjà absent) → on vide la clé. Sinon on la garde (retry).
      if (del.ok || del.status === 404) {
        await admin.from('whatsapp_messages').update({ media_r2_key: null }).eq('id', m.id)
      } else {
        console.error('L3 purge R2 delete failed', del.status, key)
      }
    }
  } catch (e) { console.error('L3 purge failed:', (e as Error)?.name ?? 'error') }

  await releaseProcessLock(admin)
  return json({ ok: true, claimed: (jobs ?? []).length, done, failed, insights, notices }, 200)
})

// ── Phase 4B : qualification autonome du lead ───────────────────────────────
// À partir de l'insight, MEGGA résout le contact (tiers → dédoublonne/crée ;
// sinon l'expéditeur), le flague « à compléter », et — si les critères suffisent —
// crée une client_searches qui déclenche le matching (trigger DB). Idempotent
// (tag whatsapp_ai_qualified). Création/MAJ interne = autonome ; aucun envoi client.
async function qualifyLead(
  admin: SupabaseClient,
  agencyId: string,
  senderContactId: string,
  insight: ConversationInsight,
  digest: string,
): Promise<void> {
  const lead = insight.lead
  if (!lead) return

  // 1. Résoudre le contact du lead.
  let leadContactId = senderContactId
  let created = false
  if (lead.is_third_party && (lead.first_name || lead.last_name)) {
    let found: { id: string } | null = null
    if (lead.phone) {
      const tail = lead.phone.replace(/\D/g, '').slice(-9)
      if (tail.length >= 6) {
        const { data } = await admin.from('contacts').select('id').eq('agency_id', agencyId).ilike('phone', `%${tail}`).limit(1).maybeSingle()
        found = (data as { id: string } | null) ?? null
      }
    }
    if (!found) {
      let q = admin.from('contacts').select('id').eq('agency_id', agencyId)
      if (lead.first_name) q = q.ilike('first_name', lead.first_name)
      if (lead.last_name) q = q.ilike('last_name', lead.last_name)
      const { data } = await q.limit(1).maybeSingle()
      found = (data as { id: string } | null) ?? null
    }
    if (found) {
      leadContactId = found.id
    } else {
      // email NOT NULL sur contacts → placeholder déterministe si absent (à compléter).
      const email = lead.email ??
        `wa-lead-${`${lead.first_name ?? ''}${lead.last_name ?? ''}`.toLowerCase().replace(/[^a-z0-9]/g, '') || 'anon'}-${agencyId.slice(0, 8)}@whatsapp.megga.local`
      const { data: newC, error } = await admin.from('contacts').insert({
        agency_id: agencyId,
        first_name: lead.first_name ?? 'Lead',
        last_name: lead.last_name ?? 'WhatsApp',
        email,
        phone: lead.phone,
        type: 'lead',
        source: 'whatsapp_ai',
        score: 'cold',
      }).select('id').single()
      if (error || !newC) return
      leadContactId = (newC as { id: string }).id
      created = true
    }
  }

  // 2. Critères extraits de CE fil + état du contact.
  const { data: cRow } = await admin.from('contacts').select('tags, phone, email, search_criteria').eq('id', leadContactId).maybeSingle()
  const tags: string[] = Array.isArray(cRow?.tags) ? (cRow!.tags as string[]) : []
  const criteria = mapCriteria(insight.intent, insight.entities, digest)

  // 2b. Déjà qualifié → ENRICHISSEMENT continu (fusion non destructive) puis stop.
  //     On ne re-crée pas, on RAFFINE : nouvelles zones/prestations, champs comblés.
  if (!created && tags.includes('whatsapp_ai_qualified')) {
    await enrichQualifiedLead(admin, agencyId, leadContactId, tags,
      (cRow?.search_criteria ?? null) as LeadCriteria | null, criteria,
      { phone: cRow?.phone ?? lead.phone, email: cRow?.email ?? lead.email })
    return
  }

  // 3. Première qualification : champs manquants.
  const missing = computeMissing(criteria, { phone: cRow?.phone ?? lead.phone, email: cRow?.email ?? lead.email })

  // 4. MAJ contact : tags + critères structurés.
  const newTags = Array.from(new Set([...tags, 'whatsapp_ai_qualified', ...(missing.length ? ['à_compléter'] : [])]))
  await admin.from('contacts').update({ tags: newTags, search_criteria: criteria }).eq('id', leadContactId)

  // 5. client_searches (→ matching auto via trigger) si critères suffisants et pas déjà active.
  if (isSearchable(criteria)) {
    const { data: existingSearch } = await admin.from('client_searches')
      .select('id').eq('contact_id', leadContactId).eq('is_active', true).limit(1).maybeSingle()
    if (!existingSearch) {
      await admin.from('client_searches').insert({
        agency_id: agencyId,
        contact_id: leadContactId,
        label: `WhatsApp — ${criteria.transaction_type === 'rent' ? 'location' : 'achat'}`,
        criteria,
        is_active: true,
      })
    }
  }

  // 6. Timeline (badge IA) : ce que MEGGA a fait + ce qui manque.
  const critTxt = [
    criteria.transaction_type === 'rent' ? 'location' : criteria.transaction_type === 'buy' ? 'achat' : null,
    criteria.type,
    (criteria.zones ?? []).join('/') || null,
    criteria.budget_max ? `budget ${criteria.budget_max}` : null,
    (criteria.features ?? []).join(', ') || null,
  ].filter(Boolean).join(' · ')
  const note = `Lead qualifié par MEGGA depuis WhatsApp.${critTxt ? ` ${critTxt}.` : ''}` +
    (missing.length ? ` À compléter : ${missing.join(', ')}.` : '')
  await admin.from('activity_events').insert({
    agency_id: agencyId,
    actor_id: null,
    actor_kind: 'ai',
    action: created ? 'Lead créé (WhatsApp)' : 'Lead qualifié (WhatsApp)',
    entity_type: 'contact',
    entity_id: leadContactId,
    object_label: note.slice(0, 500),
    category: 'contact',
    severity: 'info',
    metadata: { via: 'whatsapp', phase: '4b' },
  })
}

// ── Enrichissement continu d'un lead déjà qualifié ──────────────────────────
// Fusion NON DESTRUCTIVE des nouveaux critères dans la fiche + la recherche active
// (jamais d'écrasement d'une valeur posée par l'agent). Écrit SEULEMENT s'il y a du
// neuf ; la MAJ de client_searches.criteria relance le matching (trigger DB
// on_search_criteria_updated). Audit du delta. Best-effort (appelé dans un try).
async function enrichQualifiedLead(
  admin: SupabaseClient,
  agencyId: string,
  contactId: string,
  tags: string[],
  current: LeadCriteria | null,
  incoming: LeadCriteria,
  contact: { phone?: string | null; email?: string | null },
): Promise<void> {
  const merged = mergeCriteria(current, incoming)
  const delta = criteriaDelta(current, merged)
  if (delta.length === 0) return // rien de neuf → aucune écriture, aucun bruit

  // Fiche : critères enrichis + recalcul du flag « à compléter ».
  const missing = computeMissing(merged, contact)
  const base = tags.filter((t) => t !== 'à_compléter')
  const newTags = Array.from(new Set(missing.length ? [...base, 'à_compléter'] : base))
  await admin.from('contacts').update({ search_criteria: merged, tags: newTags }).eq('id', contactId)

  // Recherche active : on fusionne AUSSI dans SES critères (jamais perdre ce que
  // l'agent y aurait ajouté), ce qui déclenche le re-matching si ça change.
  if (isSearchable(merged)) {
    const { data: active } = await admin.from('client_searches')
      .select('id, criteria').eq('contact_id', contactId).eq('is_active', true).limit(1).maybeSingle()
    if (active) {
      const searchMerged = mergeCriteria((active.criteria ?? null) as LeadCriteria | null, merged)
      if (criteriaDelta((active.criteria ?? null) as LeadCriteria | null, searchMerged).length > 0) {
        await admin.from('client_searches').update({ criteria: searchMerged }).eq('id', active.id)
      }
    } else {
      await admin.from('client_searches').insert({
        agency_id: agencyId, contact_id: contactId,
        label: `WhatsApp — ${merged.transaction_type === 'rent' ? 'location' : 'achat'}`,
        criteria: merged, is_active: true,
      })
    }
  }

  await admin.from('activity_events').insert({
    agency_id: agencyId, actor_id: null, actor_kind: 'ai',
    action: 'Fiche enrichie (WhatsApp)', entity_type: 'contact', entity_id: contactId,
    object_label: `MEGGA a enrichi la recherche depuis WhatsApp : ${delta.join(' · ')}.`.slice(0, 500),
    category: 'contact', severity: 'info', metadata: { via: 'whatsapp', phase: '4b-enrich' },
  })
}
