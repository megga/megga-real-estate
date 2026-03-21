import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Plus, LayoutGrid, List, ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react'
import { cn, formatCHF, formatSurface, formatRelativeDate } from '@/lib/utils'
import { PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS } from '@/lib/constants'
import type { PropertyStatus } from '@/lib/constants'
import { MOCK_AGENT_LISTINGS, type MockAgentListing } from '@/lib/mockData'
import { useAgencyListings } from '@/hooks/useListings'
import PageTransition from '@/components/layout/PageTransition'
import ListingDetailModal from '@/components/listings/ListingDetailModal'

const ITEMS_PER_PAGE = 9

const STATUS_DOT: Record<PropertyStatus, string> = {
  draft: 'bg-gray-400',
  active: 'bg-emerald-400',
  reserved: 'bg-amber-400',
  sold: 'bg-blue-400',
  archived: 'bg-gray-400',
}

const selectClasses = 'h-9 px-3 pr-8 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none'

export default function ListingsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [selectedListing, setSelectedListing] = useState<MockAgentListing | null>(null)

  const { data: realListings } = useAgencyListings()
  const dataSource: MockAgentListing[] = (realListings && realListings.length > 0)
    ? realListings.map(l => {
        const prop = l.property as unknown as Record<string, unknown> | undefined
        return {
          id: l.id, title: l.title,
          type: (prop?.type as MockAgentListing['type']) ?? 'apartment',
          status: (prop?.status as MockAgentListing['status']) ?? 'draft',
          price: (prop?.price as number) ?? 0,
          address: (prop?.address as string) ?? '', city: (prop?.city as string) ?? '', canton: (prop?.canton as string) ?? '',
          rooms: (prop?.rooms as number) ?? 0, bedrooms: (prop?.bedrooms as number) ?? 0, surface_m2: (prop?.surface_m2 as number) ?? 0,
          photo: ((prop?.photos as string[]) ?? [])[0] ?? '',
          views_count: l.views_count, favorites_count: l.favorites_count,
          created_at: l.published_at ?? '', published_at: l.published_at, updated_at: l.published_at ?? '',
        }
      })
    : MOCK_AGENT_LISTINGS

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

  return (
    <PageTransition>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">Mes biens</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">{dataSource.length} biens</p>
          </div>
          <Link
            to="/dashboard/listings/new"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter un bien
          </Link>
        </div>

        {/* Status tabs + filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status pills */}
          <div className="flex items-center border border-theme-border rounded-lg p-0.5">
            {[
              { key: '', label: 'Tous', count: statusCounts.all },
              { key: 'active', label: 'Actifs', count: statusCounts.active || 0 },
              { key: 'draft', label: 'Brouillons', count: statusCounts.draft || 0 },
              { key: 'reserved', label: 'Réservés', count: statusCounts.reserved || 0 },
              { key: 'sold', label: 'Vendus', count: statusCounts.sold || 0 },
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
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="relative">
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} className={selectClasses}>
              <option value="">Type</option>
              <option value="apartment">Appartement</option>
              <option value="house">Maison</option>
              <option value="villa">Villa</option>
              <option value="commercial">Commercial</option>
              <option value="land">Terrain</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          {hasFilters && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setPage(1) }} className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors">
              Effacer
            </button>
          )}
        </div>

        {/* Empty */}
        {filtered.length === 0 && (
          <div className="text-center py-12 rounded-xl border border-theme-border">
            <p className="text-sm text-theme-tertiary">Aucun bien trouvé</p>
          </div>
        )}

        {/* Grid view — 3 columns */}
        {filtered.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map((listing) => (
              <div key={listing.id} onClick={() => setSelectedListing(listing)} className="rounded-xl border border-theme-border overflow-hidden group hover:border-theme-active transition-colors cursor-pointer">
                {/* Photo */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={listing.photo} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-[11px] font-medium px-2 py-1 rounded-md">
                    <div className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[listing.status])} />
                    {PROPERTY_STATUS_LABELS[listing.status]}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="text-lg font-semibold text-theme-primary">{formatCHF(listing.price)}</p>
                  <p className="text-sm font-medium text-theme-primary mt-1 truncate">{listing.title}</p>
                  <p className="text-xs text-theme-tertiary mt-0.5 truncate">{listing.address}, {listing.city}</p>

                  {listing.rooms > 0 && (
                    <p className="text-xs text-theme-tertiary mt-2">
                      {listing.rooms}p · {listing.bedrooms}ch · {formatSurface(listing.surface_m2)}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-theme-border text-xs text-theme-tertiary">
                    <span>{PROPERTY_TYPE_LABELS[listing.type]}</span>
                    <span>{formatRelativeDate(listing.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view — transparent bento */}
        {filtered.length > 0 && viewMode === 'list' && (
          <div className="rounded-xl border border-theme-border">
            <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-[11px] font-medium text-theme-tertiary uppercase tracking-wider">
              <span className="flex-1">Bien</span>
              <span className="w-24 hidden md:block">Type</span>
              <span className="w-24">Statut</span>
              <span className="w-28 text-right">Prix</span>
              <span className="w-24 text-right hidden sm:block">Activité</span>
            </div>

            {paginated.map((listing, i) => (
              <div
                key={listing.id}
                onClick={() => setSelectedListing(listing)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 hover:bg-theme-hover transition-colors cursor-pointer group',
                  i < paginated.length - 1 && 'border-b border-theme-border'
                )}
              >
                <img src={listing.photo} alt={listing.title} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">{listing.title}</p>
                  <p className="text-xs text-theme-tertiary truncate">{listing.address}, {listing.city}</p>
                </div>
                <span className="w-24 text-xs text-theme-secondary hidden md:block">{PROPERTY_TYPE_LABELS[listing.type]}</span>
                <div className="w-24 flex items-center gap-1.5">
                  <div className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[listing.status])} />
                  <span className="text-xs text-theme-secondary">{PROPERTY_STATUS_LABELS[listing.status]}</span>
                </div>
                <span className="w-28 text-sm font-medium text-theme-primary text-right">{formatCHF(listing.price)}</span>
                <span className="w-24 text-xs text-theme-tertiary text-right hidden sm:block">{formatRelativeDate(listing.updated_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-theme-tertiary">
              {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary disabled:opacity-40 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={cn('h-7 min-w-[28px] px-2 rounded-md text-xs font-medium transition-colors', p === safePage ? 'bg-accent text-white' : 'text-theme-secondary hover:text-theme-primary')}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary disabled:opacity-40 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        {selectedListing && (
          <ListingDetailModal
            listing={{
              id: selectedListing.id,
              title: selectedListing.title,
              price: selectedListing.price,
              address: selectedListing.address,
              city: selectedListing.city,
              canton: selectedListing.canton,
              rooms: selectedListing.rooms,
              surface: selectedListing.surface_m2,
              type: selectedListing.type,
              status: selectedListing.status,
              created_at: selectedListing.created_at,
            }}
            onClose={() => setSelectedListing(null)}
          />
        )}
      </div>
    </PageTransition>
  )
}
