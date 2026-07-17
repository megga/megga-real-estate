/**
 * Page super-admin — journal d'audit de sécurité.
 *
 * Route : `/dashboard/admin/security` (SuperAdminGuard, accent violet). Liste les
 * actions sensibles d'`activity_events` (filtres sévérité/action/acteur, recherche,
 * pagination, métadonnées dépliables) avec un bandeau KPI sur 7 jours. Deux exports :
 * CSV de la vue filtrée, et PDF juridique de la chaîne d'audit PLATEFORME complète
 * (hash-chain nLPD/LBA — volontairement non filtré).
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, AlertTriangle, AlertCircle, Info, Download, FileDown, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { exportToCsv } from '@/lib/exportCsv'
import { downloadAuditPdf } from '@/lib/auditPdfExport'
import { useToast } from '@/components/ui/Toast'
import {
  useSecurityAudit,
  AUDIT_ACTION_LABELS,
  AUDIT_SEVERITY,
  SENSITIVE_ACTIONS,

} from '@/hooks/useSecurityAudit'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import PageTransition from '@/components/layout/PageTransition'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'

// Labels are resolved at render time via t() — see component body
const SEVERITY_PILL_VALUES: SeverityFilter[] = ['all', 'critical', 'warning', 'info']

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Classe Tailwind de la pastille colorée selon la sévérité. */
function severityDot(severity: 'critical' | 'warning' | 'info'): string {
  switch (severity) {
    case 'critical': return 'bg-red-500'
    case 'warning': return 'bg-amber-500'
    case 'info': return 'bg-blue-500'
  }
}

// severityLabel is now resolved via t() inside the component

/** Formate un timestamp ISO en `dd.MM.yyyy HH:mm` (locale FR) ; renvoie la chaîne brute si invalide. */
function formatTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return format(d, 'dd.MM.yyyy HH:mm', { locale: fr })
  } catch {
    return dateStr
  }
}

/** Condense un objet metadata en une ligne `clé: valeur`, tronquée à 80 caractères. */
function summarizeMetadata(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return '-'
  const parts: string[] = []
  for (const [key, val] of Object.entries(metadata)) {
    if (val === null || val === undefined) continue
    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val)
    parts.push(`${key}: ${strVal}`)
  }
  const summary = parts.join(', ')
  return summary.length > 80 ? summary.slice(0, 77) + '...' : summary
}

/** Sévérité d'une action d'audit via la table `AUDIT_SEVERITY` (défaut `info`). */
function getActionSeverity(action: string): 'critical' | 'warning' | 'info' {
  return AUDIT_SEVERITY[action] ?? 'info'
}

/** Vrai si la date tombe dans les `days` derniers jours (fenêtre des KPI). */
function isWithinDays(dateStr: string, days: number): boolean {
  const d = new Date(dateStr)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return d >= cutoff
}

// ─── SKELETON ───────────────────────────────────────────────────────────────

/** Lignes squelette affichées pendant le chargement du journal. */
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={cn('flex items-center px-4 py-3.5 gap-4', i < 7 && 'border-b border-theme-border')}>
          <div className="w-28 h-3.5 rounded bg-theme-hover animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-theme-hover animate-pulse" />
          <div className="flex-1 h-3.5 rounded bg-theme-hover animate-pulse" />
          <div className="w-24 h-3.5 rounded bg-theme-hover animate-pulse" />
          <div className="w-32 h-3.5 rounded bg-theme-hover animate-pulse" />
        </div>
      ))}
    </>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

/** Page : KPI 7 jours + filtres + table paginée du journal d'audit de sécurité. */
export default function AdminSecurityAuditPage() {
  const { t } = useTranslation('admin')
  const { data: entries, isLoading } = useSecurityAudit({ limit: 500 })
  const toast = useToast()
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [pdfExporting, setPdfExporting] = useState(false)

  // ── Derived data ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!entries) return []
    return entries.filter(e => {
      // Severity filter
      if (severityFilter !== 'all' && getActionSeverity(e.action) !== severityFilter) return false
      // Action filter
      if (actionFilter !== 'all' && e.action !== actionFilter) return false
      // Search by actor name/email
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const nameMatch = e.actor_name?.toLowerCase().includes(q)
        const emailMatch = e.actor_email?.toLowerCase().includes(q)
        if (!nameMatch && !emailMatch) return false
      }
      return true
    })
  }, [entries, severityFilter, actionFilter, searchQuery])

  // ── Stats (last 7 days) ───────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!entries) return { critical: 0, warning: 0, total: 0 }
    const recent = entries.filter(e => isWithinDays(e.created_at, 7))
    return {
      critical: recent.filter(e => getActionSeverity(e.action) === 'critical').length,
      warning: recent.filter(e => getActionSeverity(e.action) === 'warning').length,
      total: recent.length,
    }
  }, [entries])

  // ── Pagination ────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  // Reset page when filters change
  const handleSeverityChange = (val: SeverityFilter) => {
    setSeverityFilter(val)
    setPage(1)
  }
  const handleActionChange = (val: string) => {
    setActionFilter(val)
    setPage(1)
  }
  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setPage(1)
  }

  // ── Export PDF plateforme (hash-chain, nLPD/LBA) ──────────────────────
  // Piste d'audit PLATEFORME complète (branche super-admin d'audit-pdf-export),
  // volontairement sans les filtres d'affichage : la preuve juridique porte sur
  // la chaîne entière, pas sur une vue filtrée par action côté client.
  async function handlePdfExport() {
    setPdfExporting(true)
    try {
      await downloadAuditPdf({})
    } catch {
      toast.error(t('admin:securityAudit.pdfExportError'))
    } finally {
      setPdfExporting(false)
    }
  }

  // ── CSV Export ─────────────────────────────────────────────────────────
  function handleExport() {
    if (!filtered.length) return
    exportToCsv('audit-securite', filtered.map(e => ({
      timestamp: formatTimestamp(e.created_at),
      severite: t(`admin:common.severity.${getActionSeverity(e.action)}`),
      action: AUDIT_ACTION_LABELS[e.action] ?? e.action,
      acteur_nom: e.actor_name ?? '',
      acteur_email: e.actor_email ?? '',
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      details: summarizeMetadata(e.metadata),
    })), [
      { key: 'timestamp', label: t('admin:securityAudit.table.timestamp') },
      { key: 'severite', label: t('admin:securityAudit.table.severity') },
      { key: 'action', label: t('admin:securityAudit.table.action') },
      { key: 'acteur_nom', label: t('admin:securityAudit.table.actor') },
      { key: 'acteur_email', label: 'Email' },
      { key: 'entity_type', label: t('admin:securityAudit.table.entity') },
      { key: 'entity_id', label: 'ID' },
      { key: 'details', label: t('admin:securityAudit.table.details') },
    ])
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <PageTransition>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-admin-accent" />
              <span className="text-xs font-medium text-admin-accent">{t('admin:common.adminBadge')}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Shield className="h-5 w-5 text-theme-secondary" />
              <h1 className="text-2xl font-semibold text-theme-primary">{t('admin:securityAudit.title')}</h1>
            </div>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {t('admin:securityAudit.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handlePdfExport()}
              disabled={pdfExporting}
              className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              {pdfExporting ? t('admin:securityAudit.pdfExporting') : t('admin:securityAudit.exportPdf')}
            </button>
            <button
              onClick={handleExport}
              disabled={!filtered.length}
              className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {t('admin:common.exportCsv')}
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <AdminKpiCard
            label={t('admin:securityAudit.kpi.criticalEvents')}
            value={isLoading ? '...' : stats.critical}
            subtitle={t('admin:common.last7Days')}
            icon={AlertTriangle}
            variant={stats.critical > 0 ? 'danger' : 'default'}
          />
          <AdminKpiCard
            label={t('admin:securityAudit.kpi.warnings')}
            value={isLoading ? '...' : stats.warning}
            subtitle={t('admin:common.last7Days')}
            icon={AlertCircle}
          />
          <AdminKpiCard
            label={t('admin:securityAudit.kpi.totalEvents')}
            value={isLoading ? '...' : stats.total}
            subtitle={t('admin:common.last7Days')}
            icon={Info}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Severity pills */}
          <div className="flex items-center gap-1 rounded-lg border border-theme-border p-0.5">
            {SEVERITY_PILL_VALUES.map(val => (
              <button
                key={val}
                onClick={() => handleSeverityChange(val)}
                className={cn(
                  'h-8 px-3 rounded-md text-sm transition-colors',
                  severityFilter === val
                    ? 'bg-theme-active text-theme-primary font-medium'
                    : 'text-theme-secondary hover:text-theme-primary'
                )}
              >
                {val === 'all' ? t('admin:common.all') : t(`admin:common.severity.${val}`)}
              </button>
            ))}
          </div>

          {/* Action dropdown */}
          <div className="relative">
            <select
              value={actionFilter}
              onChange={e => handleActionChange(e.target.value)}
              className="h-9 pl-3 pr-8 text-sm bg-transparent border border-theme-border rounded-lg text-theme-secondary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent appearance-none cursor-pointer"
            >
              <option value="all">{t('admin:securityAudit.allActions')}</option>
              {SENSITIVE_ACTIONS.map(action => (
                <option key={action} value={action}>
                  {AUDIT_ACTION_LABELS[action] ?? action}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder={t('admin:securityAudit.searchPlaceholder')}
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-primary placeholder:text-theme-muted"
            />
          </div>
        </div>

        {/* Audit table */}
        <div className="rounded-xl border border-theme-border overflow-hidden">
          {/* Table header */}
          <div className="flex items-center px-4 py-2.5 bg-theme-section text-xs font-medium text-theme-secondary border-b border-theme-border">
            <div className="w-[140px] shrink-0">{t('admin:securityAudit.table.timestamp')}</div>
            <div className="w-[100px] shrink-0">{t('admin:securityAudit.table.severity')}</div>
            <div className="w-[180px] shrink-0">{t('admin:securityAudit.table.action')}</div>
            <div className="w-[180px] shrink-0">{t('admin:securityAudit.table.actor')}</div>
            <div className="flex-1 min-w-0">{t('admin:securityAudit.table.details')}</div>
            <div className="w-[100px] shrink-0 text-right">{t('admin:securityAudit.table.entity')}</div>
          </div>

          {/* Table body */}
          {isLoading ? (
            <SkeletonRows />
          ) : paginated.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Shield className="h-8 w-8 text-theme-tertiary mx-auto mb-2" />
              <p className="text-sm text-theme-secondary">{t('admin:securityAudit.empty.title')}</p>
              <p className="text-xs text-theme-tertiary mt-1">{t('admin:securityAudit.empty.subtitle')}</p>
            </div>
          ) : (
            paginated.map((entry, i) => {
              const severity = getActionSeverity(entry.action)
              const isExpanded = expandedRow === entry.id
              return (
                <div key={entry.id}>
                  <button
                    onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                    className={cn(
                      'w-full flex items-center px-4 py-3 text-left hover:bg-theme-hover transition-colors cursor-pointer',
                      i < paginated.length - 1 && !isExpanded && 'border-b border-theme-border'
                    )}
                  >
                    {/* Timestamp */}
                    <div className="w-[140px] shrink-0 text-xs text-theme-secondary font-mono">
                      {formatTimestamp(entry.created_at)}
                    </div>

                    {/* Severity */}
                    <div className="w-[100px] shrink-0 flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', severityDot(severity))} />
                      <span className="text-xs text-theme-secondary">{t(`admin:common.severity.${severity}`)}</span>
                    </div>

                    {/* Action */}
                    <div className="w-[180px] shrink-0">
                      <span className="text-sm text-theme-primary">
                        {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                    </div>

                    {/* Actor */}
                    <div className="w-[180px] shrink-0 min-w-0">
                      {entry.actor_name ? (
                        <div>
                          <p className="text-sm text-theme-primary truncate">{entry.actor_name}</p>
                          <p className="text-xs text-theme-tertiary truncate">{entry.actor_email}</p>
                        </div>
                      ) : entry.actor_id === 'ai' ? (
                        <span className="text-sm text-theme-secondary">{t('admin:securityAudit.megaAi')}</span>
                      ) : (
                        <span className="text-xs text-theme-tertiary">-</span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-theme-tertiary truncate">
                        {summarizeMetadata(entry.metadata)}
                      </p>
                    </div>

                    {/* Entity */}
                    <div className="w-[100px] shrink-0 text-right">
                      <span className="text-xs text-theme-secondary">{entry.entity_type}</span>
                    </div>
                  </button>

                  {/* Expanded metadata */}
                  {isExpanded && (
                    <div className={cn(
                      'px-4 py-3 bg-theme-section border-b border-theme-border',
                      i < paginated.length - 1 && 'border-b border-theme-border'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-theme-secondary">{t('admin:securityAudit.metadataFull')}</span>
                        <span className="text-xs text-theme-tertiary">ID: {entry.entity_id}</span>
                      </div>
                      <pre className="text-xs text-theme-secondary font-mono bg-theme-page rounded-lg p-3 overflow-x-auto max-h-48 scrollbar-hide">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-theme-tertiary">
              {t(filtered.length !== 1 ? 'admin:securityAudit.eventsTotal_plural' : 'admin:securityAudit.eventsTotal', { count: filtered.length })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Page précédente"
                className="h-7 w-7 rounded-md flex items-center justify-center text-theme-secondary hover:text-theme-primary disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .map((p, idx, arr) => {
                  const showEllipsis = idx > 0 && p - arr[idx - 1] > 1
                  return (
                    <span key={p} className="flex items-center">
                      {showEllipsis && <span className="text-xs text-theme-tertiary px-1">...</span>}
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
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Page suivante"
                className="h-7 w-7 rounded-md flex items-center justify-center text-theme-secondary hover:text-theme-primary disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
