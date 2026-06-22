// MEGGA CRM Sugar — Contacts · pastille de SCORE DE CONTACT (estimation)
// ----------------------------------------------------------------------------
// Surface le score de contact backend (contact_scores, cf calculate_contact_scores)
// sur la liste + la fiche. Pastille TEINTÉE par palier (sérieux / à qualifier /
// froid) + icône sparkle + chiffre. Affichée comme ESTIMATION (jamais
// « garanti »/« automatique ») et DISTINCTE du score déclaratif de l'agent ; le
// tooltip signale « données limitées » quand le score repose sur peu de signaux.
// health null → rien (pas encore calculé). Calque de BnScoreBadge (score de bien).

import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { ContactHealth } from '@/hooks/useContactScores'

const LABEL_COLORS: Record<string, string> = {
  serieux: '#2FB389',
  a_qualifier: '#D98A2B',
  froid: '#8A93A6',
}

interface CtScoreBadgeProps {
  health: ContactHealth | null | undefined
  /** sm = rangée compacte ; md = fiche. */
  size?: 'sm' | 'md'
}

export function CtScoreBadge({ health, size = 'sm' }: CtScoreBadgeProps) {
  const { t } = useTranslation('contacts')
  if (!health) return null
  const color = LABEL_COLORS[health.label] ?? '#8A93A6'
  const text = t(`widgets.scoreBadge.label.${health.label}`, {
    defaultValue: t('widgets.scoreBadge.estimation'),
  })
  const meta = { text, color }
  const limited = health.dataCompleteness != null && health.dataCompleteness <= 0.34
  const title = limited
    ? t('widgets.scoreBadge.titleLimited')
    : t('widgets.scoreBadge.title')
  const fs = size === 'sm' ? 10.5 : 11
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: size === 'sm' ? '2px 7px' : '3px 8px',
        borderRadius: 999,
        background: meta.color + '1A', // teinte ~10% — pastille discrète, pas un fond plein
        color: meta.color,
        fontSize: fs,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <MEIcon name="sparkle" size={fs} color={meta.color} />
      {meta.text}
      <span style={{ opacity: 0.7, fontWeight: 600 }}>· {Math.round(health.overall)}</span>
    </span>
  )
}
