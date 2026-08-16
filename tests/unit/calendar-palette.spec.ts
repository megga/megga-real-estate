/**
 * Garde-fou : la palette du calendrier descend de MEGGA X, dans LES DEUX thèmes.
 *
 * Pourquoi ce test existe. Au 11 août 2026, `buildCalPalette()` ne dérivait de
 * `mxCrmPalette()` que sa branche SOMBRE ; la branche claire rendait `CAL_LIGHT`
 * tel quel, avec ses neutres bleutés hérités de Sugar — `#EDEFF3` de canvas,
 * `#7A8088` de texte secondaire, `#0B0C0E` d'encre. Mesuré alors : 18 des 21
 * littéraux hexadécimaux de `CAL_LIGHT` tombaient hors de l'échelle de la
 * vitrine. Les deux thèmes ne descendaient donc pas de la même source, et rien
 * ne le signalait — c'est exactement la dérive silencieuse que
 * `megga-x-crm-tokens.spec.ts` empêche pour les jetons du CRM.
 *
 * Ce que le test NE fait pas : interdire toute couleur hors échelle. Un
 * calendrier a besoin de dire l'avertissement, le retard et l'instant présent,
 * et la vitrine ne propose rien pour ça. Ces jetons-là sont donc EXEMPTÉS
 * nommément (`SEMANTIQUES`), sur le modèle de « le test fige l'écart au lieu de
 * l'interdire » : en ajouter un demande de l'écrire ici, donc d'en décider.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { buildCalPalette, type CalPalette } from '@/components/crm/calendar/data'

/** Les barreaux que la vitrine publie — la seule source de couleur autorisée. */
const ECHELLE = new Set(
  [...Object.values(MXC_COLOR), ...Object.values(MXC_SYSTEM)].map((v) => v.toLowerCase()),
)

/**
 * Jetons qui portent un SENS que la vitrine ne sait pas dire, et qui gardent
 * donc leur propre valeur. Chacun est là pour une raison, pas par tolérance :
 *
 * - `nowColor` : le trait de l'heure courante. Il doit trancher sur TOUT le
 *   reste de la grille, y compris sur l'accent — un agent qui cherche « où on en
 *   est » ne doit pas le confondre avec un événement sélectionné.
 * - `warn*` / `warm*` / `dangerInk` : l'avertissement et le retard. Les teintes
 *   de système de MEGGA X sont réglées pour un canvas `#030303` et ne tiennent
 *   pas en aplat clair (cf. la JSDoc de MXC_SYSTEM).
 * - `hero*` : le bandeau est volontairement sombre dans les deux thèmes.
 * - `line` / `line2` / `todayCol` : des VOILES (rgba), pas des couleurs. Ils se
 *   posent sur la surface au lieu de la remplacer, ce qu'aucun barreau opaque ne
 *   sait faire.
 * - `shadow*` : des ombres, pas des couleurs.
 */
const SEMANTIQUES = new Set([
  'nowColor',
  'warnBg', 'warnBorder', 'warnInk', 'warnIcon',
  'warmBg', 'warmInk', 'warmIcon',
  'dangerInk',
  'heroBg', 'heroInk', 'heroChip', 'heroChipStrong', 'heroShadow',
  'line', 'line2', 'todayCol',
  'shadowSm', 'shadow', 'shadowHover',
  'bgGradient',
])

/** Les hex d'une valeur de jeton — une valeur peut en contenir plusieurs. */
function hexOf(value: string): string[] {
  return (value.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toLowerCase())
}

describe('Calendrier — la palette descend de MEGGA X', () => {
  // Sans cette garde, une palette vidée rendrait tout le reste vrai par vacuité.
  it('les deux thèmes rendent une palette fournie', () => {
    for (const dark of [false, true]) {
      const p = buildCalPalette(dark)
      expect(Object.keys(p).length).toBeGreaterThan(25)
      expect(p.isDark).toBe(dark)
    }
  })

  it.each([false, true])('aucune couleur hors échelle (sombre=%s)', (dark) => {
    const p = buildCalPalette(dark) as unknown as Record<string, unknown>
    const fautifs: string[] = []
    for (const [jeton, valeur] of Object.entries(p)) {
      if (typeof valeur !== 'string' || SEMANTIQUES.has(jeton)) continue
      for (const h of hexOf(valeur)) {
        if (!ECHELLE.has(h)) fautifs.push(`${jeton} = ${h}`)
      }
    }
    expect(fautifs, `hors de l'échelle de la vitrine : ${fautifs.join(', ')}`).toEqual([])
  })

  /**
   * Le canvas et l'encre viennent de `mxCrmPalette`, pas d'une copie. Le test
   * précédent laisserait passer un littéral qui COÏNCIDE avec un barreau sans
   * en descendre ; celui-ci vérifie l'égalité avec la source elle-même.
   */
  it.each([false, true])('canvas, cartes et encres sortent de mxCrmPalette (sombre=%s)', async (dark) => {
    const { mxCrmPalette } = await import('@/components/megga-x-crm/tokens')
    const mx = mxCrmPalette(dark)
    const p = buildCalPalette(dark)
    expect(p.bg).toBe(mx.pageBg)
    expect(p.card).toBe(mx.cardBg)
    expect(p.ink).toBe(mx.ink)
    expect(p.inkSoft).toBe(mx.soft)
    expect(p.muted).toBe(mx.sub)
  })

  /**
   * L'accent de la marque, et rien d'autre. `black` est un alias historique
   * (@deprecated) : il doit valoir l'accent, pas un noir résiduel — c'est la
   * même correction qui a été faite sur `SET.black` aux Réglages.
   */
  it.each([false, true])('l’accent est celui de la marque (sombre=%s)', (dark) => {
    const p: CalPalette = buildCalPalette(dark)
    expect(p.accent).toBe(MXC_COLOR.accent)
    expect(p.ring).toBe(MXC_COLOR.accent)
    expect(p.black).toBe(MXC_COLOR.accent)
    expect(p.onAccent).toBe(MXC_COLOR.n1000)
  })

  /**
   * Les 7 teintes de TYPE d'événement restent hors échelle, et c'est décidé.
   *
   * Elles ne sont pas un oubli de la migration : l'échelle MEGGA X ne peut pas
   * les porter. `CAL_EVENT_TYPES` fige `ink: '#FFFFFF'` et fait donc reposer
   * tout le contraste sur la noirceur du fond. Mesuré, blanc sur les accents
   * disponibles : `#424bfb` 5,78:1 — le SEUL qui tienne ; `#fe566b` 3,11:1,
   * `#1abcfe` 2,17:1, `#00d95f` 1,89:1, `#74d184` 1,88:1, `#8dc1ff` 1,87:1,
   * `#efc42c` 1,67:1, `#adecbb` 1,36:1. Sept sur huit sont sous 3:1.
   *
   * Il n'existe donc pas sept fonds assez sombres dans la vitrine pour du texte
   * blanc. Les replier dessus rendrait les blocs illisibles — et les replier sur
   * MOINS de sept ferait perdre l'appariement bloc ↔ pastille, seul moyen de
   * balayer une semaine sans lire (les vues étroites n'affichent qu'une lettre).
   *
   * Ce test verrouille les deux propriétés qui comptent vraiment : elles sont
   * SEPT, et elles sont DISTINCTES. Repeindre reste possible ; les confondre non.
   */
  it('les sept teintes de type restent sept, et distinctes', async () => {
    const { CAL_EVENT_TYPES, eventTypeColors } = await import('@/components/crm/calendar/data')
    const types = Object.values(CAL_EVENT_TYPES)
    expect(types).toHaveLength(7)
    for (const dark of [false, true]) {
      const fonds = types.map((t) => eventTypeColors(t, dark).bg.toLowerCase())
      expect(new Set(fonds).size, `teintes confondues en ${dark ? 'sombre' : 'clair'}`).toBe(7)
    }
  })

  /**
   * `bgGradient` a été retiré : il était déclaré dans les deux thèmes et lu par
   * PERSONNE dans `calendar/` — mesuré au rendu, zéro dégradé radial sur la
   * page. Ce test empêche qu'il revienne par copier-coller depuis un module
   * voisin qui, lui, en a un vrai (crm-sugar-wizard, crm-sugar-v3).
   */
  it('aucun dégradé de fond ne subsiste dans la source du calendrier', () => {
    const src = readFileSync('src/components/crm/calendar/data.ts', 'utf-8')
    expect(src).not.toMatch(/bgGradient/)
  })
})
