import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, ShieldCheck, Eye, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import {
  KYC_STATUS_LABELS, KYC_RISK_LABELS, KYC_TYPE_LABELS,
  KYC_STATUSES, KYC_RISK_LEVELS, KYC_TYPES,
} from '@/lib/constants'
import { MOCK_KYC_CASES, type MockKycCase } from '@/lib/mockData'
import { useKycCases } from '@/hooks/useKyc'

type SortField = 'contact' | 'completion' | 'updated'
type SortDir = 'asc' | 'desc'

const ITEMS_PER_PAGE = 10

function progressColor(pct: number) {
  if (pct < 40) return 'bg-danger'
  if (pct < 70) return 'bg-warning'
  return 'bg-success'
}

function statusBadge(status: MockKycCase['status']) {
  const map = {
    pending:     { cls: 'bg-theme-active text-theme-secondary' },
    in_progress: { cls: 'bg-accent/10 text-accent' },
    review:      { cls: 'bg-warning/10 text-warning' },
    validated:   { cls: 'bg-success/10 text-success' },
    rejected:    { cls: 'bg-danger/10 text-danger' },
  }
  const s = map[status]
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge', s.cls)}>
      {KYC_STATUS_LABELS[status]}
    </span>
  )
}

function riskBadge(risk: MockKycCase['risk_level']) {
  const map = {
    low:        { dot: 'bg-success',     cls: 'bg-success/10 text-success' },
    medium:     { dot: 'bg-warning',     cls: 'bg-warning/10 text-warning' },
    high:       { dot: 'bg-danger',      cls: 'bg-danger/10 text-danger' },
    unassessed: { dot: 'bg-theme-tertiary', cls: 'bg-theme-active text-theme-secondary' },
  }
  const r = map[risk]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-badge', r.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', r.dot)} />
      {KYC_RISK_LABELS[risk]}
    </span>
  )
}

function ContactAvatar({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0', color)}>
      <span className="text-xs font-semibold text-white">{initials}</span>
    </div>
  )
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronUp className="h-3.5 w-3.5 text-theme-tertiary" />
  return sortDir === 'asc'
    ? <ChevronUp className="h-3.5 w-3.5 text-accent" />
    : <ChevronDown className="h-3.5 w-3.5 text-accent" />
}

export default function KycListPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [riskFilter, setRiskFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  // Real data from Supabase with mock fallback
  const { data: realKycCases } = useKycCases()
  const dataSource: MockKycCase[] = (realKycCases && realKycCases.length > 0)
    ? realKycCases.map(k => {
        const kx = k as unknown as Record<string, unknown>
        const c = kx.contact as Record<string, string> | null
        return {
          id: k.id,
          contact_name: c ? `${c.first_name} ${c.last_name}` : 'Contact',
          contact_avatar_color: 'bg-accent',
          type: k.type,
          status: k.status,
          risk_level: k.risk_level,
          completion_pct: k.completion_pct,
          property_title: 'Bien associé',
          assigned_to: 'Agent',
          validated_by: k.validated_by ?? null,
          validated_at: k.validated_at ?? null,
          created_at: k.created_at,
          updated_at: k.created_at,
        } as MockKycCase
      })
    : MOCK_KYC_CASES

  const filtered = useMemo(() => {
    let list = [...dataSource]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.contact_name.toLowerCase().includes(q) ||
          c.property_title.toLowerCase().includes(q)
      )
    }
    if (statusFilter) list = list.filter((c) => c.status === statusFilter)
    if (riskFilter) list = list.filter((c) => c.risk_level === riskFilter)
    if (typeFilter) list = list.filter((c) => c.type === typeFilter)

    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'contact') {
        cmp = a.contact_name.localeCompare(b.contact_name)
      } else if (sortField === 'completion') {
        cmp = a.completion_pct - b.completion_pct
      } else if (sortField === 'updated') {
        cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [dataSource, search, statusFilter, riskFilter, typeFilter, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'contact' ? 'asc' : 'desc')
    }
  }

  // Counts by status for the header
  const counts = useMemo(() => {
    const c = { pending: 0, in_progress: 0, review: 0, validated: 0, rejected: 0 }
    dataSource.forEach((k) => { c[k.status]++ })
    return c
  }, [dataSource])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">
            Dossiers KYC
          </h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {dataSource.length} dossiers · {counts.review} en revue · {counts.in_progress} en cours
          </p>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setStatusFilter(''); setPage(1) }}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            !statusFilter ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
          )}
        >
          Tous ({dataSource.length})
        </button>
        {KYC_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              statusFilter === s ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
            )}
          >
            {KYC_STATUS_LABELS[s]} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
          <input
            type="text"
            placeholder="Rechercher par nom ou bien..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full h-10 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        <select
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setPage(1) }}
          className="h-10 px-3 text-sm bg-transparent border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les risques</option>
          {KYC_RISK_LEVELS.map((r) => (
            <option key={r} value={r}>{KYC_RISK_LABELS[r]}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="h-10 px-3 text-sm bg-transparent border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les types</option>
          {KYC_TYPES.map((t) => (
            <option key={t} value={t}>{KYC_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {(search || statusFilter || riskFilter || typeFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setRiskFilter(''); setTypeFilter(''); setPage(1) }}
            className="text-xs text-accent hover:text-accent/80 font-medium"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-transparent rounded-card shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-theme-border bg-theme-section">
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort('contact')}
                    className="flex items-center gap-1 text-xs font-semibold text-theme-secondary uppercase tracking-wider hover:text-theme-primary"
                  >
                    Contact
                    <SortIcon field="contact" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 hidden md:table-cell">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Bien lié</span>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Type</span>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Risque</span>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Statut</span>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort('completion')}
                    className="flex items-center gap-1 text-xs font-semibold text-theme-secondary uppercase tracking-wider hover:text-theme-primary"
                  >
                    Progression
                    <SortIcon field="completion" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Agent</span>
                </th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">
                  <button
                    onClick={() => toggleSort('updated')}
                    className="flex items-center gap-1 text-xs font-semibold text-theme-secondary uppercase tracking-wider hover:text-theme-primary"
                  >
                    Mis à jour
                    <SortIcon field="updated" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-4 py-3">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <ShieldCheck className="h-10 w-10 text-theme-tertiary mx-auto mb-3" />
                    <p className="text-sm text-theme-tertiary">Aucun dossier trouvé</p>
                  </td>
                </tr>
              ) : (
                paginated.map((kyc) => (
                  <tr key={kyc.id} className="hover:bg-theme-section/50 transition-colors group">
                    <td className="px-4 py-3">
                      <Link to={`/dashboard/kyc/${kyc.id}`} className="flex items-center gap-3">
                        <ContactAvatar name={kyc.contact_name} color={kyc.contact_avatar_color} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">
                            {kyc.contact_name}
                          </p>
                          <p className="text-xs text-theme-tertiary truncate md:hidden">
                            {kyc.property_title}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-theme-secondary truncate block max-w-[200px]">
                        {kyc.property_title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-badge bg-theme-hover text-theme-secondary">
                        {KYC_TYPE_LABELS[kyc.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{riskBadge(kyc.risk_level)}</td>
                    <td className="px-4 py-3">{statusBadge(kyc.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-2 bg-theme-active rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', progressColor(kyc.completion_pct))}
                            style={{ width: `${kyc.completion_pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-theme-secondary w-8 text-right">
                          {kyc.completion_pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-theme-tertiary">{kyc.assigned_to}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-theme-tertiary">
                        {formatRelativeDate(kyc.updated_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <Link
                          to={`/dashboard/kyc/${kyc.id}`}
                          className="p-1.5 rounded-md text-theme-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                          title="Voir le dossier"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-theme-border bg-theme-section/50">
            <p className="text-xs text-theme-tertiary">
              {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length} dossiers
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-md text-theme-secondary hover:bg-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-8 min-w-[32px] px-2 rounded-md text-sm font-medium transition-colors',
                    p === safePage ? 'bg-accent text-white' : 'text-theme-secondary hover:bg-transparent'
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-md text-theme-secondary hover:bg-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
