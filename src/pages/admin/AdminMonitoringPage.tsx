import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, Zap, Mail, CheckCircle, AlertTriangle, Search, HardDrive, Globe } from 'lucide-react'
import { useAdminMonitoring } from '@/hooks/useAdminMonitoring'
import { cn, formatRelativeDate } from '@/lib/utils'

type FunctionFilter = 'all' | 'healthy' | 'error' | 'unknown'

export default function AdminMonitoringPage() {
  const { t } = useTranslation('admin')
  const { health, healthLoading, edgeFunctions, edgeFunctionsLoading, errorLogs, errorLogsLoading } = useAdminMonitoring()
  const [errorSearch, setErrorSearch] = useState('')
  const [fnFilter, setFnFilter] = useState<FunctionFilter>('all')
  const [fnSearch, setFnSearch] = useState('')
  const [expandedError, setExpandedError] = useState<string | null>(null)

  const filteredErrors = useMemo(() => {
    if (!errorSearch.trim()) return errorLogs
    const q = errorSearch.toLowerCase()
    return errorLogs.filter(
      (e) =>
        (e.function_name ?? '').toLowerCase().includes(q) ||
        (e.error_message ?? '').toLowerCase().includes(q) ||
        e.entity_type.toLowerCase().includes(q)
    )
  }, [errorLogs, errorSearch])

  const filteredFunctions = useMemo(() => {
    let list = [...edgeFunctions]
    if (fnFilter !== 'all') list = list.filter(f => f.status === fnFilter)
    if (fnSearch) {
      const q = fnSearch.toLowerCase()
      list = list.filter(f => f.name.toLowerCase().includes(q))
    }
    return list
  }, [edgeFunctions, fnFilter, fnSearch])

  const dbPercent = health ? Math.round((health.dbSizeMb / health.dbLimitMb) * 100) : 0
  const dbColor = dbPercent >= 90 ? 'bg-red-500' : dbPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  const dbTextColor = dbPercent >= 90 ? 'text-red-500' : dbPercent >= 70 ? 'text-amber-500' : 'text-emerald-500'
  const storagePercent = health ? Math.round((health.storageUsedMb / health.storageLimitMb) * 100) : 0

  const healthyCount = edgeFunctions.filter(f => f.status === 'healthy').length
  const errorCount = edgeFunctions.filter(f => f.status === 'error').length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-semibold text-admin-accent">{t('admin:common.adminBadge')}</span>
        </div>
        <h1 className="text-xl font-semibold text-theme-primary">{t('admin:monitoring.title')}</h1>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-emerald-600 font-medium">{t('admin:monitoring.planPro')}</span>
        </div>
      </div>

      {/* Health indicators — 6 cards */}
      {healthLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-5 animate-pulse">
              <div className="h-3 bg-theme-hover rounded w-24 mb-3" />
              <div className="h-6 bg-theme-hover rounded w-16" />
            </div>
          ))}
        </div>
      ) : health ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* DB */}
          <div className="rounded-xl border border-theme-border p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Database className="h-3.5 w-3.5 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary tracking-wide">{t('admin:monitoring.health.database')}</span>
            </div>
            <span className={cn('text-lg font-bold', dbTextColor)}>{health.dbSizeMb} MB</span>
            <div className="w-full h-1 rounded-full bg-theme-hover mt-2">
              <div className={cn('h-full rounded-full', dbColor)} style={{ width: `${Math.min(dbPercent, 100)}%` }} />
            </div>
            <p className="text-xs text-theme-muted mt-1">/ {(health.dbLimitMb / 1000).toFixed(0)} GB ({dbPercent}%)</p>
          </div>

          {/* Edge Functions */}
          <div className="rounded-xl border border-theme-border p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary tracking-wide">{t('admin:monitoring.health.functions')}</span>
            </div>
            <span className="text-lg font-bold text-theme-primary">{health.totalEdgeFunctions}</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-emerald-600">{healthyCount} {t('admin:monitoring.health.ok')}</span>
              {errorCount > 0 && <span className="text-xs text-red-500">{errorCount} {t('admin:monitoring.health.err')}</span>}
            </div>
          </div>

          {/* Errors 24h */}
          <div className="rounded-xl border border-theme-border p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary tracking-wide">{t('admin:monitoring.health.errors24h')}</span>
            </div>
            <span className={cn('text-lg font-bold', health.errorsLast24h === 0 ? 'text-emerald-600' : 'text-red-500')}>
              {health.errorsLast24h}
            </span>
          </div>

          {/* API Requests */}
          <div className="rounded-xl border border-theme-border p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Globe className="h-3.5 w-3.5 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary tracking-wide">{t('admin:monitoring.health.requests')}</span>
            </div>
            <span className="text-lg font-bold text-theme-primary">{health.apiRequestsToday}</span>
            <p className="text-xs text-theme-muted mt-1">{t('admin:monitoring.health.todayLabel')}</p>
          </div>

          {/* Emails */}
          <div className="rounded-xl border border-theme-border p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Mail className="h-3.5 w-3.5 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary tracking-wide">{t('admin:monitoring.health.emails')}</span>
            </div>
            <span className="text-lg font-bold text-theme-primary">{health.emailsSentToday}</span>
            <p className="text-xs text-theme-muted mt-1">{t('admin:monitoring.health.todayLabel')}</p>
          </div>

          {/* Storage */}
          <div className="rounded-xl border border-theme-border p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <HardDrive className="h-3.5 w-3.5 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary tracking-wide">{t('admin:monitoring.health.storage')}</span>
            </div>
            <span className="text-lg font-bold text-theme-primary">{health.storageUsedMb} MB</span>
            <div className="w-full h-1 rounded-full bg-theme-hover mt-2">
              <div className="h-full rounded-full bg-admin-accent" style={{ width: `${Math.min(storagePercent, 100)}%` }} />
            </div>
            <p className="text-xs text-theme-muted mt-1">/ {(health.storageLimitMb / 1000).toFixed(0)} GB</p>
          </div>
        </div>
      ) : null}

      {/* Edge Functions table — per-function status */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-theme-primary">{t('admin:monitoring.edgeFunctions')} ({edgeFunctions.length})</h2>
          <div className="flex items-center gap-2">
            {/* Status filter pills */}
            {(['all', 'healthy', 'error', 'unknown'] as FunctionFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFnFilter(f)}
                className={cn(
                  'h-7 px-2.5 rounded-lg text-xs font-medium transition-colors',
                  fnFilter === f ? 'bg-theme-active text-theme-primary' : 'text-theme-muted hover:text-theme-primary'
                )}
              >
                {f === 'all' ? t('admin:monitoring.edgeFunctions.filter.all') : f === 'healthy' ? t('admin:monitoring.edgeFunctions.filter.ok') : f === 'error' ? t('admin:monitoring.edgeFunctions.filter.error') : t('admin:monitoring.edgeFunctions.filter.unknown')}
              </button>
            ))}
            <div className="relative ml-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-muted" />
              <input
                type="text"
                placeholder={t('admin:monitoring.edgeFunctions.filterPlaceholder')}
                value={fnSearch}
                onChange={e => setFnSearch(e.target.value)}
                className="h-7 pl-8 pr-3 text-xs bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent text-theme-primary placeholder:text-theme-muted w-36"
              />
            </div>
          </div>
        </div>

        {edgeFunctionsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 bg-theme-hover rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme-border text-xs text-theme-secondary">
                  <th className="text-left py-2 font-medium">{t('admin:monitoring.edgeFunctions.table.function')}</th>
                  <th className="text-center py-2 font-medium w-16">{t('admin:monitoring.edgeFunctions.table.status')}</th>
                  <th className="text-right py-2 font-medium w-24">{t('admin:monitoring.edgeFunctions.table.invocations')}</th>
                  <th className="text-right py-2 font-medium w-20">{t('admin:monitoring.edgeFunctions.table.errors')}</th>
                  <th className="text-right py-2 font-medium w-32">{t('admin:monitoring.edgeFunctions.table.lastInvocation')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredFunctions.map(fn => (
                  <tr key={fn.name} className="border-b border-theme-border/50 last:border-0 hover:bg-theme-hover/50 transition-colors">
                    <td className="py-2.5">
                      <span className="font-mono text-sm text-theme-primary">{fn.name}</span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={cn(
                        'w-2 h-2 rounded-full inline-block',
                        fn.status === 'healthy' ? 'bg-emerald-500' : fn.status === 'error' ? 'bg-red-500' : 'bg-theme-muted'
                      )} />
                    </td>
                    <td className="py-2.5 text-right text-theme-secondary">{fn.invocationsLast24h}</td>
                    <td className="py-2.5 text-right">
                      <span className={fn.errorsLast24h > 0 ? 'text-red-500 font-medium' : 'text-theme-muted'}>
                        {fn.errorsLast24h}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-xs text-theme-muted">
                      {fn.lastInvocation ? formatRelativeDate(fn.lastInvocation) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error logs — expandable */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-theme-primary">{t('admin:monitoring.errorLogs')}</h2>
            <span className="text-xs text-theme-muted">({errorLogs.length})</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-muted" />
            <input
              type="text"
              placeholder={t('admin:monitoring.errorLogs.filterPlaceholder')}
              value={errorSearch}
              onChange={(e) => setErrorSearch(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent text-theme-primary placeholder:text-theme-muted w-64"
            />
          </div>
        </div>

        {errorLogsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-theme-hover rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredErrors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-500 mb-3" />
            <p className="text-sm font-medium text-theme-primary">{t('admin:monitoring.errorLogs.noErrors')}</p>
            <p className="text-xs text-theme-muted mt-1">{t('admin:monitoring.errorLogs.noErrorsSubtitle')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredErrors.map((err) => {
              const isExpanded = expandedError === err.id
              return (
                <div key={err.id}>
                  <button
                    onClick={() => setExpandedError(isExpanded ? null : err.id)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg border-l-4 border-l-red-500 bg-theme-hover/50 hover:bg-theme-hover transition-colors text-left"
                  >
                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-admin-accent bg-admin-accent/10 px-1.5 py-0.5 rounded">
                          {err.function_name ?? err.entity_type}
                        </span>
                        {err.duration_ms && (
                          <span className="text-xs text-theme-muted">{err.duration_ms}ms</span>
                        )}
                      </div>
                      <p className="text-xs text-theme-secondary mt-1 truncate">
                        {err.error_message || JSON.stringify(err.metadata).slice(0, 120)}
                      </p>
                    </div>
                    <span className="text-xs text-theme-muted flex-shrink-0 whitespace-nowrap">
                      {formatRelativeDate(err.created_at)}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-7 mt-1 p-3 rounded-lg bg-theme-section text-xs">
                      <pre className="font-mono text-theme-secondary whitespace-pre-wrap break-all">
                        {JSON.stringify(err.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
