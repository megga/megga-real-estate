/**
 * Lecteur pur de `admin_overview()` — la RPC d'assemblage de la Vue d'ensemble.
 *
 * Elle rend `jsonb`, donc `Returns: Json` côté types générés : la forme se
 * déclare ici à la main, comme `useAdminPlansBoard` le fait pour le poste de
 * plans. Tout est défensif — un champ absent ne doit jamais faire tomber la
 * page d'accueil de la console.
 *
 * Le module est importé par le hook, jamais seulement par les tests : un helper
 * consommé uniquement depuis `tests/` serait déclaré mort par `lint:deadcode`
 * (`tsconfig.app.json` n'inclut que `src`). Même motif que `src/lib/cronRunNow.ts`.
 *
 * ⚠ Aucune règle métier serveur n'est rejouée ici. Le filtre « pas de conformité
 * des clients finaux » (`category is distinct from 'kyc'`) est appliqué EN BASE ;
 * le refaire côté client créerait un second juge, qui se périmerait au premier
 * ajout d'action.
 */
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'

/** Pouls technique. ⚠ `functions_err` compte des FONCTIONS distinctes, pas des erreurs. */
export interface OverviewPulse {
  healthy: boolean
  functions_err: number
  crons_failed: number
  errors_24h: number
}

export interface OverviewKpis {
  agencies: number
  users: number
  properties: number
  transactions: number
  mrr: number
  new_agencies_this_month: number
  new_users_this_month: number
}

/** Signal de la tête « À traiter ». `kind` et `go` sont produits par le serveur. */
export interface OverviewSignal {
  id: string
  kind: string
  tone: string
  count: number
  go: string
}

/** Ligne du journal : `get_admin_live_feed` moins `total_count`, délibérément retiré. */
export interface OverviewJournalRow {
  id: string
  ts: string
  action: string
  severity: string
  category: string | null
  agency_name: string | null
  actor_label: string | null
  actor_kind: string | null
  entity_type: string | null
  object_label: string | null
}

export interface OverviewActivation {
  total: number
  active: number
  at_risk: number
  dormant: number
}

export interface OverviewKycFunnel {
  links_sent: number
  links_opened: number
  links_submitted: number
  links_expired: number
  conversion_pct: number
}

export interface OverviewRevenue {
  mrr: number
  subscriptions: number
  arpu: number
  /** ⚠ Compte des AGENCES de la file `unpaid`, pas des paiements — voir `SIGNAL_LABEL_KEY`. */
  failed: number
}

export interface AdminOverview {
  pulse: OverviewPulse
  kpis: OverviewKpis
  signals: OverviewSignal[]
  journal: OverviewJournalRow[]
  activation: OverviewActivation
  kyc_funnel: OverviewKycFunnel
  revenue: OverviewRevenue
  unavailable: string[]
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/** `numeric` peut arriver en CHAÎNE via PostgREST ; les `bigint` de `jsonb_build_object` arrivent en nombres. */
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

export function readAdminOverview(raw: unknown): AdminOverview {
  const r = obj(raw)
  const pulse = obj(r.pulse)
  const kpis = obj(r.kpis)
  const activation = obj(r.activation)
  const funnel = obj(r.kyc_funnel)
  const revenue = obj(r.revenue)

  return {
    pulse: {
      healthy: pulse.healthy === true,
      functions_err: num(pulse.functions_err),
      crons_failed: num(pulse.crons_failed),
      errors_24h: num(pulse.errors_24h),
    },
    kpis: {
      agencies: num(kpis.agencies),
      users: num(kpis.users),
      properties: num(kpis.properties),
      transactions: num(kpis.transactions),
      mrr: num(kpis.mrr),
      new_agencies_this_month: num(kpis.new_agencies_this_month),
      new_users_this_month: num(kpis.new_users_this_month),
    },
    signals: (Array.isArray(r.signals) ? r.signals : []).map(s => {
      const o = obj(s)
      return {
        id: String(o.id ?? ''),
        kind: String(o.kind ?? ''),
        tone: String(o.tone ?? 'info'),
        count: num(o.count),
        go: String(o.go ?? ''),
      }
    }),
    journal: (Array.isArray(r.journal) ? r.journal : []).map(l => {
      const o = obj(l)
      return {
        id: String(o.id ?? ''),
        ts: String(o.ts ?? ''),
        action: String(o.action ?? ''),
        severity: String(o.severity ?? 'info'),
        category: str(o.category),
        agency_name: str(o.agency_name),
        actor_label: str(o.actor_label),
        actor_kind: str(o.actor_kind),
        entity_type: str(o.entity_type),
        object_label: str(o.object_label),
      }
    }),
    activation: {
      total: num(activation.total),
      active: num(activation.active),
      at_risk: num(activation.at_risk),
      dormant: num(activation.dormant),
    },
    kyc_funnel: {
      links_sent: num(funnel.links_sent),
      links_opened: num(funnel.links_opened),
      links_submitted: num(funnel.links_submitted),
      links_expired: num(funnel.links_expired),
      conversion_pct: num(funnel.conversion_pct),
    },
    revenue: {
      mrr: num(revenue.mrr),
      subscriptions: num(revenue.subscriptions),
      arpu: num(revenue.arpu),
      failed: num(revenue.failed),
    },
    unavailable: (Array.isArray(r.unavailable) ? r.unavailable : []).map(String),
  }
}

/**
 * Cible de navigation d'un jeton `go` du serveur.
 *
 * ⛔ Ne JAMAIS concaténer `${ADMIN_CONSOLE_PATH}/${go}` : le serveur émet `kyb`
 * quand la route s'appelle `kyb-review`. Une cible nue tombe sur `<Route path="*">`,
 * donc sur une redirection silencieuse — sans erreur, sans trace, et c'est
 * précisément le seul signal vivant en production qui partirait dans le vide.
 *
 * `security` n'est pas un jeton serveur : il est ici parce que la modale de
 * diagnostic KYC y renvoie, et qu'une seconde table de chemins divergerait.
 */
const SECTION_PATH: Record<string, string> = {
  monitoring: `${ADMIN_CONSOLE_PATH}/monitoring`,
  plans: `${ADMIN_CONSOLE_PATH}/plans`,
  live: `${ADMIN_CONSOLE_PATH}/live`,
  agencies: `${ADMIN_CONSOLE_PATH}/agencies`,
  kyb: `${ADMIN_CONSOLE_PATH}/kyb-review`,
  security: `${ADMIN_CONSOLE_PATH}/security`,
}

export function sectionPath(go: string): string {
  return SECTION_PATH[go] ?? ADMIN_CONSOLE_PATH
}

/** Clé i18n du libellé d'un signal, par `kind` serveur. */
export const SIGNAL_LABEL_KEY: Record<string, string> = {
  functions_error: 'dashboard.head.signalFunctions',
  // ⚠ « paiements échoués » serait FAUX : le serveur compte les agences de la file
  // `unpaid` de `get_admin_plans_board`, où tombe aussi toute agence SUSPENDUE, y
  // compris sans la moindre ligne d'abonnement. D'où « agence à régulariser ».
  payments_failed: 'dashboard.head.signalPay',
  kyb_review: 'dashboard.head.signalKyb',
}

/** Clé i18n du bouton d'un signal. */
export const SIGNAL_CTA_KEY: Record<string, string> = {
  functions_error: 'dashboard.head.ctaMonitoring',
  payments_failed: 'dashboard.head.ctaRevenue',
  kyb_review: 'dashboard.head.ctaKyb',
}

/**
 * Libellés d'action du journal.
 *
 * ⚠ Les chaînes sont celles qu'`activity_events` porte RÉELLEMENT, relevées en
 * production : deux d'entre elles contiennent un point (`contact_scores.recompute`),
 * et le copilote WhatsApp s'appelle `whatsapp_agent_copilot_reply`. Une clé
 * devinée (`contact_scores`, `whatsapp_copilot`) affiche l'action brute, et
 * aucune porte ne le voit — `lint:i18n` ne couvre pas la console.
 */
export const JOURNAL_ACTION_KEY: Record<string, string> = {
  match_suggested: 'dashboard.journal.action.matchSuggested',
  agency_created: 'dashboard.journal.action.agencyCreated',
  'contact_scores.recompute': 'dashboard.journal.action.contactScores',
  'property_scores.recompute': 'dashboard.journal.action.propertyScores',
  whatsapp_agent_copilot_reply: 'dashboard.journal.action.whatsappCopilot',
  stage_change: 'dashboard.journal.action.stageChange',
  contact_created: 'dashboard.journal.action.contactCreated',
  property_created: 'dashboard.journal.action.propertyCreated',
  kyc_case_created: 'dashboard.journal.action.kycCaseCreated',
  kyc_case_validated: 'dashboard.journal.action.kycCaseValidated',
  email_sent: 'dashboard.journal.action.emailSent',
  // Conservées de l'ancien bloc « Alertes » : `role_changed` est la SEULE action
  // `critical` réellement produite en production. La perdre afficherait une
  // pastille rouge à côté d'une clé brute.
  role_changed: 'dashboard.journal.action.roleChanged',
  payment_failed: 'dashboard.journal.action.paymentFailed',
  edge_function_error: 'dashboard.journal.action.edgeFunctionError',
}

/**
 * Actions masquées du journal.
 *
 * `admin_console_entered` porte `category='auth'` et `severity='warn'` : le filtre
 * serveur ne retire que `category='kyc'`, donc c'est aujourd'hui la seule ligne
 * `warn` qui survit — le tri par sévérité la placerait EN TÊTE. « Vous avez ouvert
 * la console » n'est pas le premier fait de votre vue d'ensemble.
 */
export const JOURNAL_HIDDEN_ACTIONS = ['admin_console_entered']

/** Rang de tri d'une sévérité : le plus grave d'abord. */
export function rankTone(severity: string): number {
  if (severity === 'critical') return 0
  if (severity === 'warn') return 1
  return 2
}

export interface JournalFamily {
  action: string
  count: number
  agencies: string[]
  last: string
  tone: string
}

/**
 * Regroupe le journal par action.
 *
 * `last` est le MAXIMUM des horodatages, pas la première ligne rencontrée : les
 * lignes arrivent triées mais le tri par sévérité les réordonne ensuite, et une
 * famille afficherait alors la date d'une ligne quelconque.
 *
 * Le tri final est stable — à sévérité égale, l'ordre d'arrivée (`ts desc` du
 * serveur) est conservé.
 */
export function groupJournal(rows: OverviewJournalRow[]): JournalFamily[] {
  const visibles = rows.filter(r => !JOURNAL_HIDDEN_ACTIONS.includes(r.action))
  const familles = new Map<string, JournalFamily & { agencySet: Set<string> }>()

  for (const row of visibles) {
    const f = familles.get(row.action)
    if (!f) {
      familles.set(row.action, {
        action: row.action,
        count: 1,
        agencies: [],
        agencySet: new Set(row.agency_name ? [row.agency_name] : []),
        last: row.ts,
        tone: row.severity,
      })
      continue
    }
    f.count += 1
    if (row.agency_name) f.agencySet.add(row.agency_name)
    if (row.ts > f.last) f.last = row.ts
    if (rankTone(row.severity) < rankTone(f.tone)) f.tone = row.severity
  }

  return [...familles.values()]
    .map(({ agencySet, ...f }) => ({ ...f, agencies: [...agencySet] }))
    .sort((a, b) => rankTone(a.tone) - rankTone(b.tone) || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
}

/** Lignes du journal visibles en maille « Détail », triées par sévérité puis récence. */
export function journalDetail(rows: OverviewJournalRow[]): OverviewJournalRow[] {
  return rows
    .filter(r => !JOURNAL_HIDDEN_ACTIONS.includes(r.action))
    .slice()
    .sort((a, b) => rankTone(a.severity) - rankTone(b.severity) || (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
}

/** Clé i18n d'un jeton `unavailable`. Un jeton inconnu s'affiche brut plutôt que d'être tu. */
export const UNAVAILABLE_KEY: Record<string, string> = {
  support_tickets: 'dashboard.unavailable.supportTickets',
  crons_late: 'dashboard.unavailable.cronsLate',
}
