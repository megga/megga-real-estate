/**
 * Cloche + panneau de notifications super-admin (portal, z-[100]).
 * Agrège les événements sensibles (nouvelle agence, alerte PEP KYC, résiliation,
 * erreur système, ticket) via `useAdminNotifications` : badge non-lus, marquer-lu.
 *
 * La cloche vit dans le PIED DU RAIL du shell : sa ligne reprend donc la
 * grammaire de nav des Réglages, exactement comme les entrées voisines (thème,
 * retour CRM) — rayon 14, gap 12, padding 10/12, icône 17 en `sp.sub`, libellé
 * 13/700. Le compteur de non-lus passe en pilule pleine (l'ancien
 * `bg-red-500` en pastille flottante), et l'état « non lu » d'une ligne se dit
 * par la surface creuse + l'accent NOIR de Sugar, plus par le violet plateforme.
 */
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { formatRelativeDate } from '@/lib/utils'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { AdminDivider, AdminEmpty, AdminGhostBtn, AdminPill, AdminSkeleton } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

// ─── Action type → icon + i18n key mapping ──────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: MEIconName; i18nKey: string }> = {
  agency_created: { icon: 'building', i18nKey: 'notifications.action.newAgency' },
  kyc_screening_match: { icon: 'shield', i18nKey: 'notifications.action.pepAlert' },
  subscription_cancelled: { icon: 'credit-card', i18nKey: 'notifications.action.subscriptionCancelled' },
  edge_function_error: { icon: 'alert', i18nKey: 'notifications.action.systemError' },
  ticket_created: { icon: 'message', i18nKey: 'notifications.action.newTicket' },
}

/**
 * Cloche déroulant un panneau de notifications ; ferme au clic extérieur ou Échap.
 * Le panneau passe par createPortal pour échapper à l'overflow de la sidebar.
 */
export default function AdminNotificationPanel() {
  const { t } = useTranslation('admin')
  const { sp, surf, dark } = useAdminSugar()
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const focusTrapRef = useFocusTrap(open)
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useAdminNotifications()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        focusTrapRef.current && !focusTrapRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, focusTrapRef])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const hair = dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)'

  return (
    <>
      {/* Ligne de rail — même grammaire que les entrées de nav du shell */}
      <button
        ref={bellRef}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Notifications admin"
        className="adm-nav"
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', borderRadius: ADMIN_RADII.row,
          cursor: 'pointer', border: 0, width: '100%',
          fontFamily: 'inherit', textAlign: 'left',
          background: 'transparent',
        }}
      >
        <span style={{ width: 22, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <MEIcon name="bell" size={17} color={sp.sub} />
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: sp.soft }}>
          {t('notifications.title')}
        </span>
        {unreadCount > 0 && (
          <AdminPill
            label={unreadCount > 99 ? '99+' : String(unreadCount)}
            tone="err"
            style={{ padding: '3px 9px', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
          />
        )}
      </button>

      {/* Panel (portal) */}
      {open && createPortal(
        <div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          className="fixed top-14 right-4 w-[380px] max-h-[500px] z-[100] flex flex-col overflow-hidden"
          style={{
            background: surf.card,
            borderRadius: ADMIN_RADII.card,
            border: surf.hairline,
            boxShadow: sp.shadow,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', flexShrink: 0 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
              {t('notifications.title')}
            </span>
            {unreadCount > 0 && (
              <AdminGhostBtn onClick={markAllAsRead} style={{ height: 28, padding: '0 11px', fontSize: 11.5 }}>
                <MEIcon name="check" size={13} color={sp.ink} />
                {t('notifications.markAllRead')}
              </AdminGhostBtn>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label={t('notifications.close')}
              style={{
                width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                background: 'transparent', color: sp.sub, display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <MEIcon name="close" size={15} color={sp.sub} />
            </button>
          </div>
          <AdminDivider />

          {/* List */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <AdminSkeleton key={i} height={44} />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <AdminEmpty title={t('notifications.empty')} />
            ) : (
              notifications.map((notif, i) => {
                const cfg = ACTION_CONFIG[notif.action]
                const Icon = cfg?.icon ?? 'bell'
                const label = cfg ? t(cfg.i18nKey) : notif.action
                return (
                  <button
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className="adm-nav"
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%',
                      padding: '11px 14px', border: 0, textAlign: 'left', cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: notif.read ? 'transparent' : surf.cardSub,
                      borderBottom: i < notifications.length - 1 ? `1px solid ${hair}` : '0',
                    }}
                  >
                    {/* Icon */}
                    <span style={{ marginTop: 1, flexShrink: 0 }}>
                      <MEIcon name={Icon as MEIconName} size={16} color={notif.read ? sp.sub : sp.ink} />
                    </span>

                    {/* Content */}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 12.5, fontWeight: notif.read ? 500 : 700, color: notif.read ? sp.sub : sp.ink }}>
                          {label}
                        </span>
                        {!notif.read && (
                          <span style={{ width: 6, height: 6, borderRadius: ADMIN_RADII.pill, background: sp.accent, flexShrink: 0 }} />
                        )}
                      </span>
                      <span style={{ display: 'block', fontSize: 11, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                        {notif.entity_type}{notif.entity_id ? ` #${notif.entity_id.slice(0, 8)}` : ''}
                      </span>
                    </span>

                    {/* Timestamp */}
                    <span style={{ marginTop: 1, flexShrink: 0, whiteSpace: 'nowrap', fontSize: 11, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                      {formatRelativeDate(notif.created_at)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
