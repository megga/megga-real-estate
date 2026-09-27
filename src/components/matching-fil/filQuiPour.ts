/**
 * « Qui pour ce bien ? » (lots C et D1) — modèle PUR partagé par le panneau du fil et les deux fiches : la forme d'un
 * acquéreur compatible, et ce qu'on écrit de son état. Ni React, ni Supabase, ni traduction.
 *
 * ⚠ Un match REPORTÉ dit jusqu'à quand ; un bien REVENU (refusé pour le prix, revenu par une baisse) dit à quel prix il
 * avait été refusé — ni l'un ni l'autre n'est une suggestion ordinaire (conception de D1, §7).
 */
import { cleMotif } from './filBoucle'
import { nombreOuNull, temps, type FilMatch, type SuiviMatch } from './filModele'

/**
 * Les statuts d'un acquéreur compatible — ceux qu'un refus n'a pas écartés : à proposer (reportés compris), proposés,
 * intéressés, en visite. Lus par les fiches (`useQuiPourCeBien`) et l'écran de fin de « Nouveau bien »
 * (`useAcquereursNouveauMandat`).
 * ⚠ La base compte les mêmes, en dur, dans la migration du lot D1 (`…_matching_surfaces.sql`) :
 * `pige_acheteurs_compatibles` (« Ce qui a bougé ») et le CTE `mandats` de `matching_actions_du_jour`
 * (« Aujourd'hui »). Changer l'une sans les autres ferait dire deux comptes différents au même bien.
 * ⚠ Le copilote WhatsApp (lot D2) les RECOPIE dans `supabase/functions/_shared/whatsapp-matching.ts` — cette
 * liste avec `etatCompatible`, l'ordre des compatibles ci-dessous (`trierCompatibles`) avec `vueAcheteurs` —
 * confrontés par `tests/unit/whatsapp-matching-fil.spec.ts`.
 */
export const STATUTS_COMPATIBLES = ['suggested', 'sent', 'interested', 'visit_planned'] as const

/** Un acquéreur compatible : ce que le fil sait d'un match, ou ce qu'une fiche en lit. */
export type Compatible = Pick<FilMatch, 'id' | 'score' | 'reporteJusquau' | 'suivi'> & {
  acheteur: Pick<FilMatch['acheteur'], 'id' | 'prenom' | 'nom'>
}

/** Une ligne `matches` lue par une fiche (`useQuiPourCeBien`). */
export interface LigneCompatible {
  id: string
  contact_id: string
  score: number | string | null
  status: string
  snoozed_until: string | null
  sent_at: string | null
  response_at: string | null
  reaction_motif: string | null
  reaction_note: string | null
  prix_propose: number | string | null
}

/**
 * Un compatible lu par une fiche ; `null` sans acheteur lisible. Le suivi d'un match à proposer n'existe que s'il a déjà
 * été proposé — la règle de `suiviAProposer` dans le fil.
 */
export function versCompatible(
  l: LigneCompatible, c: { first_name: string | null; last_name: string | null } | undefined,
): Compatible | null {
  if (!c) return null
  const prixPropose = nombreOuNull(l.prix_propose)
  const jamaisPropose = l.status === 'suggested' && prixPropose == null && l.reaction_motif == null
  const suivi: SuiviMatch | undefined = jamaisPropose ? undefined : {
    statut: l.status as SuiviMatch['statut'], proposeLe: l.sent_at, reponduLe: l.response_at, motif: l.reaction_motif,
    note: l.reaction_note, prixPropose, apprisLe: null,
  }
  return {
    id: l.id, score: nombreOuNull(l.score) ?? 0, suivi,
    // Le report ne vaut que pour un match À PROPOSER, comme dans le fil (`useMatchingFil` le force à `null` sur la
    // boucle) : `snoozeMatch` écrit `snoozed_until` par id, sans regarder le statut. Sans ce filtre, un bien proposé
    // puis reporté s'écrirait « Reporté jusqu'au … » sur la fiche, là où « Sa boucle » dit « Proposé » et où
    // `lienPlace` mène à « Retours de … ».
    reporteJusquau: l.status === 'suggested' ? l.snoozed_until : null,
    acheteur: { id: l.contact_id, prenom: c.first_name ?? '', nom: c.last_name ?? '' },
  }
}

/** L'état d'un compatible, à écrire : une clé `fil.quiPour.etat.*` et ses valeurs (dates et prix encore bruts). */
type EtatCompatible =
  | { cle: 'reporte'; date: string }
  | { cle: 'aProposer' }
  | { cle: 'revenu'; prix: number }
  | { cle: 'propose'; date: string }
  | { cle: 'proposeSansDate' }
  | { cle: 'interesse' }
  | { cle: 'visite' }
  | { cle: 'refuse'; motif: string }
  | { cle: 'refuseSansMotif' }

/** Où en est un compatible, à l'heure de la lecture. */
export function etatCompatible(m: Compatible, maintenant: number): EtatCompatible {
  if (m.reporteJusquau && temps(m.reporteJusquau) > maintenant) return { cle: 'reporte', date: m.reporteJusquau }
  const s = m.suivi
  if (!s || s.statut === 'suggested') {
    return s?.motif === 'prix' && s.prixPropose != null ? { cle: 'revenu', prix: s.prixPropose } : { cle: 'aProposer' }
  }
  if (s.statut === 'sent') return s.proposeLe ? { cle: 'propose', date: s.proposeLe } : { cle: 'proposeSansDate' }
  if (s.statut === 'interested') return { cle: 'interesse' }
  if (s.statut === 'visit_planned') return { cle: 'visite' }
  const motif = cleMotif(s.motif)
  return motif ? { cle: 'refuse', motif } : { cle: 'refuseSansMotif' }
}

/**
 * Les compatibles d'un bien, par score ; l'id départage.
 * ⚠ Le copilote WhatsApp (lot D2) la recopie dans `vueAcheteurs` (`_shared/whatsapp-matching.ts`), confrontée
 * par `tests/unit/whatsapp-matching-fil.spec.ts`.
 */
export const trierCompatibles = <T extends Compatible>(ms: readonly T[]): T[] =>
  [...ms].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
