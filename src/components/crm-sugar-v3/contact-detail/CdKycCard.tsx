// MEGGA CRM Sugar v3 — Card KYC sidebar fiche contact
// Port 1:1 de crm-screen-contact-detail-sugar.jsx lignes 500-549 (CdKycCard).

import { useTranslation } from 'react-i18next'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycGhostPill, KycSection } from '../primitives'
import { KYC_STATUS_LABELS, KYC_RISK_LABELS } from '../tokens'
import type { KycDossierSummary } from '@/types/kyc'

interface Props {
  dossier: KycDossierSummary | null
  onOpenKyc: () => void
}

export function CdKycCard({ dossier, onOpenKyc }: Props) {
  const { t } = useTranslation('contacts')
  const status = dossier?.dossier_status ?? 'none'
  const meta = KYC_STATUS_LABELS[status]
  const verified = status === 'verified'

  const pct =
    dossier && dossier.checks_total > 0
      ? Math.round((dossier.checks_completed / dossier.checks_total) * 100)
      : 0

  return (
    <KycSection
      title={t('cd.kycTitle')}
      eyebrow={t('cd.kycEyebrow')}
      action={
        <KycGhostPill
          onClick={onOpenKyc}
          size="sm"
          icon={<SgIcon name="arrowR" size={13} stroke={SugarV3.inkSoft} />}
        >
          {t('cd.kycOpen')}
        </KycGhostPill>
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px',
          borderRadius: 16,
          background: verified ? SugarV3.okSoft : SugarV3.cardSubtle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: verified ? SugarV3.ok : SugarV3.card,
              color: verified ? '#fff' : SugarV3.ink,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <SgIcon
              name={verified ? 'check' : 'shield'}
              size={20}
              stroke={verified ? '#fff' : SugarV3.ink}
              sw={verified ? 2.2 : 1.6}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SugarV3.ink,
                letterSpacing: -0.2,
                marginBottom: 3,
              }}
            >
              {meta.label}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: SugarV3.muted,
                fontWeight: 500,
              }}
            >
              {verified
                ? (dossier && KYC_RISK_LABELS[dossier.risk_level]?.label) ?? '—'
                : pct > 0
                  ? t('cd.kycPercentComplete', { pct })
                  : t('cd.kycNoDocuments')}
            </div>
          </div>
        </div>
        {!verified && (
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: SugarV3.errSoft,
              color: SugarV3.errDarker,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.2,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <SgIcon name="lock" size={10} stroke={SugarV3.errDarker} sw={2} />
            {t('cd.kycToComplete')}
          </div>
        )}
      </div>
    </KycSection>
  )
}
