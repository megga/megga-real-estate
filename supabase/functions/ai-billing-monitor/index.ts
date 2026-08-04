// supabase/functions/ai-billing-monitor/index.ts
// Fetches DeepSeek account balance and stores a snapshot in ai_balance_snapshots.
// Called hourly by pg_cron (via service_role) or manually by super_admin.
//
// Only DeepSeek exposes a balance endpoint (Gemini/Google billing is separate).
// Per-call AI cost is tracked via ai_usage_logs (estimated_cost_usd).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'
import { isServiceSecret } from '../_shared/require-service-secret.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
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

    // Auth : appel interne (pg_cron) OU super_admin interactif (console).
    //
    // Le Bearer est comparé à temps constant au secret partagé
    // `app_config.service_role_key` (ce que pg_cron forwarde), avec repli sur
    // l'env — `isServiceSecret` accepte les deux formats, ce qui couvre l'écart
    // entre la clé collée et l'env qui avait motivé le décodage de claim.
    // Ce décodage ne vérifiait AUCUNE signature : la fonction étant déployée
    // --no-verify-jwt, un jeton forgé {"role":"service_role"} passait la garde.
    // Même correctif que photo-processor (S1b) et backfill-cf-images (S22).
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    if (!req.headers.get('Authorization')) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!(await isServiceSecret(admin, req))) {
      // Appel interactif — super_admin : rôle + allowlist email
      // (voir _shared/require-super-admin.ts, migration 20260705160000)
      const auth = await requireSuperAdmin(req, corsHeaders)
      if (auth instanceof Response) return auth
    }

    // Après l'auth, et pas avant : l'état de configuration du projet n'a pas à
    // se lire depuis l'extérieur. Répondre « DEEPSEEK_API_KEY not set » à un
    // inconnu renseigne sur l'installation, et rendait surtout tout test de la
    // garde creux — le 500 partait avant que l'authentification soit évaluée.
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekKey) {
      return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
