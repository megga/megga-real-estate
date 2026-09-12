/**
 * Garde-fou : la plaque derrière le dock MEGGA AI ne revient pas.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Jusqu'au 12 septembre 2026, la coquille
 * (`AgentLayout`) se comprimait de 404 px quand le dock s'ouvrait et peignait sa
 * gouttière au `pageBg` de la palette. Chaque écran peignant SON fond, la
 * gouttière s'en écartait dès qu'il n'était pas `pageBg` : « Aujourd'hui » en
 * clair (`#EBEDF1` contre `#F9F9F9`), l'Audit (un dégradé), et — après une
 * bascule de thème sur les huit écrans qui ne la mémorisaient pas — une page
 * noire à côté d'une gouttière et d'un dock blancs. Julien : « une plaque qui
 * part du haut vers le bas et qui se voit ».
 *
 * Le correctif retire le second peintre : la page s'étend sous le dock, et c'est
 * son plan de travail qui se comprime (`usePousseeDock`). Ce fichier garde les
 * deux choses qu'aucune capture ne verrait avant qu'elles cassent :
 *   1. le MÉCANISME — l'écran se comprime seul tant qu'aucun plan de travail ne
 *      s'est inscrit, cède dès qu'il y en a un, et reprend dès qu'il n'y en a
 *      plus, y compris quand Suspense cache la page ;
 *   2. les CONTRATS DE SOURCE — qui prend la poussée s'inscrit (sinon 808 px),
 *      et aucun écran ne garde plus le thème pour lui seul.
 *
 * ⚠ Montage par `react-dom/client`, sans `@testing-library/react`, comme
 * `focus-trap.spec.ts`. jsdom ne met rien en page : on éprouve l'ATTRIBUT qui
 * décide de la poussée, pas une largeur. La preuve à l'écran est sur `/dev/crm`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createElement, act, Suspense, useEffect, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { EcranPousse } from '@/components/layout/EcranPousse'
import { usePorteSaPoussee } from '@/hooks/usePousseeDock'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ATTR = 'data-porte-sa-poussee'

let racine: Root | null = null

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  document.body.innerHTML = ''
})

function monter(arbre: ReactNode): HTMLElement {
  const hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  act(() => racine!.render(arbre))
  return hote.querySelector('[data-ecran-pousse]') as HTMLElement
}

/** Ce que fait `CrmWorkspace` : s'inscrire comme porteur de la poussée. */
function Porteur() {
  usePorteSaPoussee()
  return createElement('div', { 'data-porteur': '' })
}

/** Commande externe du nombre de porteurs montés. */
let fixerPorteurs: (n: number) => void = () => {}
function Porteurs({ initial }: { initial: number }) {
  const [n, setN] = useState(initial)
  // Exposé par un effet, pas pendant le rendu : `react-hooks/globals`.
  useEffect(() => { fixerPorteurs = (v) => act(() => setN(v)) })
  return createElement('div', null, ...Array.from({ length: n }, (_, i) => createElement(Porteur, { key: i })))
}

describe('La poussée du dock — qui se comprime', () => {
  it('un écran SANS plan de travail se comprime lui-même (le repli)', () => {
    const ecran = monter(createElement(EcranPousse, null, createElement('div')))
    expect(ecran).not.toBeNull()
    expect(ecran.hasAttribute(ATTR)).toBe(false)
  })

  it('un plan de travail inscrit retire le repli — et le rend en partant', () => {
    const ecran = monter(createElement(EcranPousse, null, createElement(Porteurs, { initial: 1 })))
    expect(ecran.hasAttribute(ATTR)).toBe(true)
    fixerPorteurs(0)
    expect(ecran.hasAttribute(ATTR)).toBe(false)
    fixerPorteurs(1)
    expect(ecran.hasAttribute(ATTR)).toBe(true)
  })

  it('deux porteurs : le repli ne revient qu’au départ du DERNIER', () => {
    const ecran = monter(createElement(EcranPousse, null, createElement(Porteurs, { initial: 2 })))
    expect(ecran.hasAttribute(ATTR)).toBe(true)
    fixerPorteurs(1)
    expect(ecran.hasAttribute(ATTR), 'un porteur reste : l’écran ne doit pas se recomprimer').toBe(true)
    fixerPorteurs(0)
    expect(ecran.hasAttribute(ATTR)).toBe(false)
  })

  /**
   * ⛔ Une bascule ANIMÉE ferait coexister 420 ms le repli qui se retire et le plan
   * qui se comprime déjà : 808 px de poussée à chaque fin de chargement dock ouvert.
   */
  it('la bascule se fait transition COUPÉE, puis la transition revient', () => {
    const ecran = monter(createElement(EcranPousse, null, createElement(Porteurs, { initial: 0 })))
    const vues: string[] = []
    const vraie = ecran.toggleAttribute.bind(ecran)
    ecran.toggleAttribute = (nom: string, force?: boolean) => {
      vues.push(ecran.style.transition)
      return vraie(nom, force)
    }
    fixerPorteurs(1)
    fixerPorteurs(0)
    expect(vues).toEqual(['none', 'none'])
    expect(ecran.style.transition, 'la transition de la feuille doit reprendre la main').toBe('')
  })

  it('hors écran porteur (bancs sans coquille), s’inscrire ne fait rien', () => {
    expect(() => monter(createElement(Porteur))).not.toThrow()
  })

  /**
   * ⛔ LE CAS QUI A DÉCIDÉ DE L'EFFET PLUTÔT QUE D'UN `:has()`. Quand une frontière
   * Suspense re-suspend, React CACHE la page sans la démonter et affiche le
   * squelette : un sélecteur verrait encore le plan de travail caché, et le
   * squelette serait peint sous le dock. Les effets de mise en page, eux, sont
   * nettoyés — le repli doit donc revenir.
   */
  it('Suspense cache la page : le squelette reprend la poussée', () => {
    let suspendre = false
    let debloquer: () => void = () => {}
    const promesse = new Promise<void>((r) => { debloquer = r })
    function Page() {
      if (suspendre) throw promesse
      return createElement(Porteur)
    }
    let relancer: () => void = () => {}
    function Hote() {
      const [, setT] = useState(0)
      useEffect(() => { relancer = () => act(() => setT((t) => t + 1)) })
      return createElement(Suspense, { fallback: createElement('div', { 'data-squelette': '' }) }, createElement(Page))
    }
    const ecran = monter(createElement(EcranPousse, null, createElement(Hote)))
    expect(ecran.hasAttribute(ATTR)).toBe(true)
    suspendre = true
    relancer()
    expect(ecran.querySelector('[data-squelette]'), 'le squelette doit être affiché').not.toBeNull()
    expect(ecran.hasAttribute(ATTR), 'page cachée : l’écran doit se recomprimer').toBe(false)
    suspendre = false
    act(() => debloquer())
  })
})

/* ─── Contrats de source ──────────────────────────────────────────────────── */

const SRC = join(process.cwd(), 'src')

function fichiers(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return fichiers(p)
    return /\.tsx?$/.test(e.name) ? [p] : []
  })
}

const TOUS = fichiers(SRC)
/**
 * Le CODE, sans ses commentaires : les en-têtes de ce chantier CITENT
 * `usePorteSaPoussee()` et `useState(readCrmDark)` pour expliquer ce qu'ils
 * remplacent — une garde qui lirait la prose se prendrait à son propre récit.
 */
const lire = (p: string) => readFileSync(p, 'utf-8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const rel = (p: string) => p.slice(process.cwd().length + 1)

describe('La poussée du dock — contrats de source', () => {
  /**
   * Prendre la poussée sans s'inscrire, c'est se comprimer PAR-DESSUS l'écran qui
   * se comprime déjà : 808 px. S'inscrire sans la prendre, c'est retirer le repli
   * sans rien pour le remplacer : le contenu sous le dock.
   */
  it('qui prend la poussée s’inscrit, et qui s’inscrit la prend', () => {
    // Le bandeau d'accueil est HORS de tout écran : il prend la poussée sans avoir
    // de repli à retirer. Seule exception, et elle est écrite.
    const SANS_ECRAN = new Set(['src/components/layout/OnboardingCallBanner.tsx'])
    const prend = TOUS.filter((p) => /\bDOCK_PUSH_STYLE\b/.test(lire(p)) && !p.endsWith('aiPanel.ts'))
    const inscrit = TOUS.filter((p) => /\busePorteSaPoussee\(\)/.test(lire(p)) && !p.endsWith('usePousseeDock.ts'))
    expect(prend.length, 'aucun preneur trouvé : la garde ne lit plus rien').toBeGreaterThan(3)
    for (const p of prend) {
      if (SANS_ECRAN.has(rel(p))) continue
      expect(inscrit.map(rel), `${rel(p)} prend la poussée sans s’inscrire`).toContain(rel(p))
    }
    for (const p of inscrit) {
      expect(prend.map(rel), `${rel(p)} s’inscrit sans prendre la poussée`).toContain(rel(p))
    }
    // Plancher : le plan de travail en fait partie, sinon la règle ne garde rien.
    expect(inscrit.map(rel)).toContain('src/components/crm/CrmWorkspace.tsx')
  })

  it('la coquille publie la poussée, elle ne la prend plus', () => {
    const code = lire(join(SRC, 'components/layout/AgentLayout.tsx'))
    expect(code).not.toMatch(/paddingRight:\s*isOpen\s*\?\s*COPILOT_WIDTH/)
    expect(code).toMatch(/\[DOCK_PUSH_VAR as string\]:\s*isOpen \? `\$\{COPILOT_WIDTH\}px` : '0px'/)
  })

  /**
   * ⛔ Un `useState(readCrmDark)` rend la bascule PRIVÉE : le dock, la gouttière,
   * les primitives et les écrans vivants gardent l'ancien thème.
   */
  it('aucun écran du CRM ne garde le thème pour lui seul', () => {
    // Hors périmètre, et écrit : la source elle-même ; le fournisseur de la
    // console, qui annonce sa bascule (`writeCrmDark` dans son effet) ; les bancs
    // `/dev/*`, qui ne montent pas le dock.
    const HORS = new Set(['src/lib/crmDark.ts', 'src/components/admin/AdminThemeProvider.tsx'])
    const fautifs = TOUS.map(rel)
      .filter((p) => !HORS.has(p) && !p.startsWith('src/pages/dev/'))
      // `useState(readCrmDark)` comme `useMemo(() => readCrmDark(), [])` : les deux
      // figent le thème au montage.
      .filter((p) => /use(?:State|Memo)[^;\n]*\(\s*(?:\(\)\s*=>[^;]*)?readCrmDark/.test(lire(join(process.cwd(), p))))
    expect(fautifs).toEqual([])
    // Et plus personne n'écrit la clé sans l'annoncer.
    const nus = TOUS.filter((p) => /localStorage\.setItem\(\s*CRM_DARK_KEY/.test(lire(p))).map(rel)
    expect(nus).toEqual([])
  })
})
