// Panneaux ops admin (P3) — syndication IDX + WhatsApp ops (AdminMonitoringPage)
// et coûts IA par agence (AdminToolUsagePage). Données : useAdminOpsHealth
// (3 RPC serveur, migration 20260705172000).

import { useTranslation } from 'react-i18next'
import { Radio, MessageSquareWarning, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useSyndicationHealth, useWhatsAppHealth, useAiCosts } from '@/hooks/useAdminOpsHealth'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(new Date(iso), 'dd.MM.yyyy HH:mm')
  } catch {
    return iso
  }
}

function statusChipColor(status: string): string {
  switch (status) {
    case 'published': return 'text-emerald-500'
    case 'queued': return 'text-amber-500'
    case 'error': return 'text-red-500'
    case 'withdrawn': return 'text-theme-muted'
    default: return 'text-theme-secondary'
  }
}

// ── Syndication IDX ──────────────────────────────────────────────────────────
export function SyndicationHealthPanel() {
  const { t } = useTranslation('admin')
  const { data, isLoading, isError } = useSyndicationHealth()

  return (
    <div className="rounded-xl border border-theme-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-theme-secondary" />
          <h2 className="text-sm font-semibold text-theme-primary">{t('monitoring.syndication.title')}</h2>
        </div>
        <span className="text-xs text-theme-tertiary">
          {t('monitoring.syndication.lastPush')} {formatDateTime(data?.last_push_at ?? null)}
        </span>
      </div>

      {isLoading ? (
        <div className="h-16 bg-theme-hover rounded-lg animate-pulse" />
      ) : isError ? (
        <p className="text-sm text-red-500">{t('monitoring.syndication.error')}</p>
      ) : !data || data.by_status.length === 0 ? (
        <p className="text-sm text-theme-muted">{t('monitoring.syndication.empty')}</p>
      ) : (
        <div className="space-y-4">
          {/* Statuts par portail */}
          <div className="flex flex-wrap gap-4">
            {data.by_status.map((row) => (
              <div key={`${row.portal}-${row.status}`} className="flex items-baseline gap-1.5 text-sm">
                <span className={cn('font-semibold', statusChipColor(row.status))}>{row.count}</span>
                <span className="text-theme-secondary">
                  {t(`monitoring.syndication.status.${row.status}`, { defaultValue: row.status })}
                </span>
                <span className="text-xs text-theme-muted">· {row.portal}</span>
              </div>
            ))}
          </div>

          {/* Dernières erreurs */}
          {data.recent_errors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-theme-secondary mb-1.5">
                {t('monitoring.syndication.recentErrors')}
              </p>
              <div className="space-y-1">
                {data.recent_errors.map((err, i) => (
                  <div key={`${err.property_id}-${i}`} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-red-500">{err.error ?? '—'}</span>
                    <span className="shrink-0 text-theme-tertiary">
                      {err.agency_name ?? '—'} · {formatDateTime(err.updated_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Config par agence */}
          {data.agencies.length > 0 && (
            <div>
              <p className="text-xs font-medium text-theme-secondary mb-1.5">
                {t('monitoring.syndication.agencies')}
              </p>
              <div className="space-y-1">
                {data.agencies.map((a) => (
                  <div key={a.agency_name} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-theme-primary">{a.agency_name}</span>
                    <span className="shrink-0 text-theme-tertiary">
                      {a.idx_enabled
                        ? t('monitoring.syndication.enabled')
                        : t('monitoring.syndication.disabled')}
                      {' · '}{a.transport}
                      {a.transport === 'ftp' && !a.ftp_configured && (
                        <span className="text-amber-500"> · {t('monitoring.syndication.ftpMissing')}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── WhatsApp ops ─────────────────────────────────────────────────────────────
export function WhatsAppOpsPanel() {
  const { t } = useTranslation('admin')
  const { data, isLoading, isError } = useWhatsAppHealth()

  const failureRate7d =
    data && data.sent_7d > 0 ? Math.round((data.failed_7d / data.sent_7d) * 100) : 0
  const webhookStale = data?.webhook_stale ?? false

  return (
    <div className="rounded-xl border border-theme-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquareWarning className="h-4 w-4 text-theme-secondary" />
        <h2 className="text-sm font-semibold text-theme-primary">{t('monitoring.whatsapp.title')}</h2>
      </div>

      {isLoading ? (
        <div className="h-16 bg-theme-hover rounded-lg animate-pulse" />
      ) : isError ? (
        <p className="text-sm text-red-500">{t('monitoring.whatsapp.error')}</p>
      ) : !data ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-theme-muted">{t('monitoring.whatsapp.sent24h')}</p>
              <p className="font-semibold text-theme-primary">{data.sent_24h}</p>
            </div>
            <div>
              <p className="text-xs text-theme-muted">{t('monitoring.whatsapp.failed24h')}</p>
              <p className={cn('font-semibold', data.failed_24h > 0 ? 'text-red-500' : 'text-theme-primary')}>
                {data.failed_24h}
              </p>
            </div>
            <div>
              <p className="text-xs text-theme-muted">{t('monitoring.whatsapp.failureRate7d')}</p>
              <p className={cn('font-semibold', failureRate7d > 5 ? 'text-red-500' : 'text-theme-primary')}>
                {failureRate7d}%
              </p>
            </div>
            <div>
              <p className="text-xs text-theme-muted">{t('monitoring.whatsapp.unmappedInbound')}</p>
              <p className="font-semibold text-theme-primary">{data.unmapped_inbound_7d}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-theme-tertiary">
            <span>
              {t('monitoring.whatsapp.lastStatusUpdate')}{' '}
              <span className={cn(webhookStale && 'text-amber-500')}>
                {formatDateTime(data.last_status_update_at)}
                {webhookStale && ` · ${t('monitoring.whatsapp.stale')}`}
              </span>
            </span>
            <span>
              {t('monitoring.whatsapp.lastInbound')} {formatDateTime(data.last_inbound_at)}
            </span>
            {data.cron_locks.map((lock) => (
              <span key={lock.job}>
                {lock.job} → {formatDateTime(lock.locked_until)}
              </span>
            ))}
          </div>

          {/* Dead-letters : files d'échec surveillées (migration 20260710163000).
              « Échecs livraison 24h » est déjà rendu ci-dessus (failed_24h). */}
          <div>
            <p className="text-xs font-medium text-theme-secondary mb-1.5">
              {t('monitoring.whatsapp.deadletters')}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-theme-muted">{t('monitoring.whatsapp.processingFailed')}</p>
                <p className={cn('font-semibold', data.processing_failed > 0 ? 'text-amber-500' : 'text-theme-primary')}>
                  {data.processing_failed}
                </p>
              </div>
              <div>
                <p className="text-xs text-theme-muted">{t('monitoring.whatsapp.processingDeadletter')}</p>
                <p className={cn('font-semibold', data.processing_deadletter > 0 ? 'text-red-500' : 'text-theme-primary')}>
                  {data.processing_deadletter}
                </p>
              </div>
              <div>
                <p className="text-xs text-theme-muted">{t('monitoring.whatsapp.agentErrors24h')}</p>
                <p className={cn('font-semibold', data.agent_errors_24h > 0 ? 'text-amber-500' : 'text-theme-primary')}>
                  {data.agent_errors_24h}
                </p>
              </div>
              <div>
                <p className="text-xs text-theme-muted">{t('monitoring.whatsapp.asyncJobsFailed24h')}</p>
                <p className={cn('font-semibold', data.async_jobs_failed_24h > 0 ? 'text-red-500' : 'text-theme-primary')}>
                  {data.async_jobs_failed_24h}
                </p>
              </div>
            </div>
          </div>

          {data.top_errors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-theme-secondary mb-1.5">
                {t('monitoring.whatsapp.topErrors')}
              </p>
              <div className="space-y-1">
                {data.top_errors.map((e) => (
                  <div key={e.error} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-theme-secondary">{e.error}</span>
                    <span className="shrink-0 font-medium text-red-500">{e.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Coûts IA par agence (AdminToolUsagePage) ─────────────────────────────────
export function AiCostsSection() {
  const { t } = useTranslation('admin')
  const { data, isLoading, isError } = useAiCosts(6)

  // Totaux par mois pour la ligne de tendance (les coûts sont en USD — on
  // affiche USD explicitement, pas de faux CHF).
  const byMonth = new Map<string, number>()
  for (const row of data ?? []) {
    byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + Number(row.cost_usd))
  }

  return (
    <div className="rounded-xl border border-theme-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Coins className="h-4 w-4 text-theme-secondary" />
        <h2 className="text-sm font-semibold text-theme-primary">{t('toolUsage.aiCosts.title')}</h2>
        <span className="text-xs text-theme-muted">· {t('toolUsage.aiCosts.subtitle')}</span>
      </div>

      {isLoading ? (
        <div className="h-16 bg-theme-hover rounded-lg animate-pulse" />
      ) : isError ? (
        <p className="text-sm text-red-500">{t('toolUsage.aiCosts.error')}</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-theme-muted">{t('toolUsage.aiCosts.empty')}</p>
      ) : (
        <div className="space-y-4">
          {/* Tendance mensuelle */}
          <div className="flex flex-wrap gap-4">
            {[...byMonth.entries()].map(([month, total]) => (
              <div key={month} className="text-sm">
                <p className="text-xs text-theme-muted">{format(new Date(month), 'MM.yyyy')}</p>
                <p className="font-semibold text-theme-primary">{total.toFixed(2)} USD</p>
              </div>
            ))}
          </div>

          {/* Détail agence × provider × module */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-theme-muted">
                  <th className="py-1.5 pr-3 font-medium">{t('toolUsage.aiCosts.table.month')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('toolUsage.aiCosts.table.agency')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('toolUsage.aiCosts.table.provider')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('toolUsage.aiCosts.table.module')}</th>
                  <th className="py-1.5 pr-3 font-medium text-right">{t('toolUsage.aiCosts.table.calls')}</th>
                  <th className="py-1.5 font-medium text-right">{t('toolUsage.aiCosts.table.cost')}</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-t border-theme-border-subtle">
                    <td className="py-1.5 pr-3 text-theme-tertiary">{format(new Date(row.month), 'MM.yyyy')}</td>
                    <td className="py-1.5 pr-3 text-theme-primary">{row.agency_name}</td>
                    <td className="py-1.5 pr-3 text-theme-secondary">{row.provider}</td>
                    <td className="py-1.5 pr-3 text-theme-secondary">{row.module}</td>
                    <td className="py-1.5 pr-3 text-right text-theme-secondary">{row.calls}</td>
                    <td className="py-1.5 text-right font-medium text-theme-primary">
                      {Number(row.cost_usd).toFixed(4)} USD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
