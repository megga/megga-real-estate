/**
 * Garde-fou : la palette de la FICHE BIEN descend de MEGGA X, dans les deux
 * thèmes.
 *
 * ⚠ POURQUOI CE FICHIER EXISTE ALORS QUE LE PLAN DISAIT LA SURFACE PROPRE.
 * Le plan de refonte de « Mes biens » range la fiche avec la liste — « les
 * couleurs y sont déjà bonnes, c'est le cas Réglages » — et sa mesure le
 * confirme : `ListingDetailPage.tsx` ne porte que 2 littéraux hexadécimaux.
 * Mais sa palette n'est pas dans ce fichier : elle vit un dossier plus loin,
 * dans `crm-sugar-v3/vitrine/` (754 lignes, 39 hex), que la liste de dossiers
 * mesurée ne couvrait pas. La fiche en est l'UNIQUE consommateur.
 *
 * C'est le piège de comptage du calendrier, à l'identique : lui vivait dans
 * `crm-sugar/calendar/` ET `crm-mobile/agenda/`, et un grep sur le seul premier
 * annonçait 7 capitales quand il y en avait 12. Une surface n'est pas un
 * dossier. Voir `megga/calendrier-meggax`.
 *
 * L'état trouvé est exactement celui du wizard avant le 11 août 2026 : la
 * branche SOMBRE dérive ses SURFACES de `MXC_COLOR` mais garde quatre encres
 * bleutées hors échelle (`#F4F6F8`, `#C4C8D2`, `#878D9A`, `#4A4E59`) ; la
 * branche CLAIRE est restée Sugar de bout en bout, accent compris — `black`
 * y vaut `#0B0C0E`, l'ancienne règle « l'accent EST l'encre ».
 */
import { describe, it, expect, afterEach } from 'vitest'
import { MXC_COLOR, MXC_SYSTEM, mxCrmPalette } from '@/components/megga-x-crm/tokens'
import { vxPalette } from '@/components/crm-sugar-v3/vitrine/vitrineTokens'

/** Les barreaux que la vitrine publie — la seule source de couleur autorisée. */
const ECHELLE = new Set(
  [...Object.values(MXC_COLOR), ...Object.values(MXC_SYSTEM)].map((v) => v.toLowerCase()),
)

/**
 * Jetons qui portent un SENS que la vitrine ne sait pas dire :
 *
 * - `ok` / `warn` / `info` et leurs fonds : l'état d'une annonce (diffusée, à
 *   renouveler, en attente). Les teintes de `MXC_SYSTEM` sont réglées pour le
 *   canvas `#030303` et ne tiennent pas en encre sur fond clair.
 * - `hairline` : un VOILE (rgba), pas une couleur — il se pose sur la surface
 *   au lieu de la remplacer.
 * - `shadow*` : des ombres.
 *
 * `bgGradient` n'est PAS exempté : il est lu, il doit descendre de l'échelle.
 */
const SEMANTIQUES = new Set([
  'ok', 'okBg', 'warn', 'warnBg', 'info', 'infoBg',
  'hairline',
  'shadowSm', 'shadow', 'shadowHov',
  // Survol de l'accent dérivé par `sgMix` : aucun barreau de vitrine ne le publie.
  'blackHover',
])

/**
 * Les couleurs sous LEURS DEUX notations. Une première version ne lisait que
 * `#rrggbb` et était donc aveugle à `rgba(11,12,14,…)` — le noir de Sugar en
 * décimal, la même couleur sous un autre alphabet. Les canaux alpha sont
 * ignorés : seule la teinte d'un voile doit descendre sur l'échelle.
 */
function hexOf(value: string): string[] {
  const hex = (value.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toLowerCase())
  const rgb = [...value.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)].map(
    (m) => '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join(''),
  )
  return [...hex, ...rgb]
}

/** Accepte `#rrggbb` ET `rgb(r, g, b)` — `blackHover` est dérivé par `sgMix`. */
function rgbOf(color: string): [number, number, number] {
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  const h = color.trim().replace('#', '')
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) throw new Error(`couleur illisible : ${color}`)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance(color: string): number {
  const ch = rgbOf(color).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

afterEach(() => undefined)

describe('Fiche bien — la palette descend de MEGGA X', () => {
  // Sans cette garde, une palette vidée rendrait tout le reste vrai par vacuité.
  it('les deux thèmes rendent une palette fournie', () => {
    for (const dark of [false, true]) {
      expect(Object.keys(vxPalette(dark)).length).toBeGreaterThan(20)
    }
    expect(vxPalette(false)).not.toEqual(vxPalette(true))
  })

  it.each([false, true])('aucune couleur hors échelle (sombre=%s)', (dark) => {
    const p = vxPalette(dark) as unknown as Record<string, unknown>
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
   * Les surfaces et les encres viennent de `mxCrmPalette`, pas d'une copie. Le
   * test précédent laisserait passer un littéral qui COÏNCIDE avec un barreau
   * sans en descendre — `card: '#FFFFFF'` était déjà dans ce cas.
   */
  it.each([false, true])('surfaces et encres sortent de mxCrmPalette (sombre=%s)', (dark) => {
    const mx = mxCrmPalette(dark)
    const p = vxPalette(dark)
    expect(p.bg).toBe(mx.pageBg)
    expect(p.card).toBe(mx.cardBg)
    expect(p.cardSub).toBe(mx.cardSubBg)
    expect(p.ink).toBe(mx.ink)
    expect(p.inkSoft).toBe(mx.soft)
    expect(p.muted).toBe(mx.sub)
  })

  /**
   * L'accent de la marque, et rien d'autre. `black` portait un noir en clair et
   * un near-white en sombre — Sugar Pure faisait de l'accent l'encre. Même
   * correction que `SET.black` aux Réglages, `p.black` au calendrier et
   * `SugarV2.black` au wizard.
   */
  it.each([false, true])('l’accent est celui de la marque (sombre=%s)', (dark) => {
    const p = vxPalette(dark)
    expect(p.black).toBe(MXC_COLOR.accent)
    expect(p.onAccent).toBe(MXC_COLOR.n1000)
    expect(contrast(p.onAccent, p.black)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([false, true])('le survol de l’accent reste distinct et lisible (sombre=%s)', (dark) => {
    const p = vxPalette(dark)
    expect(p.blackHover).not.toBe(p.black)
    expect(contrast(p.onAccent, p.blackHover)).toBeGreaterThanOrEqual(4.5)
  })

  /**
   * `ghost` sert de trait et d'encre FAIBLE. Il doit rester sur l'échelle, et
   * surtout rester DISTINCT de `muted` : les deux confondus, la hiérarchie des
   * gris s'effondre à deux niveaux au lieu de trois.
   */
  it.each([false, true])('ghost est sur l’échelle et distinct de muted (sombre=%s)', (dark) => {
    const p = vxPalette(dark)
    expect([...ECHELLE]).toContain(p.ghost.toLowerCase())
    expect(p.ghost).not.toBe(p.muted)
  })
})
