// MEGGA CRM Sugar v2 — Notifications popover anchored on the topbar bell.
// 1:1 port from the Claude Design bundle (crm-notifications.jsx — SugarNotificationsPopover).

import { useState } from 'react'
import type { SugarPalette } from '../tokens'
import MEIcon from '@/components/propertyx/MEIcon'
import { KIND_META, type SugarNotif } from './data'

// ─── Atom : ligne de notif compacte (popover) ──────────────────────────
interface NotifRowProps {
  n: SugarNotif
  sp: SugarPalette
  onClick?: () => void
}

function NotifRow({ n, sp, onClick }: NotifRowProps) {
  const meta = KIND_META[n.kind] || KIND_META.system
  const [hover, setHover] = useState(false)
  const context = n.body ? n.body.split(/[.·]/)[0].trim() : ''

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 12px',
        border: 0, background: hover ? sp.cardSubBg : 'transparent',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        borderRadius: 12, fontFamily: 'inherit', color: sp.ink,
        transition: 'background 160ms ease',
        position: 'relative',
      }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12, background: sp.cardSubBg,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        marginTop: 1,
      }}>
        <MEIcon name={meta.icon} size={14} color={sp.ink} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, color: sp.ink, lineHeight: 1.4,
          fontWeight: n.read ? 500 : 600,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'normal', overflowWrap: 'anywhere',
        }}>
          <span style={{ fontWeight: n.read ? 600 : 700, color: sp.ink }}>{n.title}</span>
          {context && (
            <span style={{ color: sp.ink, fontWeight: n.read ? 500 : 600 }}> {context}.</span>
          )}
        </div>
        <div style={{
          fontSize: 11.5, color: n.read ? sp.sub : '#0041D9', marginTop: 4,
          fontWeight: n.read ? 500 : 700,
          fontVariantNumeric: 'tabular-nums',
        }}>{n.time}</div>
      </div>
      {!n.read && (
        <span style={{
          width: 9, height: 9, borderRadius: 999, flexShrink: 0,
          background: '#0041D9', marginTop: 14,
        }} />
      )}
    </button>
  )
}

// ─── Popover ───────────────────────────────────────────────────────────
interface SugarNotificationsPopoverProps {
  sp: SugarPalette
  dark: boolean
  items: SugarNotif[]
  onItemClick?: (n: SugarNotif) => void
  onMarkAll?: () => void
  onSeeAll?: () => void
  onMute?: () => void
}

export default function SugarNotificationsPopover({
  sp, dark, items, onItemClick, onMarkAll, onSeeAll, onMute,
}: SugarNotificationsPopoverProps) {
  const top = items.slice(0, 5)
  const unread = items.filter(n => !n.read).length
  const solidBg = dark ? '#1A1D24' : '#FFFFFF'

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 10px)', right: 0,
      width: 400, padding: 12, zIndex: 9000,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      borderRadius: 20,
      boxShadow: '0 32px 70px rgba(15,23,42,0.10), 0 6px 20px rgba(15,23,42,0.05)',
      animation: 'sugar-fade-up 280ms cubic-bezier(.22,1,.36,1)',
    }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: solidBg, borderRadius: 20,
        zIndex: 0,
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 10px 12px',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 12, background: sp.cardSubBg,
            display: 'grid', placeItems: 'center',
          }}>
            <MEIcon name="bell" size={14} color={sp.ink} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: sp.ink, letterSpacing: '-0.01em' }}>
              Notifications
            </div>
            <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
              {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est à jour'}
            </div>
          </div>
          <button
            onClick={onMarkAll}
            disabled={unread === 0}
            style={{
              fontSize: 11, fontWeight: 700, color: unread === 0 ? sp.sub : sp.ink,
              padding: '6px 10px', borderRadius: 999, border: 0,
              background: 'transparent', cursor: unread === 0 ? 'default' : 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              opacity: unread === 0 ? 0.5 : 1,
            }}>Tout marquer lu</button>
        </div>

        {/* Liste */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          maxHeight: 420, overflowY: 'auto',
        }}>
          {top.length === 0 && (
            <div style={{
              padding: '32px 16px', textAlign: 'center', color: sp.sub,
              fontSize: 12.5,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 999, background: sp.cardSubBg,
                display: 'grid', placeItems: 'center', margin: '0 auto 10px',
              }}>
                <MEIcon name="bell" size={18} color={sp.sub} />
              </div>
              Aucune notification pour l'instant.
            </div>
          )}
          {top.map(n => (
            <NotifRow key={n.id} n={n} sp={sp}
              onClick={() => onItemClick && onItemClick(n)} />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 8px 4px', marginTop: 6,
          borderTop: `1px solid ${sp.frameBorder || 'rgba(15,23,42,0.06)'}`,
        }}>
          <button
            onClick={onMute}
            title="Pause 2 h"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 999, border: 0,
              background: 'transparent', color: sp.sub,
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sp.cardSubBg }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <MEIcon name="calendar" size={13} color={sp.sub} />
            Pause 2 h
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={onSeeAll}
            style={{
              padding: '8px 14px', borderRadius: 999, border: 0,
              background: sp.ink, color: sp.pageBg,
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(11,12,14,0.18)',
            }}>Voir toutes les notifications →</button>
        </div>
      </div>
    </div>
  )
}
