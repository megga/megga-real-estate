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

    // Verify caller is super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') throw new Error('Forbidden')

    // Collect metrics
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

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

    // Store snapshot in platform_metrics
    const metrics = [
      { metric_type: 'agency_count', metric_value: agencyCount.count ?? 0 },
      { metric_type: 'user_count', metric_value: userCount.count ?? 0 },
      { metric_type: 'property_count', metric_value: propertyCount.count ?? 0 },
      { metric_type: 'transaction_count', metric_value: transactionCount.count ?? 0 },
      { metric_type: 'error_count_24h', metric_value: errorCount.count ?? 0 },
      { metric_type: 'email_count_today', metric_value: emailCount.count ?? 0 },
    ]

    await supabaseAdmin.from('platform_metrics').insert(metrics)

    return new Response(JSON.stringify({ success: true, metrics, recorded_at: now.toISOString() }), {
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
