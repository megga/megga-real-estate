// Déclencheur léger de la recherche immersive Sugar.
// Module sans dépendance lourde : importé par le shell / le rail latéral pour
// ouvrir la palette sans embarquer le composant CrmSugarSearch dans leur bundle.

export const OPEN_SEARCH_EVENT = 'megga:open-search'

/** Ouvre la recherche immersive Sugar (écoutée par CrmSugarSearchHost). */
export function openSugarSearch() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT))
  }
}
