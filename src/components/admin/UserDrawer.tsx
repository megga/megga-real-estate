import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X, Mail, Phone, Building2, Clock } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useAdminUsers, useUserActivity } from '@/hooks/useAdminUsers'

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'agent', label: 'Agent' },
  { value: 'assistant', label: 'Assistant' },
]

interface UserDrawerProps {
  userId: string
  onClose: () => void
}

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const colors = ['bg-admin-accent', 'bg-accent', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-16 w-16 rounded-full object-cover"
        decoding="async"
        loading="lazy"
      />
    )
  }

  return (
    <div className={cn('h-16 w-16 rounded-full flex items-center justify-center', colors[idx])}>
      <span className="text-lg font-semibold text-white">{initials}</span>
    </div>
  )
}

export default function UserDrawer({ userId, onClose }: UserDrawerProps) {
  const { users, updateRole } = useAdminUsers()
  const { data: activity, isLoading: activityLoading } = useUserActivity(userId)

  const user = users.find(u => u.id === userId)

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleRoleChange(newRole: string) {
    updateRole.mutate({ id: userId, role: newRole })
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="relative w-[380px] max-w-full bg-theme-card border-l border-theme-border h-full overflow-y-auto scrollbar-hide">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 p-1.5 rounded-md text-theme-secondary hover:text-theme-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {!user ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-theme-tertiary">Utilisateur introuvable</p>
          </div>
        ) : (
          <div className="px-6 py-6 space-y-6">
            {/* User header */}
            <div className="flex flex-col items-center text-center pt-2">
              <UserAvatar name={user.full_name ?? 'Utilisateur'} avatarUrl={user.avatar_url} />
              <h2 className="text-lg font-semibold text-theme-primary mt-3">
                {user.full_name ?? 'Sans nom'}
              </h2>
              <p className="text-sm text-theme-secondary mt-0.5">{user.email}</p>
            </div>

            {/* Info fields */}
            <div className="rounded-xl border border-theme-border divide-y divide-theme-border">
              {/* Phone */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Phone className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                <span className="text-sm text-theme-secondary w-20 flex-shrink-0">Telephone</span>
                <span className="text-sm text-theme-primary">
                  {user.phone || <span className="text-theme-tertiary">Non renseigne</span>}
                </span>
              </div>

              {/* Email */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Mail className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                <span className="text-sm text-theme-secondary w-20 flex-shrink-0">Email</span>
                <span className="text-sm text-theme-primary truncate">{user.email}</span>
              </div>

              {/* Agency */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Building2 className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                <span className="text-sm text-theme-secondary w-20 flex-shrink-0">Agence</span>
                {user.agency_name && user.agency_id ? (
                  <Link
                    to={`/dashboard/admin/agencies/${user.agency_id}`}
                    onClick={onClose}
                    className="text-sm text-admin-accent hover:underline truncate"
                  >
                    {user.agency_name}
                  </Link>
                ) : (
                  <span className="text-sm text-theme-tertiary">Aucune</span>
                )}
              </div>

              {/* Created at */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Clock className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                <span className="text-sm text-theme-secondary w-20 flex-shrink-0">Inscription</span>
                <span className="text-sm text-theme-primary">
                  {formatRelativeDate(user.created_at)}
                </span>
              </div>
            </div>

            {/* Role selector */}
            <div>
              <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
                Role
              </label>
              <select
                value={user.role ?? 'agent'}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={updateRole.isPending}
                className={cn(
                  'w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors',
                  'text-theme-primary',
                  updateRole.isPending && 'opacity-60'
                )}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {updateRole.isError && (
                <p className="text-xs text-red-500 mt-1">Erreur lors de la mise a jour du role</p>
              )}
            </div>

            {/* Activity timeline */}
            <div>
              <h3 className="text-xs font-medium text-theme-secondary mb-3">Activite recente</h3>

              {activityLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="h-2 w-2 rounded-full bg-theme-hover animate-pulse mt-1.5" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 w-40 rounded bg-theme-hover animate-pulse" />
                        <div className="h-2.5 w-20 rounded bg-theme-hover animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !activity || activity.length === 0 ? (
                <p className="text-xs text-theme-tertiary py-4 text-center">Aucune activite recente</p>
              ) : (
                <div className="space-y-0.5">
                  {activity.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-theme-hover transition-colors"
                    >
                      <div className="h-2 w-2 rounded-full bg-admin-accent mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-theme-primary">
                          <span className="font-medium">{event.action}</span>
                          {event.entity_type && (
                            <span className="text-theme-secondary"> sur {event.entity_type}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-theme-tertiary mt-0.5">
                          {formatRelativeDate(event.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
