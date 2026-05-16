// MEGGA CRM Sugar v3 — Hero du dossier (vue détail)
// Port 1:1 de crm-screen-kyc-sugar.jsx lignes 369-426.

import { SugarV3, fmtDateLong } from '../tokens'
import { KycAvatar, KycRing, KycStatusPill, KycRiskPill } from '../primitives'
import { SgIcon } from '../icons'
import type { KycCase } from '@/types/kyc'

interface Props {
  dossier: KycCase
  contact: { first_name: string; last_name: string } | null
  pct: number
  onBack: () => void
}

export function KycDossierHero({ dossier, contact, pct, onBack }: Props) {
  if (!contact) return null
  return (
    <div
      style={{
        background: SugarV3.card,
        borderRadius: 28,
        padding: '36px 40px',
        boxShadow: SugarV3.shadowLg,
        marginBottom: 24,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <button
        onClick={onBack}
        style={{
          border: 0,
          background: 'transparent',
          color: SugarV3.muted,
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 24,
          padding: 0,
          letterSpacing: 0.2,
        }}
      >
        <SgIcon name="arrowL" size={14} stroke={SugarV3.muted} />
        Retour aux dossiers
      </button>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 32,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <KycAvatar
            firstName={contact.first_name}
            lastName={contact.last_name}
            size={88}
          />

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: SugarV3.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Dossier KYC · LBA
            </div>
            <h1
              style={{
                margin: '0 0 10px',
                fontSize: 34,
                fontWeight: 700,
                color: SugarV3.ink,
                letterSpacing: -0.6,
                lineHeight: 1.1,
              }}
            >
              {contact.first_name} {contact.last_name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KycStatusPill status={dossier.dossier_status} />
              <KycRiskPill risk={dossier.risk_level} />
              {dossier.expires_at && (
                <span
                  style={{
                    fontSize: 12,
                    color: SugarV3.muted,
                    fontWeight: 500,
                    marginLeft: 6,
                  }}
                >
                  Échéance : {fmtDateLong(dossier.expires_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <KycRing pct={pct} size={88} stroke={4} />
        </div>
      </div>
    </div>
  )
}
