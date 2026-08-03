/**
 * Santé d'une agence — **un mot, jamais un score nu** (maquette `admin-agencies.jsx`).
 *
 * Dérivation FRONT, et le handoff l'exige telle quelle (§5.3 : « mot de santé
 * dérivé front, inchangé »). L'ordre des tests est repris au caractère près :
 * le réordonner change le mot rendu, puisque les branches se recouvrent.
 *
 * ⛔ Ce module rend un **mot-clé**, jamais une chaîne française : la maquette
 * code « Saine » en dur, la console parle quatre langues. Le tuple traverse,
 * `t()` traduit à l'écran.
 *
 * ⛔ Il ne rend **aucune couleur** non plus. `tone: 'ok'` n'est pas « vert » :
 * sur ce registre, la maquette peint « Saine » à l'encre douce — un réflexe
 * « ok ⇒ vert » casserait sa hiérarchie visuelle. La table de correspondance
 * vit dans la page qui l'affiche.
 *
 * ⚠ **`cause` n'est pas décoratif.** Deux branches rendent le MÊME mot
 * « dormant » pour des états incompatibles : une agence *suspendue par un
 * administrateur* et une agence *à score bas*. La maquette les distinguait par
 * une phrase ; sans elle, les deux rendraient un pixel identique. `cause` porte
 * cette distinction jusqu'à l'infobulle. Invisible en production aujourd'hui
 * (aucune agence suspendue) — c'est précisément pourquoi ça passerait une revue.
 */

export type AgencyHealthWord =
  | 'healthy'
  | 'toWake'
  | 'stalledActivation'
  | 'dormant'
  | 'unpaid'
  | 'new'

/** Ton FONCTIONNEL, pas une couleur : la page décide du rendu. */
export type AgencyHealthTone = 'ok' | 'warn' | 'err' | 'mute'

/** Pourquoi ce mot — désambiguïse les deux « dormant ». */
export type AgencyHealthCause =
  | 'suspended'
  | 'unpaid'
  | 'new'
  | 'stalled'
  | 'lowScore'
  | 'fading'
  | 'healthy'

export interface AgencyHealth {
  word: AgencyHealthWord
  tone: AgencyHealthTone
  cause: AgencyHealthCause
}

/** Ce dont la dérivation a besoin — un sous-ensemble d'`AgencyWithStats`. */
export interface AgencyHealthInput {
  status: string
  subscription_status: string | null
  score: number | null
  transaction_count: number
}

/**
 * Seuils de la maquette. Nommés plutôt que dispersés : ce sont des arbitrages
 * produit, pas des constantes techniques.
 */
export const HEALTH_DORMANT_BELOW = 45
export const HEALTH_FADING_BELOW = 75

export function agencyHealth(a: AgencyHealthInput): AgencyHealth {
  // ⚠ ORDRE VERBATIM de la maquette. Les branches se recouvrent : une agence
  // suspendue ET à score bas doit sortir « suspendue », pas « dormante par
  // score ». Trier autrement changerait le mot sans changer la donnée.
  if (a.status === 'suspended') {
    return a.subscription_status === 'past_due'
      ? { word: 'unpaid', tone: 'err', cause: 'unpaid' }
      : { word: 'dormant', tone: 'err', cause: 'suspended' }
  }
  // `score == null` : l'agence n'a pas encore de ligne d'activation. Le cron
  // nocturne la crée, donc cet état vit moins d'une nuit — mais il est réel et
  // atteignable, la création d'agence n'écrivant pas dans `agency_activation`.
  if (a.score == null) return { word: 'new', tone: 'mute', cause: 'new' }

  if (a.subscription_status === 'trialing' && a.transaction_count === 0 && a.score < HEALTH_DORMANT_BELOW) {
    return { word: 'stalledActivation', tone: 'err', cause: 'stalled' }
  }
  if (a.score < HEALTH_DORMANT_BELOW) return { word: 'dormant', tone: 'err', cause: 'lowScore' }
  if (a.score < HEALTH_FADING_BELOW) return { word: 'toWake', tone: 'warn', cause: 'fading' }
  return { word: 'healthy', tone: 'ok', cause: 'healthy' }
}

/** Ce dont le tri a besoin. */
export interface AgencySortInput {
  status: string
  mrr: number
  name: string
}

/** Actives d'abord, puis MRR décroissant, puis le nom (ordre de la maquette). */
export function compareAgencies(a: AgencySortInput, b: AgencySortInput): number {
  return (
    (a.status === 'suspended' ? 1 : 0) - (b.status === 'suspended' ? 1 : 0) ||
    b.mrr - a.mrr ||
    a.name.localeCompare(b.name, 'fr')
  )
}

/** Clé i18n du mot de santé. */
export const HEALTH_WORD_KEY: Record<AgencyHealthWord, string> = {
  healthy: 'agencies.health.healthy',
  toWake: 'agencies.health.toWake',
  stalledActivation: 'agencies.health.stalledActivation',
  dormant: 'agencies.health.dormant',
  unpaid: 'agencies.health.unpaid',
  new: 'agencies.health.new',
}

/** Clé i18n de la CAUSE, rendue en infobulle : c'est elle qui sépare les deux « dormant ». */
export const HEALTH_CAUSE_KEY: Record<AgencyHealthCause, string> = {
  suspended: 'agencies.healthCause.suspended',
  unpaid: 'agencies.healthCause.unpaid',
  new: 'agencies.healthCause.new',
  stalled: 'agencies.healthCause.stalled',
  lowScore: 'agencies.healthCause.lowScore',
  fading: 'agencies.healthCause.fading',
  healthy: 'agencies.healthCause.healthy',
}

/**
 * Sous-ligne d'identité d'une agence (ville · canton).
 *
 * ⚠ Mesuré en production : `city` est nulle sur 9 agences sur 11, `canton` sur
 * 8, et une agence porte `city = NULL` avec `canton = 'GE'` — le gabarit naïf
 * de la maquette rendrait alors « · GE », séparateur orphelin en tête de ligne.
 * Une autre porte `"Les Acasias "` avec une espace finale, d'où le `trim`.
 */
export function agencyIdentityLine(city: string | null, canton: string | null): string {
  return [city?.trim(), canton?.trim()].filter(Boolean).join(' · ')
}
