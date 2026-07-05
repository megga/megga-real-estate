import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, Mail, Phone, Building2, Clock, Eye, FileDown, Ban, KeyRound, Trash2 } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useAdminUsers, useUserActivity, useDsarExport } from '@/hooks/useAdminUsers'
import { useAdminUserLifecycle } from '@/hooks/useAdminUserLifecycle'
import { useImpersonate } from '@/hooks/useImpersonate'
import { useToast } from '@/components/ui/Toast'

const ROLE_OPTIONS = [
  { value: 'super_admin', i18nKey: 'common.role.superAdmin' },
  { value: 'admin', i18nKey: 'common.role.admin' },
  { value: 'manager', i18nKey: 'common.role.manager' },
  { value: 'agent', i18nKey: 'common.role.agent' },
  { value: 'assistant', i18nKey: 'common.role.assistant' },
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
  const { t } = useTranslation('admin')
  const { users, updateRole } = useAdminUsers()
  const { data: activity, isLoading: activityLoading } = useUserActivity(userId)
  const { startImpersonate } = useImpersonate()
  const dsarExport = useDsarExport()
  const { lifecycle, deleteAccount } = useAdminUserLifecycle()
  const toast = useToast()

  const user = users.find(u => u.id === userId)
  const focusTrapRef = useFocusTrap(true)

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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div ref={focusTrapRef} className="relative w-[380px] max-w-full bg-theme-card border-l border-theme-border h-full overflow-y-auto scrollbar-hide">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label={t('userDrawer.close')}
          className="absolute top-4 right-4 p-1.5 rounded-md text-theme-secondary hover:text-theme-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {!user ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-theme-tertiary">{t('userDrawer.notFound')}</p>
          </div>
        ) : (
          <div className="px-6 py-6 space-y-6">
            {/* User header */}
            <div className="flex flex-col items-center text-center pt-2">
              <UserAvatar name={user.full_name ?? 'Utilisateur'} avatarUrl={user.avatar_url} />
              <h2 className="text-lg font-semibold text-theme-primary mt-3">
                {user.full_name ?? t('common.noName')}
                {user.is_suspended && (
                  <span className="ml-2 text-xs font-medium text-red-500">{t('common.status.suspended')}</span>
                )}
              </h2>
              <p className="text-sm text-theme-secondary mt-0.5">{user.email}</p>
            </div>

            {/* Info fields */}
            <div className="rounded-xl border border-theme-border divide-y divide-theme-border">
              {/* Phone */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Phone className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                <span className="text-sm text-theme-secondary w-20 flex-shrink-0">{t('userDrawer.phone')}</span>
                <span className="text-sm text-theme-primary">
                  {user.phone || <span className="text-theme-tertiary">{t('common.notProvided')}</span>}
                </span>
              </div>

              {/* Email */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Mail className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                <span className="text-sm text-theme-secondary w-20 flex-shrink-0">{t('userDrawer.email')}</span>
                <span className="text-sm text-theme-primary truncate">{user.email}</span>
              </div>

              {/* Agency */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Building2 className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                <span className="text-sm text-theme-secondary w-20 flex-shrink-0">{t('userDrawer.agency')}</span>
                {user.agency_name && user.agency_id ? (
                  <Link
                    to={`/dashboard/admin/agencies/${user.agency_id}`}
                    onClick={onClose}
                    className="text-sm text-admin-accent hover:underline truncate"
                  >
                    {user.agency_name}
                  </Link>
                ) : (
                  <span className="text-sm text-theme-tertiary">{t('common.none')}</span>
                )}
              </div>

              {/* Created at */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Clock className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                <span className="text-sm text-theme-secondary w-20 flex-shrink-0">{t('userDrawer.registration')}</span>
                <span className="text-sm text-theme-primary">
                  {formatRelativeDate(user.created_at)}
                </span>
              </div>
            </div>

            {/* Role selector */}
            <div>
              <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
                {t('userDrawer.role')}
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
                  <option key={opt.value} value={opt.value}>{t(opt.i18nKey)}</option>
                ))}
              </select>
              {updateRole.isError && (
                <p className="text-xs text-red-500 mt-1">{t('userDrawer.roleUpdateError')}</p>
              )}
            </div>

            {/* Impersonate button */}
            <button
              onClick={async () => {
                // Audit-first : l'impersonation ne s'active que si l'événement
                // d'audit serveur a été journalisé (RPC admin_log_impersonation).
                const ok = await startImpersonate({
                  id: user.id,
                  full_name: user.full_name ?? 'Utilisateur',
                  email: user.email,
                  role: user.role ?? 'agent',
                  agency_id: user.agency_id,
                  agency_name: user.agency_name,
                })
                if (!ok) {
                  toast.error(t('userDrawer.impersonateAuditFailed'))
                  return
                }
                onClose()
              }}
              className="w-full h-9 flex items-center justify-center gap-2 text-sm font-medium border border-admin-accent/30 text-admin-accent rounded-lg hover:bg-admin-accent/5 transition-colors"
            >
              <Eye className="h-4 w-4" />
              {t('userDrawer.impersonate')}
            </button>

            {/* Export DSAR (nLPD art. 25) — JSON journalisé côté serveur */}
            <button
              onClick={() =>
                dsarExport.mutate(
                  { userId: user.id, email: user.email },
                  { onError: () => toast.error(t('userDrawer.dsarExportError')) },
                )
              }
              disabled={dsarExport.isPending}
              className="w-full h-9 flex items-center justify-center gap-2 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:bg-theme-hover transition-colors disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              {dsarExport.isPending ? t('userDrawer.dsarExporting') : t('userDrawer.dsarExport')}
            </button>

            {/* Cycle de vie du compte (P4) — actions journalisées serveur ;
                les comptes allowlistés sont refusés par l'edge (anti-lockout). */}
            <div className="space-y-2 border-t border-theme-border-subtle pt-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const action = user.is_suspended ? 'reactivate' : 'suspend'
                    if (action === 'suspend' && !window.confirm(t('userDrawer.lifecycle.suspendConfirm', { email: user.email }))) return
                    lifecycle.mutate(
                      { action, userId: user.id },
                      {
                        onSuccess: () => toast.success(t('userDrawer.lifecycle.done')),
                        onError: () => toast.error(t('userDrawer.lifecycle.error')),
                      },
                    )
                  }}
                  disabled={lifecycle.isPending}
                  className={cn(
                    'h-9 flex items-center justify-center gap-2 text-sm font-medium border rounded-lg transition-colors disabled:opacity-50',
                    user.is_suspended
                      ? 'border-theme-border text-theme-secondary hover:bg-theme-hover'
                      : 'border-amber-500/30 text-amber-500 hover:bg-amber-500/5',
                  )}
                >
                  <Ban className="h-4 w-4" />
                  {user.is_suspended ? t('userDrawer.lifecycle.reactivate') : t('userDrawer.lifecycle.suspend')}
                </button>
                <button
                  onClick={() =>
                    lifecycle.mutate(
                      { action: 'force_password_reset', userId: user.id },
                      {
                        onSuccess: () => toast.success(t('userDrawer.lifecycle.resetSent')),
                        onError: () => toast.error(t('userDrawer.lifecycle.error')),
                      },
                    )
                  }
                  disabled={lifecycle.isPending}
                  className="h-9 flex items-center justify-center gap-2 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:bg-theme-hover transition-colors disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  {t('userDrawer.lifecycle.resetPassword')}
                </button>
              </div>
              <button
                onClick={() => {
                  // Confirmation typée : l'admin doit saisir l'email exact du compte.
                  const typed = window.prompt(t('userDrawer.lifecycle.deletePrompt', { email: user.email }))
                  if (typed === null) return
                  if (typed.trim().toLowerCase() !== user.email.toLowerCase()) {
                    toast.error(t('userDrawer.lifecycle.deleteMismatch'))
                    return
                  }
                  deleteAccount.mutate(
                    { userId: user.id },
                    {
                      onSuccess: () => {
                        toast.success(t('userDrawer.lifecycle.deleted'))
                        onClose()
                      },
                      onError: () => toast.error(t('userDrawer.lifecycle.error')),
                    },
                  )
                }}
                disabled={deleteAccount.isPending}
                className="w-full h-9 flex items-center justify-center gap-2 text-sm font-medium border border-red-500/30 text-red-500 rounded-lg hover:bg-red-500/5 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleteAccount.isPending ? t('userDrawer.lifecycle.deleting') : t('userDrawer.lifecycle.delete')}
              </button>
            </div>

            {/* Activity timeline */}
            <div>
              <h3 className="text-xs font-medium text-theme-secondary mb-3">{t('userDrawer.recentActivity')}</h3>

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
                <p className="text-xs text-theme-tertiary py-4 text-center">{t('userDrawer.noActivity')}</p>
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
                            <span className="text-theme-secondary"> {t('userDrawer.actionOn')} {event.entity_type}</span>
                          )}
                        </p>
                        <p className="text-xs text-theme-tertiary mt-0.5">
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
