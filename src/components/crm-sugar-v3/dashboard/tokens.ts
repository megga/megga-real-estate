// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Tokens dédiés
// Port pixel-près de sprint-4/crm-dashboard-shell.jsx (window.DB_SP).
//
// Palette Sugar Pure complète + pilules premium (vert forêt / bordeaux / etc.)
// utilisées par les deltas, sources, tranches de revenu, etc.

export const DB_SP = {
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  cardWhisper: '#FBFBFC',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  hairline: 'rgba(11,12,14,0.06)',
  hairlineStrong: 'rgba(11,12,14,0.10)',
  shadowSm: '0 4px 16px rgba(15,23,42,0.04)',
  shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
  shadowLg: '0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)',
  ok: '#10B981',
  okSoft: 'rgba(16,185,129,0.10)',
  warn: '#F59E0B',
  warnSoft: 'rgba(245,158,11,0.10)',
  err: '#EF4444',
  errSoft: 'rgba(239,68,68,0.10)',
  // Pilules premium solides (cf. crm-tokens.jsx → CRM_PILL)
  pill: {
    ok: {
      bg: '#15643F',
      fg: '#FFFFFF',
      shadow:
        '0 1px 2px rgba(21,100,63,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
      dot: '#7CD8A6',
    },
    warn: {
      bg: '#A0521E',
      fg: '#FFFFFF',
      shadow:
        '0 1px 2px rgba(160,82,30,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
      dot: '#F5C58A',
    },
    danger: {
      bg: '#8E1F3D',
      fg: '#FFFFFF',
      shadow:
        '0 1px 2px rgba(142,31,61,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
      dot: '#F0A1B5',
    },
    info: {
      bg: '#1B4A8E',
      fg: '#FFFFFF',
      shadow:
        '0 1px 2px rgba(27,74,142,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
      dot: '#A3C1EE',
    },
    neutral: {
      bg: '#202127',
      fg: '#FFFFFF',
      shadow:
        '0 1px 2px rgba(32,33,39,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
      dot: '#9CA0AC',
    },
  },
  // Stage colors (rappel CLAUDE.md)
  mandate: '#1E5BC6',
  prep: '#0891B2',
  visite: '#0891B2',
  offre: '#C45A00',
  compromis: '#059669',
  acte: '#0B0C0E',
} as const

export type DbSp = typeof DB_SP

// ─── Keyframes (à injecter dans le DOM) ───────────────────────────────
export const DB_KEYFRAMES = `
@keyframes sgFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sgGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes dbRefreshPulse {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 0.32; }
}
@keyframes dbToastIn {
  0%   { opacity: 0; transform: translateY(8px) scale(.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes rlnFade  { from { opacity: 0; } to { opacity: 1; } }
@keyframes rlnUp    { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rlnSlide { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes rlnPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
`

// ─── Formatters ────────────────────────────────────────────────────────

/** Formate en CHF avec apostrophes suisses : `CHF 142'500`. */
export function dbFmtCHF(n: number): string {
  return (
    'CHF ' +
    Math.round(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, "'")
  )
}

/** Formate en k/M pour les axes graphiques : `750 k`, `1.25 M`. */
export function dbFmtK(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n >= 1000000) {
    const m = n / 1000000
    return (
      (Number.isInteger(m) ? m.toFixed(1) : m.toFixed(2))
        .replace(/\.0+$/, '')
        .replace(/(\.\d)0$/, '$1') + ' M'
    )
  }
  return Math.round(n / 1000) + ' k'
}

/** Formate un objectif : `CHF 1.2 M` ou `CHF 175 k`. */
export function dbFmtTarget(n: number): string {
  if (n >= 1000000) {
    const m = n / 1000000
    const str = (Number.isInteger(m) ? m.toFixed(1) : m.toFixed(2))
      .replace(/\.0+$/, '')
      .replace(/(\.\d)0$/, '$1')
    return `CHF ${str} M`
  }
  return `CHF ${Math.round(n / 1000)} k`
}

/** Format raw number avec apostrophes (sans CHF). */
export function dbFmtN(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}
