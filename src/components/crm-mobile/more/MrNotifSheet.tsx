/**
 * Feuille Notifications du CRM mobile (crm-mobile/more) — bottom-sheet plein
 * écran ouvert depuis le hub « Plus ». Digest des priorités + liste groupée par
 * jour, alimentée par `useAgentNotifications` (instance passée en props).
 */
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { KIND_META, type NotifGroup, type SugarNotif } from '@/components/crm-sugar/notifications/data'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'

interface MrNotifSheetProps {
  open: boolean
  onClose: () => void
  items: SugarNotif[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}

const GROUPS: { id: NotifGroup; labelKey: string }[] = [
  { id: 'today', labelKey: 'notifications.groupToday' },
  { id: 'yesterday', labelKey: 'notifications.groupYesterday' },
  { id: 'older', labelKey: 'notifications.groupOlder' },
]

const SHEET_SPRING = { type: 'spring' as const, stiffness: 320, damping: 34, mass: 0.95 }

/** Convertit un hex en `rgba()` avec alpha — pour teinter le fond d'une pastille d'icône. */
function tint(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

/**
 * Feuille Notifications (depuis « Plus » → cloche). Sugar Pure, alimentée par
 * `useAgentNotifications` (passé en props depuis le hub → une seule instance).
 * Digest « L'essentiel » pour les priorités, liste groupée par jour. Le clic
 * marque comme lu (pas de navigation : `ctaTo` est vide côté données — pas de
 * deep-link mort). Empty-state honnête.
 */
export default function MrNotifSheet({
  open,
  onClose,
  items,
  unreadCount,
  markRead,
  markAllRead,
}: MrNotifSheetProps) {
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation('common')
  const { tk, isDark } = useMobileTokens()

  const priorities = items.filter((n) => n.priority === 'high' && !n.read)

  const renderRow = (n: SugarNotif) => {
    const meta = KIND_META[n.kind]
    const iconColor = isDark ? '#FFFFFF' : meta.dot
    return (
      <button
        key={n.id}
        type="button"
        onClick={() => markRead(n.id)}
        style={{
          width: '100%',
          textAlign: 'left',
          border: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          background: n.read ? 'transparent' : tk.card,
          borderRadius: 'var(--crm-radius-2xl)',
          boxShadow: n.read ? 'none' : tk.shadowSm,
          padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
          display: 'flex',
          gap: 'var(--crm-space-xl)',
          alignItems: 'flex-start',
          opacity: n.read ? 0.62 : 1,
        }}
      >
        <span
          style={{
            position: 'relative',
            width: 40,
            height: 40,
            borderRadius: 'var(--crm-radius-lg)',
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            background: n.read ? tk.cardSubtle : tint(meta.dot, isDark ? 0.22 : 0.1),
          }}
        >
          <MEIcon name={meta.icon} size={19} color={iconColor} strokeWidth={1.9} />
          {!n.read ? (
            <span
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 9,
                height: 9,
                borderRadius: 'var(--crm-radius-pill)',
                background: meta.dot,
                boxShadow: `0 0 0 2.5px ${tk.sheetBg}`,
              }}
            />
          ) : null}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 'var(--crm-text-xl)',
              fontWeight: n.read ? 700 : 800,
              letterSpacing: -0.3,
              color: tk.ink,
              lineHeight: 1.3,
            }}
          >
            {n.title}
          </span>
          {n.body ? (
            <span
              style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, marginTop: 3, lineHeight: 1.4 }}
            >
              {n.body}
            </span>
          ) : null}
          <span
            style={{ display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 700, color: tk.ghost, marginTop: 6, letterSpacing: -0.1 }}
          >
            {n.time}
          </span>
        </span>
      </button>
    )
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.notifications')}
          style={{ fontFamily: MOBILE_FONT }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.22 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: tk.overlay, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          />
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reducedMotion ? { duration: 0 } : SHEET_SPRING}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '90dvh',
              background: tk.sheetBg,
              borderRadius: '26px 26px 0 0',
              boxShadow: '0 -20px 60px rgba(15,23,42,0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* poignée + en-tête */}
            <div style={{ flexShrink: 0, padding: 'var(--crm-space-xl) var(--crm-space-5xl) var(--crm-space-sm)' }}>
              <span
                aria-hidden="true"
                style={{ display: 'block', width: 40, height: 5, borderRadius: 'var(--crm-radius-pill)', background: tk.ghost, opacity: 0.5, margin: '0 auto 14px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 800, letterSpacing: -0.7, color: tk.ink }}>
                  {t('nav.notifications')}
                </h2>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={markAllRead}
                    style={{
                      height: 36,
                      padding: '0 var(--crm-space-2xl)',
                      borderRadius: 'var(--crm-radius-pill)',
                      border: 0,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 'var(--crm-text-lg)',
                      fontWeight: 700,
                      color: tk.inkSoft,
                      background: tk.card,
                      boxShadow: tk.shadowSm,
                    }}
                  >
                    {t('notifications.markAllRead')}
                  </button>
                ) : null}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 28px', WebkitOverflowScrolling: 'touch' }}>
              {items.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--crm-space-xl)',
                    padding: '64px 24px',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{ width: 56, height: 56, borderRadius: 'var(--crm-radius-3xl)', display: 'grid', placeItems: 'center', background: tk.card, boxShadow: tk.shadowSm }}
                  >
                    <MEIcon name="bell" size={24} color={tk.muted} />
                  </span>
                  <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.muted }}>{t('notifications.empty')}</span>
                </div>
              ) : (
                <>
                  {priorities.length > 0 ? (
                    <div
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        background: '#0B0C0E',
                        borderRadius: 'var(--crm-radius-4xl)',
                        padding: 'var(--crm-space-3xl) var(--crm-space-3xl) var(--crm-space-3xl)',
                        boxShadow: '0 18px 44px rgba(11,12,14,0.4)',
                      }}
                    >
                      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: '-18%',
                            top: '-40%',
                            width: '70%',
                            height: '120%',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, #4F5BF2 0%, rgba(79,91,242,0) 70%)',
                            filter: 'blur(20px)',
                            opacity: 0.5,
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            right: '-20%',
                            top: '-30%',
                            width: '66%',
                            height: '120%',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, #D24A9C 0%, rgba(210,74,156,0) 70%)',
                            filter: 'blur(20px)',
                            opacity: 0.46,
                          }}
                        />
                      </div>
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
                          <span style={{ width: 26, height: 26, borderRadius: 'var(--crm-radius-sm)', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.14)' }}>
                            <MEIcon name="sparkle" size={15} color="#FFFFFF" strokeWidth={1.8} />
                          </span>
                          <span
                            style={{ fontSize: 'var(--crm-text-md)', fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)' }}
                          >
                            {t('notifications.essential')}
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.5, marginTop: 11 }}>
                          {t('notifications.digestPriorities', { count: priorities.length })}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', marginTop: 13 }}>
                          {priorities.map((p) => {
                            const meta = KIND_META[p.kind]
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => markRead(p.id)}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  border: 0,
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                  background: 'rgba(255,255,255,0.08)',
                                  borderRadius: 'var(--crm-radius-lg)',
                                  padding: 'var(--crm-space-lg) var(--crm-space-xl)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--crm-space-lg)',
                                }}
                              >
                                <span style={{ width: 28, height: 28, borderRadius: 'var(--crm-radius-sm)', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.1)' }}>
                                  <MEIcon name={meta.icon} size={15} color="#FFFFFF" strokeWidth={1.9} />
                                </span>
                                <span
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                    fontSize: 'var(--crm-text-lg)',
                                    fontWeight: 700,
                                    letterSpacing: -0.2,
                                    color: '#FFFFFF',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {p.title}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {GROUPS.map(({ id, labelKey }) => {
                    const list = items.filter((n) => n.group === id)
                    if (list.length === 0) return null
                    return (
                      <div key={id}>
                        <div
                          style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: tk.muted, margin: '20px 4px 8px' }}
                        >
                          {t(labelKey)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>{list.map(renderRow)}</div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
