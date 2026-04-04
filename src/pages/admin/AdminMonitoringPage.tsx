import { useState, useMemo } from 'react'
import { Database, Zap, Clock, Mail, CheckCircle, AlertTriangle, Search } from 'lucide-react'
import { useAdminMonitoring } from '@/hooks/useAdminMonitoring'
import { cn, formatRelativeDate } from '@/lib/utils'

const EDGE_FUNCTIONS = [
  'ai-copilot',
  'ai-search',
  'external-matching',
  'send-email',
  'send-property-email',
  'send-reminder-email',
  'send-team-invite',
  'send-visit-email',
  'support-chatbot',
  'extract-property-pdf',
  'extract-property-url',
  'kyc-screening',
  'photo-labeler',
  'virtual-staging',
  'public-staging',
  'google-calendar-sync',
  'outlook-calendar-sync',
  'stripe-checkout',
  'stripe-portal',
  'stripe-webhook',
  'score-engine',
  'search-alert',
  'market-scraper',
  'market-scraper-batch',
  'automation-engine',
  'accept-team-invite',
  'webhooks',
  'admin-monitoring',
] as const

export default function AdminMonitoringPage() {
  const { health, healthLoading, errorLogs, errorLogsLoading } = useAdminMonitoring()
  const [errorSearch, setErrorSearch] = useState('')

  const filteredErrors = useMemo(() => {
    if (!errorSearch.trim()) return errorLogs
    const q = errorSearch.toLowerCase()
    return errorLogs.filter(
      (e) =>
        e.entity_type.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        JSON.stringify(e.metadata).toLowerCase().includes(q)
    )
  }, [errorLogs, errorSearch])

  const dbPercent = health ? Math.round((health.dbSizeMb / health.dbLimitMb) * 100) : 0
  const dbColor = dbPercent >= 90 ? 'bg-red-500' : dbPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  const dbTextColor = dbPercent >= 90 ? 'text-red-500' : dbPercent >= 70 ? 'text-amber-500' : 'text-emerald-500'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with admin badge */}
      <div className="flex items-center gap-3">
        <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-semibold text-admin-accent">Admin MEGGA</span>
        </div>
        <h1 className="text-xl font-semibold text-theme-primary">Monitoring</h1>
      </div>

      {/* Section 1: Health indicators */}
      {healthLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-5 animate-pulse">
              <div className="h-3 bg-theme-hover rounded w-24 mb-3" />
              <div className="h-6 bg-theme-hover rounded w-16" />
            </div>
          ))}
        </div>
      ) : health ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* DB Size */}
          <div className="rounded-xl border border-theme-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary">Base de donnees</span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className={cn('text-xl font-bold', dbTextColor)}>{health.dbSizeMb} MB</span>
              <span className="text-xs text-theme-muted">/ {health.dbLimitMb} MB</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-theme-hover">
              <div className={cn('h-full rounded-full transition-all', dbColor)} style={{ width: `${dbPercent}%` }} />
            </div>
            <p className="text-xs text-theme-muted mt-1.5">{dbPercent}% utilise</p>
          </div>

          {/* Edge Functions */}
          <div className="rounded-xl border border-theme-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary">Edge Functions</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-theme-primary">{health.totalEdgeFunctions}</span>
              <span className="text-xs text-theme-muted">fonctions</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <div className={cn('w-2 h-2 rounded-full', health.errorsLast24h === 0 ? 'bg-emerald-500' : 'bg-red-500')} />
              <span className={cn('text-xs', health.errorsLast24h === 0 ? 'text-emerald-600' : 'text-red-500')}>
                {health.errorsLast24h === 0 ? 'Aucune erreur (24h)' : `${health.errorsLast24h} erreur${health.errorsLast24h > 1 ? 's' : ''} (24h)`}
              </span>
            </div>
          </div>

          {/* Scraping */}
          <div className="rounded-xl border border-theme-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary">Dernier scraping</span>
            </div>
            {health.lastScrapingRun ? (
              <>
                <span className="text-xl font-bold text-theme-primary">
                  {formatRelativeDate(health.lastScrapingRun)}
                </span>
              </>
            ) : (
              <span className="text-sm text-theme-muted">Aucun run</span>
            )}
          </div>

          {/* Emails */}
          <div className="rounded-xl border border-theme-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-theme-secondary" />
              <span className="text-xs font-medium text-theme-secondary">Emails envoyes</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-theme-primary">{health.emailsSentToday}</span>
              <span className="text-xs text-theme-muted">aujourd'hui</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Section 2: Edge Functions list */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-sm font-semibold text-theme-primary mb-4">
          Edge Functions ({EDGE_FUNCTIONS.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1.5">
          {EDGE_FUNCTIONS.map((fn) => (
            <div key={fn} className="flex items-center gap-2 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-sm text-theme-secondary font-mono truncate">{fn}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Error logs feed */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-theme-primary">Erreurs recentes</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-muted" />
            <input
              type="text"
              placeholder="Filtrer..."
              value={errorSearch}
              onChange={(e) => setErrorSearch(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent text-theme-primary placeholder:text-theme-muted w-48"
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
            <p className="text-sm font-medium text-theme-primary">Aucune erreur recente</p>
            <p className="text-xs text-theme-muted mt-1">Toutes les fonctions operent normalement</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredErrors.map((err) => {
              const summary = err.metadata
                ? JSON.stringify(err.metadata).slice(0, 120)
                : 'Pas de details'
              return (
                <div
                  key={err.id}
                  className="flex items-start gap-3 p-3 rounded-lg border-l-4 border-l-red-500 bg-theme-hover/50"
                >
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-theme-primary">{err.entity_type}</span>
                    </div>
                    <p className="text-xs text-theme-muted mt-0.5 truncate">{summary}</p>
                  </div>
                  <span className="text-xs text-theme-muted flex-shrink-0 whitespace-nowrap">
                    {formatRelativeDate(err.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
