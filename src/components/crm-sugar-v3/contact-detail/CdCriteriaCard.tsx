// MEGGA CRM Sugar v3 — Card Critères de recherche (sidebar buyer)
// Port pixel-près de crm-screen-contact-detail-sugar.jsx lignes 308-375 (CdCriteriaCard).

import { useTranslation } from 'react-i18next'
import { SugarV3, fmtCHF } from '../tokens'
import { SgIcon } from '../icons'
import { KycGhostPill, KycSection, KycNeutralPill } from '../primitives'
import type { SearchCriteria } from '@/types/contact'

interface Props {
  criteria: SearchCriteria | null
}

interface CriteriaItem {
  label: string
  value: string
  icon: string
}

export function CdCriteriaCard({ criteria }: Props) {
  const { t } = useTranslation('contacts')
  if (!criteria) return null

  const items: CriteriaItem[] = [
    {
      label: t('cd.criteriaType'),
      value: criteria.type ?? '—',
      icon: 'home',
    },
    {
      label: t('cd.criteriaZones'),
      value: criteria.zones?.join(', ') ?? '—',
      icon: 'map',
    },
    {
      label: t('cd.criteriaBudget'),
      value:
        criteria.budget_min || criteria.budget_max
          ? `${fmtCHF(criteria.budget_min ?? 0) || '—'} – ${fmtCHF(criteria.budget_max ?? 0) || '—'}`
          : '—',
      icon: 'coins',
    },
    {
      label: t('cd.criteriaSurface'),
      value: criteria.surface_min ? t('cd.criteriaFrom', { value: `${criteria.surface_min} m²` }) : '—',
      icon: 'home',
    },
    {
      label: t('cd.criteriaRooms'),
      value: criteria.rooms_min ? t('cd.criteriaFrom', { value: criteria.rooms_min }) : '—',
      icon: 'bed',
    },
  ]

  return (
    <KycSection
      title={t('cd.criteriaTitle')}
      eyebrow={t('cd.criteriaEyebrow')}
      action={
        <KycGhostPill
          size="sm"
          icon={<SgIcon name="pencil" size={13} stroke={SugarV3.inkSoft} />}
        >
          {t('cd.edit')}
        </KycGhostPill>
      }
    >
      <div className="sg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              background: SugarV3.cardSubtle,
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: SugarV3.card,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <SgIcon name={it.icon} size={14} stroke={SugarV3.inkSoft} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: SugarV3.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 3,
                }}
              >
                {it.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.1,
                }}
              >
                {it.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(criteria.features || []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: SugarV3.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {t('cd.criteriaMustHave')}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(criteria.features ?? []).map((m) => (
              <KycNeutralPill key={m} label={m} tone={SugarV3.black} />
            ))}
          </div>
        </div>
      )}
    </KycSection>
  )
}
