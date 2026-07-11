// MEGGA CRM Sugar v2 — KYC Mode non-bloquant (Tier 4 — VariationE)
// 1:1 port from `megga-kyc-variations.jsx` VariationENonBlocking (lines 817-950).
// 3 composants : Banner doux fiche contact + Badge persistant carte deal + Tableau de dette.

import { useTranslation } from 'react-i18next'
import {
  KycIcon, SP, type KycTone,
} from './atoms'

// ─── Banner non-bloquant fiche contact ───────────────────────────────────
export interface KycSoftBannerProps {
  title: string
  desc: string
  onComplete?: () => void
  onDismiss?: () => void
}

// ─── Badge persistant carte deal pipeline ────────────────────────────────
export interface KycDealBadgeProps {
  done: number
  total: number
  /** title on hover */
  hint?: string
}

export function KycDealBadge({ done, total, hint }: KycDealBadgeProps) {
  const { t } = useTranslation('kyc')
  return (
    <span
      title={hint || t('nonBlocking.dealBadgeHint', { count: total - done })}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: SP.warnSoft,
        fontSize: 10.5,
        fontWeight: 700,
        color: SP.warn,
      }}
    >
      <KycIcon name="shield" size={10} stroke={SP.warn} sw={2.4} />
      KYC {done}/{total}
    </span>
  )
}

// ─── Action item (utility) ────────────────────────────────────────────────
// ─── Carte deal pipeline (avec badge) ────────────────────────────────────
export interface KycDealCardData {
  stage: string
  stageTone: KycTone
  name: string
  amount: string
  scoreText?: string
  due?: string
  dueLabel?: string
  kycDone: number
  kycTotal: number
}


// ─── Tableau de dette KYC (vue responsable) ──────────────────────────────
export interface KycDebtRow {
  name: string
  info: string
  days: number
  tone: KycTone
}

