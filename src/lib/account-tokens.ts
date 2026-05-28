// Design tokens for the /account (Account) page tree.
// Imported by all components under src/components/account/.
// Mirrors the MEGGA Compte design bundle (window.MEGGA_M + window.MEGGA_fontStack).

export const ACCOUNT_TOKENS = {
  ink: '#0E1410',
  page: '#FAFBFD',
  card: '#FFFFFF',
  section: '#F6F8F4',
  border: '#DDE2EA',
  borderSubtle: '#E8EBF0',
  muted: '#7A8079',
  soft: '#3F4640',
  accent: '#0041D9',
  accentSoft: '#E8EFFE',
  accentDark: '#002DA8',
  green: '#0F7A3A',
  greenSoft: '#E7F5EC',
  warning: '#A85020',
  warningSoft: '#FBE9E0',
  danger: '#E53935',
  dangerSoft: '#FBECE8',
  dangerDark: '#B23A2A',
  fontStack: "'Manrope', system-ui, -apple-system, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, monospace",
} as const

export type AccountTokens = typeof ACCOUNT_TOKENS
