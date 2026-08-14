// MEGGA CRM Sugar v3 — Wizard Step 3 : Vigilance
//
// 2 cartes : Standard (LBA art. 3-4) / Renforcée (LBA art. 6).

import { useTranslation } from 'react-i18next'
import { useKycPalette } from '../kyc/kycPalette'
import { SgIcon } from '../icons'
import { KwGateCard } from './KwGateCard'
import type { WizardData } from './types'

interface Props {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
}

export function KwStepVigilance({ data, set }: Props) {
  const { t } = useTranslation('kyc')
  const sp = useKycPalette()

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 36, maxWidth: 720 }}>
        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 'var(--crm-text-9xl)',
            fontWeight: 600,
            color: sp.ink,
            letterSpacing: -0.8,
            lineHeight: 1.1,
          }}
        >
          {t('wizard.vigilance.title')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--crm-text-xl)',
            color: sp.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {t('wizard.vigilance.subtitle')}
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 'var(--crm-text-md)',
            fontWeight: 600,
            color: sp.muted,
                                    marginBottom: 12,
          }}
        >
          {t('wizard.vigilance.entityTypeLabel')}
        </div>
        <div
          role="radiogroup"
          aria-label={t('wizard.vigilance.entityTypeAria')}
          style={{ display: 'inline-flex', gap: 'var(--crm-space-md)', background: sp.cardSubtle, padding: 'var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)' }}
        >
          {([
            { value: 'pp', label: t('wizard.vigilance.entityPp'), icon: 'user' },
            { value: 'pm', label: t('wizard.vigilance.entityPm'), icon: 'building' },
          ] as const).map((opt) => {
            const isSelected = data.entityType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => set({ entityType: opt.value })}
                style={{
                  border: 0,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  padding: 'var(--crm-space-md) var(--crm-space-4xl)',
                  borderRadius: 'var(--crm-radius-pill)',
                  fontSize: 'var(--crm-text-lg)',
                  fontWeight: 600,
                  background: isSelected ? sp.black : 'transparent',
                  color: isSelected ? sp.onAccent : sp.inkSoft,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--crm-space-md)',
                  transition: 'all .2s ease',
                }}
              >
                <SgIcon
                  name={opt.icon}
                  size={14}
                  stroke={isSelected ? sp.onAccent : sp.inkSoft}
                />
                {opt.label}
              </button>
            )
          })}
        </div>
        {data.entityType === 'pm' && (
          <div
            style={{
              marginTop: 10,
              fontSize: 'var(--crm-text-md)',
              color: sp.muted,
              fontWeight: 500,
            }}
          >
            {t('wizard.vigilance.pmHint')}
          </div>
        )}
      </div>

      <div className="sg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-6xl)' }}>
        <KwGateCard
          selected={data.vigilance === 'standard'}
          icon={
            <SgIcon
              name="shield"
              size={26}
              stroke={data.vigilance === 'standard' ? sp.onAccent : sp.black}
            />
          }
          title={t('wizard.vigilance.standard.title')}
          sub={t('wizard.vigilance.standard.sub')}
          onClick={() => set({ vigilance: 'standard', riskLevel: 'low' })}
        />
        <KwGateCard
          selected={data.vigilance === 'renforced'}
          icon={
            <SgIcon
              name="shieldStar"
              size={26}
              stroke={data.vigilance === 'renforced' ? sp.onAccent : sp.black}
            />
          }
          title={t('wizard.vigilance.renforced.title')}
          sub={t('wizard.vigilance.renforced.sub')}
          onClick={() => set({ vigilance: 'renforced', riskLevel: 'medium' })}
        />
      </div>
    </div>
  )
}
