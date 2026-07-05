// Radar de signaux — logique PURE (seuils + raisons chiffrées), zéro I/O, zéro
// Deno, testable vitest. Les requêtes SQL vivent dans automation-engine ; ici on
// tient les SEUILS et la construction du message_template (la « raison » que la
// file Focus affiche et que le copilote relaie via suggest_priorities_today).
//
// Doctrine : déterministe, explicable, seuils conservateurs. Aucun LLM.

export interface RadarThresholds {
  /** Dossier actif sans avancement depuis ≥ N jours. */
  dealStagnantDays: number
  /** Correspondance forte jamais envoyée depuis ≥ N jours. */
  matchIgnoredDays: number
  /** Score minimum d'une correspondance pour être « forte ». */
  matchIgnoredMinScore: number
}

export const RADAR_DEFAULTS: RadarThresholds = {
  dealStagnantDays: 14,
  matchIgnoredDays: 5,
  matchIgnoredMinScore: 70,
}

/** Jours entiers écoulés depuis `iso` jusqu'à `now` (0 si futur/invalide). */
export function daysSince(iso: string | null | undefined, now: number): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((now - t) / 86_400_000))
}

// Étapes de dossier considérées « en cours » : ni tout début, ni terminal. Un
// dossier figé au tout début (new_lead/lead) ou terminal (signed/lost) n'est pas
// un « dossier qui stagne » au sens actionnable.
const TERMINAL_OR_START_STAGES = new Set([
  'lead', 'new_lead', 'to_qualify', 'signed', 'closed', 'lost',
])

/** Un dossier est-il « stagnant » : actif, étape en cours, inactif depuis le seuil. */
export function isDealStagnant(params: {
  status: string | null
  stage: string | null
  updatedAt: string | null
  now: number
  days?: number
}): boolean {
  const threshold = params.days ?? RADAR_DEFAULTS.dealStagnantDays
  if ((params.status ?? '') !== 'active') return false
  if (!params.stage || TERMINAL_OR_START_STAGES.has(params.stage)) return false
  return daysSince(params.updatedAt, params.now) >= threshold
}

/** Libellés FR d'étape de dossier (transaction_stage), pour parler humain. */
const STAGE_LABELS: Record<string, string> = {
  active_search: 'Recherche active', visit_planned: 'Visite planifiée',
  visit_done: 'Visite effectuée', interest_confirmed: 'Intérêt confirmé',
  offer: 'Offre', negotiation: 'Négociation', reserved: 'Réservé',
  financing: 'Financement', notary: 'Notaire', to_recontact: 'À relancer',
}
export function stageLabelFr(stage: string | null | undefined): string {
  return (stage && STAGE_LABELS[stage]) || (stage ?? 'en cours')
}

/** message_template du signal « dossier stagnant » (chiffré, sobre). */
export function stagnantDealReason(stage: string | null, days: number): string {
  return `Dossier sans avancement depuis ${days} jours (étape : ${stageLabelFr(stage)}). À relancer ou faire avancer.`
}

/** Une correspondance est-elle « forte mais ignorée » : suggérée, score élevé,
 *  jamais envoyée, ancienne. */
export function isMatchIgnored(params: {
  status: string | null
  score: number | null
  sentAt: string | null
  createdAt: string | null
  now: number
  days?: number
  minScore?: number
}): boolean {
  const days = params.days ?? RADAR_DEFAULTS.matchIgnoredDays
  const minScore = params.minScore ?? RADAR_DEFAULTS.matchIgnoredMinScore
  if ((params.status ?? '') !== 'suggested') return false
  if (params.sentAt) return false
  if (typeof params.score !== 'number' || params.score < minScore) return false
  return daysSince(params.createdAt, params.now) >= days
}

/** message_template du signal « correspondance forte ignorée ». */
export function ignoredMatchReason(score: number, days: number, propertyTitle?: string | null): string {
  const bien = propertyTitle ? ` (${propertyTitle})` : ''
  return `Correspondance forte (score ${score}, estimation) proposée il y a ${days} jours et jamais envoyée${bien}. À envoyer ou écarter.`
}
