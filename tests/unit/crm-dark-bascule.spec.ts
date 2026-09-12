/**
 * Garde-fou : une bascule clair/sombre atteint TOUT ce qui est à l'écran.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. `storage` ne part que vers les AUTRES onglets.
 * Dans l'onglet où l'on clique, huit écrans gardaient le thème dans un
 * `useState` local, et le dock MEGGA AI comme la coquille relisaient la clé
 * toutes les 400 ms. Mesuré le 12 septembre 2026 sur Analytics : bascule en
 * sombre, page noire, dock et gouttière BLANCS — la plaque que Julien voyait
 * derrière le dock. Les écrans gardés vivants derrière l'onglet restaient, eux,
 * dans l'ancien thème jusqu'à leur remontage.
 *
 * Ce fichier tient les quatre propriétés de `writeCrmDark` / `useCrmDark` /
 * `useCrmDarkPref` qui l'empêchent : écrire ET annoncer ; tous les lecteurs
 * suivent l'annonce ; sans choix enregistré, tous suivent le système ensemble ;
 * le setter accepte la forme fonctionnelle de `useState`.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { createElement, act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CRM_DARK_EVENT, CRM_DARK_KEY, useCrmDark, useCrmDarkPref, writeCrmDark } from '@/lib/crmDark'
import { readFileSync } from 'node:fs'
import { rayonsDeRevelation } from '@/lib/crmDarkBascule'
import { AdminThemeProvider } from '@/components/admin/AdminThemeProvider'
import { ThemeProvider } from '@/hooks/useTheme'
import { EcranPousse } from '@/components/layout/EcranPousse'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let racines: Root[] = []

/** Stockage minimal — l'environnement de test n'en fournit pas toujours un. */
let donnees = new Map<string, string>()
beforeEach(() => {
  donnees = new Map([[CRM_DARK_KEY, '0']])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => void donnees.set(k, v),
    removeItem: (k: string) => void donnees.delete(k),
  })
})
afterEach(() => {
  racines.forEach((r) => act(() => r.unmount()))
  racines = []
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function monter(el: ReturnType<typeof createElement>): HTMLElement {
  const hote = document.createElement('div')
  document.body.appendChild(hote)
  const r = createRoot(hote)
  racines.push(r)
  act(() => r.render(el))
  return hote
}

/** Un lecteur — le dock, la coquille, une primitive de dossier. */
function Lecteur({ id }: { id: string }) {
  return createElement('span', { 'data-lecteur': id }, useCrmDark() ? 'sombre' : 'clair')
}

let basculer: (v: boolean | ((p: boolean) => boolean)) => void = () => {}
/** Un écran qui porte la bascule — sa barre latérale reçoit `setDark`. */
function Ecran() {
  const [dark, setDark] = useCrmDarkPref()
  // Exposé par un effet, pas pendant le rendu : `react-hooks/globals`.
  useEffect(() => { basculer = (v) => act(() => setDark(v)) })
  return createElement('span', { 'data-ecran': '' }, dark ? 'sombre' : 'clair')
}

describe('Thème sombre — la bascule est annoncée dans l’onglet', () => {
  it('writeCrmDark écrit la clé ET annonce la valeur', () => {
    const recus: boolean[] = []
    const ecoute = (e: Event) => recus.push((e as CustomEvent<boolean>).detail)
    window.addEventListener(CRM_DARK_EVENT, ecoute)
    writeCrmDark(true)
    window.removeEventListener(CRM_DARK_EVENT, ecoute)
    expect(donnees.get(CRM_DARK_KEY)).toBe('1')
    expect(recus).toEqual([true])
  })

  it('une bascule faite par UN écran atteint tous les lecteurs de l’onglet', () => {
    const dock = monter(createElement(Lecteur, { id: 'dock' }))
    const cache = monter(createElement(Lecteur, { id: 'ecran-cache' }))
    const ecran = monter(createElement(Ecran))
    expect(dock.textContent).toBe('clair')
    basculer(true)
    expect(ecran.textContent).toBe('sombre')
    expect(dock.textContent, 'le dock doit suivre sans attendre').toBe('sombre')
    expect(cache.textContent, 'un écran vivant caché doit suivre aussi').toBe('sombre')
    expect(donnees.get(CRM_DARK_KEY)).toBe('1')
  })

  /**
   * ⛔ Sans choix enregistré, le thème est celui du SYSTÈME, relu à chaque lecture.
   * Les écrans ne figent plus la clé à leur montage : un changement d'apparence
   * en cours de session doit donc atteindre tous les lecteurs ensemble, sinon les
   * écrans ouverts ensuite divergent du dock resté dans l'ancienne apparence.
   */
  it('sans choix enregistré, tous les lecteurs suivent l’apparence du système', () => {
    donnees.clear()
    let sombre = false
    const ecouteurs = new Set<() => void>()
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return sombre },
      addEventListener: (_: string, f: () => void) => ecouteurs.add(f),
      removeEventListener: (_: string, f: () => void) => ecouteurs.delete(f),
    }))
    const dock = monter(createElement(Lecteur, { id: 'dock' }))
    const ecran = monter(createElement(Ecran))
    expect(dock.textContent).toBe('clair')
    sombre = true
    act(() => ecouteurs.forEach((f) => f()))
    expect(dock.textContent, 'le dock doit suivre le système').toBe('sombre')
    expect(ecran.textContent).toBe('sombre')
    // Un choix explicite l'emporte ensuite sur le système.
    basculer(false)
    sombre = true
    act(() => ecouteurs.forEach((f) => f()))
    expect(dock.textContent, 'un choix de l’agent prime sur le système').toBe('clair')
  })

  it('le setter accepte la forme fonctionnelle, comme celui de useState', () => {
    const ecran = monter(createElement(Ecran))
    basculer((v) => !v)
    expect(ecran.textContent).toBe('sombre')
    basculer((v) => !v)
    expect(ecran.textContent).toBe('clair')
  })
})

/* ─── La bascule ANIMÉE (`lib/crmDarkBascule.ts`) ─────────────────────────── */

/**
 * ⛔ POURQUOI CES CAS. La bascule courait sur trois horloges (carte de la barre
 * latérale instantanée, lignes à 180 ms, « Aujourd'hui » à 550 ms) : le nom de
 * l'agence restait illisible 150 ms sur une carte déjà noire. Le correctif coupe
 * TOUTES les transitions le temps de la bascule et révèle l'écran d'un seul geste.
 * Ce qui doit tenir : la nouvelle palette est rendue AVANT la photo (`flushSync`),
 * les transitions sont coupées pendant et rendues après, et sans l'API — ou en
 * mouvement réduit — la bascule reste d'un seul tenant, sans animation.
 */
describe('Thème sombre — la bascule est d’un seul geste', () => {
  const ATTR = 'data-crm-bascule'
  let vtOriginal: unknown

  beforeEach(() => {
    vtOriginal = (document as unknown as { startViewTransition?: unknown }).startViewTransition
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  })
  afterEach(() => {
    ;(document as unknown as { startViewTransition?: unknown }).startViewTransition = vtOriginal
    document.documentElement.removeAttribute(ATTR)
  })

  /** Un faux `startViewTransition` : il note ce que le DOM montre à la sortie du rappel. */
  function fauxTransition(ecran: HTMLElement) {
    const vu: { texte?: string; attr?: boolean; finir?: () => void } = {}
    ;(document as unknown as { startViewTransition: unknown }).startViewTransition = (rappel: () => void) => {
      rappel()
      vu.texte = ecran.textContent ?? ''
      vu.attr = document.documentElement.hasAttribute(ATTR)
      let finir: () => void = () => {}
      const finished = new Promise<void>((r) => { finir = r })
      vu.finir = finir
      return { ready: Promise.resolve(), finished, updateCallbackDone: Promise.resolve(), skipTransition: () => {} }
    }
    return vu
  }

  it('la nouvelle palette est rendue AVANT la photo, transitions coupées jusqu’à la fin', async () => {
    const ecran = monter(createElement(Ecran))
    const anim = vi.fn()
    document.documentElement.animate = anim as unknown as typeof document.documentElement.animate
    const vu = fauxTransition(ecran)
    basculer(true)
    expect(vu.texte, 'flushSync : le DOM montre déjà le nouveau thème à la sortie du rappel').toBe('sombre')
    expect(vu.attr, 'transitions coupées pendant la bascule').toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(anim).toHaveBeenCalledTimes(1)
    const [images, options] = anim.mock.calls[0] as [{ clipPath: string[] }, { pseudoElement: string }]
    expect(options.pseudoElement).toBe('::view-transition-new(root)')
    expect(images.clipPath[0]).toMatch(/^circle\(0(\.0)?px at /)
    expect(document.documentElement.hasAttribute(ATTR), 'toujours coupées tant que la révélation court').toBe(true)
    vu.finir!()
    await Promise.resolve()
    await Promise.resolve()
    expect(document.documentElement.hasAttribute(ATTR), 'rendues à la fin').toBe(false)
  })

  it('sans l’API : bascule d’un seul tenant, transitions rendues aussitôt', () => {
    ;(document as unknown as { startViewTransition?: unknown }).startViewTransition = undefined
    const ecran = monter(createElement(Ecran))
    basculer(true)
    expect(ecran.textContent).toBe('sombre')
    expect(document.documentElement.hasAttribute(ATTR)).toBe(false)
  })

  it('en mouvement réduit : aucune révélation, même avec l’API', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion'), addEventListener: () => {}, removeEventListener: () => {} }))
    const appel = vi.fn()
    ;(document as unknown as { startViewTransition: unknown }).startViewTransition = appel
    const ecran = monter(createElement(Ecran))
    basculer(true)
    expect(appel).not.toHaveBeenCalled()
    expect(ecran.textContent).toBe('sombre')
  })

  /**
   * ⛔ Une bascule PENDANT une révélation attend sa fin : lancée tout de suite,
   * elle abandonnait la première et faisait clignoter la part d'écran pas encore
   * révélée. Et seule la dernière rend les transitions.
   */
  it('deux bascules rapprochées : la seconde attend la fin de la première', async () => {
    const tache = () => new Promise((r) => setTimeout(r, 0))
    const ecran = monter(createElement(Ecran))
    document.documentElement.animate = vi.fn() as unknown as typeof document.documentElement.animate
    const appels: string[] = []
    let finirs: Array<() => void> = []
    ;(document as unknown as { startViewTransition: unknown }).startViewTransition = (rappel: () => void) => {
      rappel()
      appels.push(ecran.textContent ?? '')
      let finir: () => void = () => {}
      const finished = new Promise<void>((r) => { finir = r })
      finirs = [...finirs, finir]
      return { ready: Promise.resolve(), finished, updateCallbackDone: Promise.resolve(), skipTransition: () => {} }
    }
    basculer(true)
    basculer(false)
    expect(appels, 'la seconde n’a pas encore commencé').toEqual(['sombre'])
    finirs[0]()
    await tache()
    expect(appels, 'elle part à la fin de la première').toEqual(['sombre', 'clair'])
    expect(document.documentElement.hasAttribute(ATTR), 'transitions toujours coupées pendant la seconde').toBe(true)
    finirs[1]()
    await tache()
    expect(document.documentElement.hasAttribute(ATTR)).toBe(false)
  })

  it('une transition sautée : aucun rejet orphelin, et l’attribut rendu', async () => {
    const ecran = monter(createElement(Ecran))
    ;(document as unknown as { startViewTransition: unknown }).startViewTransition = (rappel: () => void) => {
      const updateCallbackDone = Promise.resolve().then(rappel)
      return {
        ready: Promise.reject(new DOMException('sautée', 'AbortError')),
        finished: updateCallbackDone,
        updateCallbackDone,
        skipTransition: () => {},
      }
    }
    await act(async () => { basculer(true) })
    await new Promise((r) => setTimeout(r, 0))
    expect(ecran.textContent).toBe('sombre')
    expect(document.documentElement.hasAttribute(ATTR)).toBe(false)
  })

  it('un changement venu d’ailleurs est annoncé UNE fois, animé', async () => {
    donnees.clear()
    let sombre = false
    const ecouteurs = new Set<() => void>()
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() { return q.includes('color-scheme') ? sombre : false },
      addEventListener: (_: string, f: () => void) => ecouteurs.add(f),
      removeEventListener: (_: string, f: () => void) => ecouteurs.delete(f),
    }))
    const appels = vi.fn()
    ;(document as unknown as { startViewTransition: unknown }).startViewTransition = (rappel: () => void) => {
      appels()
      rappel()
      return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition: () => {} }
    }
    document.documentElement.animate = vi.fn() as unknown as typeof document.documentElement.animate
    const dock = monter(createElement(Lecteur, { id: 'dock' }))
    const ecran = monter(createElement(Lecteur, { id: 'ecran' }))
    sombre = true
    act(() => ecouteurs.forEach((f) => f()))
    await new Promise((r) => setTimeout(r, 0))
    expect(appels, 'deux lecteurs, une seule révélation').toHaveBeenCalledTimes(1)
    expect(dock.textContent).toBe('sombre')
    expect(ecran.textContent).toBe('sombre')
  })

  it('au clavier, le cercle part du contrôle activé', async () => {
    const ecran = monter(createElement(Ecran))
    const bouton = document.createElement('button')
    document.body.appendChild(bouton)
    bouton.getBoundingClientRect = () => ({ left: 100, top: 200, width: 40, height: 20, right: 140, bottom: 220, x: 100, y: 200, toJSON: () => ({}) }) as DOMRect
    const anim = vi.fn()
    document.documentElement.animate = anim as unknown as typeof document.documentElement.animate
    fauxTransition(ecran)
    bouton.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    basculer(true)
    await Promise.resolve()
    await Promise.resolve()
    const [images] = anim.mock.calls[0] as [{ clipPath: string[] }]
    expect(images.clipPath[0]).toContain('at 120px 210px')
  })
})

/**
 * ⛔ LA RÉVÉLATION NE TRAÎNE PLUS. Premier jet mesuré : 96 % de l'écran découvert
 * à 30 % du temps, puis une demi-animation à révéler un coin. Le rythme est
 * désormais celui de la SURFACE découverte : à mi-course, une part raisonnable de
 * l'écran — ni tout, ni rien —, et la fin découvre encore quelque chose.
 */
describe('Thème sombre — la révélation est rythmée sur la surface', () => {
  const L = 1440
  const H = 900
  /** Part de l'écran couverte par un cercle — par bandes d'un pixel. */
  const part = (r: number, x: number, y: number) => {
    let aire = 0
    for (let cx = 0.5; cx < L; cx += 1) {
      const dx = cx - x
      if (Math.abs(dx) >= r) continue
      const demi = Math.sqrt(r * r - dx * dx)
      aire += Math.max(0, Math.min(H, y + demi) - Math.max(0, y - demi))
    }
    return aire / (L * H)
  }

  it('part de rien, finit au coin le plus lointain, et grandit sans jamais reculer', () => {
    const r = rayonsDeRevelation(1000, 27, L, H)
    expect(r[0]).toBe(0)
    expect(r[r.length - 1]).toBeCloseTo(Math.hypot(1000, 900 - 27), 5)
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1])
  })

  it('bouton ☾ en haut à droite : pas de traîne — la seconde moitié révèle encore', () => {
    const r = rayonsDeRevelation(1000, 27, L, H)
    const n = r.length - 1
    const aMi = part(r[Math.round(n / 2)], 1000, 27)
    const a30 = part(r[Math.round(n * 0.3)], 1000, 27)
    const a80 = part(r[Math.round(n * 0.8)], 1000, 27)
    expect(a30, 'à 30 % du temps, l’écran n’est pas déjà révélé (96 % au premier jet)').toBeLessThan(0.6)
    expect(aMi).toBeGreaterThan(0.45)
    expect(aMi).toBeLessThan(0.85)
    expect(part(r[Math.round(n * 0.1)], 1000, 27), 'le clic répond tout de suite').toBeGreaterThan(0.06)
    expect(1 - a80, 'les 20 % de fin découvrent encore une part visible').toBeGreaterThan(0.04)
  })
})

/**
 * Les écritures qui comptent — trois défauts relevés par la revue du 12.09.2026 :
 * un choix égal à la valeur courante n'était pas enregistré (le système le
 * reprenait au coucher du soleil), la console admin épinglait la préférence à son
 * montage (défaisant « Système »), et sa restauration de `data-theme` en sortant
 * laissait le document dans l'ancien thème sous un CRM déjà basculé.
 */
describe('Thème sombre — ce qui est écrit, et par qui', () => {
  const systemeClair = () => vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))

  it('sans choix enregistré, choisir la valeur courante l’ÉPINGLE', () => {
    donnees.clear()
    let sombre = false
    const ecouteurs = new Set<() => void>()
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return sombre },
      addEventListener: (_: string, f: () => void) => ecouteurs.add(f),
      removeEventListener: (_: string, f: () => void) => ecouteurs.delete(f),
    }))
    const ecran = monter(createElement(Ecran))
    basculer(false)
    expect(donnees.get(CRM_DARK_KEY), '« Clair » choisi alors qu’on y est déjà : enregistré').toBe('0')
    sombre = true
    act(() => ecouteurs.forEach((f) => f()))
    expect(ecran.textContent, 'le système ne reprend pas un choix de l’agent').toBe('clair')
  })

  it('la console admin n’écrit rien à son montage', () => {
    donnees.clear()
    systemeClair()
    monter(createElement(AdminThemeProvider, null, createElement('span')))
    expect(donnees.has(CRM_DARK_KEY), '« Système » doit survivre à une visite de la console').toBe(false)
  })

  it('piloté, `data-theme` est réaffirmé contre une réécriture étrangère', async () => {
    systemeClair()
    monter(createElement(ThemeProvider, { pilote: 'dark' }, createElement('span')))
    const racine = document.documentElement
    expect(racine.getAttribute('data-theme')).toBe('dark')
    expect(racine.style.colorScheme).toBe('dark')
    racine.setAttribute('data-theme', 'light') // la console qui restaure sa valeur capturée
    await Promise.resolve()
    expect(racine.getAttribute('data-theme'), 'le pilote reste maître du document').toBe('dark')
  })
})

/**
 * Un écran d'onglet caché prend la palette APRÈS la révélation, transitions
 * rétablies : sans règle, ses fondus couraient dans le noir et se voyaient en
 * rebasculant sur son onglet (revue du 12.09.2026). La règle vit dans la feuille ;
 * ce test tient les deux bouts — elle existe, et elle vise ce que l'écran rend.
 */
describe('Thème sombre — un écran caché ne fond pas', () => {
  const SELECTEUR = '[data-ecran-pousse][aria-hidden="true"]'

  it('la feuille coupe toute transition sous un écran caché', () => {
    const css = readFileSync('src/styles/globals.css', 'utf-8')
    const regle = new RegExp(`${SELECTEUR.replace(/[[\]"]/g, '\\$&')} \\*,[^{]*\\{\\s*transition: none !important;`)
    expect(css).toMatch(regle)
  })

  it('le sélecteur vise l’écran tel qu’`EcranVivant` le rend caché', () => {
    const hote = monter(createElement(EcranPousse, { 'aria-hidden': true }, createElement('span')))
    expect(hote.querySelector(SELECTEUR), 'un écran caché').not.toBeNull()
    const visible = monter(createElement(EcranPousse, null, createElement('span')))
    expect(visible.querySelector(SELECTEUR), 'un écran montré garde ses transitions').toBeNull()
  })
})
