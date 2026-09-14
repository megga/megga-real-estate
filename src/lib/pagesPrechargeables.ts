/**
 * Ce qu'affiche un onglet NEUF, préchargé tant que le CRM est au repos.
 *
 * ⛔ LE DÉFAUT (14.09.2026, Julien : « quand j'ouvre un nouvel onglet, j'ai un bug
 * d'affichage »). Mesuré image par image : au premier « + », l'écran ENTIER passait
 * au noir pendant ~300 ms — bande d'onglets, barre latérale et cadre compris — avec
 * un spinner en haut. Le chunk de la page d'onglet neuf n'était pas chargé : le
 * nouvel écran suspendait, et le repli de sa frontière (`SmartPageLoader`) voulait
 * peindre `CrmPageSkeleton`… lui-même chargé à la demande, donc absent lui aussi. Il
 * restait le spinner de dernier recours, sur le fond de page. Au second « + », rien :
 * le chunk était là.
 *
 * Les deux sont donc préchargés quand la bande d'onglets monte (au repos du
 * navigateur) et au survol du « + », puis rendus par `lazyPrechargeable`, qui ne
 * suspend plus une fois chargé. Le squelette sert aussi la PREMIÈRE visite de tout
 * autre écran d'onglet : il décalque le chrome, là où le spinner le faisait disparaître.
 */
import { lazyPrechargeable } from './lazyPrechargeable'

/** La page d'un onglet neuf (`/dashboard/nouvel-onglet`). */
export const NewTabPagePrechargeable = lazyPrechargeable(() => import('@/pages/agent/NewTabPage'))

/** Le squelette des surfaces CRM : le repli de la première visite d'un écran d'onglet. */
export const CrmPageSkeletonPrechargeable = lazyPrechargeable(() => import('@/components/skeletons/CrmPageSkeleton'))

/** Précharge les deux. Idempotent : chaque module n'est demandé qu'une fois par vie de page. */
export function prechargerOngletNeuf(): void {
  // ⚠ Un préchargement raté est AVALÉ. Laissé sans gestionnaire, son rejet atteindrait
  // `StaleBundleDetector` (écouteur `unhandledrejection`), qui le prendrait pour un
  // bundle périmé et rechargerait la page au bout de 8 s. Le rendu, lui, retombera sur
  // son propre chemin d'échec s'il le faut.
  void NewTabPagePrechargeable.precharger().catch(() => {})
  void CrmPageSkeletonPrechargeable.precharger().catch(() => {})
}

/**
 * Planifie `prechargerOngletNeuf` au prochain repos du navigateur ; rend l'annulation.
 * ⚠ `requestIdleCallback` manque à Safari : repli sur une minuterie.
 */
export function planifierPrechargementOngletNeuf(): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(prechargerOngletNeuf, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const t = setTimeout(prechargerOngletNeuf, 1200)
  return () => clearTimeout(t)
}
