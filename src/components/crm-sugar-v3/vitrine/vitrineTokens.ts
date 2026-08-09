// MEGGA CRM — Fiche bien « Vitrine » — jetons de palette et formatters.
//
// Séparés de vitrineKit.tsx : ce dernier n'exporte plus que des composants.
// Un fichier mixte composants + constantes casse le Fast Refresh de Vite —
// toute édition recharge la page au lieu de préserver l'état (galerie ouverte,
// lightbox, scroll de la fiche).
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

// ─── Palettes (light/dark) ───────────────────────────────────────────────
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
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSub: '#F4F6F9',
  cardSub2: '#EBEEF3',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  hairline: 'rgba(15,23,42,0.06)',
  black: '#0B0C0E',
  blackHover: '#22242C',
  onAccent: '#FFFFFF',
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
  bg: MXC_COLOR.n100,
  bgGradient: `radial-gradient(ellipse 120% 80% at 50% 100%, ${MXC_COLOR.n400} 0%, ${MXC_COLOR.n200} 55%, ${MXC_COLOR.n100} 100%)`,
  card: MXC_COLOR.n300,
  cardSub: MXC_COLOR.n200,
  cardSub2: MXC_COLOR.n400,
  ink: '#F4F6F8',
  inkSoft: '#C4C8D2',
  muted: '#878D9A',
  ghost: '#4A4E59',
  hairline: 'rgba(255,255,255,0.08)',
  black: '#F2F3F6',
  blackHover: '#FFFFFF',
  onAccent: '#0B0C0E',
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
