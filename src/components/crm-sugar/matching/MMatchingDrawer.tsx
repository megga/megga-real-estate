// MEGGA CRM Sugar v2 — Drawer (vue détail acheteur + biens correspondants)
// 1:1 port from `crm-screen-matching-sugar.jsx` (MMatchingDrawer).

import { createPortal } from 'react-dom'
import { crmBienById } from '../mockData'
import type { SugarPalette } from '../tokens'
import { BienIcon } from './BienIcon'
import {
  AI_NOTES,
  getBuyerType,
  getCities,
  mColor,
  matchKey,
  type MatchGroup,
} from './helpers'
import type { ScheduledVisit } from './MBuyerCard'

export type MatchingAction = 'send' | 'schedule'

interface MMatchingDrawerProps {
  group: MatchGroup
  sp: SugarPalette
  dark: boolean
  sentMatchIds: Set<string>
  scheduledVisits: ScheduledVisit[]
  onClose: () => void
  onAction: (action: MatchingAction, group: MatchGroup) => void
}

export function MMatchingDrawer({
  group,
  sp,
  dark,
  sentMatchIds,
  scheduledVisits,
  onClose,
  onAction,
}: MMatchingDrawerProps) {
  const { buyer, matches } = group
  const fullName = `${buyer.firstName} ${buyer.lastName}`
  const initials = (buyer.firstName?.[0] || '') + (buyer.lastName?.[0] || '')
  const top = matches[0]
  const topScore = top?.score || 0
  const topColor = mColor(topScore)
  const aiNote = AI_NOTES[buyer.id]
  const cities = getCities(buyer)
  const buyerType = getBuyerType(buyer)
  const budget = buyer.criteria?.budgetMax
    ? `CHF ${buyer.criteria.budgetMax.toLocaleString('fr-CH').replace(/,/g, ' ')}`
    : 'Budget non défini'
  const avatarBg = buyer.avatarBg || '#0041D9'

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: dark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.30)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          animation: 'sugar-overlay-fade 220ms ease',
        }}
      />

      <aside
        style={{
          position: 'fixed',
          top: 24,
          right: 24,
          bottom: 24,
          width: 480,
          zIndex: 1201,
          background: sp.frameBg,
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          border: `1px solid ${sp.frameBorder}`,
          borderRadius: 32,
          boxShadow: dark
            ? '-20px 20px 60px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset'
            : '-20px 20px 60px rgba(15,23,42,0.18), 0 1px 0 rgba(255,255,255,0.6) inset',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sugar-bento-in 380ms cubic-bezier(.22,1,.36,1)',
          color: sp.ink,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 24px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            position: 'relative',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              left: -40,
              right: -40,
              height: 200,
              background: `radial-gradient(circle at 30% 0%, ${avatarBg}22 0%, transparent 65%)`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 999,
              background: avatarBg,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 19,
              fontWeight: 800,
              boxShadow: `0 6px 20px ${avatarBg}55`,
              border: `3px solid ${sp.avatarBorder}`,
              flexShrink: 0,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {initials}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              position: 'relative',
              zIndex: 1,
              paddingTop: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: 'rgba(0,65,217,0.12)',
                  color: '#0041D9',
                }}
              >
                {matches.length} match{matches.length > 1 ? 's' : ''}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: `${topColor}1A`,
                  color: topColor,
                }}
              >
                Top {topScore}%
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: -0.5,
                color: sp.ink,
                lineHeight: 1.15,
              }}
            >
              {fullName}
            </h2>
            <div
              style={{
                fontSize: 12,
                color: sp.sub,
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {buyerType} · {budget} · {cities || '—'}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: 0,
              background: sp.cardSubBg,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
              zIndex: 1,
              flexShrink: 0,
              transition: 'background 160ms ease, transform 160ms ease',
              color: sp.soft,
              fontSize: 16,
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = sp.cardBorder
              e.currentTarget.style.transform = 'rotate(90deg)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = sp.cardSubBg
              e.currentTarget.style.transform = 'rotate(0)'
            }}
          >
            ×
          </button>
        </div>

        {/* Note IA */}
        {aiNote && (
          <div
            style={{
              margin: '0 24px 12px',
              padding: '10px 14px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(0,65,217,0.06), rgba(124,58,237,0.04))',
              border: '1px solid rgba(0,65,217,0.12)',
              fontSize: 12.5,
              color: sp.ink,
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.6,
                padding: '2px 7px',
                borderRadius: 99,
                background: 'linear-gradient(135deg, #0041D9, #7C3AED)',
                color: '#fff',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              AI
            </span>
            <span style={{ fontStyle: 'italic' }}>{aiNote}</span>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 16px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: sp.sub,
              marginBottom: 10,
              paddingLeft: 2,
            }}
          >
            Biens correspondants
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {matches.map((m, i) => {
              const b = crmBienById(m.bienId)
              if (!b) return null
              const col = mColor(m.score)
              const price = b.price?.toLocaleString('fr-CH').replace(/,/g, ' ')
              const k = matchKey(m)
              const hasVisit = scheduledVisits.some(
                v => v.buyerId === buyer.id && v.bienId === m.bienId,
              )
              const wasSent = sentMatchIds.has(k)

              let pillLabel: string
              let pillInk: string
              let pillBg: string
              let pillBd: string
              if (hasVisit) {
                pillLabel = 'Visite planifiée'
                pillInk = '#0041D9'
                pillBg = dark ? 'rgba(64,107,255,.14)' : '#EEF2FF'
                pillBd = dark ? 'rgba(64,107,255,.28)' : '#DBE3FF'
              } else if (wasSent) {
                pillLabel = 'Envoyé'
                pillInk = '#3F8A4F'
                pillBg = dark ? 'rgba(63,138,79,.14)' : '#ECF6EE'
                pillBd = dark ? 'rgba(63,138,79,.28)' : '#D9EBDD'
              } else {
                pillLabel = 'À envoyer'
                pillInk = sp.sub
                pillBg = sp.cardSubBg
                pillBd = sp.cardBorder
              }

              return (
                <div
                  key={i}
                  style={{
                    background: dark ? 'transparent' : 'rgba(255,255,255,.55)',
                    backdropFilter: dark ? 'none' : 'blur(8px)',
                    WebkitBackdropFilter: dark ? 'none' : 'blur(8px)',
                    border: `1px solid ${sp.cardBorder}`,
                    borderRadius: 18,
                    padding: 12,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'stretch',
                    transition: 'border-color 160ms ease, transform 160ms ease, background 160ms ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${col}55`
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.background = sp.cardBg
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = sp.cardBorder
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.background = dark
                      ? 'transparent'
                      : 'rgba(255,255,255,.55)'
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      background: dark ? 'rgba(255,255,255,.04)' : '#FBFAF8',
                      border: `1px solid ${sp.cardBorder}`,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <BienIcon bien={b} size={28} color={sp.soft} opacity={0.55} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: sp.ink,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {b.title}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: col,
                          flexShrink: 0,
                        }}
                      >
                        {m.score}
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 3 }}>
                      {b.canton} · {b.rooms}p · {b.area}m²
                    </div>
                    {price && (
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: sp.ink,
                          marginTop: 4,
                        }}
                      >
                        CHF {price}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {hasVisit && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 99,
                            background: pillInk,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 99,
                          background: pillBg,
                          color: pillInk,
                          border: `1px solid ${pillBd}`,
                        }}
                      >
                        {pillLabel}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px 22px',
            borderTop: `1px solid ${sp.cardBorder}`,
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            onClick={() => onAction('send', group)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 999,
              border: 0,
              background: sp.ink,
              color: sp.pageBg,
              fontSize: 13.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: sp.focusShadow,
            }}
          >
            Envoyer le dossier
          </button>
          <button
            onClick={() => onAction('schedule', group)}
            style={{
              height: 44,
              padding: '0 18px',
              borderRadius: 999,
              border: `1px solid ${sp.cardBorder}`,
              background: sp.cardBg,
              color: sp.ink,
              fontSize: 13.5,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Planifier visite
          </button>
        </div>
      </aside>
    </>,
    document.body,
  )
}
