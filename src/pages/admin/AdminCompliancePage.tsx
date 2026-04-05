import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, ShieldCheck, AlertTriangle, FileCheck, Clock, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/exportCsv'
import { cn, formatDate } from '@/lib/utils'
import { useAdminCompliance } from '@/hooks/useAdminCompliance'
import type { ComplianceCase } from '@/hooks/useAdminCompliance'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import PageTransition from '@/components/layout/PageTransition'

const ITEMS_PER_PAGE = 10

type TabValue = 'risk' | 'pending' | 'validated' | 'all'

function riskDotColor(level: string): string {
  switch (level) {
    case 'high': return 'bg-red-500'
    case 'medium': return 'bg-amber-500'
    case 'low': return 'bg-emerald-500'
    default: return 'bg-theme-tertiary'
  }
}

function riskTextColor(level: string): string {
  switch (level) {
    case 'high': return 'text-red-500'
    case 'medium': return 'text-amber-500'
    case 'low': return 'text-emerald-500'
    default: return 'text-theme-tertiary'
  }
}

function filterCases(cases: ComplianceCase[], tab: TabValue): ComplianceCase[] {
  switch (tab) {
    case 'risk':
      return cases.filter(c => c.risk_level === 'high' || c.screening_status === 'match')
    case 'pending':
      return cases.filter(c => c.status === 'pending' || c.status === 'in_progress')
    case 'validated':
      return cases.filter(c => c.status === 'validated')
    case 'all':
    default:
      return cases
  }
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn('flex items-center px-4 py-3.5 gap-3', i < 4 && 'border-b border-theme-border')}>
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-28 rounded bg-theme-hover animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-theme-hover animate-pulse" />
          </div>
          <div className="h-3 w-24 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-12 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-16 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-8 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-20 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-20 rounded bg-theme-hover animate-pulse" />
        </div>
      ))}
    </>
  )
}

function EmptyState({ tab }: { tab: TabValue }) {
  const { t } = useTranslation('admin')

  const messages: Record<TabValue, { title: string; subtitle: string }> = {
    risk: {
      title: t('compliance.empty.risk.title'),
      subtitle: t('compliance.empty.risk.subtitle'),
    },
    pending: {
      title: t('compliance.empty.pending.title'),
      subtitle: t('compliance.empty.pending.subtitle'),
    },
    validated: {
      title: t('compliance.empty.validated.title'),
      subtitle: t('compliance.empty.validated.subtitle'),
    },
    all: {
      title: t('compliance.empty.all.title'),
      subtitle: t('compliance.empty.all.subtitle'),
    },
  }

  const msg = messages[tab]

  return (
    <div className="px-4 py-16 text-center">
      <ShieldCheck className="h-8 w-8 mx-auto text-theme-tertiary mb-3" />
      <p className="text-sm text-theme-secondary font-medium">{msg.title}</p>
      <p className="text-xs text-theme-tertiary mt-1">{msg.subtitle}</p>
    </div>
  )
}

function CompletionBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-theme-hover overflow-hidden">
        <div
          className="h-full rounded-full bg-theme-primary transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs text-theme-tertiary">{value}%</span>
    </div>
  )
}

export default function AdminCompliancePage() {
  const { t } = useTranslation('admin')
  const { cases, isLoading, stats, statsLoading } = useAdminCompliance()
  const [tab, setTab] = useState<TabValue>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const TABS: { value: TabValue; label: string }[] = [
    { value: 'risk', label: t('compliance.tab.atRisk') },
    { value: 'pending', label: t('compliance.tab.pending') },
    { value: 'validated', label: t('compliance.tab.validated') },
    { value: 'all', label: t('compliance.tab.all') },
  ]

  const TYPE_LABEL: Record<string, string> = {
    buyer_pp: 'PP',
    buyer_pm: 'PM',
    seller_pp: 'PP',
    seller_pm: 'PM',
  }

  const TYPE_FULL: Record<string, string> = {
    buyer_pp: t('compliance.type.buyerPP'),
    buyer_pm: t('compliance.type.buyerPM'),
    seller_pp: t('compliance.type.sellerPP'),
    seller_pm: t('compliance.type.sellerPM'),
  }

  const RISK_LABEL: Record<string, string> = {
    low: t('common.risk.low'),
    medium: t('common.risk.medium'),
    high: t('common.risk.high'),
    unassessed: t('common.risk.unassessed'),
  }

  const STATUS_LABEL: Record<string, string> = {
    pending: t('common.status.pending'),
    in_progress: t('common.status.inProgress'),
    review: t('common.status.review'),
    validated: t('common.status.validated'),
    rejected: t('common.status.rejected'),
  }

  const filtered = useMemo(() => {
    let list = filterCases(cases, tab)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        c =>
          c.contact_name.toLowerCase().includes(q) ||
          (c.agency_name ?? '').toLowerCase().includes(q) ||
          (TYPE_FULL[c.type] ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [cases, tab, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-admin-accent" />
              <span className="text-xs font-medium text-admin-accent">{t('common.adminBadge')}</span>
            </div>
            <h1 className="text-2xl font-semibold text-theme-primary">{t('compliance.title')}</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {isLoading ? t('common.loading') : t('compliance.subtitle', { count: cases.length })}
            </p>
          </div>
          <button
            onClick={() => exportToCsv('megga-compliance', cases.map(c => ({
              contact: c.contact_name, agence: c.agency_name ?? '', type: c.type,
              risque: c.risk_level, completion: c.completion_pct, statut: c.status, date: c.created_at,
            })))}
            className="h-9 px-3 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {t('common.export')}
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AdminKpiCard
            label={t('compliance.kpi.total')}
            value={statsLoading ? '...' : (stats?.total ?? 0)}
            icon={FileCheck}
          />
          <AdminKpiCard
            label={t('compliance.kpi.pending')}
            value={statsLoading ? '...' : (stats?.pending ?? 0)}
            icon={Clock}
          />
          <AdminKpiCard
            label={t('compliance.kpi.pepAlerts')}
            value={statsLoading ? '...' : (stats?.pepMatches ?? 0)}
            icon={AlertTriangle}
            variant={stats && stats.pepMatches > 0 ? 'danger' : 'default'}
          />
          <AdminKpiCard
            label={t('compliance.kpi.completionRate')}
            value={statsLoading ? '...' : `${stats?.avgCompletion ?? 0}%`}
            icon={ShieldCheck}
          />
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {TABS.map((tb) => (
              <button
                key={tb.value}
                onClick={() => { setTab(tb.value); setPage(1) }}
                className={cn(
                  'h-9 px-4 rounded-lg text-sm transition-colors',
                  tab === tb.value
                    ? 'bg-theme-active text-theme-primary font-medium'
                    : 'text-theme-secondary hover:text-theme-primary'
                )}
              >
                {tb.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder={t('compliance.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {isLoading ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-theme-tertiary">{t('common.loading')}</p>
            </div>
          ) : paginated.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            paginated.map((c) => (
              <Link
                key={c.id}
                to={`/dashboard/kyc/${c.id}`}
                className="flex items-center gap-3 p-3 w-full rounded-xl border border-theme-border hover:border-theme-active transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-theme-primary truncate">{c.contact_name}</p>
                    <span className="text-xs font-medium text-theme-tertiary border border-theme-border rounded px-1.5 py-0.5">
                      {TYPE_LABEL[c.type] ?? c.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('h-1.5 w-1.5 rounded-full', riskDotColor(c.risk_level))} />
                    <span className={cn('text-xs', riskTextColor(c.risk_level))}>
                      {RISK_LABEL[c.risk_level] ?? c.risk_level}
                    </span>
                    {c.screening_status === 'match' && (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    )}
                    {c.screening_status === 'clear' && (
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </div>
                </div>
                <CompletionBar value={c.completion_pct} />
              </Link>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block rounded-xl border border-theme-border">
          {/* Header row */}
          <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary tracking-wide">
            <span className="flex-1 min-w-0">{t('compliance.table.contact')}</span>
            <span className="w-28">{t('compliance.table.agency')}</span>
            <span className="w-20">{t('compliance.table.type')}</span>
            <span className="w-24">{t('compliance.table.risk')}</span>
            <span className="w-14 text-center">{t('compliance.table.pep')}</span>
            <span className="w-28">{t('compliance.table.completion')}</span>
            <span className="w-20 text-center">{t('compliance.table.status')}</span>
            <span className="w-24">{t('compliance.table.date')}</span>
          </div>

          {/* Rows */}
          {isLoading ? (
            <SkeletonRows />
          ) : paginated.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            paginated.map((c, i) => (
              <Link
                key={c.id}
                to={`/dashboard/kyc/${c.id}`}
                className={cn(
                  'flex items-center px-4 py-3 w-full text-left group hover:bg-theme-hover transition-colors',
                  i < paginated.length - 1 && 'border-b border-theme-border'
                )}
              >
                {/* Contact name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate group-hover:text-admin-accent transition-colors">
                    {c.contact_name}
                  </p>
                </div>

                {/* Agency */}
                <span className="w-28 text-xs text-theme-secondary truncate">
                  {c.agency_name ?? <span className="text-theme-tertiary">&mdash;</span>}
                </span>

                {/* Type badge */}
                <span className="w-20">
                  <span className="text-xs font-medium text-theme-secondary border border-theme-border rounded px-1.5 py-0.5">
                    {TYPE_LABEL[c.type] ?? c.type}
                  </span>
                </span>

                {/* Risk */}
                <span className="w-24 flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', riskDotColor(c.risk_level))} />
                  <span className={cn('text-xs font-medium', riskTextColor(c.risk_level))}>
                    {RISK_LABEL[c.risk_level] ?? c.risk_level}
                  </span>
                </span>

                {/* PEP screening */}
                <span className="w-14 flex items-center justify-center">
                  {c.screening_status === 'match' ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : c.screening_status === 'clear' ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <span className="text-xs text-theme-tertiary">&mdash;</span>
                  )}
                </span>

                {/* Completion bar */}
                <span className="w-28">
                  <CompletionBar value={c.completion_pct} />
                </span>

                {/* Status */}
                <span className="w-20 text-center">
                  <span className={cn(
                    'text-xs font-medium',
                    c.status === 'validated' ? 'text-emerald-500' :
                    c.status === 'rejected' ? 'text-red-500' :
                    'text-theme-secondary'
                  )}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </span>

                {/* Date */}
                <span className="w-24 text-xs text-theme-tertiary">
                  {formatDate(c.created_at)}
                </span>
              </Link>
            ))
          )}

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-theme-border">
              <p className="text-xs text-theme-tertiary">
                {(safePage - 1) * ITEMS_PER_PAGE + 1}&ndash;{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} {t('common.on')} {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)) }}
                  disabled={safePage <= 1}
                  aria-label={t('common.previousPage')}
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
                          onClick={(e) => { e.preventDefault(); setPage(p) }}
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
                  onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)) }}
                  disabled={safePage >= totalPages}
                  aria-label={t('common.nextPage')}
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
              {t('common.previous')}
            </button>
            <span className="text-xs text-theme-tertiary">{safePage}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="min-h-[44px] px-3 rounded-lg text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 border border-theme-border transition-colors"
            >
              {t('common.next')}
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
