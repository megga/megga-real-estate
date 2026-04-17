// supabase/functions/ai-billing-monitor/index.ts
// Fetches DeepSeek account balance and stores a snapshot in ai_balance_snapshots.
// Called hourly by pg_cron (via service_role) or manually by super_admin.
//
// Anthropic has no public balance endpoint — only DeepSeek is monitored here.
// Claude cost is tracked via ai_usage_logs (estimated_cost_usd).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeepSeekBalanceResponse {
  is_available: boolean
  balance_infos: Array<{
    currency: string
    total_balance: string
    topped_up_balance: string
    granted_balance: string
  }>
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekKey) {
      return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Auth: accept either service_role (pg_cron) or super_admin user.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const isServiceRole = token === serviceKey

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      const { data: profile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const res = await fetch('https://api.deepseek.com/user/balance', {
      headers: { 'Authorization': `Bearer ${deepseekKey}`, 'Accept': 'application/json' },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return new Response(JSON.stringify({
        error: `DeepSeek balance API ${res.status}`,
        body: body.slice(0, 200),
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data: DeepSeekBalanceResponse = await res.json()
    const usd = data.balance_infos?.find((b) => b.currency === 'USD')
    if (!usd) {
      return new Response(JSON.stringify({ error: 'No USD balance in response', data }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { error } = await admin.from('ai_balance_snapshots').insert({
      provider: 'deepseek',
      total_balance_usd: parseFloat(usd.total_balance),
      topped_up_balance_usd: parseFloat(usd.topped_up_balance),
      granted_balance_usd: parseFloat(usd.granted_balance),
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        provider: 'deepseek',
        total_balance_usd: parseFloat(usd.total_balance),
        is_available: data.is_available,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[ai-billing-monitor]', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
