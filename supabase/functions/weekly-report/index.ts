/**
 * POST /functions/v1/weekly-report — rapport hebdomadaire de la PLATEFORME, envoyé aux
 * super-admins MEGGA (métriques agences, utilisateurs, biens, transactions, KYC, erreurs).
 *
 * UN SEUL APPELANT : le bouton « Envoyer maintenant » de la console super-admin
 * (`src/components/admin/WeeklyReportPreview.tsx`), avec le JWT de l'utilisateur. La garde
 * est `requireSuperAdmin` — rôle `super_admin` ET e-mail d'authentification allowlisté, la
 * définition d'`is_super_admin()`. Un refus rend désormais le 401/403 de la garde partagée,
 * et non plus un 500 : l'échec levait une exception attrapée par le `catch` général.
 *
 * ⛔ PLUS DE CHEMIN `x-cron-secret` (audit du 13.09.2026, point S8). Il comparait l'en-tête
 * à `CRON_SECRET` par un `===` nu, et n'avait AUCUN appelant : aucune tâche `cron.job`,
 * aucune fonction SQL, rien dans le dépôt — relu en production le 13.09.2026, en lecture
 * seule. Son repli JWT, lui, acceptait `profiles.role = 'super_admin'` SANS l'allowlist.
 * Si le rapport doit un jour être planifié, ce sera par `isServiceSecret` ET un test qui
 * éprouve ce chemin — pas en rouvrant celui-ci. Un secret `CRON_SECRET` éventuellement posé
 * sur le projet est orphelin depuis.
 *
 * DESTINATAIRES : la même définition que la garde, évaluée sur l'e-mail
 * d'AUTHENTIFICATION (`selectReportRecipients`, `_shared/weekly-report-recipients.ts`) —
 * plus sur `profiles.email`, que son titulaire peut modifier.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { buildWeeklyReportEmail } from '../_shared/weekly-report-email.ts'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'
import { selectReportRecipients } from '../_shared/weekly-report-recipients.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Garde AVANT tout accès : la fonction lit des compteurs de TOUTE la plateforme.
    const auth = await requireSuperAdmin(req, corsHeaders)
    if (auth instanceof Response) return auth
    const { user, supabase: supabaseAdmin } = auth

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

    // ── Destinataires : rôle super_admin ET allowlist, sur l'e-mail d'authentification ──
    const adminEmails = await selectReportRecipients({
      listSuperAdminIds: async () => {
        const { data, error } = await supabaseAdmin.from('profiles').select('id').eq('role', 'super_admin')
        if (error) throw new Error(`super_admin profiles: ${error.message}`)
        return (data ?? []).map((p: { id: string }) => p.id)
      },
      authEmailOf: async (id) => {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
        if (error) throw error
        return data.user?.email ?? null
      },
      // Une erreur de la RPC vaut « non allowlisté » : on n'écrit pas à qui on n'a pas pu vérifier.
      isAllowlisted: async (email) => {
        const { data, error } = await supabaseAdmin.rpc('super_admin_allowlist_match', { p_email: email })
        return !error && data === true
      },
    })
    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ error: 'No super_admin emails found' }), {
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
          from: 'MEGGA Admin <noreply@getmegga.com>',
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

    // Journal de l'envoi, au nom du super-admin qui l'a déclenché (piste d'audit).
    // ⚠ `entity_id` est un uuid : la chaîne 'weekly-report' qu'il portait faisait échouer
    // l'INSERT (22P02) sans que l'erreur soit lue — aucun envoi ne POUVAIT être journalisé
    // (0 ligne `weekly_report_sent` en production au 13.09.2026). La fonction est désignée
    // par `entity_type`, et l'erreur est désormais lue.
    const { error: journalErr } = await supabaseAdmin.from('activity_events').insert({
      actor_id: user.id,
      action: 'weekly_report_sent',
      category: 'settings',
      entity_type: 'system',
      entity_id: null,
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
    if (journalErr) console.error('[weekly-report] envoi non journalisé :', journalErr.message)

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
