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
import { buildAdminAlertEmail, formatCH } from './admin-alert-email.ts'

interface AlertThresholds {
  cron_stale_hours: number
  flatfox_stale_hours: number
  deepseek_balance_min_usd: number
  whatsapp_token_days: number
  edge_errors_24h: number
  whatsapp_deadletter_max: number
  calendar_sync_stale_max: number
  stripe_webhook_stale_hours: number
  outbox_stuck_hours: number
  email_failure_window_hours: number
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
  // Nb de calendriers OAuth « stale » (sync activée mais last_sync_at > 48h)
  // au-delà duquel on alerte. NON basé sur token_expires_at (refresh normal).
  calendar_sync_stale_max: 3,
  // Âge (heures) du dernier événement webhook Stripe au-delà duquel on alerte,
  // UNIQUEMENT s'il existe ≥1 abonnement actif (sinon aucun trafic = normal).
  stripe_webhook_stale_hours: 72,
  // Âge (heures) d'un job d'outbox resté `pending`. Court volontairement : un
  // consommateur sain reprend en quelques minutes, donc 6 h signifie déjà que
  // personne ne consomme — ce qui est l'état RÉEL aujourd'hui, aucun worker
  // n'existant. Le seuil n'est pas là pour tolérer du retard mais pour que
  // l'absence de consommateur cesse d'être silencieuse.
  outbox_stuck_hours: 6,
  // Fenêtre des échecs de remise. 24 h et non plus : au-delà, l'alerte redirait chaque
  // jour un rebond déjà traité, et le cooldown par destinataire suffit à ne pas répéter
  // un incident en cours.
  email_failure_window_hours: 24,
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
  /** P7 — santé intégrations (issus de get_admin_integrations_health). */
  calendarStaleCount?: number
  stripeWebhookAgeHours?: number | null
  activeSubscriptions?: number
  now: Date
}

export interface Alert {
  key: string
  subject: string
  body: string
}

/** Une ligne d'`email_delivery_events` — un e-mail qui n'est PAS arrivé. */
export interface EmailFailureRow {
  event_type: string
  recipient: string | null
  subject: string | null
  bounce_type: string | null
  occurred_at: string
}

/**
 * Les e-mails qui ne sont pas arrivés, sur la fenêtre écoulée.
 *
 * POURQUOI CETTE RÈGLE EST LA PLUS IMPORTANTE DU MODULE. Le 15.08.2026, on a découvert
 * que `hello@juarts.com` était sur la liste de suppression Resend depuis dix jours : tout
 * ce fichier écrivait dans le vide, et son propre verrou de 24 h se posait quand même,
 * parce que Resend rend 200 en ACCEPTANT une requête dont il ne remettra jamais le
 * message. Un canal d'alerte dont la panne est silencieuse est pire que pas d'alerte.
 *
 * Cette règle est donc l'alerte SUR l'alerte, en plus de couvrir les e-mails client.
 *
 * ⚠ Elle n'est pas à l'abri du même piège : si l'adresse de destination est elle-même
 * supprimée, ce message ne partira pas non plus. C'est pourquoi elle nomme les
 * destinataires touchés — le jour où l'un d'eux est une adresse de l'équipe, la ligne se
 * lit dans la console (`/dashboard/admin/monitoring`) même si l'e-mail n'arrive pas.
 *
 * Groupée PAR DESTINATAIRE et non une alerte par événement : dix rebonds sur la même
 * boîte sont un seul fait à traiter, et le cooldown par clé les tiendrait de toute façon.
 */
export function buildEmailFailureAlerts(lignes: EmailFailureRow[], fenetreHeures: number): Alert[] {
  const parDestinataire = new Map<string, EmailFailureRow[]>()
  for (const l of lignes) {
    const cle = l.recipient ?? 'destinataire inconnu'
    parDestinataire.set(cle, [...(parDestinataire.get(cle) ?? []), l])
  }

  return [...parDestinataire.entries()].map(([destinataire, evts]) => {
    // Un rebond PERMANENT condamne l'adresse (Resend la met en liste de suppression et
    // tout envoi ultérieur est refusé au départ) ; un transitoire se rejoue seul. La
    // distinction décide s'il faut agir, elle ouvre donc le message.
    const permanent = evts.some((e) => (e.bounce_type ?? '').toLowerCase() === 'permanent')
    const plainte = evts.some((e) => e.event_type === 'email.complained')
    const sujets = [...new Set(evts.map((e) => e.subject).filter(Boolean))].slice(0, 3)

    return {
      key: `email:failure:${destinataire}`,
      subject: `${plainte ? 'Plainte' : permanent ? 'Adresse morte' : 'Remise en échec'} · ${destinataire}`,
      body: `${evts.length} e-mail(s) non remis à « ${destinataire} » sur ${fenetreHeures}h`
        + `${sujets.length ? ` (${sujets.join(' · ')})` : ''}.`
        + (permanent
          ? ` Rebond PERMANENT : Resend a mis l’adresse en liste de suppression, et tout envoi ultérieur sera refusé au départ tant qu’elle y reste, sans erreur visible côté code.`
          : plainte
            ? ` Marqué comme indésirable par le destinataire : à ne plus solliciter.`
            : ` Rebond transitoire : peut se résoudre seul, à surveiller s’il se répète.`)
        + ` Voir /dashboard/admin/monitoring`,
    }
  })
}

/** Une ligne de `get_admin_agency_review_queue` — la file telle que la console la voit. */
export interface KybReviewQueueRow {
  agency_id: string
  agency_name: string
  country: string | null
  /** `numeric` en base : PostgREST peut le rendre en chaîne. Jamais lu sans `Number()`. */
  verification_score: number | string | null
  identity_submitted_at: string | null
  /** Taille RÉELLE de la file, rendue par la RPC — évite un `count: 'exact'` (§7). */
  total_count: number | string
}

/** « 6h », « 3 jours » — au-delà de deux jours, l'heure près n'apprend plus rien. */
function dureeAttente(depuis: string, now: Date): string {
  const heures = Math.max(0, Math.round((now.getTime() - new Date(depuis).getTime()) / 3_600_000))
  return heures < 48 ? `${heures}h` : `${Math.round(heures / 24)} jours`
}

/**
 * Un dossier KYB en attente de revue = une alerte. Pure, donc testable sans client.
 *
 * POURQUOI CETTE RÈGLE EXISTE. Un dossier qui atterrit en `manual_review` n'était
 * notifié à PERSONNE chez MEGGA : `agency-verification-notify` écrit aux DIRIGEANTS de
 * l'agence à chaque décision, jamais à nous à l'arrivée. La file ne se découvrait qu'en
 * ouvrant la console — donc seulement si on y pensait.
 *
 * Ce n'est pas une file de confort. Tant qu'un dossier n'est ni `auto_validated` ni
 * `validated`, la liste blanche d'`useLabGuard` INTERDIT à l'agence d'ouvrir un dossier
 * KYC et d'envoyer une signature — le cœur du produit. Chaque ligne est un client
 * bloqué qui attend un clic de notre part ; c'est ce que le corps du message dit.
 *
 * UNE CLÉ PAR AGENCE : un dossier donne une alerte, puis se tait 24 h (cooldown du
 * module). Un dossier qui traîne se rappelle donc une fois par jour — voulu, il bloque
 * quelqu'un. Même forme de clé que la règle des quotas.
 *
 * ⚠ AUCUN SEUIL, et aucune sélection : la RPC ne rend QUE `manual_review`, et c'est le
 * bon périmètre — `correction_requested` attend l'AGENCE, pas nous ; l'alerter ici
 * demanderait d'agir à qui ne peut rien faire.
 */
export function buildKybReviewAlerts(file: KybReviewQueueRow[], now: Date): Alert[] {
  const total = Number(file[0]?.total_count ?? 0)
  const reste = Number.isFinite(total) && total > file.length ? total - file.length : 0

  return file.map((d) => {
    const score = Number(d.verification_score)
    return {
      key: `kyb:review:${d.agency_id}`,
      subject: `Dossier KYB à valider · ${d.agency_name}`,
      body: `L'agence « ${d.agency_name} »${d.country ? ` (${d.country})` : ''} attend une revue humaine`
        + `${d.identity_submitted_at ? ` depuis ${dureeAttente(d.identity_submitted_at, now)}` : ''}`
        // Un score absent n'est PAS un détail propre à cette agence : c'est l'état de
        // tout dossier suisse tant que MAPBOX_TOKEN manque (les trois checks scorables
        // sortent `unavailable`, cf. CLAUDE.md). Le nommer évite de chercher une
        // anomalie du dossier là où c'est la plateforme qui ne sait pas encore scorer.
        + ` (score : ${Number.isFinite(score) && d.verification_score !== null ? score.toFixed(3) : 'jamais calculé'}).`
        + ` Tant qu'elle n'est pas validée, elle ne peut ni ouvrir un dossier KYC ni envoyer une signature.`
        + `${reste > 0 ? ` ${reste} autre(s) dossier(s) en attente.` : ''}`
        + ` Traiter : /dashboard/admin/kyb-review`,
    }
  })
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


/**
 * Au bout de combien d'heures un job pg_cron est-il VRAIMENT en retard.
 *
 * ⛔ UN SEUIL UNIQUE NE PEUT PAS MARCHER. `cron_stale_hours` vaut 25 h et s'appliquait à
 * TOUS les jobs : un job hebdomadaire est donc « en retard » six jours sur sept, et un
 * job mensuel trente jours sur trente et un. Mesuré le 16.08.2026 — sur les cinq jobs
 * que le seuil dénonçait, QUATRE étaient parfaitement sains :
 *
 *   weekly-digest-friday              `0 17 * * 5`  hebdomadaire, tourné vendredi, OK
 *   knowledge-snippets-expire-weekly  `15 3 * * 1`  hebdomadaire, tourné lundi, OK
 *   activity-events-retention         `15 3 1 * *`  mensuel, tourné le 1er, OK
 *   whatsapp-consent-cache-reconcile  `20 3 * * *`  quotidien, tourné hier, OK (le jobid
 *                                                   avait changé, cf. 20260816000000)
 *   admin-ai-drift-purge-monthly      `40 3 1 * *`  mensuel, JAMAIS exécuté. Le vrai.
 *
 * Le seul signal réel dormait donc sous quatre fausses alertes hebdomadaires, ce qui est
 * la façon la plus sûre de rendre une boîte d'alertes illisible.
 *
 * La cadence se lit dans l'expression elle-même : jour-du-mois contraint ⇒ mensuel,
 * sinon jour-de-semaine contraint ⇒ hebdomadaire, sinon quotidien ou plus fréquent. La
 * marge est large À DESSEIN : cette alerte doit dire « ce job ne tourne plus », pas
 * « ce job a dix minutes de retard ».
 */
export function cronStaleHours(schedule: string, defautHeures: number): number {
  const champs = schedule.trim().split(/\s+/)
  if (champs.length < 5) return defautHeures
  const [, , jourDuMois, , jourSemaine] = champs
  if (jourDuMois !== '*') return 24 * 33      // mensuel : un mois de 31 jours, plus deux
  if (jourSemaine !== '*') return 24 * 8      // hebdomadaire : une semaine, plus un jour
  return defautHeures
}


/**
 * Un job sans AUCUNE exécution est-il en panne, ou simplement trop jeune ?
 *
 * ⛔ LA QUESTION N'EST PAS DÉCIDABLE SANS SON ÂGE. `cron.job` ne porte pas de date de
 * création, et pg_cron journalise les échecs comme les succès : zéro ligne signifie
 * « jamais déclenché », pas « déclenché et raté ».
 *
 * Mesuré le 16.08.2026 sur `admin-ai-drift-purge-monthly` (`40 3 1 * *`) : zéro
 * exécution, donc alerte. Or ses voisins de jobid (308 et 310) ont démarré le 01.08 à
 * 08:25 — il a été créé le même matin, APRÈS son créneau de 03:40. Son premier passage
 * est le 01.09. Le job n'a rien raté : il n'a pas encore eu son tour.
 *
 * D'où le registre de première observation : on n'accuse un job muet qu'une fois qu'on
 * l'a vu vivre plus longtemps que sa propre période. Un job réellement mort est donc
 * signalé avec au plus une période de retard, ce qui est le prix exact de ne pas crier
 * pour rien pendant un mois.
 */
export function jobMuetEstSuspect(
  premiereObservationIso: string | undefined,
  toleranceHeures: number,
  now: Date,
): boolean {
  // Jamais vu : on l'inscrit ce tour-ci et on se tait. Le tour suivant tranchera.
  if (!premiereObservationIso) return false
  const vu = new Date(premiereObservationIso).getTime()
  if (Number.isNaN(vu)) return false
  return now.getTime() - vu > toleranceHeures * 3_600_000
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
    // ⚠ DÉSTRUCTURER `error` N'EST PAS COSMÉTIQUE. PostgREST ne LÈVE PAS sur un timeout :
    // il rend `{data: null, error}`. Sans cette ligne, `cronRows ?? []` valait `[]`, la boucle
    // ci-dessous ne parcourait rien, et le `catch` ne se déclenchait jamais — l'alerting des
    // 50 crons était aveugle 22 fois sur 24 (audit du 03.09.2026) en paraissant sain.
    const { data: cronRows, error: cronError } = await admin.rpc('get_cron_health')
    if (cronError) throw new Error(cronError.message)
    // Registre de première observation : `cron.job` ne date pas ses créations, donc on
    // s'en souvient nous-mêmes. Sans lui, un job mensuel créé hier est « en panne »
    // pendant un mois (cf. `jobMuetEstSuspect`).
    const vus = (await readJsonConfig<Record<string, string>>(admin, 'admin_cron_first_seen')) ?? {}
    let vusModifie = false
    for (const job of (cronRows ?? []) as Array<{ jobname: string; schedule: string | null; active: boolean; last_start: string | null; last_status: string | null }>) {
      if (!job.active) continue
      if (!vus[job.jobname]) { vus[job.jobname] = now.toISOString(); vusModifie = true }
      // ⛔ LE SEUIL DÉPEND DE LA CADENCE DU JOB, pas d'une constante unique : voir
      // `cronStaleHours`. Un `cron_stale_hours` plat criait sur quatre jobs sains.
      const heures = cronStaleHours(job.schedule ?? '', thresholds.cron_stale_hours)
      const stale = job.last_start
        ? now.getTime() - new Date(job.last_start).getTime() > heures * 3_600_000
        : jobMuetEstSuspect(vus[job.jobname], heures, now)
      const failed = job.last_status === 'failed'
      if (stale || failed) {
        alerts.push({
          key: `cron:${job.jobname}`,
          subject: `Cron ${job.jobname} ${failed ? 'en échec' : 'en retard'}`,
          body: `Le job pg_cron « ${job.jobname} » (${job.schedule ?? 'horaire inconnu'}) est ${failed ? `en échec (dernier statut : ${job.last_status})` : job.last_start ? `sans exécution depuis plus de ${heures}h` : 'observé depuis plus d’une période sans avoir jamais tourné'}. Dernier run : ${formatCH(job.last_start)}.`,
        })
      }
    }
    if (vusModifie) {
      await admin.from('app_config').upsert(
        { key: 'admin_cron_first_seen', value: JSON.stringify(vus) },
        { onConflict: 'key' },
      )
    }
  } catch (e) {
    // « Je ne peux pas me prononcer » n'est pas « tout va bien » : on ALERTE sur l'illisibilité
    // elle-même, sinon la panne du chien de garde reste indiscernable d'une infrastructure saine.
    const motif = (e as Error)?.message ?? 'erreur inconnue'
    console.error('[admin-alerts] cron health read failed:', motif)
    alerts.push({
      key: 'cron:sante-illisible',
      subject: 'Santé des crons illisible',
      body: `La lecture de get_cron_health a échoué (${motif}). Tant qu'elle échoue, AUCUN retard ni échec de job pg_cron ne peut être détecté : l'absence d'alerte cron ne prouve plus rien.`,
    })
  }

  // 2. Sync Flatfox en retard.
  if (signals.flatfoxLastSeen) {
    const ageMs = now.getTime() - new Date(signals.flatfoxLastSeen).getTime()
    if (ageMs > thresholds.flatfox_stale_hours * 60 * 60 * 1000) {
      alerts.push({
        key: 'flatfox:stale',
        subject: 'Sync Flatfox en retard',
        body: `Aucun listing Flatfox vu depuis ${Math.round(ageMs / 3_600_000)}h (seuil : ${thresholds.flatfox_stale_hours}h). Dernier passage : ${formatCH(signals.flatfoxLastSeen)}.`,
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
        body: `${newlyStuck} nouvel(le)(s) file(s) WhatsApp en échec définitif sur 24h (seuil : ${thresholds.whatsapp_deadletter_max}) : ${dl.processing_deadletter_24h} média/transcription non rejouable(s) et ${dl.async_jobs_failed_24h} job(s) KYC async échoué(s). Backlog cumulatif : ${dl.processing_deadletter}. Voir /dashboard/admin/monitoring.`,
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
        subject: `Quota ${QUOTA_METRIC_LABELS[b.metric] ?? b.metric} · ${b.agency_name}`,
        body: `L'agence « ${b.agency_name} » atteint ${pct}% de son plafond ${QUOTA_METRIC_LABELS[b.metric] ?? b.metric} (${b.usage} / ${b.cap}, alerte dès ${b.threshold_pct}%). Aucun blocage appliqué, voir /dashboard/admin/agencies.`,
      })
    }
  } catch (e) {
    console.error('[admin-alerts] quota breaches read failed:', (e as Error)?.message)
  }

  // 8. Calendriers OAuth « stale » (P7) — sync activée mais aucun last_sync_at
  // depuis > 48h. On n'alerte PAS sur token_expires_at (refresh OAuth normal).
  if (typeof signals.calendarStaleCount === 'number' && signals.calendarStaleCount > thresholds.calendar_sync_stale_max) {
    alerts.push({
      key: 'calendar:stale',
      subject: 'Synchros calendrier en panne',
      body: `${signals.calendarStaleCount} calendrier(s) OAuth sans synchro depuis plus de 48h (seuil : ${thresholds.calendar_sync_stale_max}). Les rendez-vous ne remontent plus. Voir /dashboard/admin/monitoring.`,
    })
  }

  // 9. Webhook Stripe muet (P7) — dernier événement d'abonnement trop ancien,
  // UNIQUEMENT s'il y a du trafic à attendre (≥1 abonnement actif).
  if ((signals.activeSubscriptions ?? 0) >= 1 &&
      typeof signals.stripeWebhookAgeHours === 'number' &&
      signals.stripeWebhookAgeHours > thresholds.stripe_webhook_stale_hours) {
    alerts.push({
      key: 'stripe:webhook',
      subject: 'Webhook Stripe silencieux',
      body: `Aucun événement Stripe reçu depuis ${Math.round(signals.stripeWebhookAgeHours)}h (seuil : ${thresholds.stripe_webhook_stale_hours}h) alors que ${signals.activeSubscriptions} abonnement(s) sont actifs. Vérifier la config webhook Stripe. Voir /dashboard/admin/monitoring.`,
    })
  }

  // 10. Chaîne d'empreintes du registre console rompue (§10.9).
  //
  // C'est l'événement le PLUS grave que la console sache détecter : il dit que le journal
  // de ce que fait MEGGA a été touché. Il était pourtant le seul à n'être notifié à
  // personne — `admin_log_chain_verify_job` écrit une ligne `crit` toutes les heures, et ce
  // module ignorait `admin_log`. Écrit, jamais lu.
  //
  // On LIT le bilan publié par le job horaire, on ne recalcule PAS. Rappeler
  // `admin_log_verify_chain()` ici referait un SHA-256 par ligne sur TOUT le registre, une
  // seconde fois par heure : on doublerait le coût de l'opération périodique la plus chère
  // du système, et ce coût croît avec la rétention (dix ans au titre de la LBA).
  //
  // `app_config` est aussi la seule porte praticable : `service_role` n'a délibérément PAS
  // de SELECT sur `admin_log` (posture asservie par un test), et un `.from('admin_log')`
  // rendrait `null` SANS erreur — la règle serait muette et personne ne le saurait.
  //
  // Péremption : inutile de la gérer ici. Si le cron cesse de tourner, la règle 1 le signale
  // déjà, générique sur tout job pg_cron en retard.
  //
  // AUCUN SEUIL : une chaîne est intacte ou ne l'est pas. Ajouter un seuil obligerait à
  // toucher AlertThresholds et DEFAULT_THRESHOLDS pour une grandeur binaire.
  try {
    const chain = await readJsonConfig<{
      status?: string
      alarme?: boolean
      attendu?: number
      rows_checked?: number
      break_at?: number | null
      checked_at?: string
    }>(admin, 'admin_log_chain_health')

    if (chain?.alarme === true) {
      // Le job a déjà tranché le cas ambigu — « rien à vérifier » n'est pas « quelqu'un a
      // touché au registre ». On se contente de distinguer les deux messages.
      const efface = chain.status === 'no_rows'
      alerts.push({
        key: 'admin_log:chain',
        subject: efface
          ? 'Registre console VIDÉ — chaîne d\'empreintes'
          : 'Registre console : chaîne d\'empreintes ROMPUE',
        body: efface
          ? `Le registre admin_log ne rend plus aucune ligne alors que sa tête en annonce ${chain.attendu ?? '?'}. Un effacement est la seule explication : le journal de ce que fait MEGGA n'est plus fiable. Ne pas écrire dedans avant constat. Vérification du ${chain.checked_at ?? '?'}. Voir /dashboard/admin/security.`
          : `La vérification de la chaîne d'empreintes échoue à la ligne seq=${chain.break_at ?? '?'} (${chain.rows_checked ?? 0} lignes relues, vérification du ${chain.checked_at ?? '?'}). Une ligne du registre a été modifiée après coup, ou son hash ne correspond plus. Voir /dashboard/admin/security.`,
      })
    }
  } catch (e) {
    console.error('[admin-alerts] chain health read failed:', (e as Error)?.message)
  }

  // 11. File d'outbox qui ne se vide pas (§5.8, socle étape 16).
  //
  // `outbox_jobs` est la file transactionnelle des gestes de console à effet EXTERNE : une
  // RPC y dépose ce qu'elle ne peut pas faire elle-même, et un consommateur exécute. Mesuré
  // le 01.08 : **aucun consommateur n'existe** — zéro appelant d'`admin_outbox_claim` hors
  // tests, et le seul cron sur la table est une purge. Un job déposé y reste donc pour
  // toujours, et RIEN ne le dit.
  //
  // C'est ce silence que cette règle supprime. Elle ne remplace pas le consommateur : elle
  // fait qu'on apprend son absence par une alerte plutôt que par un client qui se plaint.
  // Tant que la file reste vide, elle ne coûte rien et ne dit rien.
  // ⚠ On BORNE au lieu de compter. CLAUDE.md §7 interdit `count: 'exact'` sur une table qui
  // peut grossir — et une file que personne ne consomme est précisément celle-là. Un
  // échantillon plafonné suffit : l'alerte dit « au moins N », pas un inventaire.
  // Et on filtre sur `next_retry_at`, PAS sur `created_at` : c'est la colonne portée par
  // l'index partiel `outbox_jobs_a_traiter_idx (next_retry_at) WHERE status = 'pending'`,
  // et elle dit « dû depuis », ce qui est exactement la question.
  const PLAFOND = 50
  const auMoins = (n: number) => (n >= PLAFOND ? `au moins ${PLAFOND}` : `${n}`)
  try {
    const seuilIso = new Date(now.getTime() - thresholds.outbox_stuck_hours * 3600_000).toISOString()

    const { data: bloques } = await admin
      .from('outbox_jobs')
      .select('id')
      .eq('status', 'pending')
      .lt('next_retry_at', seuilIso)
      .limit(PLAFOND)
    const nbBloques = bloques?.length ?? 0
    if (nbBloques > 0) {
      alerts.push({
        key: 'outbox:stuck',
        subject: 'File d\'outbox bloquée : rien ne la consomme',
        body: `${auMoins(nbBloques)} job(s) de la file outbox_jobs sont dus depuis plus de ${thresholds.outbox_stuck_hours}h et personne ne les a pris. Un geste de console y a déposé un effet externe que rien n'exécute, par exemple une réémission de lien KYC qui ne partira jamais. Vérifier qu'un consommateur d'outbox tourne. Voir /dashboard/admin/monitoring.`,
      })
    }

    // Les morts sont une décision HUMAINE, pas un incident de plus : le socle promet qu'ils
    // « remontent au Monitoring pour décision humaine », et rien ne les y remontait.
    const { data: morts } = await admin
      .from('outbox_jobs')
      .select('id')
      .eq('status', 'dead')
      .limit(PLAFOND)
    const nbMorts = morts?.length ?? 0
    if (nbMorts > 0) {
      alerts.push({
        key: 'outbox:dead',
        subject: 'Jobs d\'outbox abandonnés',
        body: `${auMoins(nbMorts)} job(s) de la file outbox_jobs sont en échec définitif après épuisement des tentatives. Ils ne seront JAMAIS repris seuls : c'est une décision humaine. Voir /dashboard/admin/monitoring.`,
      })
    }
  } catch (e) {
    console.error('[admin-alerts] outbox read failed:', (e as Error)?.message)
  }

  // 12. Dossiers KYB en attente de revue humaine (15.08.2026) — cf. buildKybReviewAlerts
  // pour le pourquoi. MÊME SOURCE que la console (`get_admin_agency_review_queue`, dont
  // la garde admet `is_service_role()`) : l'alerte ne peut pas raconter autre chose que
  // l'écran vers lequel elle renvoie, et le tri des plus douteux en tête est le sien.
  // Plafonné à 20 lignes nommées ; `total_count` dit le reste sans compter la table.
  try {
    const { data: fileRevue } = await admin.rpc('get_admin_agency_review_queue', { p_limit: 20, p_offset: 0 })
    alerts.push(...buildKybReviewAlerts((fileRevue ?? []) as KybReviewQueueRow[], now))
  } catch (e) {
    console.error('[admin-alerts] kyb review queue read failed:', (e as Error)?.message)
  }

  // 13. E-mails non remis (15.08.2026) — cf. buildEmailFailureAlerts pour le pourquoi.
  // Fenêtre glissante et lecture BORNÉE (§7) : la table peut grossir, on n'y compte
  // jamais. Alimentée par l'edge `resend-webhook`.
  try {
    const depuis = new Date(now.getTime() - thresholds.email_failure_window_hours * 3_600_000).toISOString()
    const { data: echecs } = await admin
      .from('email_delivery_events')
      .select('event_type, recipient, subject, bounce_type, occurred_at')
      .gte('occurred_at', depuis)
      .order('occurred_at', { ascending: false })
      .limit(200)
    alerts.push(...buildEmailFailureAlerts((echecs ?? []) as EmailFailureRow[], thresholds.email_failure_window_hours))
  } catch (e) {
    console.error('[admin-alerts] email failures read failed:', (e as Error)?.message)
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

  // ⛔ CE MESSAGE PARTAIT EN TEXTE SEUL, sans une ligne de HTML : c'est celui que
  // l'équipe reçoit quand la plateforme va mal, et il arrivait sans marque, sans lien
  // cliquable et horodaté en ISO brut. La composition vit désormais dans un module pur,
  // donc relisible au banc (`npm run email:preview`) et couvert par des tests.
  // Les DEUX parts sont envoyées : une alerte doit rester lisible là où le HTML ne
  // passe pas.
  const mail = buildAdminAlertEmail(due, now)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'MEGGA <noreply@megga.ch>',
      to: recipients,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
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
