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

/**
 * Combien de palettes EN PLACE sont montées à l'écran.
 *
 * ⛔ POURQUOI CE COMPTEUR EXISTE. Depuis que la page d'accueil d'onglet accueille
 * la recherche dans son propre corps, `⌘K` y ferait paraître un SECOND champ,
 * flottant, par-dessus celui qui est déjà là et déjà focalisé — c'est-à-dire le
 * pop-up que cette page a précisément été refaite pour ne plus produire.
 *
 * Le raccourci reste donc global, mais il va à la recherche LÀ OÙ ELLE EST :
 * il ouvre le voile quand il n'y a rien d'autre, et se contente de rendre le
 * focus au champ quand une palette est déjà rendue dans la page.
 *
 * ⚠ Un COMPTEUR et non un booléen : deux surfaces pourraient en monter chacune
 * une (deux onglets vivants sur la page d'accueil, par exemple). Un booléen
 * remis à `false` par le premier démontage rouvrirait le voile alors qu'un champ
 * est encore à l'écran.
 */
let enPlaceMontees = 0

/** À appeler au montage d'une palette `inline` ; rend sa fonction de retrait. */
export function declarerPaletteEnPlace(): () => void {
  enPlaceMontees += 1
  let retiree = false
  return () => {
    if (retiree) return
    retiree = true
    enPlaceMontees = Math.max(0, enPlaceMontees - 1)
  }
}

/** Une palette est-elle déjà rendue dans la page ? */
export function paletteEnPlaceMontee(): boolean {
  return enPlaceMontees > 0
}
