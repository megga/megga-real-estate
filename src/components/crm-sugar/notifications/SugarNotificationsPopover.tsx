// MEGGA CRM Sugar v2 — Notifications popover anchored on the topbar bell.
// 1:1 port from the Claude Design bundle (crm-notifications.jsx — SugarNotificationsPopover).

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { sgVoileEncre, type SugarPalette } from '../tokens'
import MEIcon from '@/components/propertyx/MEIcon'
import { KIND_META, type SugarNotif, type NotifKind } from './data'

// ─── Atom : ligne de notif compacte (popover) ──────────────────────────
interface NotifRowProps {
  n: SugarNotif
  sp: SugarPalette
  dark: boolean
  onClick?: () => void
  onMarkRead: (read: boolean) => void
  onHide: () => void
  onMute: () => void
}

function NotifRow({ n, sp, dark, onClick, onMarkRead, onHide, onMute }: NotifRowProps) {
  const { t } = useTranslation('common')
  const meta = KIND_META[n.kind] || KIND_META.system
  const [hover, setHover] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const context = n.body ? n.body.split(/[.·]/)[0].trim() : ''

  // Fermeture du menu sur clic extérieur.
  useEffect(() => {
    if (!menuOpen) return
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [menuOpen])

  const menuItem = (icon: 'check' | 'eye' | 'bell', label: string, onPick: () => void) => (
    <button
      onClick={e => { e.stopPropagation(); setMenuOpen(false); onPick() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', width: '100%',
        padding: 'var(--crm-space-md) var(--crm-space-xl)', border: 0, cursor: 'pointer', textAlign: 'left',
        background: 'transparent', borderRadius: 'var(--crm-radius-md)', color: sp.ink,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
      }}
      // Option survolée : elle se CREUSE sous le plafond du menu (S3) au lieu
      // de monter — la plage reste étanche.
      onMouseEnter={e => { e.currentTarget.style.background = sp.solidBgSub }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
      <MEIcon name={icon} size={15} color={sp.ink} />
      {label}
    </button>
  )

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
          padding: 'var(--crm-space-lg) var(--crm-space-lg)',
          border: 0, background: hover || menuOpen ? sp.cardSubBg : 'transparent',
          cursor: 'pointer', textAlign: 'left', width: '100%',
          borderRadius: 'var(--crm-radius-xl)', fontFamily: 'inherit', color: sp.ink,
          transition: 'background 160ms ease',
          position: 'relative',
        }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <MEIcon name={meta.icon} size={14} color={sp.ink} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--crm-text-lg)', color: sp.ink, lineHeight: 1.4, fontWeight: 500,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', wordBreak: 'normal', overflowWrap: 'anywhere',
          }}>
            <span style={{ fontWeight: n.read ? 500 : 600, color: sp.ink }}>{n.title}</span>
            {context && (
              <span style={{ color: sp.ink, fontWeight: n.read ? 400 : 500, opacity: 0.85 }}> {context}.</span>
            )}
          </div>
          <div style={{
            fontSize: 'var(--crm-text-sm)', color: n.read ? sp.sub : sp.ink, marginTop: 3,
            fontWeight: n.read ? 400 : 600, fontVariantNumeric: 'tabular-nums',
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <span>{n.time}</span>
            <span aria-hidden style={{ width: 3, height: 3, borderRadius: 'var(--crm-radius-pill)', background: sp.sub, opacity: 0.5 }} />
            <span style={{ color: sp.sub, fontWeight: 600 }}>{meta.label}</span>
          </div>
        </div>
        {/* Bouton « ⋯ » au survol, ou pastille non-lue */}
        <div style={{ width: 30, display: 'grid', placeItems: 'center', flexShrink: 0, alignSelf: 'center' }}>
          {(hover || menuOpen) ? (
            <span
              role="button"
              tabIndex={0}
              title={t('actions.options')}
              onClick={e => { e.stopPropagation(); setMenuRect(e.currentTarget.getBoundingClientRect()); setMenuOpen(o => !o) }}
              style={{
                width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)',
                display: 'grid', placeItems: 'center',
                background: menuOpen ? sp.accent : sp.pageBg,
                color: menuOpen ? sp.accentInk : sp.ink,
                boxShadow: `0 1px 4px ${sgVoileEncre(dark, 0.12)}`,
              }}>
              <MEIcon name="more-horizontal" size={16} color={menuOpen ? sp.accentInk : sp.ink} />
            </span>
          ) : !n.read ? (
            <span style={{ width: 10, height: 10, borderRadius: 'var(--crm-radius-pill)', background: sp.ink }} />
          ) : null}
        </div>
      </button>
      {/* Menu contextuel — position fixed (ancré au bouton) pour ne pas être coupé par l'overflow scrollable. */}
      {menuOpen && menuRect && (
        <div style={{
          position: 'fixed',
          top: menuRect.bottom + 6,
          right: Math.max(12, window.innerWidth - menuRect.right - 2),
          zIndex: 9999,
          minWidth: 232, padding: 'var(--crm-space-sm)', borderRadius: 'var(--crm-radius-xl)',
          // Menu flottant : palier haut, pas le canvas — au fond de page il ne
          // se détachait pas de la liste qu'il recouvre.
          background: sp.solidBg,
          border: `1px solid ${dark ? sp.solidBorder : sp.frameBorder}`,
          boxShadow: sp.solidShadow,
        }}>
          {menuItem('check', n.read ? t('notifications.markUnread') : t('notifications.markRead'), () => onMarkRead(!n.read))}
          {menuItem('eye', t('notifications.hideOne'), () => onHide())}
          <div style={{ height: 1, background: sp.frameBorder, margin: '5px 8px' }} />
          {menuItem('bell', t('notifications.muteKind', { kind: meta.label }), () => onMute())}
        </div>
      )}
    </div>
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
  const { t } = useTranslation('common')
  // Copie locale : les actions du menu « ⋯ » (lu/non-lu, masquer, désactiver type)
  // s'appliquent en direct. Resynchronisée si la source `items` change.
  const [localItems, setLocalItems] = useState<SugarNotif[]>(items)
  useEffect(() => { setLocalItems(items) }, [items])

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const markRead = (id: string, read: boolean) => {
    setLocalItems(prev => prev.map(n => n.id === id ? { ...n, read } : n))
    flashToast(read ? t('notifications.toastMarkedRead') : t('notifications.toastMarkedUnread'))
  }
  const hide = (id: string) => {
    setLocalItems(prev => prev.filter(n => n.id !== id))
    flashToast(t('notifications.toastHidden'))
  }
  const muteKind = (kind: NotifKind) => {
    setLocalItems(prev => prev.filter(n => n.kind !== kind))
    flashToast(t('notifications.toastMuted', { kind: KIND_META[kind]?.label || kind }))
  }

  const top = localItems.slice(0, 5)
  const unread = localItems.filter(n => !n.read).length
  // ⛔ La popover peignait SA propre surface flottante — `#16181F`, un palier
  // Graphite bleuté (B−R = 9) — alors que la palette la porte : `solidBg` vaut
  // n300 (#090909) en sombre. Troisième source de surfaces, même défaut que
  // `adminSurfaces()` sur la console.
  const solidBg = sp.solidBg

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 10px)', right: 0,
      width: 400, padding: 'var(--crm-space-xl)', zIndex: 9000,
      // ⚠ Portait `rgba(255,255,255,0.85)` en dur — un blanc qui aurait sauté
      // aux yeux en sombre si la doublure opaque ci-dessous ne le recouvrait pas
      // entièrement (`inset: 0`). Inerte, donc, mais c'est un piège posé pour qui
      // retirerait la doublure. Le retrait est un no-op vérifié à l'écran.
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      // Rayon du pager (26) — jumeau du dropdown profil, ancré au bouton voisin :
      // les deux popovers de la TopNav doivent partager la même courbure.
      borderRadius: 'var(--crm-radius-6xl)',
      boxShadow: `0 32px 70px ${sgVoileEncre(dark, 0.10)}, 0 6px 20px ${sgVoileEncre(dark, 0.05)}`,
      animation: 'sugar-fade-up 280ms cubic-bezier(.22,1,.36,1)',
    }}>
      {/* Doublure opaque — son rayon DOIT suivre celui de la coque, sinon un
          liseré translucide réapparaît dans les coins. */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: solidBg, borderRadius: 'var(--crm-radius-6xl)',
        border: dark ? '1px solid rgba(255,255,255,0.07)' : 'none',
        zIndex: 0,
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-sm) var(--crm-space-lg) var(--crm-space-xl)' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg,
            display: 'grid', placeItems: 'center',
          }}>
            <MEIcon name="bell" size={14} color={sp.ink} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, letterSpacing: '-0.01em' }}>
              {t('nav.notifications')}
            </div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
              {unread > 0 ? t('notifications.unreadCount', { count: unread }) : t('notifications.allClear')}
            </div>
          </div>
          <button
            onClick={() => { setLocalItems(prev => prev.map(n => ({ ...n, read: true }))); onMarkAll?.() }}
            disabled={unread === 0}
            style={{
              fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: unread === 0 ? sp.sub : sp.ink,
              padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: 'transparent', cursor: unread === 0 ? 'default' : 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              opacity: unread === 0 ? 0.5 : 1,
            }}>{t('notifications.markAllRead')}</button>
        </div>

        {/* Liste */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', maxHeight: 420, overflowY: 'auto' }}>
          {top.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: sp.sub, fontSize: 'var(--crm-text-md)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--crm-radius-pill)', background: sp.cardSubBg,
                display: 'grid', placeItems: 'center', margin: '0 auto 10px',
              }}>
                <MEIcon name="bell" size={18} color={sp.sub} />
              </div>
              {t('notifications.empty')}
            </div>
          )}
          {top.map(n => (
            <NotifRow key={n.id} n={n} sp={sp} dark={dark}
              onClick={() => onItemClick && onItemClick(n)}
              onMarkRead={read => markRead(n.id, read)}
              onHide={() => hide(n.id)}
              onMute={() => muteKind(n.kind)} />
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
          padding: 'var(--crm-space-lg) var(--crm-space-md) var(--crm-space-xs)', marginTop: 6,
          borderTop: `1px solid ${sp.frameBorder}`,
        }}>
          <button
            onClick={onMute}
            title={t('notifications.pause2h')}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
              padding: 'var(--crm-space-md) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: 'transparent', color: sp.sub,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sp.cardSubBg }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            <MEIcon name="calendar" size={13} color={sp.sub} />
            {t('notifications.pause2h')}
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={onSeeAll}
            style={{
              padding: 'var(--crm-space-md) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: sp.accent, color: sp.accentInk,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: `0 4px 12px ${sgVoileEncre(dark, 0.18)}`,
            }}>{t('notifications.seeAll')} →</button>
        </div>

        {/* Toast de confirmation (auto-dismiss) */}
        {toast && (
          <div style={{
            position: 'absolute', left: '50%', bottom: -6, transform: 'translateX(-50%)',
            background: sp.ink, color: sp.pageBg,
            fontSize: 'var(--crm-text-sm)', fontWeight: 600, padding: 'var(--crm-space-sm) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
            boxShadow: `0 8px 24px ${sgVoileEncre(dark, 0.28)}`, whiteSpace: 'nowrap', zIndex: 2,
            animation: 'sugar-fade-up 200ms cubic-bezier(.22,1,.36,1)',
          }}>{toast}</div>
        )}
      </div>
    </div>
  )
}
