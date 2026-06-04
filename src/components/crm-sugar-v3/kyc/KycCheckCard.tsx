// MEGGA CRM Sugar v3 — Carte d'un contrôle LBA (5 cards de la vue détail)
// Port du handoff Claude Design (crm-screen-kyc-sugar.jsx §KycCheckCard) :
//  - thème dynamique clair ↔ sombre (useKycPalette)
//  - pilule de statut opaque (kycPrimitives)
//  - tout ce qui est posé sur l'accent utilise sp.onAccent (lisible en sombre)

import { KYC_CHECK_LABELS, KYC_CHECK_ICONS, fmtDateTime } from '../tokens'
import { SgIcon } from '../icons'
import { useKycPalette } from './kycPalette'
import { KycStatusPill } from './kycPrimitives'
import type { KycCheckCategory, KycChecklistItem, KycDossierStatus } from '@/types/kyc'

interface Props {
  category: KycCheckCategory
  check: KycChecklistItem | null
  onMarkVerified: () => void
  /** Pour afficher le nom de l'acteur sous l'étiquette. */
  actorName?: string
}

export function KycCheckCard({ category, check, onMarkVerified, actorName }: Props) {
  const sp = useKycPalette()
  const label = KYC_CHECK_LABELS[category]
  // is_completed (DB) → mappé sur 'verified' (UI). Un check non required + non completed = 'na'.
  const uiStatus: KycDossierStatus = check?.is_completed
    ? 'verified'
    : check?.is_required === false
      ? 'verified' // not required → tonally verified (cf. 'na' du JSX)
      : 'pending'

  const verified = uiStatus === 'verified'

  return (
    <div
      style={{
        background: sp.card,
        borderRadius: 22,
        padding: '26px 28px',
        border: `1px solid ${sp.cardBorder}`,
        boxShadow: sp.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* Icône */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            background: verified ? sp.black : sp.cardSubtle,
            color: verified ? sp.onAccent : sp.black,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <SgIcon
            name={KYC_CHECK_ICONS[category] || 'shield'}
            size={22}
            stroke={verified ? sp.onAccent : sp.black}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 4,
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: sp.ink,
                letterSpacing: -0.2,
              }}
            >
              {label.title}
            </h4>
            <KycStatusPill status={uiStatus} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: sp.inkSoft,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            {label.sub}
          </p>
        </div>
      </div>

      {check?.notes && (
        <div
          style={{
            background: sp.cardSubtle,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 12.5,
            color: sp.inkSoft,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {check.notes}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11.5,
          color: sp.muted,
          fontWeight: 500,
          paddingTop: 4,
        }}
      >
        <span>
          {check?.completed_at ? fmtDateTime(check.completed_at) : 'En attente'}
          {actorName && check?.completed_at && ' · ' + actorName}
        </span>
        {!verified && (
          <button
            onClick={onMarkVerified}
            style={{
              border: 0,
              background: sp.black,
              color: sp.onAccent,
              fontFamily: 'inherit',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 999,
              letterSpacing: 0.1,
              boxShadow: '0 4px 12px rgba(11,12,14,0.18)',
              transition: 'all .18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = sp.blackHover
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = sp.black
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <SgIcon name="check" size={12} stroke={sp.onAccent} sw={2.2} />
            Marquer vérifié
          </button>
        )}
      </div>
    </div>
  )
}
