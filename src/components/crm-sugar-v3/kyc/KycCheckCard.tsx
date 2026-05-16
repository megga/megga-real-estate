// MEGGA CRM Sugar v3 — Carte d'un contrôle LBA (5 cards de la vue détail)
// Port 1:1 de crm-screen-kyc-sugar.jsx lignes 293-366 (KycCheckCard).

import { SugarV3, KYC_CHECK_LABELS, KYC_CHECK_ICONS, fmtDateTime } from '../tokens'
import { KycStatusPill } from '../primitives'
import { SgIcon } from '../icons'
import type { KycCheckCategory, KycChecklistItem, KycDossierStatus } from '@/types/kyc'

interface Props {
  category: KycCheckCategory
  check: KycChecklistItem | null
  onMarkVerified: () => void
  /** Pour afficher le nom de l'acteur sous l'étiquette. */
  actorName?: string
}

export function KycCheckCard({ category, check, onMarkVerified, actorName }: Props) {
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
        background: SugarV3.card,
        borderRadius: 22,
        padding: '26px 28px',
        boxShadow: SugarV3.shadow,
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
            background: verified ? SugarV3.black : SugarV3.cardSubtle,
            color: verified ? '#fff' : SugarV3.black,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <SgIcon
            name={KYC_CHECK_ICONS[category] || 'shield'}
            size={22}
            stroke={verified ? '#fff' : SugarV3.black}
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
                color: SugarV3.ink,
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
              color: SugarV3.inkSoft,
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
            background: SugarV3.cardSubtle,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 12.5,
            color: SugarV3.inkSoft,
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
          color: SugarV3.muted,
          fontWeight: 500,
          paddingTop: 4,
        }}
      >
        <span>
          {check?.completed_at
            ? fmtDateTime(check.completed_at)
            : 'En attente'}
          {actorName && check?.completed_at && ' · ' + actorName}
        </span>
        {!verified && (
          <button
            onClick={onMarkVerified}
            style={{
              border: 0,
              background: SugarV3.black,
              color: '#fff',
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
              e.currentTarget.style.background = SugarV3.blackHover
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = SugarV3.black
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <SgIcon name="check" size={12} stroke="#fff" sw={2.2} />
            Marquer vérifié
          </button>
        )}
      </div>
    </div>
  )
}
