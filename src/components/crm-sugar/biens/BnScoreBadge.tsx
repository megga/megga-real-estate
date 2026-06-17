// MEGGA CRM Sugar v2 — Mes biens · pastille de SCORE DE BIEN (estimation)
// ----------------------------------------------------------------------------
// Surface le score de bien backend (property_scores, cf calculate_property_scores)
// sur les cartes/rangées de la galerie. Pastille TEINTÉE par palier (chaud / à
// animer / en veille) + icône sparkle + chiffre. Affichée comme ESTIMATION
// (jamais « garanti »/« automatique ») ; le tooltip signale « données limitées »
// quand le score repose sur peu de signaux. health null → rien (pas encore calculé).

import MEIcon from '@/components/propertyx/MEIcon'
import type { BienHealth } from '../mockData'
import type { SugarPalette } from '../tokens'

const LABELS: Record<string, { text: string; color: string }> = {
  chaud: { text: 'Chaud', color: '#2FB389' },
  a_animer: { text: 'À animer', color: '#D98A2B' },
  en_veille: { text: 'En veille', color: '#8A93A6' },
}

interface BnScoreBadgeProps {
  health: BienHealth | null | undefined
  sp: SugarPalette
  /** sm = rangée compacte ; md = carte. */
  size?: 'sm' | 'md'
}

export function BnScoreBadge({ health, sp, size = 'md' }: BnScoreBadgeProps) {
  if (!health) return null
  const meta = LABELS[health.label] ?? { text: 'Estimation', color: sp.sub }
  const limited = health.dataCompleteness != null && health.dataCompleteness <= 0.34
  const title = `Score de bien — estimation${limited ? ' · données limitées' : ''}`
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
