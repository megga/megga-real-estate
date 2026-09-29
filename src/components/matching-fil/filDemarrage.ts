/**
 * Matching — ce que montre la page 0 (lot E1, conception
 * `docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md` §5.1) : la couverture de premier lancement,
 * l'état « aucun match », ou le fil lui-même. Module PUR.
 *
 * Mesuré en production le 27.09.2026 : 12 agences sur 13 n'ont aucun match, et le fil leur aurait dit « Tout est à
 * jour » — faux : rien n'a commencé. Le seul prérequis réel d'un match est une recherche d'acheteur ACTIVE : le moteur
 * la compare aux mandats de l'agence et au marché, qui suffit.
 *
 * ⚠ LA COUVERTURE NE SE MONTRE QU'À COUP SÛR : jamais pendant une lecture — elle paraîtrait puis s'effacerait —, jamais
 * sur un échec, où l'état d'erreur du fil dit ce qui se passe. Ni à une agence dont le fil a lu un match, même sans
 * recherche active : une recherche close garde sa boucle, et ce qu'elle porte reste à traiter.
 *
 * ⚠ « Aucun match », c'est aucun match LU — à proposer, du marché ou de la boucle —, pas « aucune ligne » : une agence
 * dont les biens ont tous été refusés ou sont en visite a des matchs et rien à proposer, et le fil lui dit « Tout est à
 * jour ». Un match sorti par « Écarter » (`ignored`) n'est plus lu, lui : l'agence qui les a tous sortis ainsi n'a plus
 * de match — l'état « aucun match », ou la couverture sans recherche active.
 */

/** Ce qu'a rendu la lecture des recherches d'acheteur actives de l'agence (`useRecherchesActives`). */
export type RecherchesAgence = 'chargement' | 'erreur' | 'aucune' | 'actives'

/** Ce que montre la page 0 : `fil` laisse au fil ses propres états, « Tout est à jour » compris. */
type EcranFil = 'chargement' | 'erreur' | 'couverture' | 'sansMatch' | 'fil'

/** La lecture du fil : en cours, en échec sans données, et le nombre de matchs qu'elle a rendus. */
interface LectureFil { chargement: boolean; erreur: boolean; matchs: number }

/** La page 0 du Matching, selon les recherches actives de l'agence et ce que le fil a lu. */
export function ecranDuFil(recherches: RecherchesAgence, fil: LectureFil): EcranFil {
  if (fil.chargement) return 'chargement'
  if (fil.erreur) return 'erreur'
  if (fil.matchs > 0) return 'fil'
  if (recherches === 'chargement' || recherches === 'erreur') return recherches
  return recherches === 'aucune' ? 'couverture' : 'sansMatch'
}
