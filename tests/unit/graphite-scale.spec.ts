/**
 * Garde-fou : l'échelle sombre reste étanche et vivante.
 *
 * ⚠ Ce fichier éprouvait aussi le CHOIX de teinte (Graphite / Noir pur), retiré
 * avec la direction Sugar le 9 août 2026 : ces tests sont partis avec lui. Ce
 * qui reste a survécu pour une raison précise, notée sur chaque bloc.
 *
 * `CRM_GRAPHITE` n'est PAS la palette du CRM — celle-ci vient de `mxCrmPalette`
 * et se garde dans `megga-x-crm-tokens.spec.ts`. Les 110 appels à `crmStep` qui
 * la lisaient ont tous été repris ; `crmStep` a été supprimée avec son dernier
 * lecteur. Il ne reste que `CRM_TOKENS.graphite`, le thème legacy.
 */
import { describe, it, expect } from 'vitest'
import { CRM_GRAPHITE, CRM_TOKENS, crmSugarPalette } from '@/components/crm-sugar/tokens'
import { mxCrmPalette, MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { SugarV2, setSugarV2Dark } from '@/components/crm-sugar-wizard/tokens'
import { TK, applyTK } from '@/components/crm-sugar/today/tk'
import { SET_PALETTE, applySetTheme } from '@/components/crm-sugar/settings/data'
import { buildCalPalette } from '@/components/crm-sugar/calendar/data'
import { VxSP_DARK } from '@/components/crm-sugar-v3/vitrine/vitrineTokens'
import { MT_DARK } from '@/components/crm-mobile/tokens'

/** Luminance relative WCAG — sert à vérifier la monotonie de l'échelle. */
function luminance(hex: string): number {
  const c = hex.replace('#', '')
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const r = channel(parseInt(c.slice(0, 2), 16))
  const g = channel(parseInt(c.slice(2, 4), 16))
  const b = channel(parseInt(c.slice(4, 6), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('échelle Graphite — ce qu\'il en reste', () => {
  it('monte strictement de s0 à s4', () => {
    const steps = [CRM_GRAPHITE.s0, CRM_GRAPHITE.s1, CRM_GRAPHITE.s2, CRM_GRAPHITE.s3, CRM_GRAPHITE.s4]
    const lums = steps.map(luminance)
    expect(lums).toEqual([...lums].sort((a, b) => a - b))
    expect(new Set(steps).size).toBe(5)
  })

  it('remonte `muted` au-dessus de AA sur le canvas', () => {
    // #797D90 (teintes historiques) tombait à 4,45:1 sur #12161C. `CrmTheme`
    // n'est pas parti avec Sugar : 28 fichiers le lisent encore.
    expect(contrast(CRM_TOKENS.graphite.muted, CRM_GRAPHITE.s0)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(CRM_TOKENS.graphite.muted, CRM_GRAPHITE.s4)).toBeGreaterThanOrEqual(4.5)
  })


  /**
   * Le vrai garde-fou désormais : plus AUCUNE surface du CRM ne doit sortir de
   * cette échelle. Elle n'alimente que le thème `CrmTheme` legacy.
   */
  it('n’alimente plus que le thème legacy', () => {
    expect(CRM_TOKENS.graphite.bg).toBe(CRM_GRAPHITE.s0)
    expect(mxCrmPalette(true).pageBg).not.toBe(CRM_GRAPHITE.s0)
  })
})

describe('palette du CRM — MEGGA X, plus aucune direction alternative', () => {
  it('rend MEGGA X dans les deux modes', () => {
    for (const dark of [false, true]) {
      expect(crmSugarPalette(dark)).toEqual(mxCrmPalette(dark))
    }
  })

  it('creuse les sous-surfaces flottantes au lieu de les élever', () => {
    // Propriété conservée de Graphite : une sous-surface de modale se CREUSE.
    const p = mxCrmPalette(true)
    expect(luminance(p.solidBgSub)).toBeLessThan(luminance(p.solidBg))
    expect(luminance(p.solidBgSub2)).toBeLessThan(luminance(p.solidBgSub))
  })

  it('ne pose aucun blanc translucide en REMPLISSAGE', () => {
    const p = mxCrmPalette(true)
    const fonds = [
      p.pageBg, p.frameBg, p.cardBg, p.cardSubBg,
      p.solidBg, p.solidBgSub, p.solidBgSub2,
      p.tableHeadBg, p.iconBtnBg, p.iconRailBg, p.kbdBg,
    ]
    for (const f of fonds) expect(f).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('n’expose plus de rampe : `crmStep(sp, …)` doit retomber sur son littéral', () => {
    expect('ramp' in crmSugarPalette(true)).toBe(false)
    expect('ramp' in crmSugarPalette(false)).toBe(false)
  })
})

describe('palettes d’écran dérivées', () => {
  /**
   * Sept écrans montent leur PROPRE palette — cockpit, wizard, calendrier,
   * fiche bien, mobile… — au lieu de recevoir `sp`. Elles empruntaient toutes
   * l'échelle Graphite par `crmStep`. Ce test garde le sens inverse de celui
   * qu'il portait : il vérifie qu'elles rendent bien un neutre MEGGA X, et
   * donc qu'aucune ne retombe sur Graphite.
   */
  const NEUTRES = Object.values(MXC_COLOR) as string[]

  const cases: { name: string; read: () => string; attendu: string }[] = [
    { name: 'wizard SugarV2.card', read: () => { setSugarV2Dark(true); return SugarV2.card }, attendu: MXC_COLOR.n300 },
    { name: 'wizard SugarV2.rail', read: () => { setSugarV2Dark(true); return SugarV2.rail }, attendu: MXC_COLOR.n200 },
    { name: 'cockpit TK.frame', read: () => { applyTK(true); return TK.frame }, attendu: MXC_COLOR.n200 },
    { name: 'cockpit TK.cardHi', read: () => { applyTK(true); return TK.cardHi }, attendu: MXC_COLOR.n400 },
    { name: 'calendrier popBg', read: () => buildCalPalette(true, { bg: '#000' }).popBg, attendu: MXC_COLOR.n300 },
    { name: 'fiche bien VxSP.cardSub', read: () => VxSP_DARK.cardSub, attendu: MXC_COLOR.n200 },
    { name: 'mobile MT.pageBg', read: () => MT_DARK.pageBg, attendu: MXC_COLOR.n100 },
    { name: 'mobile MT.card', read: () => MT_DARK.card, attendu: MXC_COLOR.n300 },
    { name: 'mobile MT.tabBarBg', read: () => MT_DARK.tabBarBg, attendu: MXC_COLOR.n300 },
  ]

  it.each(cases)('$name rend un neutre MEGGA X', ({ read, attendu }) => {
    const v = read()
    expect(v).toBe(attendu)
    expect(NEUTRES, `${v} hors palette`).toContain(v)
  })

  it('aucune de ces surfaces n’est restée sur Graphite', () => {
    const rampe = Object.values(CRM_GRAPHITE) as string[]
    for (const { name, read } of cases) expect(rampe, name).not.toContain(read())
  })

  // Le voile de chrome mobile se dérive du palier CADRE : un quasi-noir figé se
  // verrait comme une bande posée sur la surface au lieu de la prolonger.
  it('le voile de chrome mobile suit le palier du cadre', () => {
    expect(MT_DARK.headerBg).toBe('rgba(5,5,5,0.82)')
  })

  it('garde le wizard en clair intact', () => {
    setSugarV2Dark(false)
    expect(SugarV2.card).toBe('#FFFFFF')
    setSugarV2Dark(null)
  })

  /**
   * Les Réglages ne passent PLUS par `crmStep` : leur palette est dérivée de
   * `mxCrmPalette` depuis la bascule. C'est le premier écran migré — le test le
   * fige pour que personne ne le ramène à l'échelle Graphite.
   */
  it('les Réglages sont déjà sortis de l’échelle Graphite', () => {
    applySetTheme(true)
    const rampe = Object.values(CRM_GRAPHITE) as string[]
    for (const s of [SET_PALETTE.bg, SET_PALETTE.card, SET_PALETTE.cardSubtle, SET_PALETTE.heroBg]) {
      expect(rampe).not.toContain(s)
    }
  })
})
