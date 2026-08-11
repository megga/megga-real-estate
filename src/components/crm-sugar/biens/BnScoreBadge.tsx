// MEGGA CRM Sugar v2 — Mes biens · pastille de SCORE DE BIEN (estimation)
// ----------------------------------------------------------------------------
// Surface le score de bien backend (property_scores, cf calculate_property_scores)
// sur les cartes/rangées de la galerie. Pastille TEINTÉE par palier (chaud / à
// animer / en veille) + icône sparkle + chiffre. Affichée comme ESTIMATION
// (jamais « garanti »/« automatique ») ; le tooltip signale « données limitées »
// quand le score repose sur peu de signaux. health null → rien (pas encore calculé).

import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { BienHealth } from '../mockData'
import type { SugarPalette } from '../tokens'

// Couleurs par palier (stables) ; le libellé est traduit via listings:biens.score.*.
const TIER_COLORS: Record<string, string> = {
  chaud: '#2FB389',
  a_animer: '#D98A2B',
  en_veille: '#8A93A6',
}

interface BnScoreBadgeProps {
  health: BienHealth | null | undefined
  sp: SugarPalette
  /** sm = rangée compacte ; md = carte. */
  size?: 'sm' | 'md'
}

export function BnScoreBadge({ health, sp, size = 'md' }: BnScoreBadgeProps) {
  const { t } = useTranslation('listings')
  if (!health) return null
  const text = TIER_COLORS[health.label]
    ? t('biens.score.' + health.label)
    : t('biens.score.fallback')
  const color = TIER_COLORS[health.label] ?? sp.sub
  const limited = health.dataCompleteness != null && health.dataCompleteness <= 0.34
  const title = limited ? t('biens.score.tooltipLimited') : t('biens.score.tooltip')
  const fs = size === 'sm' ? 10.5 : 11
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-xs)',
        padding: size === 'sm' ? '2px 7px' : '3px 8px',
        borderRadius: 'var(--crm-radius-pill)',
        background: color + '1A', // teinte ~10% — pastille discrète, pas un fond plein
        color,
        fontSize: fs,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <MEIcon name="sparkle" size={fs} color={color} />
      {text}
      <span style={{ opacity: 0.7, fontWeight: 600 }}>· {Math.round(health.overall)}</span>
    </span>
  )
}
