// MEGGA CRM Sugar v2 — Top opportunity row (droite)
// 1:1 port from `crm-screen-matching-sugar.jsx` (MTopOppRow).

import { useState } from 'react'
import { crmBienById, crmContactById, type CrmMatch } from '../mockData'
import { crmInitials, type SugarPalette } from '../tokens'
import { BienIcon } from './BienIcon'
import { fmtPriceShort, getStatusMap, mColor } from './helpers'

interface MTopOppRowProps {
  match: CrmMatch
  sp: SugarPalette
  dark: boolean
  onClick: () => void
}

export function MTopOppRow({ match, sp, dark, onClick }: MTopOppRowProps) {
  const b = crmBienById(match.bienId)
  const c = crmContactById(match.contactId)
  const [hov, setHov] = useState(false)

  if (!b || !c) return null
  const col = mColor(match.score)
  const statusMap = getStatusMap(sp)
  const st = statusMap[match.status] || statusMap.sent

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? sp.cardBg : dark ? 'transparent' : 'rgba(255,255,255,.55)',
        backdropFilter: hov ? 'none' : dark ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: hov ? 'none' : dark ? 'none' : 'blur(8px)',
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 16,
        padding: '12px',
        boxShadow: hov ? sp.shadow : 'none',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        cursor: 'pointer',
        transform: hov ? 'translateY(-1px)' : 'translateY(0)',
        transition:
          'transform 200ms cubic-bezier(.22,1,.36,1), box-shadow 200ms ease, background 200ms ease',
      }}
    >
      {/* Photo placeholder */}
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 16,
          flexShrink: 0,
          background: dark ? 'rgba(255,255,255,.04)' : '#FBFAF8',
          border: `1px solid ${sp.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <BienIcon bien={b} size={32} color={sp.soft} opacity={0.55} />
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 8,
            fontSize: 13,
            fontWeight: 800,
            color: col,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: -0.4,
          }}
        >
          {match.score}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            right: 8,
            fontSize: 9,
            fontWeight: 700,
            color: sp.sub,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {b.transaction === 'location' ? 'Loc' : b.type === 'maison' ? 'Villa' : 'Appt'}
        </div>
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: sp.ink,
              letterSpacing: -0.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
            }}
          >
            {b.title}
          </div>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: st.textInk,
              fontStyle: 'italic',
              flexShrink: 0,
            }}
          >
            {st.label}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: sp.sub, marginBottom: 6 }}>
          {fmtPriceShort(b)} · {b.area}m² · {b.rooms}p
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 99,
              background: c.avatarBg || '#0041D9',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 8.5,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {crmInitials(`${c.firstName} ${c.lastName}`)}
          </div>
          <span style={{ fontSize: 11, color: sp.sub, fontWeight: 500 }}>
            {c.firstName} {c.lastName}
          </span>
        </div>
      </div>
    </div>
  )
}
