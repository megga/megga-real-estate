/**
 * Garde-fou : la palette du wizard « Créer un bien » descend de MEGGA X, dans
 * LES DEUX thèmes.
 *
 * Pourquoi ce test existe. Au 11 août 2026, `crm-sugar-wizard/tokens.ts` était
 * le dernier fichier de jetons AUTONOME du CRM : pas une dérivation de
 * `mxCrmPalette()`, une palette écrite à la main. En clair il rendait le gris
 * bleuté de Sugar (`#EDEFF3` de canvas, `#0B0C0E` d'encre) et surtout un accent
 * NOIR — `#424bfb` n'apparaissait pas une seule fois dans les 4 832 lignes du
 * wizard. Il était resté sur la règle Sugar Pure « l'accent EST l'encre », que
 * la décision du 10 août 2026 a remplacée par « l'élément actif porte l'accent
 * #424bfb » (cf. `CLAUDE.md` §3).
 *
 * Même asymétrie que `buildCalPalette()` : la branche SOMBRE dérivait déjà de
 * `MXC_COLOR`… pour ses SURFACES seulement. Ses quatre encres (`ink` `#ECEDF3`,
 * `inkSoft` `#B7B9C6`, `muted` `#7C8094`, `ghost` `#3A3B4A`) étaient bleutées
 * hors échelle, dans la branche qu'on croyait propre — c'est exactement le
 * `ghost '#52535A'` que le garde-fou du calendrier avait trouvé, et que l'audit
 * manuel avait manqué. Mesuré avant correctif : 19 hex hors échelle en clair,
 * 13 en sombre.
 *
 * Ce que le test NE fait pas : interdire toute couleur hors échelle. Un wizard
 * a besoin de dire l'erreur et le succès, et la vitrine ne propose rien qui
 * tienne en encre sur fond clair. Ces jetons sont EXEMPTÉS nommément
 * (`SEMANTIQUES`) : figer l'écart plutôt que l'interdire, même idiome que
 * `calendar-palette.spec.ts` et `megga-x-crm-tokens.spec.ts`. En ajouter un
 * demande de l'écrire ici, donc d'en décider.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { MXC_COLOR, MXC_SYSTEM, mxCrmPalette } from '@/components/megga-x-crm/tokens'
import { SugarV2, setSugarV2Dark, sgOn, sgAcc } from '@/components/crm-sugar-wizard/tokens'

const SRC = 'src/components/crm-sugar-wizard/tokens.ts'

/** Les barreaux que la vitrine publie — la seule source de couleur autorisée. */
const ECHELLE = new Set(
  [...Object.values(MXC_COLOR), ...Object.values(MXC_SYSTEM)].map((v) => v.toLowerCase()),
)

/**
 * Jetons qui portent un SENS que la vitrine ne sait pas dire, et qui gardent
 * donc leur propre valeur. Chacun est là pour une raison mesurée :
 *
 * - `ok` / `warn` / `err` : employés en ENCRE (couleur de texte, `stroke` de
 *   svg) sur des surfaces claires — 16 sites. Les teintes de `MXC_SYSTEM` sont
 *   réglées pour le canvas `#030303` de la vitrine et tombent à 1,7:1 sous une
 *   encre claire ; en encre sur blanc elles ne tiennent pas davantage. Il n'y a
 *   rien à leur emprunter ici (cf. la JSDoc de `MXC_SYSTEM`).
 * - `pop1`…`pop4` : teintes d'avatar. `pop1` est écrit dans la DONNÉE du contact
 *   (`avatarBg`, Step1Vendor) — il ENCODE une identité, il ne décore pas. Même
 *   famille que `SG_STAGE_HUE` et `TYPE_COLOR`, arbitrés pareil.
 * - `line` : un VOILE (rgba), pas une couleur. Il se pose sur la surface au lieu
 *   de la remplacer, ce qu'aucun barreau opaque ne sait faire.
 * - `shadow*` / `pillShadow*` / `ringSoft` : des ombres, pas des couleurs.
 *
 * ⚠ `bgGradient` n'est PAS exempté, à la différence du calendrier — là-bas il
 * était mort et a été supprimé, ici il est LU (`WizardShell.tsx:349`, branche
 * claire). Il doit donc descendre de l'échelle comme n'importe quelle surface.
 */
const SEMANTIQUES = new Set([
  'ok', 'warn', 'err',
  'pop1', 'pop2', 'pop3', 'pop4',
  'line',
  'shadowSm', 'shadow', 'shadowLg', 'shadowHover',
  'pillShadow', 'pillShadowHover', 'ringSoft',
])

/** Les hex d'une valeur de jeton — une valeur peut en contenir plusieurs. */
function hexOf(value: string): string[] {
  return (value.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toLowerCase())
}

/**
 * Accepte `#rrggbb` ET `rgb(r, g, b)` : `blackHover` est dérivé par `sgMix`, qui
 * rend du `rgb()`. Un parseur qui n'en lirait qu'une forme rendrait `NaN` — et
 * un `NaN` comparé à un seuil est TOUJOURS faux, donc le test passerait au vert
 * sans rien vérifier. Cf. `megga/shademix-nan-invisible`.
 */
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

/**
 * `SugarV2` est un Proxy qui résout le thème actif à chaque lecture ; on le fige
 * en objet nu pour l'inspecter. `setSugarV2Dark` est l'API que le shell emploie
 * déjà — le test n'ouvre donc aucune porte dérobée dans le module.
 */
function palette(dark: boolean): Record<string, unknown> {
  setSugarV2Dark(dark)
  return { ...SugarV2 }
}

afterEach(() => setSugarV2Dark(null))

describe('Wizard « Créer un bien » — la palette descend de MEGGA X', () => {
  // Sans cette garde, une palette vidée rendrait tout le reste vrai par vacuité.
  it('les deux thèmes rendent une palette fournie', () => {
    for (const dark of [false, true]) {
      const p = palette(dark)
      expect(Object.keys(p).length).toBeGreaterThan(20)
      expect(p.isDark).toBe(dark)
    }
  })

  it.each([false, true])('aucune couleur hors échelle (sombre=%s)', (dark) => {
    const p = palette(dark)
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
    const p = palette(dark)
    expect(p.bg).toBe(mx.pageBg)
    expect(p.card).toBe(mx.cardBg)
    expect(p.cardSubtle).toBe(mx.cardSubBg)
    expect(p.rail).toBe(mx.frameBg)
    expect(p.railHover).toBe(mx.focusSurface)
    expect(p.ink).toBe(mx.ink)
    expect(p.inkSoft).toBe(mx.soft)
    expect(p.muted).toBe(mx.sub)
  })

  /**
   * L'accent de la marque, et rien d'autre. `black` est un nom historique : il
   * portait un noir en clair et un near-white en sombre, parce que Sugar Pure
   * faisait de l'accent l'encre. Il vaut désormais `#424bfb` dans les deux
   * thèmes — même correction que `SET.black` aux Réglages et `p.black` au
   * calendrier.
   */
  it.each([false, true])('l’accent est celui de la marque (sombre=%s)', (dark) => {
    const p = palette(dark)
    expect(p.black).toBe(MXC_COLOR.accent)
    expect(p.onBlack).toBe(MXC_COLOR.n1000)
    // L'aplat tient sous encre blanche (5,78:1) — c'est l'encre qui porte le
    // contraste, pas l'accent, qui échoue lui en TEXTE sur sombre (3,44:1).
    expect(contrast(String(p.onBlack), String(p.black))).toBeGreaterThanOrEqual(4.5)
  })

  /**
   * Le survol de l'accent se distingue de l'accent, sans perdre son encre.
   * La vitrine ne publie pas de barreau « accent survolé » : la valeur reste
   * donc libre, seules ces deux propriétés sont verrouillées.
   */
  it.each([false, true])('le survol de l’accent reste distinct et lisible (sombre=%s)', (dark) => {
    const p = palette(dark)
    expect(p.blackHover).not.toBe(p.black)
    expect(contrast(String(p.onBlack), String(p.blackHover))).toBeGreaterThanOrEqual(4.5)
  })

  /**
   * ⛔ LA QUESTION `sgOn()`, TRANCHÉE : la fonction RESTE, la bascule de thème
   * qu'elle portait DISPARAÎT.
   *
   * `sgOn()` rendait `onBlack`, qui s'inversait avec le thème : Sugar peignait
   * l'accent en noir le jour et en near-white la nuit, donc ce qui était posé
   * DESSUS devait s'inverser aussi. L'accent ne bascule plus — l'encre posée sur
   * `#424bfb` est blanche dans les deux thèmes, mesurée à 5,78:1.
   *
   * Pourquoi on ne remplace pas ses 45 appels par `MXC_COLOR.n1000` :
   * 1. `sgOn()` nomme une RELATION — « l'encre posée sur l'accent » — et c'est
   *    ce que les 45 sites veulent dire. Le fait qu'elle se résolve aujourd'hui
   *    en une seule valeur est une CONSÉQUENCE mesurée de l'invariance de
   *    l'accent, pas une raison d'effacer leur intention. Si l'accent sombre
   *    devait un jour passer à `MXC_SYSTEM.blue300` — le barreau qui tient en
   *    encre sur sombre —, la question de ce qu'on pose dessus redeviendrait
   *    vivante, en un seul point.
   * 2. Elle appelait `document.documentElement.getAttribute('data-theme')` à
   *    chaque lecture. 45 sites × chaque render : la constante retire des
   *    lectures du DOM, elle n'en ajoute pas.
   *
   * Ce test verrouille la décision dans les deux sens : la valeur est celle de
   * l'encre sur l'accent, ET elle ne dépend plus du thème.
   */
  it('sgOn() est l’encre de l’accent, et ne bascule plus avec le thème', () => {
    setSugarV2Dark(false)
    const clair = sgOn()
    setSugarV2Dark(true)
    const sombre = sgOn()
    expect(clair).toBe(MXC_COLOR.n1000)
    expect(sombre, 'sgOn() bascule encore avec le thème').toBe(clair)
  })

  /**
   * `sgAcc(a)` est le VOILE POSÉ SUR L'ACCENT — blanc dans les deux thèmes,
   * pour la même raison que `sgOn()`.
   *
   * ⛔ CE QUE CE TEST PROTÈGE VRAIMENT. Avant correctif, `sgAcc` servait DEUX
   * choses que rien ne distinguait, parce que l'inversion de l'accent les
   * faisait coïncider : en clair « voile sur l'accent noir » et « voile sur le
   * canvas clair » valaient tous deux du blanc ; en sombre, tous deux du sombre.
   * L'accent devenu invariant, la coïncidence tombe.
   *
   * Les deux sites de `Step2Address` (pastille « placez le point » sur la carte,
   * pastille « carte indisponible ») sont des voiles de SURFACE : ils portent
   * `SugarV2.muted` en encre, illisible sur `#424bfb`. Ils doivent suivre le
   * thème. D'où `sgVeil(a)`, et la règle de `CLAUDE.md` : « un élément posé sur
   * une surface teintée reste un VOILE translucide ».
   */
  it('sgAcc() est le voile de l’accent — blanc dans les deux thèmes', () => {
    setSugarV2Dark(false)
    const clair = sgAcc(0.15)
    setSugarV2Dark(true)
    expect(clair).toBe('rgba(255,255,255,0.15)')
    expect(sgAcc(0.15), 'le voile de l’accent bascule encore avec le thème').toBe(clair)
  })

  it('sgVeil() est le voile de SURFACE, et lui suit le thème', async () => {
    const mod = await import('@/components/crm-sugar-wizard/tokens')
    const sgVeil = (mod as Record<string, unknown>).sgVeil
    expect(typeof sgVeil, 'sgVeil manque : les voiles de carte retomberaient sur sgAcc').toBe('function')
    const veil = sgVeil as (a: number) => string
    setSugarV2Dark(false)
    const clair = veil(0.85)
    setSugarV2Dark(true)
    expect(veil(0.85), 'le voile de surface ne suit pas le thème').not.toBe(clair)
  })

  /**
   * ⛔ `ghost` était SURCHARGÉ, et l'un de ses deux rôles était sous l'AA.
   *
   * 13 sites : dix veulent un trait ou une encre FAIBLE (filets 1 px, bordure
   * pointillée, piste de spinner, texte désactivé) ; trois en font le FOND d'un
   * bouton primaire désactivé, sous une encre blanche — `primitives.tsx:91`,
   * `Step7Publish.tsx:354`, `Step1Vendor.tsx:266`. Mesuré avant correctif :
   * blanc sur `#B5BAC2` = 2,0:1, très en dessous de l'AA. Un barreau ne peut pas
   * servir les deux rôles ; `ghostSolid` nomme le second.
   *
   * Même geste que la gouttière d'heures du calendrier : la migration referme un
   * défaut d'accessibilité préexistant au lieu de le recopier sur l'échelle.
   */
  it.each([false, true])('ghostSolid porte l’encre blanche à l’AA (sombre=%s)', async (dark) => {
    const mod = await import('@/components/crm-sugar-wizard/tokens')
    const p = palette(dark)
    expect(typeof p.ghostSolid, 'ghostSolid manque : le CTA désactivé retombe sur ghost').toBe('string')
    expect(contrast(String(p.onBlack), String(p.ghostSolid))).toBeGreaterThanOrEqual(4.5)
    // …et il reste distinct de l'accent, sinon « désactivé » ressemble à « actif ».
    expect(p.ghostSolid).not.toBe(p.black)
    void mod
  })

  /**
   * Le dégradé de fond survit — contrairement à celui du calendrier, qui était
   * déclaré et lu par personne. Celui-ci est lu en clair (`WizardShell.tsx:349`,
   * `dark ? SugarV2.bg : SugarV2.bgGradient`), donc le retirer changerait le
   * rendu. Il doit descendre de l'échelle, pas en sortir.
   */
  it('le dégradé de fond a toujours son lecteur', () => {
    const shell = readFileSync('src/components/crm-sugar-wizard/WizardShell.tsx', 'utf-8')
    expect(shell).toMatch(/SugarV2\.bgGradient/)
  })

  /**
   * Les 14 voiles `onAcc04`…`onAcc80` sont retirés : mesurés à ZÉRO lecteur dans
   * tout `src/`, et ils encodaient précisément la mécanique que ce changement
   * retire (un voile qui s'inverse parce que l'accent s'inverse). Les laisser,
   * c'est laisser un piège prêt à servir.
   */
  it('les voiles inversés onAcc* ne reviennent pas', () => {
    const src = readFileSync(SRC, 'utf-8')
    expect(src).not.toMatch(/onAcc\d/)
  })

  /**
   * L'accent du curseur `.sg-range` est posé en variable CSS par le shell
   * (`--sg-accent`), mais `SG_KEYFRAMES` porte un REPLI en dur qui, lui, ne suit
   * personne — il valait `#0B0C0E`, le noir de Sugar. Un repli hors échelle est
   * une couleur de la direction précédente qui attend une occasion de rendre.
   */
  it('le repli CSS du curseur est sur l’échelle', () => {
    const src = readFileSync(SRC, 'utf-8')
    const replis = [...src.matchAll(/var\(--sg-accent,\s*(#[0-9A-Fa-f]{6})\)/g)].map((m) => m[1].toLowerCase())
    expect(replis.length, 'le repli a disparu : vérifier que --sg-accent est toujours posé').toBeGreaterThan(0)
    for (const r of replis) expect(r, `repli hors échelle : ${r}`).toBe(MXC_COLOR.accent)
  })
})
