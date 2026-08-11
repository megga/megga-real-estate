// MEGGA CRM — Fiche bien « Vitrine » — jetons de palette et formatters.
//
// Séparés de vitrineKit.tsx : ce dernier n'exporte plus que des composants.
// Un fichier mixte composants + constantes casse le Fast Refresh de Vite —
// toute édition recharge la page au lieu de préserver l'état (galerie ouverte,
// lightbox, scroll de la fiche).
import { MXC_COLOR, mxCrmPalette } from '@/components/megga-x-crm/tokens'
import { sgMix } from '@/components/crm-sugar/tokens'

// ─── Palettes (light/dark) ───────────────────────────────────────────────
//
// Les DEUX thèmes descendent de `mxCrmPalette()` depuis le 11 août 2026. Avant,
// même asymétrie que le wizard : le SOMBRE dérivait ses surfaces de `MXC_COLOR`
// mais gardait quatre encres bleutées hors échelle, et le CLAIR était resté
// Sugar de bout en bout — accent compris, `black` valant `#0B0C0E` sous la règle
// « l'accent EST l'encre » que la décision du 10 août a remplacée.
//
// ⚠ Ce module ne se voit pas depuis `BienDetailSugarV4Page.tsx` : la page ne
// porte que 2 littéraux, la palette en porte 39. La fiche en est l'unique
// consommateur. Garde-fou : `tests/unit/bien-palette.spec.ts`.

const MX_LIGHT = mxCrmPalette(false)
const MX_DARK = mxCrmPalette(true)

// Survol de l'accent : la vitrine n'en publie aucun barreau (son
// `.primary-button:hover` grandit au lieu de changer de teinte). Dérivé de
// l'accent, comme aux Réglages et au wizard — 0,12 en sombre et non 0,16, tout
// éclaircissement coûtant du contraste à l'encre blanche posée dessus.
const ACCENT_HOVER_LIGHT = sgMix(MXC_COLOR.accent, '#000000', 0.14)
const ACCENT_HOVER_DARK = sgMix(MXC_COLOR.accent, '#FFFFFF', 0.12)
export interface VxPalette {
  bg: string
  bgGradient: string
  card: string
  cardSub: string
  cardSub2: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  hairline: string
  black: string
  blackHover: string
  onAccent: string
  shadowSm: string
  shadow: string
  shadowHov: string
  ok: string
  okBg: string
  warn: string
  warnBg: string
  info: string
  infoBg: string
}

export const VxSP_LIGHT: VxPalette = {
  bg: MX_LIGHT.pageBg,
  bgGradient:
    `radial-gradient(ellipse 120% 80% at 50% 100%, ${MXC_COLOR.n700} 0%, ${MXC_COLOR.n800} 50%, ${MXC_COLOR.n900} 100%)`,
  card: MX_LIGHT.cardBg,
  cardSub: MX_LIGHT.cardSubBg,
  cardSub2: MX_LIGHT.focusSurface,
  ink: MX_LIGHT.ink,
  inkSoft: MX_LIGHT.soft,
  muted: MX_LIGHT.sub,
  // `ghost` = trait et encre FAIBLE. Il doit rester distinct de `muted`, sinon
  // la hiérarchie des gris s'effondre de trois niveaux à deux.
  ghost: MXC_COLOR.n600,
  hairline: 'rgba(3,3,3,0.06)',
  black: MX_LIGHT.accent,
  blackHover: ACCENT_HOVER_LIGHT,
  onAccent: MX_LIGHT.accentInk,
  shadowSm: '0 1px 2px rgba(15,23,42,.05), 0 6px 18px -10px rgba(40,55,90,.18)',
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 14px 38px -16px rgba(40,55,90,.24)',
  shadowHov: '0 2px 6px rgba(15,23,42,.06), 0 28px 56px -20px rgba(40,55,90,.34)',
  ok: '#0B7A53',
  okBg: 'rgba(5,150,105,.12)',
  warn: '#B45309',
  warnBg: 'rgba(196,90,0,.12)',
  info: '#1E5BC6',
  infoBg: 'rgba(30,91,198,.12)',
}

// Surfaces en GETTERS : elles suivent la teinte sombre active (cf. tokens.ts).
// ⚠ `cardSub2` empile au PLAFOND s4 : si un bloc de la fiche paraît trop clair
// face à une modale ouverte par-dessus, le redescendre à s3 (noté au handoff).
export const VxSP_DARK: VxPalette = {
  bg: MX_DARK.pageBg,
  bgGradient: `radial-gradient(ellipse 120% 80% at 50% 100%, ${MXC_COLOR.n400} 0%, ${MXC_COLOR.n200} 55%, ${MXC_COLOR.n100} 100%)`,
  card: MX_DARK.cardBg,
  cardSub: MX_DARK.cardSubBg,
  cardSub2: MX_DARK.focusSurface,
  ink: MX_DARK.ink,
  inkSoft: MX_DARK.soft,
  muted: MX_DARK.sub,
  ghost: MXC_COLOR.n500,
  hairline: 'rgba(255,255,255,0.08)',
  black: MX_DARK.accent,
  blackHover: ACCENT_HOVER_DARK,
  onAccent: MX_DARK.accentInk,
  shadowSm: '0 1px 2px rgba(0,0,0,.4), 0 6px 18px -10px rgba(0,0,0,.55)',
  shadow: '0 1px 2px rgba(0,0,0,.45), 0 16px 40px -18px rgba(0,0,0,.65)',
  shadowHov: '0 2px 6px rgba(0,0,0,.5), 0 30px 60px -20px rgba(0,0,0,.75)',
  ok: '#34D399',
  okBg: 'rgba(52,211,153,.16)',
  warn: '#FBBF66',
  warnBg: 'rgba(251,191,102,.16)',
  info: '#7FA8F5',
  infoBg: 'rgba(127,168,245,.16)',
}

export const vxPalette = (dark: boolean): VxPalette => (dark ? VxSP_DARK : VxSP_LIGHT)

// ─── Formatters CHF (apostrophes suisses) ─────────────────────────────────
export function vxFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return (
    'CHF ' +
    Math.round(n).toLocaleString('fr-CH').replace(/ /g, "'").replace(/[\s,]/g, "'")
  )
}
export function vxFmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-CH').replace(/ /g, "'").replace(/[\s,]/g, "'")
}
export function vxCompact(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return '' + n
}
