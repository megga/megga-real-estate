// MEGGA CRM Sugar v3 — Header compact de la fiche dossier (handoff §5)
// Port de crm-screen-kyc-sugar.jsx §KycDetailHeader.
// Remplace l'ancien KycDossierHero (hero géant). Compact : avatar, statut +
// risque, jauge 76px. L'échéance migre dans l'onglet Synthèse > Informations.

import { KycAvatar } from '../primitives'
import { SgIcon } from '../icons'
import { useKycPalette } from './kycPalette'
import { KycStatusPill, KycRiskPill } from './kycPrimitives'
import { KycGauge } from './KycGauge'
import type { KycCase } from '@/types/kyc'

interface Props {
  dossier: KycCase
  contact: { first_name: string; last_name: string } | null
  /** Contrôles complétés / total — alimente la jauge. */
  done: number
  total: number
  onBack: () => void
}

export function KycDetailHeader({ dossier, contact, done, total, onBack }: Props) {
  const sp = useKycPalette()
  if (!contact) return null
  return (
    <div
      style={{
        background: sp.card,
        borderRadius: 24,
        padding: '22px 26px',
        border: `1px solid ${sp.cardBorder}`,
        boxShadow: sp.shadow,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <button
        onClick={onBack}
        style={{
          border: 0,
          background: 'transparent',
          color: sp.muted,
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 18,
          padding: 0,
          letterSpacing: 0.2,
        }}
      >
        <SgIcon name="arrowL" size={14} stroke={sp.muted} />
        Retour aux dossiers
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <KycAvatar
          firstName={contact.first_name}
          lastName={contact.last_name}
          avatarBg={sp.black}
          color={sp.onAccent}
          size={64}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: sp.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Dossier KYC · LBA
          </div>
          <h1
            style={{
              margin: '0 0 9px',
              fontSize: 26,
              fontWeight: 700,
              color: sp.ink,
              letterSpacing: -0.5,
              lineHeight: 1.1,
            }}
          >
            {contact.first_name} {contact.last_name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <KycStatusPill status={dossier.dossier_status} />
            <KycRiskPill risk={dossier.risk_level} />
          </div>
        </div>

        <KycGauge done={done} total={total} risk={dossier.risk_level} size={76} />
      </div>
    </div>
  )
}
