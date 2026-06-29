// supabase/functions/idx-syndicate/index.ts
//
// Push FTP du feed IDX — déclenché par pg_cron (cf. migration idx_ftp_transport)
// ou manuellement (POST {agency_id?}). Pour chaque agence configurée FTP :
//   1. génère le feed IDX (cœur partagé buildAgencyIdxFeed),
//   2. le DÉPOSE sur le FTP du portail (idx-ftp),
//   3. passe les biens inclus queued → published + last_pushed_at + audit.
//
// Auth interne : Bearer == service-role (pg_cron l'envoie). verify_jwt=false.
// No-op tant qu'aucune agence n'a de ftp_host (sécurisé avant d'avoir les accès).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildAgencyIdxFeed } from '../_shared/idx-feed-core.ts'
import { uploadIdxCsv, type FtpTarget } from '../_shared/idx-ftp.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const FTP_PASSWORD = Deno.env.get('IDX_FTP_PASSWORD') ?? '' // pilote mono-agence
const LISTING_BASE_URL = Deno.env.get('IDX_LISTING_BASE_URL') ?? ''
const DEFAULT_PORTAL = 'immobilier_ch'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

// Comparaison à temps constant (anti timing-attack sur le secret service-role).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface SyndConfigRow {
  agency_id: string
  idx_sender_id: string
  ftp_host: string | null
  ftp_port: number | null
  ftp_secure: boolean | null
  ftp_username: string | null
  ftp_remote_dir: string | null
  ftp_remote_filename: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!SERVICE_ROLE_KEY || !safeEqual(auth, SERVICE_ROLE_KEY)) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const body = (req.method === 'POST' ? await req.json().catch(() => ({})) : {}) as { agency_id?: string }
  const onlyAgency = typeof body.agency_id === 'string' ? body.agency_id : null

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  // Agences à pousser : FTP activé + configuré.
  let query = supabase
    .from('agency_syndication_config')
    .select('agency_id, idx_sender_id, ftp_host, ftp_port, ftp_secure, ftp_username, ftp_remote_dir, ftp_remote_filename')
    .eq('idx_enabled', true)
    .eq('transport', 'ftp')
    .not('ftp_host', 'is', null)
  if (onlyAgency) query = query.eq('agency_id', onlyAgency)

  const { data: configs, error: cfgErr } = await query
  if (cfgErr) return json({ ok: false, error: cfgErr.message }, 500)

  const report: Array<Record<string, unknown>> = []

  for (const cfg of (configs ?? []) as SyndConfigRow[]) {
    const agencyId = cfg.agency_id
    try {
      const feed = await buildAgencyIdxFeed(supabase, agencyId, DEFAULT_PORTAL, {
        senderId: cfg.idx_sender_id,
        listingBaseUrl: LISTING_BASE_URL || null,
      })
      if (!feed.agencyFound) { report.push({ agencyId, skipped: 'agency_not_found' }); continue }
      if (feed.propertyIds.length === 0) { report.push({ agencyId, skipped: 'no_listings' }); continue }
      if (!FTP_PASSWORD) { report.push({ agencyId, error: 'missing IDX_FTP_PASSWORD secret' }); continue }

      const target: FtpTarget = {
        host: cfg.ftp_host as string,
        port: cfg.ftp_port ?? 21,
        secure: !!cfg.ftp_secure,
        user: cfg.ftp_username ?? '',
        password: FTP_PASSWORD,
        remoteDir: cfg.ftp_remote_dir ?? '/',
        remoteFilename: cfg.ftp_remote_filename ?? 'megga.idx',
      }
      await uploadIdxCsv(target, feed.csv)

      const nowIso = new Date().toISOString()
      // Livré → queued/published passent published + bump last_pushed_at.
      await supabase
        .from('property_syndications')
        .update({ status: 'published', last_pushed_at: nowIso, error: null, updated_at: nowIso })
        .eq('agency_id', agencyId)
        .eq('portal', DEFAULT_PORTAL)
        .in('property_id', feed.propertyIds)
        .in('status', ['queued', 'published'])

      try {
        await supabase.from('activity_events').insert({
          agency_id: agencyId, actor_id: null, actor_kind: 'system',
          action: 'idx_feed_pushed', entity_type: 'agency', entity_id: agencyId, category: 'bien',
          severity: 'info', metadata: { portal: DEFAULT_PORTAL, count: feed.propertyIds.length, via: 'ftp' },
        })
      } catch { /* non bloquant */ }

      report.push({ agencyId, pushed: feed.propertyIds.length })
    } catch (err) {
      console.error('idx-syndicate agency failed:', agencyId, (err as Error)?.message ?? 'error')
      report.push({ agencyId, error: (err as Error)?.message ?? 'error' })
    }
  }

  return json({ ok: true, agencies: report.length, report })
})
