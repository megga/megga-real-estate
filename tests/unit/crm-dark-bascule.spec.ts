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
