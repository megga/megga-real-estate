import { buildWeeklyReportEmail } from '../_shared/weekly-report-email.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
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

    // Auth: accept either super_admin JWT or pg_cron secret
    const authHeader = req.headers.get('Authorization')
    const cronSecret = req.headers.get('x-cron-secret')
    const expectedCronSecret = Deno.env.get('CRON_SECRET')

    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      // pg_cron caller — OK
    } else if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError || !user) throw new Error('Unauthorized')
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role !== 'super_admin') throw new Error('Forbidden')
    } else {
      throw new Error('Unauthorized')
    }

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // ── Collect metrics ──
    const [
      totalAgencies,
      newAgencies,
      totalUsers,
      newUsers,
      activeProperties,
      activeTransactions,
      newTransactions,
      highRiskKyc,
      totalEvents,
      errors,
    ] = await Promise.all([
      supabaseAdmin.from('agencies').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('agencies').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabaseAdmin.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('transactions').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabaseAdmin.from('kyc_cases').select('id', { count: 'exact', head: true }).eq('risk_level', 'high'),
      supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabaseAdmin.from('activity_events').select('id', { count: 'exact', head: true }).eq('action', 'edge_function_error').gte('created_at', weekAgo),
    ])

    // ── Recipients = admin alert list (allowlist minus opt-out) ──
    // Same list as the hourly cron alerting (admin_alert_recipients, migration
    // 20260803220000): the mailing list is decoupled from the super_admin
    // IDENTITY allowlist, so an admin can opt out of admin/cron emails via
    // app_config.admin_alert_optout WITHOUT losing super-admin access.
    const { data: recipients, error: recipientsErr } = await supabaseAdmin.rpc('admin_alert_recipients')
    const adminEmails = (Array.isArray(recipients) ? recipients : []).filter(Boolean)
    if (recipientsErr || adminEmails.length === 0) {
      return new Response(JSON.stringify({ error: 'No admin recipients found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Le gabarit vit dans `_shared/weekly-report-email.ts` depuis le 15.08.2026 : pur,
    // donc testable et visible au banc de rendu.
    //
    // ⚠ Fuseau EXPLICITE. `toLocaleDateString` sans `timeZone` suit celui du runtime,
    // c'est-à-dire UTC en edge : un rapport tiré peu après minuit affichait la veille.
    const jour = (d: Date) => d.toLocaleDateString('fr-CH', { timeZone: 'Europe/Zurich' })
    const { subject, html } = buildWeeklyReportEmail({
      periode: `${jour(new Date(weekAgo))} au ${jour(now)}`,
      rows: [
        { label: 'Agences totales', value: totalAgencies.count ?? 0, delta: newAgencies.count ?? 0 },
        { label: 'Utilisateurs', value: totalUsers.count ?? 0, delta: newUsers.count ?? 0 },
        { label: 'Biens actifs', value: activeProperties.count ?? 0 },
        { label: 'Transactions actives', value: activeTransactions.count ?? 0, delta: newTransactions.count ?? 0 },
        { label: 'KYC à risque', value: highRiskKyc.count ?? 0, alertIfPositive: true },
        { label: 'Événements (7 j)', value: totalEvents.count ?? 0 },
        { label: 'Erreurs système (7 j)', value: errors.count ?? 0, alertIfPositive: true },
      ],
    })

    // ── Send via Resend ──
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured')

    const sendErrors: string[] = []
    for (const email of adminEmails) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'MEGGA Admin <noreply@megga.ch>',
          to: email,
          subject,
          html,
        }),
      })
      if (!res.ok) {
        console.error(`Resend error for ${email}:`, res.status, await res.text())
        sendErrors.push(email)
      }
    }
    if (sendErrors.length === adminEmails.length) {
      throw new Error('All email sends failed')
    }

    // Log the report sending
    await supabaseAdmin.from('activity_events').insert({
      action: 'weekly_report_sent',
      category: 'settings',
      entity_type: 'system',
      entity_id: 'weekly-report',
      metadata: {
        recipient_count: adminEmails.length,
        metrics: {
          agencies: totalAgencies.count,
          users: totalUsers.count,
          properties: activeProperties.count,
          transactions: activeTransactions.count,
          errors: errors.count,
        },
      },
    })

    return new Response(JSON.stringify({
      success: true,
      recipient_count: adminEmails.length,
      sent_at: now.toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
