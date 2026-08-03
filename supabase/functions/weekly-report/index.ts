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

    // ── Build email HTML ──
    const dateRange = `${new Date(weekAgo).toLocaleDateString('fr-CH')} — ${now.toLocaleDateString('fr-CH')}`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport hebdomadaire MEGGA</title>
</head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:24px;font-weight:bold;color:#1c1c1c;margin:0;">MEGGA</h1>
      <p style="font-size:14px;color:#8b5cf6;margin:8px 0 0;">Rapport hebdomadaire</p>
      <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">${dateRange}</p>
    </div>

    <!-- KPIs Grid -->
    <div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:16px;">
      <h2 style="font-size:14px;font-weight:600;color:#1c1c1c;margin:0 0 16px;">Vue d'ensemble</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#6b7280;">Agences totales</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <strong style="font-size:16px;color:#1c1c1c;">${totalAgencies.count ?? 0}</strong>
            ${(newAgencies.count ?? 0) > 0 ? `<span style="font-size:11px;color:#10b981;margin-left:6px;">+${newAgencies.count}</span>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#6b7280;">Utilisateurs</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <strong style="font-size:16px;color:#1c1c1c;">${totalUsers.count ?? 0}</strong>
            ${(newUsers.count ?? 0) > 0 ? `<span style="font-size:11px;color:#10b981;margin-left:6px;">+${newUsers.count}</span>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#6b7280;">Biens actifs</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <strong style="font-size:16px;color:#1c1c1c;">${activeProperties.count ?? 0}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#6b7280;">Transactions actives</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <strong style="font-size:16px;color:#1c1c1c;">${activeTransactions.count ?? 0}</strong>
            ${(newTransactions.count ?? 0) > 0 ? `<span style="font-size:11px;color:#10b981;margin-left:6px;">+${newTransactions.count}</span>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#6b7280;">KYC a risque</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <strong style="font-size:16px;color:${(highRiskKyc.count ?? 0) > 0 ? '#dc2626' : '#1c1c1c'};">${highRiskKyc.count ?? 0}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px;color:#6b7280;">Evenements (7j)</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <strong style="font-size:16px;color:#1c1c1c;">${totalEvents.count ?? 0}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;">
            <span style="font-size:13px;color:#6b7280;">Erreurs systeme (7j)</span>
          </td>
          <td style="padding:8px 0;text-align:right;">
            <strong style="font-size:16px;color:${(errors.count ?? 0) > 0 ? '#dc2626' : '#10b981'};">${errors.count ?? 0}</strong>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-top:24px;">
      <a href="https://megga.ch/dashboard/admin" style="display:inline-block;padding:12px 24px;background:#8b5cf6;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Ouvrir le dashboard admin
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">MEGGA Real Estate — Rapport automatique</p>
      <p style="font-size:11px;color:#9ca3af;margin:4px 0 0;">Ce rapport est envoye chaque lundi a 8h</p>
    </div>
  </div>
</body>
</html>`

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
          subject: `Rapport hebdomadaire MEGGA — ${now.toLocaleDateString('fr-CH')}`,
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
