/**
 * « Une modale possède-t-elle le clavier ? » — lu par les raccourcis de BASCULE
 * d'onglet (⌘K, Alt+chiffre, Alt+flèches, Alt+Maj+T).
 *
 * ⛔ POURQUOI. Une modale est portée dans `document.body` (règle du dépôt) : elle
 * échappe au `visibility: hidden` de l'écran qui l'a ouverte. Basculer d'onglet
 * sous elle la laissait peinte et active par-dessus l'onglet d'arrivée — et
 * l'autofocus de la page d'onglet neuf lui volait le focus : la frappe suivante
 * partait dans un champ invisible, sous le voile. Une modale est modale : tant
 * qu'elle est ouverte, on ne bascule pas.
 *
 * Deux signaux, parce qu'aucun ne couvre tout :
 *   1. `aria-modal="true"` — la déclaration explicite (MxModal, les feuilles,
 *      le composeur de la messagerie, les overlays de l'atelier…) ;
 *   2. le VOILE — un nœud porté dans `<body>`, fixe, qui couvre la fenêtre. C'est
 *      la forme que la règle du dépôt donne aux modales, y compris à celles qui
 *      ne se déclarent pas (confirmation de perte, renouvellement de mandat,
 *      session de relance…).
 *
 * ⚠ Seul ce qui est VISIBLE compte : une modale non portée reste dans le DOM de
 * son écran caché, et la compter bloquerait les raccourcis de tous les autres
 * onglets jusqu'au retour dans le sien.
 */

function visible(el: HTMLElement): boolean {
  const cs = getComputedStyle(el)
  return cs.display !== 'none' && cs.visibility === 'visible' && el.getClientRects().length > 0
}

export function modaleOuverte(): boolean {
  if (typeof document === 'undefined') return false
  for (const el of document.querySelectorAll<HTMLElement>('[aria-modal="true"]')) {
    if (visible(el)) return true
  }
  for (const el of document.body.children) {
    if (!(el instanceof HTMLElement) || el.id === 'root') continue
    const cs = getComputedStyle(el)
    if (cs.position !== 'fixed' || cs.pointerEvents === 'none' || !visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9) return true
  }
  return false
}
