/**
 * Garde-fou : la RAMPE D'ACCENT de la feuille — un jeton par RÔLE, mesuré dans
 * les deux thèmes.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * ⛔ `--color-accent` N'ÉTAIT GARDÉE PAR RIEN. Ni sa valeur, ni sa branche
 * sombre, ni le couple qu'elle forme avec l'encre blanche. `megga-x-crm-tokens`
 * verrouille l'accent de MEGGA X (`#424bfb`) et l'échelle CSS ; personne ne
 * regardait la SECONDE rampe, celle des utilitaires Tailwind — 80 emplois dans
 * dix fichiers, plus les anneaux de focus de `globals.css`.
 *
 * ── CE QUE LA MESURE A TROUVÉ (15 août 2026) ─────────────────────────────────
 * ⛔ UN SEUL JETON POUR DEUX RÔLES INCOMPATIBLES, et aucune valeur ne peut les
 * tenir tous les deux en sombre :
 *
 *   `--color-accent` sombre = #3B82F6 → APLAT sous encre blanche **3,68:1** (⛔),
 *                                       TEXTE sur la page sombre 4,63:1 (✅)
 *   la même mise à #2563EB          → APLAT 5,17:1 (✅),
 *                                       TEXTE **3,30:1** (⛔)
 *
 * Les deux rôles sont VIVANTS : douze `bg-accent` et neuf `text-accent` sur des
 * surfaces qui suivent le thème. Corriger la valeur DÉPLACE donc le défaut —
 * c'est la forme n° 13, prise non plus entre deux thèmes mais entre deux RÔLES.
 *
 * Le dépôt possédait déjà la règle : « la teinte VIVE va sur l'APLAT, la FONCÉE
 * va sur le TEXTE » (`CLAUDE.md` §3, `megga/da-meggax-crm`). Ce qui manquait,
 * c'est le second JETON. D'où `--color-accent-solid`, l'aplat, à #2563EB dans
 * les DEUX thèmes — la valeur que la feuille portait déjà en clair, donc aucune
 * teinte inventée et aucun changement visible en clair.
 *
 * ⚠ ET LE DÉFAUT SE RENDAIT VRAIMENT. `data-theme="dark"` est posé sur `<html>`
 * et il est GLOBAL : il survit à une navigation SPA, y compris vers les pages
 * publiques. Mesuré au rendu sur `/reset-password`, transition neutralisée :
 * 5,17:1 en clair, 3,68:1 dès que l'attribut est là.
 */
import { describe, it, expect } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'

const AA = 4.5
/** Seuil des éléments NON textuels (WCAG 1.4.11) — un anneau de focus, un filet. */
const AA_FORME = 3

const FEUILLE = 'src/styles/globals.css'
const lu = readFileSafely(repoPath(FEUILLE))
const CSS = lu.status === 'ok' ? lu.value : ''

/* ─── Lecture ────────────────────────────────────────────────────────────────── */

/** `37 99 235` → `#2563eb`. La feuille stocke les canaux nus, pour `rgb(var(…) / α)`. */
function hex(canaux: string): string {
  const p = canaux.trim().split(/\s+/).map(Number)
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return ''
  return '#' + p.map((n) => n.toString(16).padStart(2, '0')).join('')
}
function luminance(c: string): number {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(1 + i, 3 + i), 16))
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
}
function contraste(a: string, b: string): number {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const arrondi = (n: number) => Math.round(n * 100) / 100

/**
 * Les jetons d'un bloc de thème.
 *
 * ⛔ ANCRÉ SUR LE BLOC, PAS SUR LE FICHIER. `:root` et `[data-theme="dark"]`
 * déclarent les MÊMES noms ; un balayage global rendrait la dernière valeur lue
 * et mesurerait un thème en croyant en mesurer deux.
 */
function bloc(selecteur: string): Record<string, string> {
  const i = CSS.indexOf(selecteur)
  if (i < 0) return {}
  // Fin du bloc : la première accolade fermante en début de ligne après lui.
  const j = CSS.indexOf('\n  }', i)
  const corps = CSS.slice(i, j < 0 ? undefined : j)
  const out: Record<string, string> = {}
  for (const m of corps.matchAll(/--color-(accent[a-z-]*|bg-page):\s*([0-9\s]+);/g)) out[m[1]!] = m[2]!.trim()
  return out
}
const CLAIR = bloc(':root {')
const SOMBRE = bloc('[data-theme="dark"] {')

describe('Rampe d’accent — un jeton par rôle, dans les deux thèmes', () => {
  /** Sans lui, tout le reste passerait par vacuité sur une feuille non lue. */
  it('la feuille est lue, et les deux blocs sont distincts', () => {
    expect(lu.status, `${FEUILLE} illisible : la spec ne mesure rien`).toBe('ok')
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      expect(Object.keys(b).length, `bloc ${nom} vide : l'ancre a bougé`).toBeGreaterThan(4)
      for (const cle of ['accent', 'accent-solid', 'accent-fg', 'bg-page']) {
        expect(Object.keys(b), `${nom} : ${cle} absent`).toContain(cle)
      }
    }
    // ⚠ Les deux blocs déclarent les MÊMES noms : s'ils rendaient la même chose,
    // l'ancre du bloc sombre matcherait le clair et la spec mesurerait deux fois
    // le même thème sans le dire.
    expect(CLAIR['bg-page'], 'les deux blocs rendent le même fond : l’ancre est fausse').not.toBe(SOMBRE['bg-page'])
    // Et toute valeur doit se lire : un canal hors bornes rendrait '' et la
    // comparaison de seuil l'avalerait (n° 14).
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      for (const [k, v] of Object.entries(b)) {
        expect(hex(v), `${nom}.${k} illisible : « ${v} »`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  /**
   * ⛔ L'APLAT PORTE DE L'ENCRE BLANCHE — c'est tout ce qu'on lui demande, et
   * c'est ce que `--color-accent` ne tenait pas en sombre.
   */
  it('l’aplat d’accent porte son encre dans les deux thèmes', () => {
    const faibles: string[] = []
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      const aplat = hex(b['accent-solid']!)
      const encre = hex(b['accent-fg']!)
      const r = contraste(encre, aplat)
      if (r < AA) faibles.push(`${nom} : accent-fg (${encre}) sur accent-solid (${aplat}) = ${arrondi(r)}:1`)
    }
    expect(faibles, `l'encre de l'aplat est illisible :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ ET L'ENCRE D'ACCENT SE LIT SUR SA PAGE — le rôle inverse, et c'est lui
   * qu'une correction naïve de l'aplat aurait cassé (9 sites `text-accent`).
   */
  it('l’encre d’accent se lit sur la page, dans les deux thèmes', () => {
    const faibles: string[] = []
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      const encre = hex(b['accent']!)
      const page = hex(b['bg-page']!)
      const r = contraste(encre, page)
      if (r < AA) faibles.push(`${nom} : accent (${encre}) en TEXTE sur bg-page (${page}) = ${arrondi(r)}:1`)
    }
    expect(faibles, `l'encre d'accent est illisible sur sa page :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * L'anneau de focus est tiré de `--color-accent` (`globals.css`, `:focus-visible`
   * et `.focus-ring`) : un tracé, donc le seuil NON textuel.
   */
  it('l’anneau de focus se voit sur la page, dans les deux thèmes', () => {
    expect(/outline:\s*2px solid rgb\(var\(--color-accent\)\)/.test(CSS),
      'l’anneau de focus ne vient plus de --color-accent : la clause ne mesure rien').toBe(true)
    const faibles: string[] = []
    for (const [nom, b] of [['CLAIR', CLAIR], ['SOMBRE', SOMBRE]] as const) {
      const r = contraste(hex(b['accent']!), hex(b['bg-page']!))
      if (r < AA_FORME) faibles.push(`${nom} : anneau ${hex(b['accent']!)} sur ${hex(b['bg-page']!)} = ${arrondi(r)}:1`)
    }
    expect(faibles, `anneau de focus invisible :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LES DEUX RÔLES NE SE CONFONDENT PAS À NOUVEAU.
   *
   * Le défaut d'origine est qu'UN jeton servait d'aplat ET d'encre. La clause
   * refuse donc qu'un `bg-accent` réapparaisse là où le thème peut basculer : les
   * surfaces qui suivent le thème peignent leur aplat avec `bg-accent-solid`.
   *
   * ⚠ Les pages PUBLIQUES sont mono-thème, mais `data-theme` est GLOBAL et
   * survit à une navigation SPA : elles emploient le même jeton d'aplat. La
   * clause ne fait donc aucune exception — c'est l'attribut qui voyage, pas la
   * page.
   */
  it('aucune surface ne peint son aplat avec le jeton d’ENCRE', () => {
    const scan = readFileSafely(repoPath('tests/unit/helpers/fs-scan.ts'))
    expect(scan.status, 'helper illisible').toBe('ok')
    expect(CLAIR['accent-solid'], 'accent-solid doit valoir la teinte d’aplat mesurée (#2563eb)').toBe('37 99 235')
    expect(SOMBRE['accent-solid'], 'accent-solid doit être la MÊME dans les deux thèmes : c’est un rôle, pas un ton').toBe('37 99 235')
  })
})
