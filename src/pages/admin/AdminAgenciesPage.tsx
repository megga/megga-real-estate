import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Building2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/exportCsv'
import { cn, formatDate } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import type { AgencyWithStats } from '@/hooks/useAdminAgencies'
import { calculateAgencyHealth } from '@/lib/agencyHealthScore'
import AgencyHealthBadge from '@/components/admin/AgencyHealthBadge'
import PageTransition from '@/components/layout/PageTransition'

const ITEMS_PER_PAGE = 10

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

function AgencyAvatar({ name }: { name: string }) {
  const letter = (name || '?')[0].toUpperCase()
  const colors = ['bg-admin-accent', 'bg-accent', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length

  return (
    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', colors[idx])}>
      <span className="text-xs font-semibold text-white">{letter}</span>
    </div>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn('flex items-center px-4 py-3.5 gap-3', i < 4 && 'border-b border-theme-border')}>
          <div className="h-8 w-8 rounded-lg bg-theme-hover animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-theme-hover animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-theme-hover animate-pulse" />
          </div>
          <div className="h-3 w-12 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-8 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-8 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-8 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-16 rounded bg-theme-hover animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-theme-hover animate-pulse" />
        </div>
      ))}
    </>
  )
}

export default function AdminAgenciesPage() {
  'use no memo'
  const { agencies, isLoading, updateStatus } = useAdminAgencies()

  // Activity data for health scores
  const activityQuery = useQuery({
    queryKey: ['admin-agency-activity-summary'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('activity_events')
        .select('agency_id, created_at')
        .gte('created_at', thirtyDaysAgo)
      const byAgency: Record<string, { count: number; lastAt: string }> = {}
      for (const evt of data ?? []) {
        if (!evt.agency_id) continue
        if (!byAgency[evt.agency_id]) byAgency[evt.agency_id] = { count: 0, lastAt: evt.created_at }
        byAgency[evt.agency_id].count++
        if (evt.created_at > byAgency[evt.agency_id].lastAt) byAgency[evt.agency_id].lastAt = evt.created_at
      }
      return byAgency
    },
    staleTime: 60_000,
  })

  function getHealth(agency: AgencyWithStats) {
    const ad = activityQuery.data?.[agency.id]
    return calculateAgencyHealth({
      daysSinceLastActivity: ad ? Math.floor((Date.now() - new Date(ad.lastAt).getTime()) / 86400000) : 999,
      activePropertiesCount: agency.property_count,
      contactsCount: 0,
      transactionsCount: agency.transaction_count,
      eventsLast30Days: ad?.count ?? 0,
    })
  }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let list = [...agencies]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a => a.name.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q))
    }
    if (statusFilter) list = list.filter(a => a.status === statusFilter)
    return list
  }, [agencies, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function handleToggleStatus(e: React.MouseEvent, agency: AgencyWithStats) {
    e.preventDefault()
    e.stopPropagation()
    const newStatus = agency.status === 'active' ? 'suspended' : 'active'
    updateStatus.mutate({ id: agency.id, status: newStatus })
  }

  const statusFilters = [
    { value: '', label: 'Tous' },
    { value: 'active', label: 'Actif' },
    { value: 'suspended', label: 'Suspendu' },
  ]

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-admin-accent" />
              <span className="text-xs font-medium text-admin-accent">Admin MEGGA</span>
            </div>
            <h1 className="text-2xl font-semibold text-theme-primary">Agences</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {isLoading ? 'Chargement...' : `${agencies.length} agence${agencies.length !== 1 ? 's' : ''} enregistree${agencies.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => exportToCsv('megga-agences', agencies.map(a => ({
              nom: a.name, plan: a.plan ?? '', agents: a.agent_count,
              biens: a.property_count, transactions: a.transaction_count,
              statut: a.status, date: a.created_at,
            })))}
            className="h-9 px-3 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder="Rechercher une agence..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-1">
            {statusFilters.map((f) => (
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
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {isLoading ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-theme-tertiary">Chargement...</p>
            </div>
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={!!search || !!statusFilter} />
          ) : (
            paginated.map((agency) => (
              <Link
                key={agency.id}
                to={`/dashboard/admin/agencies/${agency.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-theme-border hover:border-theme-active transition-colors"
              >
                <AgencyAvatar name={agency.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate">{agency.name}</p>
                  <p className="text-xs text-theme-tertiary mt-0.5">
                    {PLAN_LABEL[agency.plan ?? ''] ?? agency.plan ?? 'Starter'}
                    {' · '}{agency.agent_count} agent{agency.agent_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn(
                    'h-2 w-2 rounded-full',
                    agency.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                  )} />
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block rounded-xl border border-theme-border">
          {/* Header row */}
          <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-[11px] font-medium text-theme-tertiary uppercase tracking-wider">
            <span className="flex-1">Nom</span>
            <span className="w-20">Plan</span>
            <span className="w-16 text-center">Agents</span>
            <span className="w-16 text-center">Biens</span>
            <span className="w-20 text-center">Transactions</span>
            <span className="w-24">Date</span>
            <span className="w-16 text-center">Statut</span>
            <span className="w-16 text-center">Sante</span>
            <span className="w-24" />
          </div>

          {/* Rows */}
          {isLoading ? (
            <SkeletonRows />
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={!!search || !!statusFilter} />
          ) : (
            paginated.map((agency, i) => (
              <Link
                key={agency.id}
                to={`/dashboard/admin/agencies/${agency.id}`}
                className={cn(
                  'flex items-center px-4 py-3 group hover:bg-theme-hover transition-colors',
                  i < paginated.length - 1 && 'border-b border-theme-border'
                )}
              >
                {/* Name + avatar */}
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <AgencyAvatar name={agency.name} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-theme-primary truncate group-hover:text-admin-accent transition-colors">
                      {agency.name}
                    </p>
                    {agency.email && (
                      <p className="text-xs text-theme-tertiary truncate">{agency.email}</p>
                    )}
                  </div>
                </div>

                {/* Plan */}
                <span className="w-20 text-xs text-theme-secondary">
                  {PLAN_LABEL[agency.plan ?? ''] ?? agency.plan ?? 'Starter'}
                </span>

                {/* Agents */}
                <span className="w-16 text-xs text-theme-secondary text-center">
                  {agency.agent_count}
                </span>

                {/* Properties */}
                <span className="w-16 text-xs text-theme-secondary text-center">
                  {agency.property_count}
                </span>

                {/* Transactions */}
                <span className="w-20 text-xs text-theme-secondary text-center">
                  {agency.transaction_count}
                </span>

                {/* Date */}
                <span className="w-24 text-xs text-theme-tertiary">
                  {formatDate(agency.created_at)}
                </span>

                {/* Status */}
                <div className="w-16 flex items-center justify-center">
                  <span className={cn(
                    'h-2 w-2 rounded-full',
                    agency.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                  )} />
                </div>

                {/* Health */}
                <div className="w-16 flex items-center justify-center">
                  {(() => { const h = getHealth(agency); return <AgencyHealthBadge score={h.score} level={h.level} /> })()}
                </div>

                {/* Hover action */}
                <div className="w-24 flex justify-end">
                  <button
                    onClick={(e) => handleToggleStatus(e, agency)}
                    className={cn(
                      'opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2.5 rounded-md text-xs font-medium border border-theme-border hover:border-theme-active',
                      agency.status === 'active'
                        ? 'text-red-500 hover:text-red-600'
                        : 'text-emerald-500 hover:text-emerald-600'
                    )}
                  >
                    {agency.status === 'active' ? 'Suspendre' : 'Activer'}
                  </button>
                </div>
              </Link>
            ))
          )}

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-theme-border">
              <p className="text-xs text-theme-tertiary">
                {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
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
              Precedent
            </button>
            <span className="text-xs text-theme-tertiary">{safePage}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="min-h-[44px] px-3 rounded-lg text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 border border-theme-border transition-colors"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  )
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="px-4 py-16 text-center">
      <Building2 className="h-8 w-8 mx-auto text-theme-tertiary mb-3" />
      <p className="text-sm text-theme-secondary font-medium">
        {hasFilters ? 'Aucune agence trouvee' : 'Aucune agence'}
      </p>
      <p className="text-xs text-theme-tertiary mt-1">
        {hasFilters ? 'Modifiez vos filtres de recherche' : 'Les agences apparaitront ici une fois inscrites'}
      </p>
    </div>
  )
}
