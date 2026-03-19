import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  X,
  UserPlus,
  MessageSquare,
  CalendarDays,
  HandCoins,
  ShieldCheck,
  Building2,
  Clock,
  Info,
  Check,
  CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications, type NotificationType } from '@/hooks/useNotifications'
import { formatRelativeDate } from '@/lib/utils'

// ─── NOTIFICATION CONFIG ────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; color: string; bg: string }> = {
  new_lead: { icon: UserPlus, color: 'text-accent', bg: 'bg-accent/10' },
  message: { icon: MessageSquare, color: 'text-sky-600', bg: 'bg-sky-50' },
  visit_scheduled: { icon: CalendarDays, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  offer_received: { icon: HandCoins, color: 'text-amber-600', bg: 'bg-amber-50' },
  kyc_update: { icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-50' },
  listing_update: { icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50' },
  calendar_reminder: { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  system: { icon: Info, color: 'text-gray-500', bg: 'bg-gray-100' },
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
      >
        <Bell className="w-[18px] h-[18px] text-gray-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-xl shadow-dropdown border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-accent hover:text-accent/80 font-medium px-2 py-1 rounded hover:bg-accent/5 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Tout lire
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune notification</p>
              </div>
            ) : (
              notifications.map(notification => {
                const config = TYPE_CONFIG[notification.type]
                const Icon = config.icon

                const content = (
                  <div
                    className={cn(
                      'flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-b-0',
                      !notification.read && 'bg-accent/[0.02]'
                    )}
                    onClick={() => {
                      markAsRead(notification.id)
                      if (notification.link) setOpen(false)
                    }}
                  >
                    {/* Icon */}
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', config.bg)}>
                      <Icon className={cn('w-4 h-4', config.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm leading-tight', notification.read ? 'text-gray-600' : 'text-gray-900 font-medium')}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-gray-300 mt-1">
                        {formatRelativeDate(notification.created_at)}
                      </p>
                    </div>

                    {/* Read indicator */}
                    {notification.read && (
                      <Check className="w-3 h-3 text-gray-300 flex-shrink-0 mt-1" />
                    )}
                  </div>
                )

                if (notification.link) {
                  return (
                    <Link key={notification.id} to={notification.link} className="block">
                      {content}
                    </Link>
                  )
                }
                return <div key={notification.id}>{content}</div>
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <Link
              to="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="text-[11px] text-gray-400 hover:text-accent transition-colors"
            >
              Gérer les préférences de notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
