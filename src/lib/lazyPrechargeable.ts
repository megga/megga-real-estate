/**
 * `React.lazy` qu'on peut PRÉCHARGER — et qui, une fois chargé, ne suspend plus.
 *
 * ⛔ Précharger le module ne suffit pas avec `React.lazy` seul. Sa fabrique n'est
 * appelée qu'au PREMIER rendu, et même un `import()` déjà résolu y rend une promesse :
 * le composant suspend une fois, et une frontière `Suspense` qui vient de monter —
 * celle d'un écran d'onglet neuf — peint son repli le temps d'une frame au moins.
 * D'où l'aiguillage : module chargé, on le rend directement ; sinon on passe par
 * `React.lazy`, comme avant.
 *
 * ⚠ Un échec de préchargement OUBLIE la promesse, pour qu'un navigateur qui réessaie
 * le puisse. Chrome, lui, mémorise l'échec d'un `import()` (c'est pourquoi la reprise
 * automatique des imports a été retirée le 12.09.2026) : l'échec d'un chunk au rendu
 * garde donc son chemin actuel — `ErrorBoundary`, puis rechargement.
 */
import { createElement, lazy, type ComponentType } from 'react'

type Module<P> = { default: ComponentType<P> }

/** Un composant paresseux doublé de `precharger()`, qui lance (une seule fois) son import. */
export function lazyPrechargeable<P extends object>(fabrique: () => Promise<Module<P>>) {
  let charge: ComponentType<P> | null = null
  let enCours: Promise<Module<P>> | null = null

  const precharger = (): Promise<Module<P>> => {
    enCours ??= fabrique().then(
      (m) => { charge = m.default; return m },
      (e: unknown) => { enCours = null; throw e },
    )
    return enCours
  }

  const Paresseux = lazy(precharger) as unknown as ComponentType<P>

  function Prechargeable(props: P) {
    return createElement(charge ?? Paresseux, props)
  }

  return Object.assign(Prechargeable, { precharger })
}
