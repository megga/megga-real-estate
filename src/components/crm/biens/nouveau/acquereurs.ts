/**
 * « Nouveau bien » — l'écran de fin d'un mandat mis en service (lot D1, conception §7) : ce que dit la ligne des
 * acquéreurs compatibles, selon ce qui est arrivé. Module PUR.
 *
 * Le moteur calcule les matchs quelques secondes après la mise en service (déclencheur `on_property_active`) ; la ligne
 * écoute les matchs du bien en direct. Au-delà de `DELAI_RECHERCHE_MS` sans aucun, elle le dit : un mandat sans
 * acquéreur compatible est un RÉSULTAT, pas une attente.
 */
export const DELAI_RECHERCHE_MS = 30_000

export type EtatAcquereurs =
  | { genre: 'recherche' }
  | { genre: 'trouves'; nombre: number }
  | { genre: 'aucun' }
  | { genre: 'erreur' }

/** Des acquéreurs trouvés l'emportent toujours ; un échec n'est jamais « aucun ». */
export function etatAcquereurs(nombre: number | null, ecoule: boolean, enErreur: boolean): EtatAcquereurs {
  if (nombre != null && nombre > 0) return { genre: 'trouves', nombre }
  if (enErreur) return { genre: 'erreur' }
  return ecoule ? { genre: 'aucun' } : { genre: 'recherche' }
}
