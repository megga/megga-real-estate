import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight, ArrowDownRight, Plus,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import PageTransition from '@/components/layout/PageTransition'
import NewTransactionDialog from '@/components/transactions/NewTransactionDialog'

/* ─── Component ─── */
export default function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const [showNewTransaction, setShowNewTransaction] = useState(false)

  /* ─── KPI Data ─── */
  const kpis = [
    { labelKey: 'kpi.activeProperties', value: '12', trend: { value: '+2 ce mois', positive: true } },
    { labelKey: 'kpi.activeTransactions', value: '8', trend: { value: '+12% ce mois', positive: true } },
    { labelKey: 'kpi.contacts', value: '156', trend: { value: '+8 cette semaine', positive: true } },
    { labelKey: 'kpi.visitsThisMonth', value: '23', trend: { value: '-3 vs dernier mois', positive: false } },
  ]

  /* ─── Pipeline Data ─── */
  const pipelineStages = [
    { labelKey: 'pipeline.stages.lead', count: 5, color: 'bg-gray-400', dotColor: 'bg-gray-400', value: 3200000 },
    { labelKey: 'pipeline.stages.qualified', count: 3, color: 'bg-accent', dotColor: 'bg-accent', value: 2800000 },
    { labelKey: 'pipeline.stages.visit', count: 4, color: 'bg-warning', dotColor: 'bg-warning', value: 4100000 },
    { labelKey: 'pipeline.stages.offer', count: 2, color: 'bg-orange-500', dotColor: 'bg-orange-500', value: 1500000 },
    { labelKey: 'pipeline.stages.signed', count: 1, color: 'bg-success', dotColor: 'bg-success', value: 800000 },
  ]

  const totalDeals = pipelineStages.reduce((sum, s) => sum + s.count, 0)
  const totalValue = pipelineStages.reduce((sum, s) => sum + s.value, 0)

  /* ─── Activity Data ─── */
  const activities = [
    { id: '1', title: 'Nouveau contact ajouté', description: 'Marie Dubois — acheteuse, 4p Champel', time: 'il y a 25 min', dot: 'bg-blue-400' },
    { id: '2', title: 'Visite planifiée', description: 'Appt Eaux-Vives — J-M Weber, demain 14h', time: 'il y a 2h', dot: 'bg-amber-400' },
    { id: '3', title: 'Offre reçue', description: "Villa Cologny — CHF 2'800'000", time: 'il y a 4h', dot: 'bg-emerald-400' },
    { id: '4', title: 'Document uploadé', description: 'Passeport Pierre Lefèvre — KYC #12', time: 'hier 16:30', dot: 'bg-gray-400' },
    { id: '5', title: 'Deal signé', description: "Duplex Champel — CHF 1'250'000", time: 'hier 11:00', dot: 'bg-emerald-400' },
  ]

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowNewTransaction(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('newTransaction')}
          </button>
        </div>

        <NewTransactionDialog open={showNewTransaction} onClose={() => setShowNewTransaction(false)} />

        {/* KPIs — grid 2x2 mobile, inline row desktop */}
        <div className="grid grid-cols-2 md:flex md:items-stretch rounded-xl border border-theme-border md:divide-x divide-theme-border">
          {kpis.map((kpi, idx) => (
            <div key={kpi.labelKey} className={cn('flex-1 px-4 py-3 md:px-5 md:py-4', idx < 2 && 'border-b md:border-b-0 border-theme-border', idx % 2 === 0 && 'border-r md:border-r-0 border-theme-border')}>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-theme-primary">{kpi.value}</span>
                <span className="text-sm text-theme-tertiary">{t(kpi.labelKey)}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                {kpi.trend.positive ? (
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                )}
                <span className={cn('text-xs', kpi.trend.positive ? 'text-emerald-500' : 'text-red-500')}>
                  {kpi.trend.value}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline — transparent bento */}
        <div className="rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-theme-primary">{t('pipeline.title')}</h2>
              <p className="text-sm text-theme-tertiary mt-0.5">
                {totalDeals} {totalDeals > 1 ? t('pipeline.dealsPlural') : t('pipeline.deals')} · {formatCHF(totalValue)}
              </p>
            </div>
            <a href="/dashboard/pipeline" className="text-sm text-accent hover:text-accent/80 font-medium transition-colors">
              {t('pipeline.viewPipeline')}
            </a>
          </div>

          {/* Pipeline bar */}
          <div className="flex rounded-lg overflow-hidden h-7 mb-5">
            {pipelineStages.map((stage) => (
              <div
                key={stage.labelKey}
                className={cn('flex items-center justify-center text-[11px] font-semibold text-white transition-all', stage.color)}
                style={{ width: `${(stage.count / totalDeals) * 100}%` }}
              >
                {stage.count}
              </div>
            ))}
          </div>

          {/* Detailed legend — rows with separators */}
          {pipelineStages.map((stage, i) => (
            <div
              key={stage.labelKey}
              className={cn(
                'flex items-center gap-3 py-2.5',
                i < pipelineStages.length - 1 && 'border-b border-theme-border'
              )}
            >
              <div className={cn('h-2 w-2 rounded-full shrink-0', stage.dotColor)} />
              <span className="text-sm text-theme-primary flex-1">{t(stage.labelKey)}</span>
              <span className="text-sm font-medium text-theme-primary tabular-nums">
                {stage.count} {stage.count > 1 ? t('pipeline.dealsPlural') : t('pipeline.deals')}
              </span>
              <span className="text-sm text-theme-tertiary tabular-nums w-28 text-right">
                {formatCHF(stage.value)}
              </span>
            </div>
          ))}
        </div>

        {/* Activité récente — transparent bento */}
        <div className="rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-theme-primary">{t('activity.title')}</h2>
            <button className="text-sm text-accent hover:text-accent/80 font-medium transition-colors">
              {t('activity.viewAll')}
            </button>
          </div>

          {activities.map((activity, i) => (
            <div
              key={activity.id}
              className={cn(
                'flex items-start gap-3 py-3 cursor-pointer group',
                i < activities.length - 1 && 'border-b border-theme-border'
              )}
            >
              <div className={cn('h-2 w-2 rounded-full shrink-0 mt-1.5', activity.dot)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-theme-primary group-hover:text-accent transition-colors">
                  {activity.title}
                </p>
                <p className="text-xs text-theme-tertiary mt-0.5">
                  {activity.description} · <span className="text-theme-tertiary">{activity.time}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
