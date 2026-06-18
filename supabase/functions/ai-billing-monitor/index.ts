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

// Decode a JWT payload without verifying the signature. We only use it to
// read the `role` claim for routing (service_role vs user) — Supabase gateway
// is not validating (deployed with --no-verify-jwt), so we re-check via
// auth.getUser() for user tokens below.
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (padded.length % 4)) % 4)
    const json = atob(padded + padding)
    return JSON.parse(json)
  } catch {
    return null
  }
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

    // Auth: decode the JWT payload. service_role tokens have `role: 'service_role'`;
    // authenticated users have a `sub` claim we can look up in profiles.
    // We avoid strict token equality on SUPABASE_SERVICE_ROLE_KEY because the
    // env var and the pasted key can differ by whitespace/JWT rotation.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = decodeJwtPayload(token)
    const jwtRole = payload?.role as string | undefined

    // Accept the current sb_secret_ service key (string-equality) in addition
    // to the legacy service_role JWT, so pg_cron via get_app_config authenticates.
    const isServiceKey = serviceKey !== '' && token === serviceKey
    if (jwtRole !== 'service_role' && !isServiceKey) {
      // Try user auth via super_admin check
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized', hint: `jwt_role=${jwtRole ?? 'none'}` }), {
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
