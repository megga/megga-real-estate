// MEGGA CRM Sugar v3 — Wizard Step 1 : Démarrer (3 portes)
// Port 1:1 de crm-kyc-wizard.jsx lignes 200-263 (KwStepStart).

import { useTranslation } from 'react-i18next'
import { useKycPalette } from '../kyc/kycPalette'
import { CrmIcon } from '../icons'
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
            fontSize: 'var(--crm-text-9xl)',
            fontWeight: 600,
            color: sp.ink,
            letterSpacing: -0.8,
            lineHeight: 1.1,
          }}
        >
          {t('wizard.start.title')}
        </h1>
        {/* ⚠ LE SOUS-TITRE A ÉTÉ RETIRÉ (16 août 2026), clé comprise, dans les
            quatre langues. Il disait « Trois chemins pour respecter l'obligation
            LBA. Le plus rapide reste de lier le dossier à un contact déjà connu
            de votre CRM. » — 124 caractères pour annoncer ce que les trois
            cartes montrent déjà, et recommander ce que le badge « Recommandé »
            recommande à quatre centimètres de là. Chaque carte dit désormais ce
            qui se passe si on la choisit, et rien d'autre. */}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 1fr 1fr',
          gap: 'var(--crm-space-6xl)',
        }}
      >
        <KwGateCard
          selected={data.source === 'existing'}
          icon={
            <CrmIcon
              name="user"
              size={26}
              stroke={data.source === 'existing' ? sp.onAccent : sp.muted}
            />
          }
          title={t('wizard.start.existing.title')}
          sub={t('wizard.start.existing.sub')}
          onClick={() => set({ source: 'existing' })}
        />
        <KwGateCard
          selected={data.source === 'import'}
          icon={
            <CrmIcon
              name="upload"
              size={26}
              stroke={data.source === 'import' ? sp.onAccent : sp.muted}
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
            <CrmIcon
              name="send"
              size={26}
              stroke={data.source === 'magic' ? sp.onAccent : sp.muted}
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
