import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // service_role = trusted internal call (pg_cron, other Edge Functions)
    if (jwtRole !== 'service_role') {
      // Interactive call from dashboard — verify the user is super_admin
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError || !user) throw new Error('Unauthorized')

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'super_admin') throw new Error('Forbidden')
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

    await supabaseAdmin.from('platform_metrics').insert(metrics)

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
