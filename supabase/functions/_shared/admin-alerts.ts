// supabase/functions/_shared/admin-alerts.ts
// Alerting proactif des admins plateforme (P3) — appelé par le cron horaire
// admin-monitoring APRÈS la collecte de métriques.
//
// Principe :
//   * Seuils dans app_config.admin_alert_thresholds (JSON, éditable service_role)
//     avec défauts sûrs — pas de redéploiement pour ajuster.
//   * Dédup 24h par type d'alerte via app_config.admin_alert_state
//     ({ [alert_key]: lastSentISO }) — un incident persistant ne spamme pas.
//   * Destinataires = RPC super_admin_allowlist() (source unique, migration
//     20260705160000). Envoi Resend direct (pattern send-email).
//   * Best-effort de bout en bout : toute erreur est loggée, jamais propagée —
//     l'alerting ne casse pas la collecte de métriques.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AlertThresholds {
  cron_stale_hours: number
  flatfox_stale_hours: number
  deepseek_balance_min_usd: number
  whatsapp_token_days: number
  edge_errors_24h: number
  whatsapp_deadletter_max: number
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  cron_stale_hours: 25,
  flatfox_stale_hours: 25,
  deepseek_balance_min_usd: 2,
  whatsapp_token_days: 7,
  edge_errors_24h: 10,
  // Nouveaux échecs définitifs WhatsApp sur 24h (média non rejouable + jobs KYC
  // async échoués). Au-delà → alerte. Taux fenêtré, pas backlog cumulatif.
  whatsapp_deadletter_max: 5,
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000

// Libellés FR des métriques de quota (P6a) pour les emails d'alerte.
const QUOTA_METRIC_LABELS: Record<string, string> = {
  ai_cost_usd: 'coût IA mensuel',
  active_properties: 'biens actifs',
  whatsapp_messages: 'messages WhatsApp mensuels',
  storage_mb: 'stockage',
}

export interface WhatsAppDeadletters {
  processing_failed: number
  /** Cumulatif à vie (aucune purge) — tendance/affichage, JAMAIS l'alerting. */
  processing_deadletter: number
  /** Fenêtré 24h — signal d'alerte actionnable qui s'auto-résout. */
  processing_deadletter_24h: number
  agent_errors_24h: number
  delivery_failed_24h: number
  async_jobs_failed_24h: number
}

interface AlertSignals {
  errorCount24h: number
  flatfoxLastSeen: string | null
  waDeadletters?: WhatsAppDeadletters
  now: Date
}

interface Alert {
  key: string
  subject: string
  body: string
}

async function readJsonConfig<T>(admin: SupabaseClient, key: string): Promise<T | null> {
  const { data } = await admin.from('app_config').select('value').eq('key', key).maybeSingle()
  if (!data?.value) return null
  try {
    return JSON.parse(data.value as string) as T
  } catch {
    return null
  }
}

export async function evaluateAndSendAlerts(admin: SupabaseClient, signals: AlertSignals): Promise<void> {
  const thresholds: AlertThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(await readJsonConfig<Partial<AlertThresholds>>(admin, 'admin_alert_thresholds') ?? {}),
  }
  const alerts: Alert[] = []
  const { now } = signals

  // 1. Crons en retard / en échec (RPC gardée is_super_admin OR is_service_role).
  try {
    const { data: cronRows } = await admin.rpc('get_cron_health')
    for (const job of (cronRows ?? []) as Array<{ jobname: string; active: boolean; last_start: string | null; last_status: string | null }>) {
      if (!job.active) continue
      const staleMs = thresholds.cron_stale_hours * 60 * 60 * 1000
      const stale = !job.last_start || now.getTime() - new Date(job.last_start).getTime() > staleMs
      const failed = job.last_status === 'failed'
      if (stale || failed) {
        alerts.push({
          key: `cron:${job.jobname}`,
          subject: `Cron ${job.jobname} ${failed ? 'en échec' : 'en retard'}`,
          body: `Le job pg_cron « ${job.jobname} » est ${failed ? `en échec (dernier statut : ${job.last_status})` : `sans exécution depuis plus de ${thresholds.cron_stale_hours}h`}. Dernier run : ${job.last_start ?? 'jamais'}.`,
        })
      }
    }
  } catch (e) {
    console.error('[admin-alerts] cron health read failed:', (e as Error)?.message)
  }

  // 2. Sync Flatfox en retard.
  if (signals.flatfoxLastSeen) {
    const ageMs = now.getTime() - new Date(signals.flatfoxLastSeen).getTime()
    if (ageMs > thresholds.flatfox_stale_hours * 60 * 60 * 1000) {
      alerts.push({
        key: 'flatfox:stale',
        subject: 'Sync Flatfox en retard',
        body: `Aucun listing Flatfox vu depuis ${Math.round(ageMs / 3_600_000)}h (seuil : ${thresholds.flatfox_stale_hours}h). Dernier last_seen_at : ${signals.flatfoxLastSeen}.`,
      })
    }
  }

  // 3. Solde DeepSeek bas (dernier snapshot du cron ai-billing-monitor).
  try {
    const { data: snap } = await admin
      .from('ai_balance_snapshots')
      .select('total_balance_usd, captured_at')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const balance = Number(snap?.total_balance_usd ?? NaN)
    if (Number.isFinite(balance) && balance < thresholds.deepseek_balance_min_usd) {
      alerts.push({
        key: 'deepseek:balance',
        subject: 'Solde DeepSeek bas',
        body: `Solde DeepSeek : ${balance.toFixed(2)} USD (seuil : ${thresholds.deepseek_balance_min_usd} USD). Recharger pour éviter la coupure du copilote.`,
      })
    }
  } catch (e) {
    console.error('[admin-alerts] deepseek balance read failed:', (e as Error)?.message)
  }

  // 4. Token WhatsApp Meta proche de l'expiration (état posé par ce même cron).
  const tokenHealth = await readJsonConfig<{ isValid?: boolean; daysLeft?: number | null }>(admin, 'whatsapp_token_health')
  if (tokenHealth && (tokenHealth.isValid === false ||
      (typeof tokenHealth.daysLeft === 'number' && tokenHealth.daysLeft < thresholds.whatsapp_token_days))) {
    alerts.push({
      key: 'whatsapp:token',
      subject: 'Token WhatsApp Meta à renouveler',
      body: tokenHealth.isValid === false
        ? 'Le token Meta WhatsApp est INVALIDE — les envois sont coupés.'
        : `Le token Meta WhatsApp expire dans ${tokenHealth.daysLeft} jour(s) (seuil : ${thresholds.whatsapp_token_days}).`,
    })
  }

  // 5. Erreurs edge functions 24h au-dessus du seuil.
  if (signals.errorCount24h > thresholds.edge_errors_24h) {
    alerts.push({
      key: 'edges:errors',
      subject: 'Pic d\'erreurs edge functions',
      body: `${signals.errorCount24h} erreurs edge sur 24h (seuil : ${thresholds.edge_errors_24h}). Voir /dashboard/admin/monitoring.`,
    })
  }

  // 6. Dead-letters WhatsApp — alerte sur le TAUX 24h (nouveaux échecs
  // définitifs), pas sur le backlog cumulatif : processing_deadletter ne
  // décroît jamais (aucune purge des lignes mortes), donc l'alerter dessus
  // ré-enverrait à vie une fois le seuil franchi. Le taux 24h s'auto-résout
  // dès que le pipeline se rétablit ; le backlog cumulatif est cité pour le
  // triage. Compteurs 24h purs (agent/livraison) = tendance sans alerte (bruit).
  const dl = signals.waDeadletters
  if (dl) {
    const newlyStuck = dl.processing_deadletter_24h + dl.async_jobs_failed_24h
    if (newlyStuck > thresholds.whatsapp_deadletter_max) {
      alerts.push({
        key: 'whatsapp:deadletter',
        subject: 'Files WhatsApp bloquées',
        body: `${newlyStuck} nouvel(le)(s) file(s) WhatsApp en échec définitif sur 24h (seuil : ${thresholds.whatsapp_deadletter_max}) — ${dl.processing_deadletter_24h} média/transcription non rejouable(s) et ${dl.async_jobs_failed_24h} job(s) KYC async échoué(s). Backlog cumulatif : ${dl.processing_deadletter}. Voir /dashboard/admin/monitoring.`,
      })
    }
  }

  // 7. Quotas d'agence proches/dépassés (P6a). L'agrégation usage-vs-cap est
  // faite côté serveur par la RPC get_admin_quota_breaches (seuil par agence
  // dans agency_usage_quotas.alert_threshold_pct) — ici on se contente
  // d'émettre une alerte par (agence × métrique) en dépassement. AUCUN blocage :
  // le super-admin décide (relever le cap, contacter l'agence, upgrade de plan).
  try {
    const { data: breaches } = await admin.rpc('get_admin_quota_breaches')
    for (const b of (breaches ?? []) as Array<{
      agency_id: string; agency_name: string; metric: string
      usage: number; cap: number; threshold_pct: number
    }>) {
      const pct = b.cap > 0 ? Math.round((Number(b.usage) / Number(b.cap)) * 100) : 0
      alerts.push({
        key: `quota:${b.agency_id}:${b.metric}`,
        subject: `Quota ${QUOTA_METRIC_LABELS[b.metric] ?? b.metric} — ${b.agency_name}`,
        body: `L'agence « ${b.agency_name} » atteint ${pct}% de son plafond ${QUOTA_METRIC_LABELS[b.metric] ?? b.metric} (${b.usage} / ${b.cap}, alerte dès ${b.threshold_pct}%). Aucun blocage appliqué — voir /dashboard/admin/agencies.`,
      })
    }
  } catch (e) {
    console.error('[admin-alerts] quota breaches read failed:', (e as Error)?.message)
  }

  if (alerts.length === 0) return

  // Dédup 24h par clé d'alerte.
  const state = (await readJsonConfig<Record<string, string>>(admin, 'admin_alert_state')) ?? {}
  const due = alerts.filter((a) => {
    const last = state[a.key] ? new Date(state[a.key]).getTime() : 0
    return now.getTime() - last > COOLDOWN_MS
  })
  if (due.length === 0) return

  // Destinataires = allowlist SQL (source unique).
  const { data: recipients, error: allowErr } = await admin.rpc('super_admin_allowlist')
  if (allowErr || !Array.isArray(recipients) || recipients.length === 0) {
    console.error('[admin-alerts] allowlist read failed:', allowErr?.message ?? 'empty')
    return
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('[admin-alerts] RESEND_API_KEY missing — alerts not sent')
    return
  }

  const list = due.map((a) => `• ${a.subject}\n  ${a.body}`).join('\n\n')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'MEGGA <noreply@megga.ch>',
      to: recipients,
      subject: `[MEGGA Admin] ${due.length === 1 ? due[0].subject : `${due.length} alertes plateforme`}`,
      text: `Alertes plateforme MEGGA — ${now.toISOString()}\n\n${list}\n\nDétails : app.megga.ch/dashboard/admin/monitoring`,
    }),
  })
  if (!res.ok) {
    console.error('[admin-alerts] resend failed:', res.status, await res.text().catch(() => ''))
    return
  }

  // Marque les alertes envoyées (cooldown) — best-effort.
  for (const a of due) state[a.key] = now.toISOString()
  await admin.from('app_config').upsert(
    { key: 'admin_alert_state', value: JSON.stringify(state) },
    { onConflict: 'key' },
  )
}
