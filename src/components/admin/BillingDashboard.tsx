/**
 * Tableau de bord facturation (section super-admin, accent violet).
 *
 * Alimenté par `useAdminBilling` — source Stripe si connecté, repli Supabase
 * sinon. Agrège KPI (MRR, revenu, ARPU, churn, échecs), répartition par plan,
 * historique de revenus sur 6 mois, renouvellements à venir et paiements récents.
 */
import { useTranslation } from 'react-i18next'
import { formatCHF, formatRelativeDate, cn } from '@/lib/utils'
import { useAdminBilling } from '@/hooks/useAdminBilling'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import { CreditCard, Zap } from 'lucide-react'
import { Icon2Users as Users, TrendDown as TrendingDown, TrendUp as TrendingUp, Dollar as DollarSign, Danger22 as AlertTriangle, TimeCircle as Clock } from '@/components/icons'

const PLAN_COLORS: Record<string, string> = {
  starter: '#94a3b8',
  pro: '#2563eb',
  entreprise: '#7c3aed',
  agency: '#7c3aed',
  unknown: '#d1d5db',
}

const PLAN_LABEL_KEYS: Record<string, string> = {
  starter: 'common.plan.starter',
  pro: 'common.plan.pro',
  entreprise: 'common.plan.entreprise',
  agency: 'common.plan.agency',
}

const PAYMENT_STATUS_KEYS: Record<string, { dot: string; key: string }> = {
  succeeded: { dot: 'bg-emerald-500', key: 'billing.payment.status.succeeded' },
  failed: { dot: 'bg-red-500', key: 'billing.payment.status.failed' },
  refunded: { dot: 'bg-amber-500', key: 'billing.payment.status.refunded' },
}

/** Vue facturation complète : bloc KPI + trois panneaux (plans, revenus, renouvellements) + table paiements. */
export default function BillingDashboard() {
  'use no memo'
  const { t } = useTranslation('admin')
  const { data, isLoading } = useAdminBilling()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-5 animate-pulse">
              <div className="h-3 bg-theme-hover rounded w-20 mb-3" />
              <div className="h-7 bg-theme-hover rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="rounded-xl border border-theme-border p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-theme-primary">{t('billing.title')}</h2>
        {data.source === 'stripe' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <Zap className="h-3 w-3" />
            {t('billing.stripeConnected')}
          </span>
        )}
        {data.source === 'supabase' && (
          <span className="text-xs text-theme-muted">{t('billing.supabaseSource')}</span>
        )}
      </div>

      {/* KPI grid — compact 3 columns on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <AdminKpiCard compact label={t('billing.kpi.mrr')} value={formatCHF(data.mrr)} icon={CreditCard} variant="success" />
        <AdminKpiCard compact label={t('billing.kpi.revenue')} value={formatCHF(data.revenueThisMonth)} icon={DollarSign} variant="success"
          trend={data.revenueGrowth !== 0 ? { value: data.revenueGrowth, label: '' } : undefined} />
        <AdminKpiCard compact label={t('billing.kpi.subscriptions')} value={data.activeSubscriptions} icon={Users} variant="blue" />
        <AdminKpiCard compact label={t('billing.kpi.arpu')} value={formatCHF(data.arpu)} icon={TrendingUp} />
        <AdminKpiCard compact label={t('billing.kpi.churn')} value={data.churnedThisMonth} icon={TrendingDown}
          variant={data.churnedThisMonth > 0 ? 'danger' : 'default'} />
        <AdminKpiCard compact label={t('billing.kpi.failed')} value={data.failedPaymentsThisMonth + data.pastDue} icon={AlertTriangle}
          variant={(data.failedPaymentsThisMonth + data.pastDue) > 0 ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plan breakdown */}
        <div className="rounded-xl border border-theme-border p-5">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">{t('billing.plans')}</h3>
          {data.planBreakdown.length === 0 ? (
            <p className="text-sm text-theme-secondary py-4 text-center">{t('billing.noSubscription')}</p>
          ) : (
            <div className="space-y-3">
              {data.planBreakdown.map(p => {
                const total = data.activeSubscriptions || 1
                const pct = Math.round((p.count / total) * 100)
                return (
                  <div key={p.plan}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PLAN_COLORS[p.plan] ?? PLAN_COLORS.unknown }} />
                        <span className="text-sm text-theme-primary font-medium">{PLAN_LABEL_KEYS[p.plan] ? t(PLAN_LABEL_KEYS[p.plan]) : p.plan}</span>
                      </div>
                      <span className="text-xs text-theme-secondary">{p.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-theme-hover">
                      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: PLAN_COLORS[p.plan] ?? PLAN_COLORS.unknown }} />
                    </div>
                    <p className="text-xs text-theme-muted mt-0.5">{formatCHF(p.mrr)}/mois</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Revenue history */}
        <div className="rounded-xl border border-theme-border p-5">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">{t('billing.revenue6Months')}</h3>
          {data.revenueHistory.length === 0 ? (
            <p className="text-sm text-theme-secondary py-4 text-center">{t('common.noData')}</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {data.revenueHistory.map((m, i) => {
                const max = Math.max(...data.revenueHistory.map(h => h.amount), 1)
                const height = Math.max((m.amount / max) * 100, 4)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-theme-muted">{m.amount > 0 ? formatCHF(m.amount) : '-'}</span>
                    <div className="w-full rounded-t" style={{ height: `${height}%`, backgroundColor: 'rgb(var(--color-admin-accent))' }} />
                    <span className="text-xs text-theme-muted">{m.month}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Upcoming renewals */}
        <div className="rounded-xl border border-theme-border p-5">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">{t('billing.upcomingRenewals')}</h3>
          {data.upcomingRenewals.length === 0 ? (
            <p className="text-sm text-theme-secondary py-4 text-center">{t('billing.noRenewals')}</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingRenewals.map((r, i) => {
                const date = new Date(r.date * 1000)
                const daysUntil = Math.ceil((date.getTime() - Date.now()) / 86400000)
                return (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <Clock className="h-3.5 w-3.5 text-theme-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-theme-primary truncate">{formatCHF(r.amount)}</p>
                    </div>
                    <span className={cn(
                      'text-xs font-medium',
                      daysUntil <= 3 ? 'text-amber-500' : 'text-theme-muted'
                    )}>
                      {daysUntil <= 0 ? "Aujourd'hui" : `J-${daysUntil}`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent payments table */}
      {data.recentPayments.length > 0 && (
        <div className="rounded-xl border border-theme-border p-5">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">{t('billing.recentPayments')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme-border text-xs text-theme-secondary">
                  <th className="text-left py-2 font-medium">{t('billing.payment.table.email')}</th>
                  <th className="text-left py-2 font-medium">{t('billing.payment.table.description')}</th>
                  <th className="text-right py-2 font-medium">{t('billing.payment.table.amount')}</th>
                  <th className="text-center py-2 font-medium">{t('billing.payment.table.status')}</th>
                  <th className="text-right py-2 font-medium">{t('billing.payment.table.date')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map(p => {
                  const statusCfg = PAYMENT_STATUS_KEYS[p.status]
                  const statusInfo = statusCfg ? { dot: statusCfg.dot, label: t(statusCfg.key) } : { dot: 'bg-theme-muted', label: p.status }
                  return (
                    <tr key={p.id} className="border-b border-theme-border/50 last:border-0">
                      <td className="py-2.5 text-theme-primary">{p.customer_email ?? '-'}</td>
                      <td className="py-2.5 text-theme-secondary text-xs truncate max-w-[200px]">{p.description ?? '-'}</td>
                      <td className="py-2.5 text-right font-medium text-theme-primary">{formatCHF(p.amount)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full', statusInfo.dot)} />
                          <span className="text-xs text-theme-secondary">{statusInfo.label}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-xs text-theme-muted">{formatRelativeDate(p.created)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
