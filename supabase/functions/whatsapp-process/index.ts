// supabase/functions/whatsapp-process/index.ts
// Orchestrateur cron — traite les conversations WhatsApp entrantes en 3 phases :
//   1. Média/voix : téléchargement Meta → R2 + transcription Deepgram (file durable).
//   2. Compréhension : insight MEGGA par contact (DeepSeek), péremption dérivée.
//   3. Compliance : avis LPD une fois par numéro client.
// Appelé UNIQUEMENT par pg_cron en service-role. DÉPLOYER verify_jwt=true
// (config.toml + allowlist deploy.yml) — NE JAMAIS --no-verify-jwt.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.17'
import { fetchMetaMedia, buildMediaKey } from '../_shared/whatsapp-media.ts'
import { transcribe } from '../_shared/whatsapp-transcribe.ts'
import { buildThreadDigest, buildMessages, comprehend, type ThreadMessage } from '../_shared/whatsapp-comprehend.ts'
import { getProvider, type SendConfig } from '../_shared/whatsapp-gateway.ts'

const BATCH = 10            // messages média réclamés / tick (chaque op peut être lente)
const MAX_RETRIES = 3
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

  const t0 = Date.now()
  const overBudget = () => Date.now() - t0 > BUDGET_MS
  const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
  const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
  const metaPhoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID') ?? ''
  const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY') ?? ''
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY') ?? ''

  const r2 = new AwsClient({
    accessKeyId: (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim(),
    secretAccessKey: (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim(),
    region: 'auto', service: 's3',
  })
  const r2Account = (Deno.env.get('CF_ACCOUNT_ID') ?? '').trim()
  const r2Bucket = Deno.env.get('R2_BUCKET') ?? 'megga-market'

  // ── Phase 1 : média + transcription (file durable, reprise sur échec). ──
  const { data: jobs, error } = await admin.rpc('claim_whatsapp_jobs', { p_batch: BATCH })
  if (error) return json({ error: error.message }, 500)

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
        const insight = await comprehend(buildMessages(digest), deepseekKey)
        await admin.from('whatsapp_conversation_insights').upsert({
          contact_id: c.contact_id, agency_id: c.agency_id,
          summary: insight.summary, intent: insight.intent, entities: insight.entities,
          commitments: insight.commitments, sentiment: insight.sentiment, next_action: insight.next_action,
          model: 'deepseek-chat', source_message_count: (thread ?? []).length,
          source_last_message_at: c.last_message_at, generated_at: new Date().toISOString(),
        }, { onConflict: 'contact_id' })
        insights++
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

  return json({ ok: true, claimed: (jobs ?? []).length, done, failed, insights, notices }, 200)
})
