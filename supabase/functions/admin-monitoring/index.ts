import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkMetaToken, tokenDaysMetric, tokenNeedsAlert } from '../_shared/whatsapp-token.ts'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'
import { evaluateAndSendAlerts, type WhatsAppDeadletters } from '../_shared/admin-alerts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Auth: accept service_role JWT (pg_cron) OR super_admin user JWT (dashboard)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const token = authHeader.replace('Bearer ', '')

    // Decode JWT payload to check role without a DB roundtrip
    let jwtRole = ''
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      jwtRole = payload.role ?? ''
    } catch { /* invalid JWT → will fail below */ }

    // service_role = trusted internal call (pg_cron, other Edge Functions).
    // Accept BOTH the legacy service_role JWT (role claim) and the current
    // sb_secret_ service key (string-equality with the runtime env), so crons
    // sending get_app_config('service_role_key') authenticate.
    const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const isServiceKey = svcKey !== '' && token === svcKey
    if (jwtRole !== 'service_role' && !isServiceKey) {
      // Interactive call from dashboard — super_admin : rôle + allowlist email
      // + AAL2 (voir _shared/require-super-admin.ts, migration 20260705160000)
      const auth = await requireSuperAdmin(req, corsHeaders)
      if (auth instanceof Response) return auth
    }

    // ── Collect metrics ──
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    // Basic counts from Supabase tables
    const [agencyCount, userCount, propertyCount, transactionCount, errorCount, emailCount] = await Promise.all([
      supabaseAdmin.from('agencies').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true })
        .eq('action', 'edge_function_error').gte('created_at', dayAgo),
      supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true })
        .eq('action', 'email_sent').gte('created_at', todayStart),
    ])

    // ── Pro plan: Real DB size via SQL ──
    let dbSizeMb = 0
    try {
      const { data: dbSize } = await supabaseAdmin.rpc('pg_database_size_mb', {})
      dbSizeMb = dbSize ?? 0
    } catch {
      // Fallback: query pg_database_size directly
      try {
        const { data } = await supabaseAdmin
          .from('pg_stat_database')
          .select('pg_database_size')
          .limit(1)
          .single()
        dbSizeMb = data ? Math.round(Number(data.pg_database_size) / (1024 * 1024)) : 0
      } catch {
        dbSizeMb = 160 // Fallback
      }
    }

    // ── Pro plan: Storage usage via pg_total_relation_size on storage.objects ──
    let storageUsedMb = 0
    try {
      // Query the actual size of all objects in Supabase Storage via the
      // internal storage.objects table. This is more accurate than the previous
      // bucket-count heuristic (buckets.length * 10 MB) which was always wrong.
      const { data: sizeRow } = await supabaseAdmin.rpc('storage_size_mb', {})
      storageUsedMb = sizeRow ?? 0
    } catch {
      // Fallback: count objects and estimate 500 KB average per file
      try {
        const { count } = await supabaseAdmin
          .from('objects' as never) // storage.objects schema
          .select('id', { count: 'exact', head: true })
        storageUsedMb = Math.round(((count ?? 0) * 0.5) / 1) // 0.5 MB avg
      } catch {
        storageUsedMb = 0
      }
    }

    // ── Flatfox sync health ──
    // Track listing count and last sync time so AdminMonitoringPage can show
    // whether the daily pg_cron sync ran successfully.
    let flatfoxActiveCount = 0
    let flatfoxLastSeen: string | null = null
    try {
      const [countRes, lastRes] = await Promise.all([
        supabaseAdmin.from('market_listings').select('id', { count: 'exact', head: true })
          .eq('source_portal', 'flatfox').eq('status', 'active'),
        supabaseAdmin.from('market_listings').select('last_seen_at')
          .eq('source_portal', 'flatfox').order('last_seen_at', { ascending: false }).limit(1),
      ])
      flatfoxActiveCount = countRes.count ?? 0
      flatfoxLastSeen = lastRes.data?.[0]?.last_seen_at ?? null
    } catch { /* non-critical */ }

    // ── Open support tickets ──
    let openTickets = 0
    try {
      const { count } = await supabaseAdmin.from('support_tickets')
        .select('id', { count: 'exact', head: true }).in('status', ['new', 'open'])
      openTickets = count ?? 0
    } catch { /* non-critical */ }

    // ── Store all metrics ──
    const metrics = [
      { metric_type: 'agency_count', metric_value: agencyCount.count ?? 0 },
      { metric_type: 'user_count', metric_value: userCount.count ?? 0 },
      { metric_type: 'property_count', metric_value: propertyCount.count ?? 0 },
      { metric_type: 'transaction_count', metric_value: transactionCount.count ?? 0 },
      { metric_type: 'error_count_24h', metric_value: errorCount.count ?? 0 },
      { metric_type: 'email_count_today', metric_value: emailCount.count ?? 0 },
      { metric_type: 'db_size_mb', metric_value: dbSizeMb },
      { metric_type: 'storage_used_mb', metric_value: storageUsedMb },
      { metric_type: 'flatfox_active_count', metric_value: flatfoxActiveCount },
      { metric_type: 'open_tickets', metric_value: openTickets },
    ]

    // ── Santé du token Meta WhatsApp (expiration → panne silencieuse des envois) ──
    // Best-effort (non-critique) : métrique de tendance + état courant dans app_config
    // + log d'alerte si invalide ou expire bientôt. Réutilise ce cron horaire.
    try {
      const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
      if (metaToken) {
        const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
        const health = await checkMetaToken(metaToken, apiVersion, now.getTime())
        metrics.push({ metric_type: 'whatsapp_token_days_left', metric_value: tokenDaysMetric(health) })
        await supabaseAdmin.from('app_config').upsert(
          { key: 'whatsapp_token_health', value: JSON.stringify({ ...health, checked_at: now.toISOString() }) },
          { onConflict: 'key' },
        )
        if (tokenNeedsAlert(health)) {
          console.error('[whatsapp] ALERTE token Meta:',
            health.isValid ? `expire dans ${health.daysLeft} j` : `INVALIDE (${health.error})`)
        }
      }
    } catch (e) { console.error('whatsapp token check failed:', (e as Error)?.name ?? 'error') }

    // ── Dead-letters WhatsApp (audit WA) — files d'échec ni enregistrées ni
    // surveillées jusqu'ici. RPC serveur (une passe indexée par signal). 5
    // compteurs → tendance dans platform_metrics + alerting du taux 24h.
    // Best-effort : ne casse jamais la collecte.
    let waDeadletters: WhatsAppDeadletters | undefined
    try {
      const { data: dl, error: dlErr } = await supabaseAdmin.rpc('get_whatsapp_deadletter_metrics')
      // supabase-js ne LÈVE PAS sur erreur DB (RAISE 42501 / statement timeout /
      // permission) : il faut lire `error`. Sur échec → métriques ABSENTES (pas
      // de fausse-zéro qui masquerait un backlog réel) et alerte non évaluée.
      if (dlErr) throw dlErr
      const c = (dl ?? {}) as Record<string, unknown>
      const n = (k: string) => Number(c[k] ?? 0) || 0
      waDeadletters = {
        processing_failed: n('processing_failed'),
        processing_deadletter: n('processing_deadletter'),
        processing_deadletter_24h: n('processing_deadletter_24h'),
        agent_errors_24h: n('agent_errors_24h'),
        delivery_failed_24h: n('delivery_failed_24h'),
        async_jobs_failed_24h: n('async_jobs_failed_24h'),
      }
      metrics.push(
        { metric_type: 'wa_processing_failed', metric_value: waDeadletters.processing_failed },
        { metric_type: 'wa_processing_deadletter', metric_value: waDeadletters.processing_deadletter },
        { metric_type: 'wa_agent_errors_24h', metric_value: waDeadletters.agent_errors_24h },
        { metric_type: 'wa_delivery_failed_24h', metric_value: waDeadletters.delivery_failed_24h },
        { metric_type: 'wa_async_jobs_failed_24h', metric_value: waDeadletters.async_jobs_failed_24h },
      )
    } catch (e) { console.error('whatsapp deadletter metrics failed:', (e as Error)?.message ?? 'error') }

    // ── Santé des intégrations + MRR estimé (P7) — 2 RPC serveur, best-effort.
    // mrr_estimate + calendar_sync_stale_count + stripe_webhook_age_hours →
    // tendance dans platform_metrics + signaux passés à l'alerting.
    let calendarStaleCount: number | undefined
    let stripeWebhookAgeHours: number | null | undefined
    let activeSubscriptions: number | undefined
    try {
      const { data: mrr, error: mrrErr } = await supabaseAdmin.rpc('compute_platform_mrr_estimate')
      if (mrrErr) throw mrrErr
      metrics.push({ metric_type: 'mrr_estimate', metric_value: Number(mrr ?? 0) })

      const { data: health, error: healthErr } = await supabaseAdmin.rpc('get_admin_integrations_health')
      if (healthErr) throw healthErr
      const h = (health ?? {}) as Record<string, Record<string, unknown>>
      calendarStaleCount = Number(h.calendar?.stale_total ?? 0) || 0
      stripeWebhookAgeHours = h.stripe_webhook?.age_hours == null ? null : Number(h.stripe_webhook.age_hours)
      activeSubscriptions = Number(h.stripe_webhook?.active_subscriptions ?? 0) || 0
      metrics.push(
        { metric_type: 'calendar_sync_stale_count', metric_value: calendarStaleCount },
        { metric_type: 'stripe_webhook_age_hours', metric_value: stripeWebhookAgeHours ?? -1 },
      )
    } catch (e) {
      console.error('[admin-monitoring] integrations health failed:', (e as Error)?.message ?? 'error')
    }

    await supabaseAdmin.from('platform_metrics').insert(metrics)

    // ── Alerting proactif (P3) — seuils app_config, dédup 24h, email aux
    // admins allowlistés. Best-effort : ne casse jamais la collecte.
    try {
      await evaluateAndSendAlerts(supabaseAdmin, {
        errorCount24h: errorCount.count ?? 0,
        flatfoxLastSeen,
        waDeadletters,
        calendarStaleCount,
        stripeWebhookAgeHours,
        activeSubscriptions,
        now,
      })
    } catch (e) {
      console.error('[admin-monitoring] alerting failed:', (e as Error)?.message)
    }

    return new Response(JSON.stringify({
      success: true,
      metrics,
      plan: 'pro',
      recorded_at: now.toISOString(),
      flatfox_last_seen: flatfoxLastSeen,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const status = (err as Error).message === 'Forbidden' ? 403 : 401
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
