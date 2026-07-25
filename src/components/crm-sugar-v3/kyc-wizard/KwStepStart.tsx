// MEGGA CRM Sugar v3 — Wizard Step 1 : Démarrer (3 portes)
// Port 1:1 de crm-kyc-wizard.jsx lignes 200-263 (KwStepStart).

import { useTranslation } from 'react-i18next'
import { useKycPalette } from '../kyc/kycPalette'
import { SgIcon } from '../icons'
import { KwGateCard } from './KwGateCard'
import type { WizardData } from './types'

interface Props {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
}

export function KwStepStart({ data, set }: Props) {
  const { t } = useTranslation('kyc')
  const sp = useKycPalette()
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 48, maxWidth: 720 }}>
        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 38,
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.8,
            lineHeight: 1.1,
          }}
        >
          {t('wizard.start.title')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: sp.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {t('wizard.start.subtitle')}
        </p>
      </div>

      <div
        className="sg-grid-gates"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 1fr 1fr',
          gap: 22,
        }}
      >
        <KwGateCard
          recommended
          selected={data.source === 'existing'}
          icon={
            <SgIcon
              name="user"
              size={26}
              stroke={data.source === 'existing' ? sp.onAccent : sp.black}
            />
          }
          title={t('wizard.start.existing.title')}
          sub={t('wizard.start.existing.sub')}
          onClick={() => set({ source: 'existing' })}
        />
        <KwGateCard
          selected={data.source === 'import'}
          icon={
            <SgIcon
              name="upload"
              size={26}
              stroke={data.source === 'import' ? sp.onAccent : sp.black}
            />
          }
          title={t('wizard.start.import.title')}
          sub={t('wizard.start.import.sub')}
          // Réactivé (refonte KYC) : l'extraction est réelle (EF kyc-report-import,
          // Gemini) et les contrôles pré-remplis restent À VALIDER par l'agent
          // (garde-fou MLRO) — pas d'IA « automatique » vantée sans livraison.
          onClick={() => set({ source: 'import' })}
        />
        <KwGateCard
          selected={data.source === 'magic'}
          icon={
            <SgIcon
              name="send"
              size={26}
              stroke={data.source === 'magic' ? sp.onAccent : sp.black}
            />
          }
          title={t('wizard.start.magic.title')}
          sub={t('wizard.start.magic.sub')}
          onClick={() => set({ source: 'magic' })}
        />
      </div>
    </div>
  )
}
