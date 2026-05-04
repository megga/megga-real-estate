// MEGGA CRM Sugar v2 — Buyer card (gauche)
// 1:1 port from `crm-screen-matching-sugar.jsx` (MBuyerCard).

import { useState } from 'react'
import { crmBienById } from '../mockData'
import { crmInitials, type SugarPalette } from '../tokens'
import { BienIcon } from './BienIcon'
import {
  fmtPriceShort,
  getBuyerType,
  getCities,
  getEngagement,
  mColor,
  mLabel,
  matchKey,
  type MatchGroup,
} from './helpers'

interface MBuyerCardProps {
  group: MatchGroup
  sp: SugarPalette
  dark: boolean
  onClick: () => void
  sentMatchIds: Set<string>
  scheduledVisits: ScheduledVisit[]
}

export interface ScheduledVisit {
  buyerId: string
  bienId: string
  dayIso: string
  slot: string
  duration: number
  notes: string
}

export function MBuyerCard({
  group,
  sp,
  dark,
  onClick,
  sentMatchIds,
  scheduledVisits,
}: MBuyerCardProps) {
  const { buyer, matches, topScore } = group
  const [hov, setHov] = useState(false)
  const engagement = getEngagement(matches)
  const buyerType = getBuyerType(buyer)
  const cities = getCities(buyer)
  const col = mColor(topScore)

  const topMatches = matches.slice(0, 2)
  const sentCount = matches.filter(m => sentMatchIds.has(matchKey(m))).length
  const visitCount = scheduledVisits.filter(v => v.buyerId === buyer.id).length

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
        borderRadius: 20,
        padding: '16px 18px',
        boxShadow: hov ? sp.shadow : 'none',
        cursor: 'pointer',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        transition:
          'transform 220ms cubic-bezier(.22,1,.36,1), box-shadow 220ms ease, background 200ms ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            flexShrink: 0,
            background: buyer.avatarBg || '#0041D9',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            fontWeight: 700,
            border: `2px solid ${sp.avatarBorder}`,
            boxSizing: 'border-box',
            boxShadow: '0 2px 6px rgba(0,0,0,.18)',
          }}
        >
          {crmInitials(`${buyer.firstName} ${buyer.lastName}`)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: sp.ink,
              letterSpacing: -0.2,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {buyer.firstName} {buyer.lastName}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: sp.sub,
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {buyerType}
            {cities ? ` · ${cities}` : ''}
          </div>
        </div>

        {/* Score */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 0,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: col,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.8,
            }}
          >
            {topScore}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: sp.sub,
              marginTop: 3,
              fontStyle: 'italic',
            }}
          >
            {mLabel(topScore).toLowerCase()}
          </span>
        </div>
      </div>

      {/* Top 2 biens */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {topMatches.map((m, i) => {
          const b = crmBienById(m.bienId)
          if (!b) return null
          const c2 = mColor(m.score)
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: 'transparent',
                border: `1px solid ${sp.cardBorder}`,
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  flexShrink: 0,
                  background: dark ? 'rgba(255,255,255,.04)' : '#FBFAF8',
                  border: `1px solid ${sp.cardBorder}`,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <BienIcon bien={b} size={15} color={sp.soft} opacity={0.65} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: sp.ink,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {b.title}
                </div>
                <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>
                  {fmtPriceShort(b)} · {b.area}m² · {b.rooms}p
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: c2,
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  letterSpacing: -0.3,
                }}
              >
                {m.score}
              </div>
            </div>
          )
        })}
        {matches.length > 2 && (
          <div
            style={{
              fontSize: 11,
              color: sp.sub,
              paddingLeft: 6,
              fontWeight: 500,
            }}
          >
            + {matches.length - 2} autre{matches.length - 2 > 1 ? 's' : ''} bien
            {matches.length - 2 > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 12,
          borderTop: `1px solid ${sp.cardBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {sentCount > 0 && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: 99,
                background: 'rgba(0,65,217,0.10)',
                color: '#0041D9',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg
                width={9}
                height={9}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0041D9"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m22 2-7 20-4-9-9-4 20-7Z" />
              </svg>
              Envoyé · {sentCount}
            </span>
          )}
          {visitCount > 0 && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: 99,
                background: 'rgba(14,159,110,0.10)',
                color: '#0E9F6E',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg
                width={9}
                height={9}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0E9F6E"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Visite · {visitCount}
            </span>
          )}
          {sentCount === 0 && visitCount === 0 && (
            <span
              style={{
                fontSize: 11.5,
                color: sp.sub,
                fontWeight: 500,
                fontStyle: 'italic',
              }}
            >
              {engagement.label}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: sp.ink,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Voir les matchs <span style={{ fontSize: 13 }}>→</span>
        </div>
      </div>
    </div>
  )
}
