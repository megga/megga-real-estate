import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Search, Plus, LayoutGrid, List, ChevronLeft, ChevronRight, ChevronDown,
  Loader2, Trash2, Pencil,
} from 'lucide-react'
import { cn, formatCHF, formatSurface, formatRelativeDate } from '@/lib/utils'
import { PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS } from '@/lib/constants'
import type { PropertyStatus } from '@/lib/constants'
import { useAgencyProperties, useDeleteProperty } from '@/hooks/useProperties'
import PageTransition from '@/components/layout/PageTransition'

const ITEMS_PER_PAGE = 9

const STATUS_DOT: Record<PropertyStatus, string> = {
  draft: 'bg-gray-400',
  active: 'bg-emerald-400',
  reserved: 'bg-amber-400',
  sold: 'bg-blue-400',
  archived: 'bg-gray-400',
}

interface AgentListing {
  id: string
  title: string
  type: PropertyStatus extends string ? string : string
  status: PropertyStatus
  price: number
  address: string
  city: string
  canton: string
  rooms: number
  bedrooms: number
  surface_m2: number
  photo: string
  views_count: number
  favorites_count: number
  created_at: string
  published_at: string | null
  updated_at: string
}

const selectClasses = 'h-9 px-3 pr-8 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none'

export default function ListingsPage() {
  const { t } = useTranslation('listings')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { data: properties, isLoading } = useAgencyProperties()
  const deleteProperty = useDeleteProperty()

  // Map properties to flat listing objects
  const dataSource: AgentListing[] = useMemo(() => {
    if (!properties) return []
    return properties.map(p => {
      const listing = p.listing?.[0]
      return {
        id: p.id,
        title: p.title,
        type: p.type,
        status: p.status as PropertyStatus,
        price: p.price ?? 0,
        address: p.address ?? '',
        city: p.city ?? '',
        canton: p.canton ?? '',
        rooms: p.rooms ?? 0,
        bedrooms: p.bedrooms ?? 0,
        surface_m2: p.surface_m2 ?? 0,
        photo: (p.photos ?? [])[0] ?? '',
        views_count: listing?.views_count ?? 0,
        favorites_count: listing?.favorites_count ?? 0,
        created_at: p.created_at ?? '',
        published_at: p.published_at ?? null,
        updated_at: p.updated_at ?? p.created_at ?? '',
      }
    })
  }, [properties])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: dataSource.length }
    for (const l of dataSource) counts[l.status] = (counts[l.status] || 0) + 1
    return counts
  }, [dataSource])

  const filtered = useMemo(() => {
    let list = [...dataSource]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((l) => l.title.toLowerCase().includes(q) || l.city.toLowerCase().includes(q))
    }
    if (statusFilter) list = list.filter((l) => l.status === statusFilter)
    if (typeFilter) list = list.filter((l) => l.type === typeFilter)
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [dataSource, search, statusFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const hasFilters = search || statusFilter || typeFilter

  function handleDelete() {
    if (!deleteId) return
    deleteProperty.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
  }

  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-theme-muted" />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">{t('title')}</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">{t('count', { count: dataSource.length })}</p>
          </div>
          <Link
            to="/dashboard/listings/new"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('add_button')}
          </Link>
        </div>

        {/* Status tabs + filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center border border-theme-border rounded-lg p-0.5">
            {[
              { key: '', label: t('tab.all'), count: statusCounts.all },
              { key: 'active', label: t('tab.active'), count: statusCounts.active || 0 },
              { key: 'draft', label: t('tab.drafts'), count: statusCounts.draft || 0 },
              { key: 'reserved', label: t('tab.reserved'), count: statusCounts.reserved || 0 },
              { key: 'sold', label: t('tab.sold'), count: statusCounts.sold || 0 },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); setPage(1) }}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  statusFilter === tab.key ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
                )}
              >
                {tab.label} <span className="text-theme-tertiary ml-0.5">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="ml-auto flex items-center border border-theme-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 rounded-md transition-colors', viewMode === 'grid' ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary')}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Search + type filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder={t('search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="relative">
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} className={selectClasses}>
              <option value="">{t('filter_type')}</option>
              <option value="apartment">{t('type.apartment')}</option>
              <option value="house">{t('type.house')}</option>
              <option value="villa">{t('type.villa')}</option>
              <option value="commercial">{t('type.commercial')}</option>
              <option value="land">{t('type.land')}</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          {hasFilters && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1) }} className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors">
              {t('clear')}
            </button>
          )}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-16 rounded-xl border border-theme-border">
            <p className="text-sm text-theme-tertiary mb-4">
              {dataSource.length === 0 ? t('empty_no_properties') : t('empty_no_results')}
            </p>
            {dataSource.length === 0 && (
              <Link
                to="/dashboard/listings/new"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('add_button')}
              </Link>
            )}
          </div>
        )}

        {/* Grid view */}
        {filtered.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map((listing) => (
              <div key={listing.id} className="rounded-xl border border-theme-border overflow-hidden group hover:border-theme-active transition-colors">
                {/* Photo */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  {listing.photo ? (
                    <img src={listing.photo} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full bg-theme-section flex items-center justify-center">
                      <span className="text-xs text-theme-muted">{t('no_photo')}</span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-md">
                    <div className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[listing.status])} />
                    {PROPERTY_STATUS_LABELS[listing.status]}
                  </div>
                  {/* Hover actions */}
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/dashboard/listings/${listing.id}/edit`}
                      className="h-7 w-7 rounded-md bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteId(listing.id) }}
                      className="h-7 w-7 rounded-md bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="text-lg font-semibold text-theme-primary">{formatCHF(listing.price)}</p>
                  <p className="text-sm font-medium text-theme-primary mt-1 truncate">{listing.title}</p>
                  <p className="text-xs text-theme-tertiary mt-0.5 truncate">{listing.address}{listing.city ? `, ${listing.city}` : ''}</p>

                  {listing.rooms > 0 && (
                    <p className="text-xs text-theme-tertiary mt-2">
                      {listing.rooms}p · {listing.bedrooms}ch · {formatSurface(listing.surface_m2)}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-theme-border text-xs text-theme-tertiary">
                    <span>{PROPERTY_TYPE_LABELS[listing.type as keyof typeof PROPERTY_TYPE_LABELS] ?? listing.type}</span>
                    <span>{formatRelativeDate(listing.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {filtered.length > 0 && viewMode === 'list' && (
          <div className="rounded-xl border border-theme-border">
            <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary capitalize">
              <span className="flex-1">{t('column.property')}</span>
              <span className="w-24 hidden md:block">{t('column.type')}</span>
              <span className="w-24">{t('column.status')}</span>
              <span className="w-28 text-right">{t('column.price')}</span>
              <span className="w-24 text-right hidden sm:block">{t('column.activity')}</span>
              <span className="w-16" />
            </div>

            {paginated.map((listing, i) => (
              <div
                key={listing.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 hover:bg-theme-hover transition-colors group',
                  i < paginated.length - 1 && 'border-b border-theme-border'
                )}
              >
                {listing.photo ? (
                  <img src={listing.photo} alt={listing.title} className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-theme-section shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate">{listing.title}</p>
                  <p className="text-xs text-theme-tertiary truncate">{listing.address}{listing.city ? `, ${listing.city}` : ''}</p>
                </div>
                <span className="w-24 text-xs text-theme-secondary hidden md:block">{PROPERTY_TYPE_LABELS[listing.type as keyof typeof PROPERTY_TYPE_LABELS] ?? listing.type}</span>
                <div className="w-24 flex items-center gap-1.5">
                  <div className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[listing.status])} />
                  <span className="text-xs text-theme-secondary">{PROPERTY_STATUS_LABELS[listing.status]}</span>
                </div>
                <span className="w-28 text-sm font-medium text-theme-primary text-right">{formatCHF(listing.price)}</span>
                <span className="w-24 text-xs text-theme-tertiary text-right hidden sm:block">{formatRelativeDate(listing.updated_at)}</span>
                <div className="w-16 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    to={`/dashboard/listings/${listing.id}/edit`}
                    className="h-7 w-7 rounded-md text-theme-secondary hover:text-theme-primary flex items-center justify-center transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => setDeleteId(listing.id)}
                    className="h-7 w-7 rounded-md text-theme-secondary hover:text-red-500 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-theme-tertiary">
              {t('pagination', { from: (safePage - 1) * ITEMS_PER_PAGE + 1, to: Math.min(safePage * ITEMS_PER_PAGE, filtered.length), total: filtered.length })}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary disabled:opacity-40 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={cn('h-7 min-w-[28px] px-2 rounded-md text-xs font-medium transition-colors', p === safePage ? 'bg-theme-active text-theme-primary' : 'text-theme-secondary hover:text-theme-primary')}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary disabled:opacity-40 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteId && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
            <div className="relative bg-theme-card rounded-xl border border-theme-border p-6 max-w-sm w-full mx-4">
              <h3 className="text-base font-semibold text-theme-primary">{t('delete_dialog.title')}</h3>
              <p className="text-sm text-theme-secondary mt-2">{t('delete_dialog.message')}</p>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setDeleteId(null)} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">
                  {t('cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteProperty.isPending}
                  className="h-9 px-4 text-sm font-medium border border-red-300 text-red-500 rounded-lg hover:border-red-500 transition-colors disabled:opacity-50"
                >
                  {deleteProperty.isPending ? t('deleting') : t('delete_button')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </PageTransition>
  )
}
