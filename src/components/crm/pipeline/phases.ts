/**
 * Les cinq PHASES du Pipeline — la refonte du 27.09.2026 (banc : « Pipeline »).
 *
 * ⛔ POURQUOI CINQ ET NON HUIT. Mesuré sur le banc à 1440 × 900 : les huit colonnes d'étape
 * rendaient 2 655 px de board pour 1 126 px visibles — trois colonnes sur huit, et les deux qui
 * portent l'argent (Offre, Signé) toujours hors écran. La granularité était de plus INVERSÉE :
 * trois colonnes pour l'entrée de l'entonnoir, une seule (« Offre déposée ») pour cinq stades de
 * la base — un deal chez le notaire s'y lisait « Offre déposée ».
 *
 * ⚠ LA BASE NE CHANGE PAS : ses stades restent la donnée. Une phase les REGROUPE ; le stade
 * précis se lit sur la carte (« Notaire », « Faite ») et s'y règle sans glisser. Glisser vers une
 * phase pose son PREMIER stade — une règle qui s'énonce en une phrase.
 *
 * ⚠ « Conclu » N'EST PAS UNE COLONNE : un deal conclu (`status = 'completed'`) sort du board,
 * comme avant. « Signature » garde les deals signés mais pas encore conclus (remise des clés,
 * commission) ; « Conclu » et « Perdu » sont des zones de dépôt, visibles pendant un glisser.
 *
 * Module PUR — ni React ni i18n : les libellés vivent sous `pipeline:phases.*`.
 */
import type { TransactionStage } from '@/lib/constants'
import { stageIdToTransactionStage } from '@/lib/crmAdapters'
import { CRM_STAGE_HUE, type StageId } from '../tokens'

export type PhaseId = 'prospects' | 'recherche' | 'visites' | 'offre' | 'signature'

export interface Phase {
  id: PhaseId
  /** Ses stades, dans l'ordre du parcours — le premier est celui que pose un dépôt. */
  stades: readonly TransactionStage[]
  /** Pris dans le balayage indigo → orange existant : la PROGRESSION reste, en cinq pas. */
  teinte: string
}

export const PHASES: readonly Phase[] = [
  { id: 'prospects', stades: ['new_lead', 'to_qualify', 'to_recontact'], teinte: CRM_STAGE_HUE['new-lead'] },
  { id: 'recherche', stades: ['active_search'], teinte: CRM_STAGE_HUE.searching },
  { id: 'visites', stades: ['visit_planned', 'visit_done'], teinte: CRM_STAGE_HUE['visit-done'] },
  { id: 'offre', stades: ['interest_confirmed', 'offer', 'negotiation'], teinte: CRM_STAGE_HUE.offer },
  { id: 'signature', stades: ['reserved', 'financing', 'notary', 'signed'], teinte: CRM_STAGE_HUE.signed },
]

const PAR_STADE = new Map<string, PhaseId>(PHASES.flatMap((p) => p.stades.map((s) => [s, p.id] as const)))

/**
 * Les quatre stades HÉRITÉS de l'énumération (antérieurs au Pipeline v2), que la base accepte
 * encore : rangés là où `mapStage` les range déjà, pour qu'aucune ligne ancienne ne tombe hors
 * du board.
 */
const HERITES: Record<string, PhaseId> = {
  lead: 'prospects', qualified: 'prospects', visit_planned_legacy: 'visites', closed: 'signature',
}

/** La phase d'un stade de la base ; `null` pour « perdu », qui sort du board. */
export function phaseDe(stade: string): PhaseId | null {
  if (stade === 'lost') return null
  return PAR_STADE.get(stade) ?? HERITES[stade] ?? 'prospects'
}

/** La phase par son identifiant — toujours définie, la liste est close. */
export function phase(id: PhaseId): Phase {
  return PHASES.find((p) => p.id === id)!
}

/** Le stade que pose un dépôt dans la phase : son premier. */
export function stadeDEntree(id: PhaseId): TransactionStage {
  return phase(id).stades[0]!
}

/**
 * Le stade de la base d'un deal. `dbStage` est porté par `transactionToCrmDeal` ; le repli sur
 * la colonne UI ne sert qu'à un deal construit ailleurs — il perd la précision (Notaire → Offre).
 */
export function stadeDuDeal(deal: { dbStage?: TransactionStage; stage: StageId }): TransactionStage {
  return deal.dbStage ?? stageIdToTransactionStage(deal.stage)
}

/* ─── Échéances ────────────────────────────────────────────────────────────── */

export type Echeance = 'retard' | 'aujourdhui' | 'demain' | 'plus_tard'

/**
 * Jours CIVILS entre aujourd'hui et une échéance — pas des heures : une relance de 9 h reste
 * « aujourd'hui » à 17 h, et elle n'est en retard qu'à partir du lendemain. Même règle que la
 * carte du board d'avant, qui comparait les dates.
 */
export function joursJusqua(iso: string, maintenant: Date = new Date()): number {
  const a = new Date(maintenant); a.setHours(0, 0, 0, 0)
  const b = new Date(iso); b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 864e5)
}

export function echeanceDe(iso: string, maintenant?: Date): Echeance {
  const j = joursJusqua(iso, maintenant)
  return j < 0 ? 'retard' : j === 0 ? 'aujourdhui' : j === 1 ? 'demain' : 'plus_tard'
}

/** Un deal sans nouvelle depuis ce nombre de jours affiche son silence — il dort. */
export const JOURS_SILENCE = 30

/* ─── Montants ─────────────────────────────────────────────────────────────── */

/** Le séparateur décimal de la langue : virgule en français et en italien, point sinon. */
function decimale(langue: string): string {
  return /^(de|en)/.test(langue) ? '.' : ','
}

/**
 * Montant court d'une carte : « 820 k », « 1,42 M ».
 *
 * ⛔ UNE SEULE ÉCRITURE PAR ÉCRAN. Le board d'avant affichait « CHF 2'350'000 » sur la carte,
 * « CHF 3.17M » en tête de colonne (point décimal anglais) et « CHF 3K » dans la liste.
 */
export function montantCourt(valeur: number, langue: string): string {
  if (valeur >= 1e6) {
    const m = (valeur / 1e6).toFixed(2).replace(/\.?0+$/, '')
    return `${m.replace('.', decimale(langue))} M`
  }
  if (valeur >= 1e3) return `${Math.round(valeur / 1e3)} k`
  return String(Math.round(valeur))
}

/** Un loyer, en entier et à l'apostrophe suisse : « 2'950 ». Le suffixe (« /mois ») est traduit. */
export function loyerCourt(valeur: number): string {
  return String(Math.round(valeur)).replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}
