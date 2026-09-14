/**
 * `lazyPrechargeable` — un composant préchargé se rend SANS suspendre.
 *
 * C'est tout l'objet de l'utilitaire (voir `src/lib/pagesPrechargeables.ts`) : au
 * premier « + », l'écran d'un onglet neuf suspendait sur son chunk et passait au noir.
 * Précharger le module ne suffisait pas avec `React.lazy` seul — sa fabrique n'est
 * appelée qu'au premier rendu, qui suspend donc une fois même sur un module déjà là.
 * La clause qui compte est la deuxième : aucun repli, pas même le temps d'un rendu.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { lazyPrechargeable } from '@/lib/lazyPrechargeable'

let racine: Root | null = null
afterEach(() => { racine?.unmount(); racine = null; document.body.innerHTML = '' })

function Page({ nom }: { nom: string }) {
  return <p>page {nom}</p>
}

/** Une fabrique d'import pilotée à la main, et le nombre de fois où elle a été appelée. */
function fabriqueManuelle() {
  let appels = 0
  let resoudre: (m: { default: typeof Page }) => void = () => {}
  let rejeter: (e: Error) => void = () => {}
  const fabrique = () => {
    appels++
    return new Promise<{ default: typeof Page }>((ok, ko) => { resoudre = ok; rejeter = ko })
  }
  return { fabrique, appels: () => appels, resoudre: () => resoudre({ default: Page }), rejeter: (e: Error) => rejeter(e) }
}

/** Monte `el` de façon SYNCHRONE : ce que montre le DOM ensuite est le premier rendu. */
function monter(el: React.ReactNode) {
  const hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  flushSync(() => racine!.render(el))
  return hote
}
/**
 * Attend que `hote` affiche `texte`. ⚠ Pas un délai fixe : après un repli, React 19
 * retient le dévoilement du contenu (~300 ms) pour ne pas faire clignoter la page.
 */
async function attendre(hote: HTMLElement, texte: string) {
  for (let i = 0; i < 50 && hote.textContent !== texte; i++) await new Promise((r) => setTimeout(r, 20))
}

describe('lazyPrechargeable', () => {
  it('non préchargé, il suspend puis rend la page — comme React.lazy', async () => {
    const f = fabriqueManuelle()
    const C = lazyPrechargeable(f.fabrique)
    const hote = monter(<Suspense fallback={<p>attente</p>}><C nom="a" /></Suspense>)
    expect(hote.textContent).toBe('attente')
    f.resoudre()
    await attendre(hote, 'page a')
    expect(hote.textContent).toBe('page a')
  })

  it('préchargé, il rend la page au PREMIER rendu, sans jamais peindre le repli', async () => {
    const f = fabriqueManuelle()
    const C = lazyPrechargeable(f.fabrique)
    const pret = C.precharger()
    f.resoudre()
    await pret
    const hote = monter(<Suspense fallback={<p>attente</p>}><C nom="b" /></Suspense>)
    expect(hote.textContent, 'le repli ne doit pas avoir été peint').toBe('page b')
  })

  it('n’importe qu’une fois, quel que soit le nombre de demandes', async () => {
    const f = fabriqueManuelle()
    const C = lazyPrechargeable(f.fabrique)
    const a = C.precharger()
    const b = C.precharger()
    expect(a).toBe(b)
    f.resoudre()
    await a
    monter(<C nom="c" />)
    expect(f.appels()).toBe(1)
  })

  it('un préchargement raté est oublié : la demande suivante réessaie', async () => {
    const f = fabriqueManuelle()
    const C = lazyPrechargeable(f.fabrique)
    const echec = C.precharger()
    f.rejeter(new Error('réseau'))
    await expect(echec).rejects.toThrow('réseau')
    const reprise = C.precharger()
    expect(f.appels()).toBe(2)
    f.resoudre()
    await expect(reprise).resolves.toBeTruthy()
  })
})
