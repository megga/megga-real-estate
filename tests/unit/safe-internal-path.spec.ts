/**
 * Chemin de retour interne (src/lib/safeInternalPath) — la seule barrière entre
 * un `?returnTo=` forgeable et `navigate()`.
 *
 * Deux preuves, et chacune a son contrôle positif :
 *   1. un corpus HOSTILE — dont on vérifie d'abord qu'il quitte réellement
 *      l'origine, et que le garde naïf suggéré par l'audit en accepte cinq ;
 *   2. le ROUTEUR INSTALLÉ, monté pour de vrai : une valeur brute à `\` fait
 *      jeter pushState (SecurityError ⇒ @remix-run/router bascule sur
 *      location.assign), la valeur filtrée navigue sans rien jeter.
 *
 * ⚠ Avec react-router 6.30.6 / @remix-run/router 1.23.4 (montée S16 du
 * 13.09.2026), le routeur résout lui-même `javascript:…`, `https://…` et `//hote`
 * en chemins internes : seules les variantes à `\` ou à caractère de contrôle
 * quittent encore l'origine (GHSA-wrjc-x8rr-h8h6, corrigé en 7.18 seulement).
 * Le filtre reste la barrière — c'est lui que ce spec garde, pas le routeur.
 *
 * Les caractères de contrôle sont bâtis par `String.fromCharCode` : aucun n'est
 * caché dans la source, et la règle ESLint `no-control-regex` reste muette.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createElement, act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { BrowserRouter, useNavigate, type NavigateFunction } from 'react-router-dom'
import { ROUTER_FUTURE } from '@/lib/routerFuture'
import { isSafeInternalPath, safeInternalPath } from '@/lib/safeInternalPath'

const TAB = String.fromCharCode(9)
const LF = String.fromCharCode(10)
const CR = String.fromCharCode(13)
const DEL = String.fromCharCode(127)

const APP = 'https://app.getmegga.com'
const BASE = `${APP}/dashboard/import-lead`

/** Valeurs qui, résolues par un navigateur, quittent l'origine de l'app. */
const HORS_ORIGINE = [
  '//evil.com',
  '/\\evil.com',
  '\\\\evil.com',
  '/\\/evil.com',
  `/${TAB}/evil.com`,
  `/${LF}/evil.com`,
  `/${CR}/evil.com`,
  ' //evil.com',
  `${TAB}//evil.com`,
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  `java${TAB}script:alert(1)`,
  'data:text/html,x',
  'https://evil.com',
  'HTTPS://evil.com',
  '//app.getmegga.com.evil.com/x',
]

describe('le corpus est réellement hostile (contrôles positifs)', () => {
  it('chaque valeur quitte l’origine une fois résolue par l’analyseur d’URL', () => {
    for (const v of HORS_ORIGINE) {
      expect(new URL(v, BASE).origin, JSON.stringify(v)).not.toBe(APP)
    }
  })

  it('le garde naïf `startsWith("/") && !startsWith("//")` en accepte cinq', () => {
    // Si cette assertion tombe, c'est le corpus qui a été affaibli — pas le filtre
    // qui s'est amélioré.
    const naif = (v: string) => v.startsWith('/') && !v.startsWith('//')
    expect(HORS_ORIGINE.filter(naif)).toEqual([
      '/\\evil.com',
      '/\\/evil.com',
      `/${TAB}/evil.com`,
      `/${LF}/evil.com`,
      `/${CR}/evil.com`,
    ])
  })
})

describe('isSafeInternalPath — refus', () => {
  it('refuse tout le corpus hors origine', () => {
    for (const v of HORS_ORIGINE) expect(isSafeInternalPath(v), JSON.stringify(v)).toBe(false)
  })

  it('refuse un chemin dont la forme NORMALISÉE commence par //', () => {
    // Le piège de la resérialisation : `new URL('/.//x').pathname === '//x'`.
    for (const v of ['/.//evil.com', '/dashboard/../..//evil.com', '/.%2e/%2e%2e//evil.com']) {
      expect(new URL(v, BASE).pathname.startsWith('//'), v).toBe(true) // contrôle positif
      expect(isSafeInternalPath(v), v).toBe(false)
    }
  })

  it('refuse les caractères de contrôle, DEL compris', () => {
    for (const v of [`/dashboard${DEL}`, `/dashboard/${TAB}x`, `/dashboard?q=${LF}`]) {
      expect(isSafeInternalPath(v), JSON.stringify(v)).toBe(false)
    }
  })

  it('refuse les non-chaînes, le vide et le trop long', () => {
    for (const v of [null, undefined, '', 42, {}, ['/dashboard']]) expect(isSafeInternalPath(v)).toBe(false)
    expect(isSafeInternalPath(`/${'a'.repeat(2047)}`)).toBe(true) // borne atteinte : acceptée
    expect(isSafeInternalPath(`/${'a'.repeat(2048)}`)).toBe(false) // un de trop
  })
})

describe('safeInternalPath — la valeur rendue', () => {
  const REPLI = '/__repli__'

  it('rend la valeur BRUTE, octet pour octet (contrôle contre un filtre qui renverrait toujours le repli)', () => {
    for (const v of [
      '/dashboard',
      '/dashboard/pipeline',
      '/dashboard/contacts/3f2b?tab=kyc#notes',
      '/dashboard/matching?contact=abc&q=%C3%A9',
      '/dashboard/pipeline?x=\\y', // un `\` dans la query reste une donnée
      '/dashboard/import-lead?returnTo=//evil.com', // une query imbriquée est inerte
    ]) {
      expect(safeInternalPath(v, REPLI, { prefix: '/dashboard' })).toBe(v)
    }
  })

  it('retombe sur le repli pour une valeur refusée', () => {
    expect(safeInternalPath('//evil.com', REPLI, { prefix: '/dashboard' })).toBe(REPLI)
    expect(safeInternalPath(null, REPLI)).toBe(REPLI)
  })

  it('le préfixe fait lui-même le refus (acceptés sans préfixe, refusés avec)', () => {
    for (const v of ['/auth/login', '/dashboardx', '/dashboard/../auth', '/dashboard/%2e%2e/auth', '/accept-invite/tok']) {
      expect(isSafeInternalPath(v), v).toBe(true)
      expect(isSafeInternalPath(v, { prefix: '/dashboard' }), v).toBe(false)
    }
  })
})

describe('contre le routeur installé', () => {
  let hote: HTMLDivElement | null = null
  let racine: Root | null = null
  let navigate: NavigateFunction | null = null
  const appels: { url: string; erreur: string | null }[] = []

  // La capture passe par un effet : réaffecter une variable externe pendant le
  // rendu est un effet de bord que la règle react-hooks refuse, à raison.
  function Sonde({ capter }: { capter: (n: NavigateFunction) => void }) {
    const n = useNavigate()
    useEffect(() => { capter(n) }, [n, capter])
    return null
  }
  const capter = (n: NavigateFunction) => { navigate = n }

  function monter() {
    // L'original est lu AVANT l'espion : l'espion le rappelle, puis RELANCE son
    // exception — sans ce relancer, le routeur n'atteindrait jamais sa branche
    // location.assign et la preuve serait creuse.
    const original = window.history.pushState.bind(window.history)
    vi.spyOn(window.history, 'pushState').mockImplementation((data: unknown, unused: string, url?: string | URL | null) => {
      try {
        original(data, unused, url)
        appels.push({ url: String(url), erreur: null })
      } catch (e) {
        // La DOMException de jsdom n'hérite pas de l'Error du test : on lit son nom.
        const nom = typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: unknown }).name) : String(e)
        appels.push({ url: String(url), erreur: nom })
        throw e
      }
    })
    // jsdom journalise « Not implemented: navigation » quand le routeur retombe
    // sur location.assign : bruit attendu, pas un échec.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
    act(() => racine!.render(createElement(BrowserRouter, { future: ROUTER_FUTURE }, createElement(Sonde, { capter }))))
  }

  afterEach(() => {
    if (racine) act(() => racine!.unmount())
    racine = null
    hote?.remove()
    hote = null
    navigate = null
    appels.length = 0
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('valeur BRUTE à `\\` : pushState jette SecurityError — le routeur prend la branche location.assign', () => {
    monter()
    act(() => { navigate!('/\\evil.com') })
    expect(appels.at(-1)).toEqual({ url: '/\\evil.com', erreur: 'SecurityError' })
  })

  it('valeur BRUTE `javascript:` : le routeur installé la résout en chemin interne', () => {
    // Jusqu'à 6.30.3 / 1.23.2, elle partait telle quelle — même SecurityError, même
    // location.assign, donc un script exécuté. Si cette assertion tombe, le routeur a
    // changé de comportement : relire le point (a) de src/lib/safeInternalPath.ts.
    monter()
    act(() => { navigate!('javascript:alert(1)') })
    expect(appels.at(-1)).toEqual({ url: '/javascript:alert(1)', erreur: null })
  })

  it('valeur FILTRÉE : le routeur pousse le repli, sans exception', () => {
    monter()
    for (const brut of ['/\\evil.com', 'javascript:alert(1)']) {
      act(() => { navigate!(safeInternalPath(brut, '/dashboard/pipeline', { prefix: '/dashboard' })) })
      expect(appels.at(-1)).toEqual({ url: '/dashboard/pipeline', erreur: null })
      expect(window.location.pathname).toBe('/dashboard/pipeline')
    }
  })

  it('un chemin légitime est bien celui qui est navigué (contrôle positif)', () => {
    monter()
    act(() => { navigate!(safeInternalPath('/dashboard/contacts/abc', '/dashboard/pipeline', { prefix: '/dashboard' })) })
    expect(appels.at(-1)).toEqual({ url: '/dashboard/contacts/abc', erreur: null })
    expect(window.location.pathname).toBe('/dashboard/contacts/abc')
  })
})
