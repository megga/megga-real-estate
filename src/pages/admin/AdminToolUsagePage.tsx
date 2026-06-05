import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminToolUsage, type ToolUsageRow } from '@/hooks/useAdminToolUsage'
import { WHATSAPP_TOOL_CATALOG } from '@/lib/whatsapp-tools-catalog'

const TIER_BY_TOOL = new Map(WHATSAPP_TOOL_CATALOG.map((tt) => [tt.name, tt.tier]))

export default function AdminToolUsagePage() {
  const { t } = useTranslation('admin')
  const { data: observed = [], isLoading, error } = useAdminToolUsage()

  // La RPC ne renvoie que les outils observés. On complète avec les outils JAMAIS utilisés du
  // catalogue (lignes synthétiques 0 appel), pour une vue exhaustive. Les outils observés mais hors
  // catalogue restent en tête (vrais appels) avec un tier « hors catalogue ».
  const observedNames = new Set(observed.map((r) => r.tool))
  const neverUsedRows: ToolUsageRow[] = WHATSAPP_TOOL_CATALOG
    .filter((c) => !observedNames.has(c.name))
    .map((c) => ({ tool: c.name, total_calls: 0, error_count: 0, error_rate: 0, last_used_at: null }))
    .sort((a, b) => a.tool.localeCompare(b.tool))
  const rows: ToolUsageRow[] = [...observed, ...neverUsedRows]
  const total = WHATSAPP_TOOL_CATALOG.length
  const neverUsed = neverUsedRows.length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-semibold text-admin-accent">{t('common.adminBadge')}</span>
          </div>
          <Sparkles className="h-5 w-5 text-theme-secondary" />
          <h1 className="text-xl font-semibold text-theme-primary">{t('toolUsage.title')}</h1>
        </div>
        {!isLoading && (
          <p className="text-sm text-theme-tertiary mt-1">
            {t('toolUsage.subtitle', { neverUsed, total })}
          </p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {t('toolUsage.error')}
        </div>
      )}

      {/* Observe-only notice */}
      <div className="rounded-xl border border-theme-border bg-admin-accent/5 px-4 py-3 flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-admin-accent mt-0.5 shrink-0" />
        <p className="text-sm text-theme-secondary">{t('toolUsage.observeNote')}</p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-theme-border overflow-x-auto">
        <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary">
          <div className="flex-1">{t('toolUsage.col.tool')}</div>
          <div className="w-28">{t('toolUsage.col.tier')}</div>
          <div className="w-24 text-right">{t('toolUsage.col.calls')}</div>
          <div className="w-28 text-right">{t('toolUsage.col.errorRate')}</div>
          <div className="w-40 text-right">{t('toolUsage.col.lastUsed')}</div>
        </div>

        {isLoading && (
          <div className="px-4 py-12 text-center text-sm text-theme-tertiary">{t('common.loading')}</div>
        )}

        {!isLoading && rows.map((r, i) => {
          const tier = TIER_BY_TOOL.get(r.tool)
          const never = r.total_calls === 0
          const rate = Number(r.error_rate)
          return (
            <div
              key={r.tool}
              className={cn(
                'flex items-center px-4 py-3',
                i < rows.length - 1 && 'border-b border-theme-border',
                never && 'opacity-60'
              )}
            >
              <div className="flex-1 text-sm text-theme-primary font-mono">{r.tool}</div>
              <div className="w-28 text-sm text-theme-secondary">
                {tier ? t(`toolUsage.tier.${tier}`) : t('toolUsage.tier.unknown')}
              </div>
              <div className="w-24 text-right text-sm text-theme-secondary tabular-nums">{r.total_calls}</div>
              <div className="w-28 text-right text-sm tabular-nums">
                {never
                  ? <span className="text-theme-tertiary">—</span>
                  : <span className={cn(rate >= 0.2 ? 'text-red-500' : 'text-theme-secondary')}>{(rate * 100).toFixed(1)}%</span>}
              </div>
              <div className="w-40 text-right text-sm text-theme-tertiary">
                {r.last_used_at
                  ? new Date(r.last_used_at).toLocaleDateString('fr-CH')
                  : t('toolUsage.neverUsed')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
