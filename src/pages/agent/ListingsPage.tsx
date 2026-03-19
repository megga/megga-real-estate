import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Plus, Eye, Heart, Pencil, Archive, Send, LayoutGrid, List,
  ChevronLeft, ChevronRight, MoreHorizontal,
} from 'lucide-react'
import { cn, formatCHF, formatSurface, formatRelativeDate } from '@/lib/utils'
import { PROPERTY_TYPE_LABELS, PROPERTY_STATUS_LABELS } from '@/lib/constants'
import type { PropertyStatus, PropertyType } from '@/lib/constants'
import { MOCK_AGENT_LISTINGS, type MockAgentListing } from '@/lib/mockData'
import { useAgencyListings } from '@/hooks/useListings'

const ITEMS_PER_PAGE = 9

const statusStyle: Record<PropertyStatus, { bg: string; dot: string }> = {
  draft:    { bg: 'bg-primary-100 text-primary-700', dot: 'bg-primary-400' },
  active:   { bg: 'bg-success/10 text-success',       dot: 'bg-success' },
  reserved: { bg: 'bg-warning/10 text-warning',       dot: 'bg-warning' },
  sold:     { bg: 'bg-accent/10 text-accent',         dot: 'bg-accent' },
  archived: { bg: 'bg-primary-100 text-primary-500',  dot: 'bg-primary-300' },
}

function StatusBadge({ status }: { status: PropertyStatus }) {
  const s = statusStyle[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-badge', s.bg)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {PROPERTY_STATUS_LABELS[status]}
    </span>
  )
}

function TypeBadge({ type }: { type: PropertyType }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-badge bg-section text-primary-600">
      {PROPERTY_TYPE_LABELS[type]}
    </span>
  )
}

function ActionMenu({ listing }: { listing: MockAgentListing }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md text-primary-400 hover:text-primary-700 hover:bg-section transition-colors"
        title="Actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-44 bg-white rounded-card shadow-dropdown border border-border py-1">
            <button
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary-700 hover:bg-section transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Éditer
            </button>
            {listing.status === 'draft' && (
              <button
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-success hover:bg-success/5 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Publier
              </button>
            )}
            {(listing.status === 'active' || listing.status === 'reserved') && (
              <button
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary-500 hover:bg-section transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
                Archiver
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function ListingsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [page, setPage] = useState(1)

  // Real data from Supabase with mock fallback
  const { data: realListings } = useAgencyListings()
  const dataSource: MockAgentListing[] = (realListings && realListings.length > 0)
    ? realListings.map(l => {
        const prop = l.property as unknown as Record<string, unknown> | undefined
        return {
          id: l.id,
          title: l.title,
          type: (prop?.type as MockAgentListing['type']) ?? 'apartment',
          status: (prop?.status as MockAgentListing['status']) ?? 'draft',
          price: (prop?.price as number) ?? 0,
          address: (prop?.address as string) ?? '',
          city: (prop?.city as string) ?? '',
          canton: (prop?.canton as string) ?? '',
          rooms: (prop?.rooms as number) ?? 0,
          bedrooms: (prop?.bedrooms as number) ?? 0,
          surface_m2: (prop?.surface_m2 as number) ?? 0,
          photo: ((prop?.photos as string[]) ?? [])[0] ?? '',
          views_count: l.views_count,
          favorites_count: l.favorites_count,
          created_at: l.published_at ?? '',
          published_at: l.published_at,
          updated_at: l.published_at ?? '',
        }
      })
    : MOCK_AGENT_LISTINGS

  // Counts per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: dataSource.length }
    for (const l of dataSource) {
      counts[l.status] = (counts[l.status] || 0) + 1
    }
    return counts
  }, [dataSource])

  // Filtered list
  const filtered = useMemo(() => {
    let list = [...dataSource]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q)
      )
    }
    if (statusFilter) list = list.filter((l) => l.status === statusFilter)
    if (typeFilter) list = list.filter((l) => l.type === typeFilter)

    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [search, statusFilter, typeFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Mes biens</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dataSource.length} biens au total</p>
        </div>
        <Link
          to="/dashboard/listings/new"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-button transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter un bien
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: '', label: 'Tous', count: statusCounts.all },
          { key: 'active', label: 'Actifs', count: statusCounts.active || 0 },
          { key: 'draft', label: 'Brouillons', count: statusCounts.draft || 0 },
          { key: 'reserved', label: 'Réservés', count: statusCounts.reserved || 0 },
          { key: 'sold', label: 'Vendus', count: statusCounts.sold || 0 },
          { key: 'archived', label: 'Archivés', count: statusCounts.archived || 0 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1) }}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
              statusFilter === tab.key
                ? 'bg-primary-900 text-white'
                : 'bg-section text-primary-600 hover:bg-primary-100'
            )}
          >
            {tab.label}
            <span className={cn(
              'ml-1.5 text-xs',
              statusFilter === tab.key ? 'text-white/70' : 'text-primary-400'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" />
          <input
            type="text"
            placeholder="Rechercher par titre, ville..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="h-10 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les types</option>
          <option value="apartment">Appartement</option>
          <option value="house">Maison</option>
          <option value="villa">Villa</option>
          <option value="commercial">Commercial</option>
          <option value="land">Terrain</option>
        </select>

        {/* Clear filters */}
        {(search || typeFilter) && (
          <button
            onClick={() => { setSearch(''); setTypeFilter(''); setPage(1) }}
            className="text-xs text-accent hover:text-accent/80 font-medium"
          >
            Effacer les filtres
          </button>
        )}

        {/* View toggle */}
        <div className="ml-auto flex items-center bg-section rounded-input p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-2 rounded-md transition-colors',
              viewMode === 'grid' ? 'bg-white text-primary-900 shadow-card' : 'text-primary-400 hover:text-primary-600'
            )}
            title="Vue grille"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'p-2 rounded-md transition-colors',
              viewMode === 'table' ? 'bg-white text-primary-900 shadow-card' : 'text-primary-400 hover:text-primary-600'
            )}
            title="Vue tableau"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-card shadow-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Aucun bien trouvé</p>
        </div>
      )}

      {/* Grid view */}
      {filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {paginated.map((listing) => (
            <div
              key={listing.id}
              className="bg-white rounded-card shadow-card hover:shadow-card-hover transition-shadow overflow-hidden group"
            >
              {/* Photo */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={listing.photo}
                  alt={listing.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3">
                  <StatusBadge status={listing.status} />
                </div>
                <div className="absolute top-3 right-3">
                  <ActionMenu listing={listing} />
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xl font-bold text-primary-900">{formatCHF(listing.price)}</p>
                    <TypeBadge type={listing.type} />
                  </div>
                  <h3 className="text-sm font-semibold text-primary-900 mt-1 line-clamp-1">
                    {listing.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {listing.address}, {listing.city} ({listing.canton})
                  </p>
                </div>

                {/* Stats */}
                {listing.rooms > 0 && (
                  <p className="text-xs text-primary-500">
                    {listing.rooms} pièces · {listing.bedrooms} ch. · {formatSurface(listing.surface_m2)}
                  </p>
                )}
                {listing.rooms === 0 && (
                  <p className="text-xs text-primary-500">{formatSurface(listing.surface_m2)}</p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {listing.views_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      {listing.favorites_count}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(listing.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {filtered.length > 0 && viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Bien</span>
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Type</span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Statut</span>
                  </th>
                  <th className="text-right px-4 py-3">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Prix</span>
                  </th>
                  <th className="text-center px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Vues</span>
                  </th>
                  <th className="text-center px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Favoris</span>
                  </th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Mise à jour</span>
                  </th>
                  <th className="text-right px-4 py-3">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-50 transition-colors duration-150 group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={listing.photo}
                          alt={listing.title}
                          className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-primary-900 truncate group-hover:text-accent transition-colors">
                            {listing.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {listing.address}, {listing.city}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <TypeBadge type={listing.type} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={listing.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-primary-900">{formatCHF(listing.price)}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" />
                        {listing.views_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <Heart className="h-3.5 w-3.5" />
                        {listing.favorites_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{formatRelativeDate(listing.updated_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded-md text-primary-400 hover:text-accent hover:bg-accent/10 transition-colors"
                          title="Voir"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md text-primary-400 hover:text-warning hover:bg-warning/10 transition-colors"
                          title="Éditer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <ActionMenu listing={listing} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length} biens
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1.5 rounded-md text-primary-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'h-8 min-w-[32px] px-2 rounded-md text-sm font-medium transition-colors',
                  p === safePage
                    ? 'bg-accent text-white'
                    : 'text-primary-600 hover:bg-white'
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded-md text-primary-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
