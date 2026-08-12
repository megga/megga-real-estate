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
import { TIER_COLORS } from './scoreTiers'

// Les teintes de palier vivent dans `scoreTiers.ts` — leur y laisser un export
// depuis ce fichier casserait le rafraîchissement à chaud. Le libellé, lui, est
// traduit via `listings:biens.score.*`.

interface BnScoreBadgeProps {
  health: BienHealth | null | undefined
  sp: SugarPalette
  /** sm = rangée compacte ; md = carte. */
  size?: 'sm' | 'md'
}

export function BnScoreBadge({ health, sp, size = 'md' }: BnScoreBadgeProps) {
  const { t } = useTranslation('listings')
  if (!health) return null
  const paliers = TIER_COLORS[sp.isDark ? 'dark' : 'light']
  const text = paliers[health.label]
    ? t('biens.score.' + health.label)
    : t('biens.score.fallback')
  const color = paliers[health.label] ?? sp.sub
  const limited = health.dataCompleteness != null && health.dataCompleteness <= 0.34
  const title = limited ? t('biens.score.tooltipLimited') : t('biens.score.tooltip')
  /**
   * L'échelle de texte du CRM s'arrête à 11 px (`--crm-text-xs`) ; `sm` valait
   * 10,5 — un demi-pas sous le plancher, que le cliquet exemptait au lieu de le
   * corriger. Les deux tailles se rejoignent donc sur le barreau réel, et c'est
   * le RENFONCEMENT qui distingue encore la rangée compacte de la carte.
   *
   * ⚠ `ICONE` reste un nombre : `MEIcon` prend une dimension graphique, pas un
   * barreau de l'échelle typographique. La faire descendre de `--crm-text-xs`
   * demanderait de lire la variable au rendu pour la même valeur.
   */
  const ICONE = 11
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
        fontSize: 'var(--crm-text-xs)',
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <MEIcon name="sparkle" size={ICONE} color={color} />
      {text}
      <span style={{ opacity: 0.7, fontWeight: 600 }}>· {Math.round(health.overall)}</span>
    </span>
  )
}
