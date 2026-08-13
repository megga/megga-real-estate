/**
 * Garde-fou : les palettes de la fiche deal et de la modale d'offre ne portent
 * QUE des barreaux MEGGA X ou des teintes sémantiques NOMMÉES.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Le plan de ce chantier désignait
 * `crm-sugar-v3/tokens.ts` comme « le vrai second système de jetons ». La mesure
 * a montré autre chose : la fiche n'en importe qu'un formateur de DATE, et la
 * modale d'offre rien du tout. Le second système, ce sont leurs palettes
 * LOCALES — `DsLIGHT/DsDARK` et `OM_LIGHT/OM_DARK` —, quatorze et vingt valeurs
 * recopiées de l'échelle grise de SugarV3, dont :
 *
 *   · le noir Sugar `#0B0C0E`, et sa forme décimale `rgba(11,12,14,…)` que les
 *     gardes de composant interdisent déjà partout ailleurs ;
 *   · le gris-bleu slate-900 `rgba(15,23,42,…)` (B−R = 27), qui a survécu à
 *     deux campagnes de retrait sur le Matching et se trouvait ici en filets ET
 *     en ombres — 18 occurrences dans le périmètre ;
 *   · un vert `#059669` employé en ENCRE à 3,77:1 sur la carte blanche, que la
 *     garde de contraste du lot 1 ne voyait pas : elle ne connaissait que
 *     `ink`/`soft`/`muted`, et personne ne lui avait nommé `err`/`ok`.
 *
 * ⚠ CE QUE CETTE GARDE NE FAIT PAS. Elle ne vérifie AUCUN contraste — c'est le
 * travail de `pipeline-contraste.spec.ts`, et les deux se complètent :
 * celle-ci dit d'où vient une valeur, l'autre si elle est lisible. Une couleur
 * peut être un barreau MEGGA X parfaitement légitime ET illisible sur la
 * surface où on la pose.
 */
import { describe, it, expect } from 'vitest'
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { dsPalette } from '@/components/crm-sugar-v3/dealTokens'
import { omPalette } from '@/components/crm-sugar-v3/offer-modal/omTokens'

/** Tout ce qu'une palette d'écran a le droit de contenir, sans le nommer. */
const BARREAUX = new Set<string>([
  ...Object.values(MXC_COLOR),
  ...Object.values(MXC_SYSTEM),
].map((v) => v.toLowerCase()))

/**
 * Teintes SÉMANTIQUES autorisées, NOMMÉES une par une.
 *
 * ⚠ Le fait de devoir les écrire ici est l'essentiel : une teinte qui dit un
 * ÉTAT (erreur, succès) ne descend d'aucune échelle de gris, mais elle ne doit
 * pas non plus pouvoir entrer sans décision. Les quatre viennent des
 * `--color-*-dark` de `globals.css` — le dépôt les possédait déjà.
 */
const SEMANTIQUES: Record<string, string> = {
  '#b91c1c': '--color-danger-dark (clair)',
  '#f87171': '--color-danger-dark (sombre)',
  '#047857': '--color-success-dark (clair)',
  '#34d399': '--color-success-dark (sombre)',
  '#f59e0b': '--color-warning (clair)',
  '#fbbf24': '--color-warning-dark (sombre)',
  // Survol de l'accent : mélange MESURÉ à 0,12 vers l'encre du thème. 0,16
  // rendrait 4,30:1 en sombre, sous l'AA — la valeur n'est pas au goût.
  '#3a42dd': 'survol de l’accent (clair)',
  '#5961fb': 'survol de l’accent (sombre)',
}

/** Extrait toute couleur d'une valeur de jeton — hex ET rgb/rgba. */
function couleursDe(valeur: string): string[] {
  return [
    ...(valeur.match(/#[0-9a-fA-F]{6}\b/g) ?? []),
    ...(valeur.match(/rgba?\([^)]*\)/g) ?? []),
  ]
}

/** `rgba(3,3,3,.05)` → `#030303`, pour comparer un voile à l'échelle. */
function noyau(couleur: string): string {
  const m = couleur.match(/rgba?\(([^)]+)\)/)
  if (!m) return couleur.toLowerCase()
  const p = m[1].split(',').slice(0, 3).map((s) => Math.round(parseFloat(s.trim())))
  if (p.some(Number.isNaN)) return couleur.toLowerCase()
  return '#' + p.map((v) => v.toString(16).padStart(2, '0')).join('')
}

const NOIR_SUGAR = /#0B0C0E\b|#0A0A0F\b|#0A0B0D\b|rgba?\(\s*11\s*,\s*12\s*,\s*14\b|rgba?\(\s*10\s*,\s*11\s*,\s*13\b/i
const GRIS_BLEU = /rgba?\(\s*15\s*,\s*23\s*,\s*42\b/i

const PALETTES = [
  { nom: 'fiche deal · clair', p: dsPalette(false, crmSugarPalette(false)) as Record<string, string> },
  { nom: 'fiche deal · sombre', p: dsPalette(true, crmSugarPalette(true)) as Record<string, string> },
  { nom: 'modale d’offre · clair', p: omPalette(false, crmSugarPalette(false)) as unknown as Record<string, string> },
  { nom: 'modale d’offre · sombre', p: omPalette(true, crmSugarPalette(true)) as unknown as Record<string, string> },
]

describe('Pipeline — les palettes d’écran ne portent que des barreaux MEGGA X', () => {
  it('les palettes sont bien peuplées', () => {
    // Sans ça, une palette vidée par un refactor rendrait tout vrai par vacuité.
    for (const { nom, p } of PALETTES) {
      expect(Object.keys(p).length, `${nom} : palette vide`).toBeGreaterThan(10)
    }
    expect(BARREAUX.size).toBeGreaterThan(10)
  })

  for (const { nom, p } of PALETTES) {
    it(`${nom} — aucun noir Sugar ni gris-bleu slate-900`, () => {
      const fautifs: string[] = []
      for (const [cle, val] of Object.entries(p)) {
        if (typeof val !== 'string') continue
        if (NOIR_SUGAR.test(val)) fautifs.push(`${cle}: ${val} (noir Sugar)`)
        if (GRIS_BLEU.test(val)) fautifs.push(`${cle}: ${val} (gris-bleu slate-900)`)
      }
      expect(fautifs, `teintes proscrites :\n  ${fautifs.join('\n  ')}`).toEqual([])
    })

    it(`${nom} — chaque couleur est un barreau ou une sémantique nommée`, () => {
      const fautifs: string[] = []
      for (const [cle, val] of Object.entries(p)) {
        if (typeof val !== 'string' || val === 'none' || val === 'transparent') continue
        for (const couleur of couleursDe(val)) {
          const n = noyau(couleur)
          if (BARREAUX.has(n) || SEMANTIQUES[n]) continue
          // Une ombre noire pure est une ombre, pas une teinte d'écran.
          if (/^#0{6}$/.test(n)) continue
          fautifs.push(`${cle}: ${couleur} → ${n}`)
        }
      }
      expect(fautifs, `hors échelle MEGGA X :\n  ${fautifs.join('\n  ')}`).toEqual([])
    })
  }

  /**
   * Une sémantique qui ne correspond plus à rien laisse croire qu'un écart est
   * décidé alors que la valeur a disparu. Même idiome que `TAILLES_ASSUMEES`.
   */
  it('chaque teinte sémantique correspond encore à une valeur employée', () => {
    const employees = new Set(
      PALETTES.flatMap(({ p }) =>
        Object.values(p).filter((v) => typeof v === 'string').flatMap(couleursDe).map(noyau)),
    )
    const mortes = Object.entries(SEMANTIQUES)
      .filter(([hex]) => !employees.has(hex))
      .map(([hex, raison]) => `${hex} — ${raison}`)
    expect(mortes, `sémantiques sans emploi :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LE CLIQUET : les deux palettes doivent rester des FONCTIONS de la palette
   * MEGGA X. Un objet figé rouvrirait la porte à la recopie — c'est exactement
   * ce qu'étaient `DsLIGHT` et `OM_LIGHT`, et pourquoi le noir Sugar y avait
   * survécu à deux campagnes de retrait.
   */
  it('les palettes dérivent de la palette MEGGA X, elles ne la recopient pas', () => {
    const clair = dsPalette(false, crmSugarPalette(false))
    const sombre = dsPalette(true, crmSugarPalette(true))
    expect(clair.ink).toBe(crmSugarPalette(false).ink)
    expect(sombre.ink).toBe(crmSugarPalette(true).ink)
    expect(clair.card).toBe(crmSugarPalette(false).cardBg)
    expect(sombre.card).toBe(crmSugarPalette(true).cardBg)
    // L'élément ACTIF porte l'accent — la règle du 10 août 2026.
    expect(clair.accent).toBe(MXC_COLOR.accent)
    expect(sombre.accent).toBe(MXC_COLOR.accent)
  })
})
