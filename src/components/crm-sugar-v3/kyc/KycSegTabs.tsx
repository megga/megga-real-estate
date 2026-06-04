// MEGGA CRM Sugar v3 — Navbar segmentée de la fiche dossier (handoff §5)
// Port de crm-screen-kyc-sugar.jsx §KycSegTabs (style toggle Calendrier).
// Onglets : Synthèse · Contrôles N · Documents N · Audit.

import { useKycPalette } from './kycPalette'

export interface KycSegTab {
  id: string
  label: string
  /** Compteur optionnel (pilule à droite du label). */
  count?: number
}

interface Props {
  tabs: KycSegTab[]
  active: string
  onChange: (id: string) => void
}

export function KycSegTabs({ tabs, active, onChange }: Props) {
  const sp = useKycPalette()
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        borderRadius: 999,
        background: sp.cardSubtle,
        border: `1px solid ${sp.cardBorder}`,
        boxShadow: sp.shadowSm,
      }}
    >
      {tabs.map((tb) => {
        const on = active === tb.id
        return (
          <button
            key={tb.id}
            onClick={() => onChange(tb.id)}
            style={{
              height: 38,
              padding: '0 18px',
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              background: on ? sp.black : 'transparent',
              color: on ? sp.onAccent : sp.inkSoft,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: on ? 700 : 600,
              letterSpacing: -0.1,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              transition: 'color .18s ease, background .18s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {tb.label}
            {tb.count != null && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: on ? `${sp.onAccent}22` : sp.card,
                  color: on ? sp.onAccent : sp.muted,
                }}
              >
                {tb.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
