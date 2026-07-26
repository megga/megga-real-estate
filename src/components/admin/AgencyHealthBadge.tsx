/**
 * Pastille de santé d'agence — pilule Sugar teintée par `level`.
 *
 * Avant l'alignement : un point vert / ambre / rouge peint par une classe de fond
 * Tailwind, suivi d'un chiffre gris. La console ne signale plus un niveau par une
 * classe de couleur : le score vit dans une pilule à fond plein (ok / warn / err),
 * en chiffres tabulaires pour que la colonne ne tremble pas au rafraîchissement.
 */
import { AdminPill } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

interface AgencyHealthBadgeProps {
  score: number
  level: 'healthy' | 'warning' | 'critical'
  showScore?: boolean
}

const LEVEL_TONE: Record<AgencyHealthBadgeProps['level'], AdminToneName> = {
  healthy: 'ok',
  warning: 'warn',
  critical: 'err',
}

/** Santé d'une agence ; `showScore=false` garde le seul signal, sans le chiffre. */
export default function AgencyHealthBadge({ score, level, showScore = true }: AgencyHealthBadgeProps) {
  const { tones } = useAdminSugar()

  if (!showScore) {
    const dot = level === 'healthy' ? tones.ok : level === 'warning' ? tones.warn : tones.err
    return <span style={{ width: 8, height: 8, borderRadius: ADMIN_RADII.pill, background: dot, flexShrink: 0 }} />
  }

  return (
    <AdminPill
      label={String(score)}
      tone={LEVEL_TONE[level]}
      style={{ padding: '4px 11px', fontVariantNumeric: 'tabular-nums' }}
    />
  )
}
