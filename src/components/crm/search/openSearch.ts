// Déclencheur léger de la recherche immersive Sugar.
// Module sans dépendance lourde : importé par le shell / le rail latéral pour
// ouvrir la palette sans embarquer le composant CrmSearch dans leur bundle.

export const OPEN_SEARCH_EVENT = 'megga:open-search'

/**
 * Ouvre la recherche immersive Sugar (écoutée par CrmSearchHost).
 *
 * `query` amorce le champ. Il sert au relais du NOUVEL ONGLET : l'agent y tape
 * dans un champ local, et la première frappe doit arriver dans la palette au
 * lieu de se perdre — c'est le geste de la barre d'adresse de Chrome, où le
 * champ de la page d'accueil n'est qu'une porte vers l'omnibox. Sans lui, la
 * palette s'ouvrirait vide et l'agent retaperait sa lettre.
 */
export function openCrmSearch(query?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT, { detail: { query } }))
  }
}
