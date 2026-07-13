import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ShieldCheck, AlertTriangle, Trash2, Check, Building2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/exportCsv'
import { cn, formatCHF, formatDate } from '@/lib/utils'
import { useAdminModeration } from '@/hooks/useAdminModeration'
import type { ModerationListing } from '@/hooks/useAdminModeration'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import ModerationActionDialog from '@/components/admin/ModerationActionDialog'
import PageTransition from '@/components/layout/PageTransition'

const ITEMS_PER_PAGE = 15

const STATUS_FILTER_KEYS = [
  { value: '', key: 'marketplace.filter.all' },
  { value: 'published', key: 'marketplace.filter.published' },
  { value: 'flagged', key: 'marketplace.filter.flagged' },
  { value: 'removed', key: 'marketplace.filter.removed' },
] as const

const STATUS_DOT: Record<string, string> = {
  published: 'bg-emerald-500',
  flagged: 'bg-amber-500',
  removed: 'bg-red-500',
}

const STATUS_LABEL_KEY: Record<string, string> = {
  published: 'common.status.published',
  flagged: 'common.status.flagged',
  removed: 'common.status.removed',
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn('flex items-center px-4 py-3 gap-3', i < 5 && 'border-b border-theme-border')}>
          <div className="h-10 w-16 rounded bg-theme-hover animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-40 rounded bg-theme-hover animate-pulse" />
            <div className="h-2.5 w-24 rounded bg-theme-hover animate-pulse" />
          </div>
          <div className="h-3 w-20 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-10 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-16 rounded bg-theme-hover animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-theme-hover animate-pulse" />
        </div>
      ))}
    </>
  )
}

function EmptyState({ hasFilters, t }: { hasFilters: boolean; t: (key: string) => string }) {
  return (
    <div className="px-4 py-16 text-center">
      <ShieldCheck className="h-8 w-8 mx-auto text-theme-tertiary mb-3" />
      <p className="text-sm text-theme-secondary font-medium">
        {hasFilters ? t('admin:marketplace.empty.titleFiltered') : t('admin:marketplace.empty.title')}
      </p>
      <p className="text-xs text-theme-tertiary mt-1">
        {hasFilters ? t('admin:marketplace.empty.subtitleFiltered') : t('admin:marketplace.empty.subtitle')}
      </p>
    </div>
  )
}

export default function AdminMarketplacePage() {
  const { t } = useTranslation('admin')
  const { listings, isLoading, stats, statsLoading, moderate } = useAdminModeration()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<'flag' | 'remove'>('flag')
  const [dialogListing, setDialogListing] = useState<ModerationListing | null>(null)

  const filtered = useMemo(() => {
    let list = [...listings]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        (l.title ?? '').toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q) ||
        (l.agency_name ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      list = list.filter(l => l.moderation_status === statusFilter)
    }
    return list
  }, [listings, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function openDialog(listing: ModerationListing, action: 'flag' | 'remove') {
    setDialogListing(listing)
    setDialogAction(action)
    setDialogOpen(true)
  }

  function handleApprove(e: React.MouseEvent, listing: ModerationListing) {
    e.stopPropagation()
    moderate.mutate({ propertyId: listing.id, action: 'approve' })
  }

  function handleDialogConfirm(reason: string) {
    if (!dialogListing) return
    moderate.mutate({ propertyId: dialogListing.id, action: dialogAction, reason })
    setDialogOpen(false)
    setDialogListing(null)
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
            <h1 className="text-2xl font-semibold text-theme-primary">{t('admin:marketplace.title')}</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {isLoading ? t('admin:common.loading') : t('admin:marketplace.subtitle', { count: listings.length })}
            </p>
          </div>
          <button
            onClick={() => exportToCsv('megga-moderation', listings.map(l => ({
              titre: l.title, agence: l.agency_name ?? '', prix: l.price,
              canton: l.canton ?? '', statut: l.moderation_status, date: l.published_at ?? '',
            })))}
            className="h-9 px-3 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {t('admin:common.export')}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <AdminKpiCard
            label={t('admin:marketplace.kpi.published')}
            value={statsLoading ? '-' : (stats?.totalPublished ?? 0)}
            icon={ShieldCheck}
          />
          <AdminKpiCard
            label={t('admin:marketplace.kpi.flaggedThisMonth')}
            value={statsLoading ? '-' : (stats?.flaggedThisMonth ?? 0)}
            icon={AlertTriangle}
            variant={stats?.flaggedThisMonth ? 'danger' : 'default'}
          />
          <AdminKpiCard
            label={t('admin:marketplace.kpi.removedThisMonth')}
            value={statsLoading ? '-' : (stats?.removedThisMonth ?? 0)}
            icon={Trash2}
            variant={stats?.removedThisMonth ? 'danger' : 'default'}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder={t('admin:marketplace.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-1">
            {STATUS_FILTER_KEYS.map((f) => (
              <button
                key={f.value}
                onClick={() => { setStatusFilter(f.value); setPage(1) }}
                className={cn(
                  'h-9 px-4 rounded-lg text-sm transition-colors',
                  statusFilter === f.value
                    ? 'bg-theme-active text-theme-primary font-medium'
                    : 'text-theme-secondary hover:text-theme-primary'
                )}
              >
                {t(`admin:${f.key}`)}
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
            <EmptyState hasFilters={!!search || !!statusFilter} t={t} />
          ) : (
            paginated.map((listing) => {
              const dotColor = STATUS_DOT[listing.moderation_status] ?? STATUS_DOT.published
              const statusLabelKey = STATUS_LABEL_KEY[listing.moderation_status] ?? STATUS_LABEL_KEY.published
              return (
                <div
                  key={listing.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-theme-border group"
                >
                  {listing.photos[0] ? (
                    <img
                      src={listing.photos[0]}
                      alt=""
                      className="h-12 w-20 rounded-lg object-cover flex-shrink-0"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="h-12 w-20 rounded-lg bg-theme-hover flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-theme-tertiary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-theme-primary truncate">{listing.title || t('admin:common.noTitle')}</p>
                    <p className="text-xs text-theme-tertiary mt-0.5">
                      {formatCHF(listing.price)}
                      {listing.canton ? ` · ${listing.canton}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('h-2 w-2 rounded-full', dotColor)} />
                    <span className="text-xs text-theme-secondary">{t(`admin:${statusLabelKey}`)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block rounded-xl border border-theme-border">
          {/* Header row */}
          <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary tracking-wide">
            <span className="w-20" />
            <span className="flex-1">{t('admin:marketplace.table.title')}</span>
            <span className="w-28">{t('admin:marketplace.table.agency')}</span>
            <span className="w-28 text-right">{t('admin:marketplace.table.price')}</span>
            <span className="w-14 text-center">{t('admin:marketplace.table.canton')}</span>
            <span className="w-24">{t('admin:marketplace.table.date')}</span>
            <span className="w-20 text-center">{t('admin:marketplace.table.status')}</span>
            <span className="w-28" />
          </div>

          {/* Rows */}
          {isLoading ? (
            <SkeletonRows />
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={!!search || !!statusFilter} t={t} />
          ) : (
            paginated.map((listing, i) => {
              const dotColor = STATUS_DOT[listing.moderation_status] ?? STATUS_DOT.published
              const statusLabelKey = STATUS_LABEL_KEY[listing.moderation_status] ?? STATUS_LABEL_KEY.published
              return (
                <div
                  key={listing.id}
                  className={cn(
                    'flex items-center px-4 py-3 group hover:bg-theme-hover transition-colors',
                    i < paginated.length - 1 && 'border-b border-theme-border'
                  )}
                >
                  {/* Thumbnail */}
                  {listing.photos[0] ? (
                    <img
                      src={listing.photos[0]}
                      alt=""
                      className="h-10 w-16 rounded object-cover flex-shrink-0"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="h-10 w-16 rounded bg-theme-hover flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-theme-tertiary" />
                    </div>
                  )}

                  {/* Title */}
                  <div className="flex-1 min-w-0 pl-3">
                    <p className="text-sm font-medium text-theme-primary truncate">
                      {listing.title || t('admin:common.noTitle')}
                    </p>
                    {listing.city && (
                      <p className="text-xs text-theme-tertiary truncate">{listing.city}</p>
                    )}
                  </div>

                  {/* Agency */}
                  <span className="w-28 text-xs text-theme-secondary truncate">
                    {listing.agency_name ?? '-'}
                  </span>

                  {/* Price */}
                  <span className="w-28 text-xs text-theme-secondary text-right">
                    {formatCHF(listing.price)}
                  </span>

                  {/* Canton */}
                  <span className="w-14 text-xs text-theme-secondary text-center">
                    {listing.canton ?? '-'}
                  </span>

                  {/* Date */}
                  <span className="w-24 text-xs text-theme-tertiary">
                    {listing.published_at ? formatDate(listing.published_at) : '-'}
                  </span>

                  {/* Status */}
                  <div className="w-20 flex items-center justify-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', dotColor)} />
                    <span className="text-xs text-theme-secondary">{t(`admin:${statusLabelKey}`)}</span>
                  </div>

                  {/* Hover actions */}
                  <div className="w-28 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {listing.moderation_status !== 'published' && (
                      <button
                        onClick={(e) => handleApprove(e, listing)}
                        title={t('admin:marketplace.action.approve')}
                        className="h-7 w-7 rounded-md flex items-center justify-center border border-theme-border text-emerald-500 hover:border-emerald-500 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); openDialog(listing, 'flag') }}
                      title={t('admin:marketplace.action.flag')}
                      className="h-7 w-7 rounded-md flex items-center justify-center border border-theme-border text-amber-500 hover:border-amber-500 transition-colors"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openDialog(listing, 'remove') }}
                      title={t('admin:marketplace.action.remove')}
                      className="h-7 w-7 rounded-md flex items-center justify-center border border-theme-border text-red-500 hover:border-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
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
        {/* Les files entrantes (leads vendeurs + messages storefront) ont déménagé
            vers « Clients finaux » (P6b) — cette page redevient modération pure. */}
      </div>

      {/* Moderation dialog */}
      <ModerationActionDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDialogListing(null) }}
        propertyTitle={dialogListing?.title || t('admin:common.noTitle')}
        propertyPhoto={dialogListing?.photos[0]}
        action={dialogAction}
        onConfirm={handleDialogConfirm}
      />
    </PageTransition>
  )
}
