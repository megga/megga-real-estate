// supabase/functions/whatsapp-process/index.ts
// Orchestrateur cron (L1) : réclame les messages 'pending', récupère le média
// Meta → R2, transcrit l'audio (Deepgram), marque done/failed avec reprise.
// Appelé UNIQUEMENT par pg_cron en service-role. DÉPLOYER verify_jwt=true
// (cf. config.toml + allowlist deploy.yml) — NE JAMAIS --no-verify-jwt.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.17'
import { fetchMetaMedia, buildMediaKey } from '../_shared/whatsapp-media.ts'
import { transcribe } from '../_shared/whatsapp-transcribe.ts'

const BATCH = 25
const MAX_RETRIES = 3

function json(o: unknown, c: number): Response {
  return new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } })
}

// Décode le claim `role` (signature validée par la plateforme via verify_jwt=true).
function isServiceRole(auth: string | null): boolean {
  if (!auth?.startsWith('Bearer ')) return false
  const parts = auth.slice(7).trim().split('.')
  if (parts.length !== 3) return false
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    return (JSON.parse(atob(b64 + pad)) as { role?: string }).role === 'service_role'
  } catch { return false }
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!isServiceRole(req.headers.get('Authorization'))) return json({ error: 'Forbidden' }, 403)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
  const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
  const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY') ?? ''

  const r2 = new AwsClient({
    accessKeyId: (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim(),
    secretAccessKey: (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim(),
    region: 'auto', service: 's3',
  })
  const r2Account = (Deno.env.get('CF_ACCOUNT_ID') ?? '').trim()
  const r2Bucket = Deno.env.get('R2_BUCKET') ?? 'megga-market'

  const { data: jobs, error } = await admin.rpc('claim_whatsapp_jobs', { p_batch: BATCH })
  if (error) return json({ error: error.message }, 500)
  if (!jobs?.length) return json({ ok: true, claimed: 0 }, 200)

  let done = 0, failed = 0
  for (const m of jobs as Array<Record<string, unknown>>) {
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

        const isAudio = (mime ?? '').startsWith('audio/')
        if (isAudio && deepgramKey) {
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
  return json({ ok: true, claimed: (jobs as unknown[]).length, done, failed }, 200)
})
