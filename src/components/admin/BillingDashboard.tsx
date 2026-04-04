import { formatCHF, formatRelativeDate, cn } from '@/lib/utils'
import { useAdminBilling } from '@/hooks/useAdminBilling'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import { CreditCard, Users, TrendingDown, DollarSign } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const PLAN_COLORS: Record<string, string> = {
  starter: '#94a3b8',
  pro: '#2563eb',
  agency: '#7c3aed',
  unknown: '#d1d5db',
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
  unknown: 'Inconnu',
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  canceled: 'bg-red-500',
  past_due: 'bg-amber-500',
  trialing: 'bg-blue-500',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  canceled: 'Annule',
  past_due: 'Impaye',
  trialing: 'Essai',
}

export default function BillingDashboard() {
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
        <div className="rounded-xl border border-theme-border p-5 animate-pulse h-64" />
      </div>
    )
  }

  if (!data) return null

  const arpu = data.activeSubscriptions > 0
    ? Math.round(data.mrr / data.activeSubscriptions)
    : 0

  const pieData = data.planBreakdown.map(p => ({
    name: PLAN_LABELS[p.plan] ?? p.plan,
    value: p.count,
    revenue: p.revenue,
    fill: PLAN_COLORS[p.plan] ?? PLAN_COLORS.unknown,
  }))

  return (
    <div className="space-y-4">
      {/* Section title */}
      <h2 className="text-sm font-semibold text-theme-primary">Revenus & Abonnements</h2>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AdminKpiCard
          label="MRR"
          value={formatCHF(data.mrr)}
          icon={CreditCard}
        />
        <AdminKpiCard
          label="Abonnements actifs"
          value={data.activeSubscriptions}
          icon={Users}
          subtitle={`${data.totalSubscriptions} total`}
        />
        <AdminKpiCard
          label="Churn ce mois"
          value={data.churnedThisMonth}
          icon={TrendingDown}
          variant={data.churnedThisMonth > 0 ? 'danger' : 'default'}
        />
        <AdminKpiCard
          label="ARPU"
          value={formatCHF(arpu)}
          icon={DollarSign}
          subtitle="par abonnement actif"
        />
      </div>

      {/* Plan breakdown + Recent subs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Plan distribution */}
        <div className="rounded-xl border border-theme-border p-5">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">Repartition par plan</h3>
          {pieData.length === 0 ? (
            <p className="text-sm text-theme-secondary py-8 text-center">Aucun abonnement</p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-40 h-40 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload?.length) return null
                        const item = payload[0].payload as typeof pieData[number]
                        return (
                          <div className="rounded-lg border border-theme-border bg-theme-card p-2 text-xs">
                            <p className="font-medium text-theme-primary">{item.name}</p>
                            <p className="text-theme-secondary">{item.value} abonnement{item.value > 1 ? 's' : ''}</p>
                            <p className="text-theme-secondary">{formatCHF(Math.round(item.revenue))}/mois</p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {data.planBreakdown.map(p => {
                  const total = data.activeSubscriptions || 1
                  const pct = Math.round((p.count / total) * 100)
                  return (
                    <div key={p.plan}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-theme-primary font-medium">
                          {PLAN_LABELS[p.plan] ?? p.plan}
                        </span>
                        <span className="text-xs text-theme-secondary">
                          {p.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-theme-hover">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: PLAN_COLORS[p.plan] ?? PLAN_COLORS.unknown,
                          }}
                        />
                      </div>
                      <p className="text-xs text-theme-muted mt-0.5">
                        {formatCHF(Math.round(p.revenue))}/mois
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recent subscriptions table */}
        <div className="rounded-xl border border-theme-border p-5">
          <h3 className="text-sm font-semibold text-theme-primary mb-4">Abonnements recents</h3>
          {data.recentSubscriptions.length === 0 ? (
            <p className="text-sm text-theme-secondary py-8 text-center">Aucun abonnement</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-theme-border">
                    <th className="text-left py-2 text-xs font-medium text-theme-secondary">Agence</th>
                    <th className="text-left py-2 text-xs font-medium text-theme-secondary">Plan</th>
                    <th className="text-right py-2 text-xs font-medium text-theme-secondary">Prix</th>
                    <th className="text-center py-2 text-xs font-medium text-theme-secondary">Statut</th>
                    <th className="text-right py-2 text-xs font-medium text-theme-secondary">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSubscriptions.map(sub => (
                    <tr key={sub.id} className="border-b border-theme-border/50 last:border-0">
                      <td className="py-2.5 text-theme-primary">
                        {sub.agency_name ?? <span className="text-theme-muted">-</span>}
                      </td>
                      <td className="py-2.5">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{
                            color: PLAN_COLORS[sub.plan] ?? PLAN_COLORS.unknown,
                            backgroundColor: `${PLAN_COLORS[sub.plan] ?? PLAN_COLORS.unknown}15`,
                          }}
                        >
                          {PLAN_LABELS[sub.plan] ?? sub.plan}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-theme-primary">
                        {formatCHF(sub.price)}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[sub.status] ?? 'bg-gray-400')} />
                          <span className="text-xs text-theme-secondary">
                            {STATUS_LABELS[sub.status] ?? sub.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-xs text-theme-muted">
                        {formatRelativeDate(sub.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
