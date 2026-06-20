// MEGGA CRM Sugar v2 — Biens helpers
// 1:1 port from the Claude Design bundle (`crm-screen-biens-sugar.jsx`).
//
// i18n : ces helpers produisent du texte d'affichage. Comme ils ne sont PAS
// unit-testés et sont appelés DANS le rendu de composants qui passent par
// useTranslation (donc re-rendus au changement de langue), on lit la langue via
// l'instance i18n singleton (cf docs/i18n-conventions.md §5 / §6) — pas de
// changement de signature, donc pas de modif des sites d'appel. (Les modules
// purs unit-testés, eux, reçoivent `t` en injection : cf focusScore.)
import i18n from '@/i18n'

// CHF : format suisse (apostrophe) quelle que soit la langue — inchangé.
export function bnFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e6) return 'CHF ' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M'
  return 'CHF ' + n.toLocaleString('fr-CH').replace(/,/g, "'")
}

function dateLocale(): string {
  const l = i18n.language || 'fr'
  if (l.startsWith('en')) return 'en-CH'
  if (l.startsWith('de')) return 'de-CH'
  if (l.startsWith('it')) return 'it-CH'
  return 'fr-CH'
}

export function bnFmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString(dateLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function bnRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const h = ms / 3600000
  if (h < 1) return i18n.t('listings:relativeTime.min', { n: Math.max(1, Math.round(ms / 60000)) })
  if (h < 24) return i18n.t('listings:relativeTime.h', { n: Math.round(h) })
  const j = Math.round(h / 24)
  if (j < 30) return i18n.t('listings:relativeTime.j', { n: j })
  return i18n.t('listings:relativeTime.mois', { n: Math.round(j / 30) })
}

export interface BnStatusMeta {
  label: string
  color: string
  bg: string
}

// Couleurs du statut (stables) ; le libellé est traduit via listings:status.*.
const BN_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  active: { color: '#0E9F6E', bg: '#0E9F6E1A' },
  reserved: { color: '#8B5CF6', bg: '#8B5CF61F' },
  draft: { color: '#7A8079', bg: '#7A80791F' },
  paused: { color: '#F59E0B', bg: '#F59E0B1F' },
  sold: { color: '#0E1410', bg: '#0E14101A' },
}

export function bnStatus(s: string): BnStatusMeta {
  const style = BN_STATUS_STYLE[s] || { color: '#7A8079', bg: '#7A80791F' }
  return { label: i18n.t('listings:status.' + s, { defaultValue: s }), color: style.color, bg: style.bg }
}
