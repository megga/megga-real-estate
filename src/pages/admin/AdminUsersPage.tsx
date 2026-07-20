/**
 * Page super-admin — annuaire des utilisateurs de la plateforme.
 *
 * Route : `/dashboard/admin/users` (SuperAdminGuard, accent violet). Table (desktop)
 * / cartes (mobile) avec recherche, filtre par rôle, pagination et export CSV. Un clic
 * sur une ligne ouvre `UserDrawer` (détail + impersonation) ; l'agence renvoie vers sa fiche.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Icon2Users as Users, ArrowLeft22 as ChevronLeft, ArrowRight22 as ChevronRight, Download } from '@/components/icons'
import { exportToCsv } from '@/lib/exportCsv'
import { cn, formatDate } from '@/lib/utils'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import type { AdminUser } from '@/hooks/useAdminUsers'
import UserDrawer from '@/components/admin/UserDrawer'
import PageTransition from '@/components/layout/PageTransition'

const ITEMS_PER_PAGE = 10

const ROLE_I18N: Record<string, string> = {
  super_admin: 'common.role.superAdmin',
  admin: 'common.role.admin',
  manager: 'common.role.manager',
  agent: 'common.role.agent',
  assistant: 'common.role.assistant',
}

const ROLE_FILTER_VALUES = ['', 'super_admin', 'admin', 'manager', 'agent', 'assistant']

/** Avatar utilisateur : photo si `avatarUrl`, sinon initiales sur fond déterministe dérivé du nom. */
function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const colors = ['bg-admin-accent', 'bg-accent', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
        decoding="async"
        loading="lazy"
      />
    )
  }

  return (
    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', colors[idx])}>
      <span className="text-xs font-semibold text-white">{initials}</span>
    </div>
  )
}

/** Lignes squelette affichées pendant le chargement de l'annuaire. */
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn('flex items-center px-4 py-3.5 gap-3', i < 4 && 'border-b border-theme-border')}>
          <div className="h-8 w-8 rounded-full bg-theme-hover animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-theme-hover animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-theme-hover animate-pulse" />
          </div>
          <div className="h-3 w-28 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-24 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-16 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-20 rounded bg-theme-hover animate-pulse" />
        </div>
      ))}
    </>
  )
}

/** État vide, distinguant « aucun utilisateur » de « aucun résultat filtré ». */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { t } = useTranslation('admin')
  return (
    <div className="px-4 py-16 text-center">
      <Users className="h-8 w-8 mx-auto text-theme-tertiary mb-3" />
      <p className="text-sm text-theme-secondary font-medium">
        {hasFilters ? t('admin:users.empty.titleFiltered') : t('admin:users.empty.title')}
      </p>
      <p className="text-xs text-theme-tertiary mt-1">
        {hasFilters ? t('admin:users.empty.subtitleFiltered') : t('admin:users.empty.subtitle')}
      </p>
    </div>
  )
}

/** Page : annuaire utilisateurs filtrable/paginé + drawer de détail au clic sur une ligne. */
export default function AdminUsersPage() {
  const { t } = useTranslation('admin')
  const { users, isLoading } = useAdminUsers()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = [...users]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        u => (u.full_name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
      )
    }
    if (roleFilter) list = list.filter(u => u.role === roleFilter)
    return list
  }, [users, search, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function handleRowClick(user: AdminUser) {
    setSelectedUserId(user.id)
  }

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-admin-accent" />
              <span className="text-xs font-medium text-admin-accent">{t('admin:common.adminBadge')}</span>
            </div>
            <h1 className="text-2xl font-semibold text-theme-primary">{t('admin:users.title')}</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {isLoading ? t('admin:common.loading') : t(users.length !== 1 ? 'admin:users.subtitle_plural' : 'admin:users.subtitle', { count: users.length })}
            </p>
          </div>
          <button
            onClick={() => exportToCsv('megga-utilisateurs', users.map(u => ({
              nom: u.full_name, email: u.email, agence: u.agency_name ?? '',
              role: u.role, date: u.created_at,
            })))}
            className="h-9 px-3 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {t('admin:common.export')}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder={t('admin:users.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-1">
            {ROLE_FILTER_VALUES.map((value) => (
              <button
                key={value}
                onClick={() => { setRoleFilter(value); setPage(1) }}
                className={cn(
                  'h-9 px-4 rounded-lg text-sm transition-colors',
                  roleFilter === value
                    ? 'bg-theme-active text-theme-primary font-medium'
                    : 'text-theme-secondary hover:text-theme-primary'
                )}
              >
                {value ? t(ROLE_I18N[value] ?? 'common.role.agent') : t('admin:common.all')}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {isLoading ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-theme-tertiary">{t('admin:common.loading')}</p>
            </div>
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={!!search || !!roleFilter} />
          ) : (
            paginated.map((user) => (
              <button
                key={user.id}
                onClick={() => handleRowClick(user)}
                className="flex items-center gap-3 p-3 w-full text-left rounded-xl border border-theme-border hover:border-theme-active transition-colors"
              >
                <UserAvatar name={user.full_name ?? t('admin:common.user')} avatarUrl={user.avatar_url} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate">{user.full_name ?? t('admin:common.noName')}</p>
                  <p className="text-xs text-theme-tertiary mt-0.5 truncate">
                    {t(ROLE_I18N[user.role] ?? 'common.role.agent')}
                    {user.agency_name && ` · ${user.agency_name}`}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block rounded-xl border border-theme-border">
          {/* Header row */}
          <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary tracking-wide">
            <span className="flex-1">{t('admin:users.table.name')}</span>
            <span className="w-44">{t('admin:users.table.email')}</span>
            <span className="w-28">{t('admin:users.table.agency')}</span>
            <span className="w-24">{t('admin:users.table.role')}</span>
            <span className="w-24">{t('admin:users.table.registration')}</span>
          </div>

          {/* Rows */}
          {isLoading ? (
            <SkeletonRows />
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={!!search || !!roleFilter} />
          ) : (
            paginated.map((user, i) => (
              <button
                key={user.id}
                onClick={() => handleRowClick(user)}
                className={cn(
                  'flex items-center px-4 py-3 w-full text-left group hover:bg-theme-hover transition-colors',
                  i < paginated.length - 1 && 'border-b border-theme-border'
                )}
              >
                {/* Name + avatar */}
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <UserAvatar name={user.full_name ?? t('admin:common.user')} avatarUrl={user.avatar_url} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-theme-primary truncate group-hover:text-admin-accent transition-colors">
                      {user.full_name ?? t('admin:common.noName')}
                    </p>
                    {user.phone && (
                      <p className="text-xs text-theme-tertiary truncate">{user.phone}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <span className="w-44 text-xs text-theme-secondary truncate">
                  {user.email}
                </span>

                {/* Agency */}
                <span className="w-28 text-xs text-theme-secondary truncate">
                  {user.agency_name ? (
                    <Link
                      to={`/dashboard/admin/agencies/${user.agency_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-admin-accent transition-colors"
                    >
                      {user.agency_name}
                    </Link>
                  ) : (
                    <span className="text-theme-tertiary">—</span>
                  )}
                </span>

                {/* Role */}
                <span className="w-24">
                  <span className={cn(
                    'text-xs font-medium',
                    user.role === 'super_admin' ? 'text-admin-accent' :
                    user.role === 'admin' ? 'text-amber-500' :
                    'text-theme-secondary'
                  )}>
                    {t(ROLE_I18N[user.role] ?? 'common.role.agent')}
                  </span>
                </span>

                {/* Date */}
                <span className="w-24 text-xs text-theme-tertiary">
                  {formatDate(user.created_at)}
                </span>
              </button>
            ))
          )}

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-theme-border">
              <p className="text-xs text-theme-tertiary">
                {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} {t('admin:common.on')} {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  aria-label={t('admin:common.previousPage')}
                  className="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - safePage) <= 2 || p === 1 || p === totalPages)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1]
                    const showEllipsis = prev !== undefined && p - prev > 1
                    return (
                      <span key={p} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-xs text-theme-tertiary">...</span>}
                        <button
                          onClick={() => setPage(p)}
                          className={cn(
                            'h-7 min-w-[28px] px-2 rounded-md text-xs font-medium transition-colors',
                            p === safePage ? 'bg-admin-accent text-white' : 'text-theme-secondary hover:text-theme-primary'
                          )}
                        >
                          {p}
                        </button>
                      </span>
                    )
                  })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  aria-label={t('admin:common.nextPage')}
                  className="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile pagination */}
        {!isLoading && filtered.length > ITEMS_PER_PAGE && (
          <div className="md:hidden flex items-center justify-between px-2 py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="min-h-[44px] px-3 rounded-lg text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 border border-theme-border transition-colors"
            >
              {t('admin:common.previous')}
            </button>
            <span className="text-xs text-theme-tertiary">{safePage}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="min-h-[44px] px-3 rounded-lg text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 border border-theme-border transition-colors"
            >
              {t('admin:common.next')}
            </button>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedUserId && (
        <UserDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </PageTransition>
  )
}
