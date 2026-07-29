/**
 * Garde-fou : l'échelle sombre « Graphite » reste étanche et résolvable.
 *
 * Le handoff du 29 juillet 2026 fait passer le sombre du CRM d'un empilement de
 * blancs translucides à une échelle de surfaces OPAQUES. Trois choses peuvent
 * se casser en silence — d'où ce test statique, qui ne dépend d'aucune donnée :
 *
 * 1. Une surface flottante qui repasserait au-dessus du plafond `s4` (ou une
 *    sous-surface de modale qui monterait au lieu de se creuser) : l'élévation
 *    ne se lit plus, et rien ne le signale à la compilation.
 * 2. Un `rgba(255,255,255,α)` réintroduit en REMPLISSAGE : au-delà de α .07 sur
 *    `#12161C` on dépasse le plafond et on lave la teinte bleutée.
 * 3. Un réglage `megga.darkTone` déjà stocké sur une teinte retirée de l'offre
 *    (`marine`, `meggaAi`) qui ne résoudrait plus — écran blanc à l'ouverture.
 */
import { describe, it, expect } from 'vitest'
import {
  CRM_GRAPHITE, CRM_TOKENS, crmStep, crmSugarPalette,
  sugarThemeTokens, DEFAULT_DARK_TONE, type DarkTone,
} from '@/components/crm-sugar/tokens'
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

const graphite = crmSugarPalette(CRM_TOKENS.graphite, true, 'graphite')

describe('échelle Graphite', () => {
  it('monte strictement de s0 à s4', () => {
    const steps = [CRM_GRAPHITE.s0, CRM_GRAPHITE.s1, CRM_GRAPHITE.s2, CRM_GRAPHITE.s3, CRM_GRAPHITE.s4]
    const lums = steps.map(luminance)
    expect(lums).toEqual([...lums].sort((a, b) => a - b))
    expect(new Set(steps).size).toBe(5)
  })

  it('tient les surfaces de la palette dans la plage s0→s4', () => {
    const surfaces = [
      graphite.pageBg, graphite.frameBg, graphite.cardBg, graphite.cardSubBg,
      graphite.solidBg, graphite.solidBgSub, graphite.solidBgSub2,
      graphite.tableHeadBg, graphite.iconBtnBg, graphite.iconRailBg, graphite.kbdBg,
    ]
    for (const s of surfaces) {
      expect(Object.values(CRM_GRAPHITE) as string[]).toContain(s)
    }
  })

  it('creuse les sous-surfaces de modale au lieu de les élever', () => {
    expect(graphite.solidBg).toBe(CRM_GRAPHITE.s4)
    expect(luminance(graphite.solidBgSub)).toBeLessThan(luminance(graphite.solidBg))
    expect(luminance(graphite.solidBgSub2)).toBeLessThan(luminance(graphite.solidBgSub))
  })

  it('ne garde le blanc translucide que sur les filets, jamais en remplissage', () => {
    // La règle porte sur les REMPLISSAGES : un rgba blanc posé en fond sur
    // #12161C fabrique une surface hors échelle. Les bordures restent des
    // traits — le handoff en ship trois, à .05 / .06 / .08.
    const filets = [graphite.frameBorder, graphite.cardBorder, graphite.solidBorder]
    for (const f of filets) {
      const alpha = Number(/rgba\(255,255,255,([\d.]+)\)/.exec(f)?.[1])
      expect(alpha).toBeLessThanOrEqual(0.08)
    }
    // Aucun slot de FOND ne doit être translucide.
    const fonds = [
      graphite.pageBg, graphite.frameBg, graphite.cardBg, graphite.cardSubBg,
      graphite.solidBg, graphite.solidBgSub, graphite.solidBgSub2,
      graphite.tableHeadBg, graphite.iconBtnBg, graphite.iconRailBg, graphite.kbdBg,
    ]
    for (const f of fonds) expect(f).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('remonte `muted` au-dessus de AA sur le canvas', () => {
    // #797D90 (teintes historiques) tombait à 4,45:1 sur #12161C.
    expect(contrast(CRM_TOKENS.graphite.muted, CRM_GRAPHITE.s0)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(CRM_TOKENS.graphite.muted, CRM_GRAPHITE.s4)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('crmStep', () => {
  it('rend le palier en graphite et le littéral historique sinon', () => {
    // Signature `crmStep(sp, step, fallback)` — lit la palette passée, donc
    // testable sans toucher au localStorage.
    expect(crmStep(graphite, 's3', 'rgba(255,255,255,.08)')).toBe(CRM_GRAPHITE.s3)
    const noir = crmSugarPalette(CRM_TOKENS.noir, true, 'noir')
    expect(crmStep(noir, 's3', 'rgba(255,255,255,.08)')).toBe('rgba(255,255,255,.08)')
  })

  it('ne repose que sur `ramp` pour reconnaître la teinte', () => {
    expect(graphite.ramp).toBe(CRM_GRAPHITE)
    expect(crmSugarPalette(CRM_TOKENS.noir, true, 'noir').ramp).toBeUndefined()
    expect(crmSugarPalette(CRM_TOKENS.light, false, 'graphite').ramp).toBeUndefined()
  })
})

describe('palettes d’écran dérivées', () => {
  // Le piège du handoff : une palette montée UNE fois fige la valeur au
  // chargement du module. Ces palettes doivent rester vivantes — on bascule la
  // teinte à chaud et on vérifie qu'elles suivent, dans les deux sens.
  const cases: { name: string; read: () => string; graphite: string; noir: string }[] = [
    // `SugarV2` résout clair/sombre sur `data-theme` — absent ici, d'où le forçage.
    { name: 'wizard SugarV2.card', read: () => { setSugarV2Dark(true); return SugarV2.card }, graphite: CRM_GRAPHITE.s2, noir: '#15151F' },
    { name: 'wizard SugarV2.rail', read: () => { setSugarV2Dark(true); return SugarV2.rail }, graphite: CRM_GRAPHITE.s1, noir: '#15151F' },
    { name: 'cockpit TK.frame', read: () => { applyTK(true); return TK.frame }, graphite: CRM_GRAPHITE.s1, noir: '#15161A' },
    { name: 'cockpit TK.cardHi', read: () => { applyTK(true); return TK.cardHi }, graphite: CRM_GRAPHITE.s3, noir: 'rgba(255,255,255,0.06)' },
    { name: 'réglages SET.card', read: () => { applySetTheme(true); return SET_PALETTE.card }, graphite: CRM_GRAPHITE.s2, noir: '#16171F' },
    { name: 'calendrier popBg', read: () => buildCalPalette(true, { bg: '#000' }).popBg, graphite: CRM_GRAPHITE.s4, noir: '#1E1F21' },
    { name: 'fiche bien VxSP.cardSub', read: () => VxSP_DARK.cardSub, graphite: CRM_GRAPHITE.s3, noir: 'rgba(255,255,255,0.045)' },
    { name: 'mobile MT.pageBg', read: () => MT_DARK.pageBg, graphite: CRM_GRAPHITE.s0, noir: '#030303' },
    { name: 'mobile MT.card', read: () => MT_DARK.card, graphite: CRM_GRAPHITE.s2, noir: '#17181A' },
    { name: 'mobile MT.tabBarBg', read: () => MT_DARK.tabBarBg, graphite: CRM_GRAPHITE.s4, noir: '#17181A' },
    // Voile de chrome : la teinte du cadre (S1 = #161A21) à l'alpha demandé.
    { name: 'mobile MT.headerBg', read: () => MT_DARK.headerBg, graphite: 'rgba(22,26,33,0.82)', noir: 'rgba(15,15,16,0.82)' },
  ]

  function withTone<T>(tone: DarkTone, fn: () => T): T {
    const w = window as Window & { __meggaDarkTone?: DarkTone }
    const previous = w.__meggaDarkTone
    w.__meggaDarkTone = tone
    try { return fn() } finally { w.__meggaDarkTone = previous }
  }

  it.each(cases)('$name suit la teinte active', ({ read, graphite, noir }) => {
    // Ordre volontaire : noir D'ABORD, pour qu'un getter figé au chargement
    // (donc figé sur graphite, la teinte par défaut) échoue au lieu de passer.
    expect(withTone('noir', read)).toBe(noir)
    expect(withTone('graphite', read)).toBe(graphite)
    expect(withTone('noir', read)).toBe(noir)
  })

  it('garde le wizard en clair intact quelle que soit la teinte', () => {
    setSugarV2Dark(false)
    const light = withTone('graphite', () => SugarV2.card)
    expect(light).toBe('#FFFFFF')
    setSugarV2Dark(null)
  })
})

describe('teintes offertes et repli', () => {
  it('prend Graphite par défaut', () => {
    expect(DEFAULT_DARK_TONE).toBe('graphite')
  })

  it('résout encore les teintes retirées de l’offre', () => {
    // Un réglage stocké avant le handoff ne doit pas produire d'écran blanc.
    for (const tone of ['marine', 'meggaAi'] as DarkTone[]) {
      expect(sugarThemeTokens(true, tone)).toBe(CRM_TOKENS.graphite)
      expect(crmSugarPalette(sugarThemeTokens(true, tone), true, tone).pageBg).toBeTruthy()
    }
  })

  it('laisse le thème clair intact', () => {
    const light = crmSugarPalette(CRM_TOKENS.light, false, 'graphite')
    expect(light.pageBg).toBe('#EEF1F5')
    expect(light.solidBg).toBe('#FFFFFF')
    expect(sugarThemeTokens(false, 'graphite')).toBe(CRM_TOKENS.light)
  })
})
