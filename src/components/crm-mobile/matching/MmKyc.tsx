/** Chip KYC du matching mobile — rappel de statut de conformité, non-bloquant. */
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import type { AtelierKyc } from '@/components/matching-atelier/types'

/**
 * Chip KYC — rappel doux, NON-bloquant (jamais rouge « bloqué », cf. règle
 * MEGGA : le KYC est compliance-enabling, pas gating). « none » est rendu en
 * muted/shield, pas en alerte. Libellés `matching.atelierKyc.*`.
 */
export default function MmKyc({ kyc }: { kyc: AtelierKyc }) {
  const { tk, isDark } = useMobileTokens()
  const { t } = useTranslation('matching')

  const map: Record<AtelierKyc, { key: string; icon: MEIconName; bg: string; fg: string }> = {
    verified: {
      key: 'atelierKyc.verified',
      icon: 'check',
      bg: isDark ? 'rgba(6,107,69,0.24)' : '#DCF1E6',
      fg: isDark ? '#7BD4A6' : '#066B45',
    },
    pending: {
      key: 'atelierKyc.pending',
      icon: 'clock',
      bg: isDark ? 'rgba(180,87,10,0.20)' : '#FAEAD7',
      fg: isDark ? '#F0B27A' : '#B4570A',
    },
    stale: {
      key: 'atelierKyc.stale',
      icon: 'clock',
      bg: isDark ? 'rgba(180,87,10,0.20)' : '#FAEAD7',
      fg: isDark ? '#F0B27A' : '#B4570A',
    },
    none: { key: 'atelierKyc.none', icon: 'shield', bg: tk.cardSubtle, fg: tk.muted },
  }
  const m = map[kyc] ?? map.none

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-xs)',
        height: 26,
        padding: '0 var(--crm-space-lg)',
        borderRadius: 'var(--crm-radius-pill)',
        background: m.bg,
        color: m.fg,
        fontSize: 'var(--crm-text-sm)',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <MEIcon name={m.icon} size={13} strokeWidth={2.1} color={m.fg} />
      {t(m.key)}
    </span>
  )
}
