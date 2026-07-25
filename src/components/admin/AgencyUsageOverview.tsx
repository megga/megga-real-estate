// P6a — Bloc repliable « Usage par agence » (super-admin) dans AdminAgenciesPage.
// Tableau comparatif (RPC get_admin_usage_overview, tri coût IA décroissant
// côté serveur), % des caps configurés. Chargé à la demande (au dépli).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronDown, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminUsageOverview, type UsageOverviewRow } from '@/hooks/useAdminUsageOverview'

function CapCell({ used, cap, threshold }: { used: number; cap: number | null | undefined; threshold: number }) {
  if (cap == null) return <span className="text-theme-muted">{used}</span>
  const over = cap > 0 && used >= cap
  const breached = cap > 0 && used >= cap * threshold / 100
  return (
    <span className={cn('font-medium', over ? 'text-red-500' : breached ? 'text-amber-500' : 'text-theme-secondary')}>
      {used}<span className="text-theme-muted">/{cap}</span>
    </span>
  )
}

export default function AgencyUsageOverview() {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const { data: rows, isLoading, isError } = useAdminUsageOverview(open)

  return (
    <div className="rounded-xl border border-theme-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-hover transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-theme-primary">
          <BarChart3 className="h-4 w-4 text-admin-accent" />
          {t('usage.overview.title')}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-theme-tertiary transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-theme-border">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-theme-tertiary">{t('common.loading')}</div>
          ) : isError ? (
            <div className="px-4 py-8 text-center text-sm text-theme-tertiary">{t('usage.error')}</div>
          ) : (rows ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-theme-tertiary">{t('usage.overview.empty')}</div>
          ) : (
            <div className="overflow-x-auto scrollbar-hide">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[1.5fr_90px_90px_90px_90px_80px] px-4 py-2 bg-theme-hover text-xs font-medium text-theme-tertiary tracking-wide">
                  <span>{t('usage.overview.agency')}</span>
                  <span className="text-right">{t('usage.overview.aiCost')}</span>
                  <span className="text-right">{t('usage.overview.properties')}</span>
                  <span className="text-right">{t('usage.overview.whatsapp')}</span>
                  <span className="text-right">{t('usage.overview.storage')}</span>
                  <span className="text-right">{t('usage.overview.portals')}</span>
                </div>
                {(rows as UsageOverviewRow[]).map((r, i) => {
                  const threshold = r.caps?.alert_threshold_pct ?? 80
                  return (
                    <Link
                      key={r.agency_id}
                      to={`/agencies/${r.agency_id}`}
                      className={cn('grid grid-cols-[1.5fr_90px_90px_90px_90px_80px] px-4 py-2.5 text-xs items-center hover:bg-theme-hover transition-colors', i > 0 && 'border-t border-theme-border-subtle')}
                    >
                      <span className="text-theme-primary font-medium truncate pr-2">{r.agency_name}</span>
                      <span className="text-right">
                        <CapCell used={Math.round(r.ai_cost_month_usd * 100) / 100} cap={r.caps?.ai_monthly_cost_cap_usd} threshold={threshold} />
                      </span>
                      <span className="text-right">
                        <CapCell used={r.active_properties} cap={r.caps?.active_properties_cap} threshold={threshold} />
                      </span>
                      <span className="text-right">
                        <CapCell used={r.wa_messages_month} cap={r.caps?.whatsapp_monthly_cap} threshold={threshold} />
                      </span>
                      <span className="text-right">
                        <CapCell used={r.storage_est_mb} cap={r.caps?.storage_cap_mb} threshold={threshold} />
                      </span>
                      <span className="text-right text-theme-secondary">{r.portals_active}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
