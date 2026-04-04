import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Bell, X, Building2, ShieldAlert, CreditCard, AlertTriangle, MessageSquare, Check } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'

// ─── Action type → icon + label mapping ──────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  agency_created: { icon: Building2, label: 'Nouvelle agence' },
  kyc_screening_match: { icon: ShieldAlert, label: 'Alerte PEP/Sanctions' },
  subscription_cancelled: { icon: CreditCard, label: 'Abonnement annule' },
  edge_function_error: { icon: AlertTriangle, label: 'Erreur systeme' },
  ticket_created: { icon: MessageSquare, label: 'Nouveau ticket' },
}

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? { icon: Bell, label: action }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminNotificationPanel() {
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useAdminNotifications()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <>
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Notifications admin"
        className="relative w-full flex items-center justify-center h-9 rounded-lg text-theme-secondary hover:bg-theme-hover hover:text-theme-primary transition-colors"
      >
        <Bell className="w-[18px] h-[18px] stroke-[1.8]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel (portal) */}
      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed top-14 right-4 w-[380px] max-h-[500px] bg-theme-card border border-theme-border rounded-xl z-[100] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border shrink-0">
            <span className="text-sm font-semibold text-theme-primary">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-theme-secondary hover:text-theme-primary transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Tout marquer lu
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer les notifications"
                className="p-1 rounded-md hover:bg-theme-hover transition-colors text-theme-tertiary hover:text-theme-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-theme-border border-t-admin-accent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-theme-muted">
                <Bell className="w-8 h-8 mb-2 opacity-40" />
                <span className="text-sm">Aucune notification</span>
              </div>
            ) : (
              notifications.map((notif) => {
                const config = getActionConfig(notif.action)
                const Icon = config.icon
                return (
                  <button
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-theme-hover transition-colors border-b border-theme-border-subtle last:border-b-0',
                      !notif.read && 'bg-admin-accent/5'
                    )}
                  >
                    {/* Icon */}
                    <div className="mt-0.5 shrink-0">
                      <Icon className={cn('w-4 h-4', !notif.read ? 'text-admin-accent' : 'text-theme-tertiary')} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm', !notif.read ? 'font-medium text-theme-primary' : 'text-theme-secondary')}>
                          {config.label}
                        </span>
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-admin-accent shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-theme-muted">
                        {notif.entity_type}{notif.entity_id ? ` #${notif.entity_id.slice(0, 8)}` : ''}
                      </span>
                    </div>

                    {/* Timestamp */}
                    <span className="text-[11px] text-theme-muted whitespace-nowrap shrink-0 mt-0.5">
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
