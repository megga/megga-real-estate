import {
  ArrowUpRight, ArrowDownRight, Plus,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import PageTransition from '@/components/layout/PageTransition'

/* ─── KPI Data ─── */
interface KpiCardData {
  label: string
  value: string
  trend: { value: string; positive: boolean }
}

const kpis: KpiCardData[] = [
  { label: 'Biens actifs', value: '12', trend: { value: '+2 ce mois', positive: true } },
  { label: 'Transactions en cours', value: '8', trend: { value: '+12% ce mois', positive: true } },
  { label: 'Contacts', value: '156', trend: { value: '+8 cette semaine', positive: true } },
  { label: 'Visites ce mois', value: '23', trend: { value: '-3 vs dernier mois', positive: false } },
]

/* ─── Pipeline Data ─── */
const pipelineStages = [
  { label: 'Lead', count: 5, color: 'bg-gray-400', dotColor: 'bg-gray-400', value: 3200000 },
  { label: 'Qualifié', count: 3, color: 'bg-accent', dotColor: 'bg-accent', value: 2800000 },
  { label: 'Visite', count: 4, color: 'bg-warning', dotColor: 'bg-warning', value: 4100000 },
  { label: 'Offre', count: 2, color: 'bg-orange-500', dotColor: 'bg-orange-500', value: 1500000 },
  { label: 'Signé', count: 1, color: 'bg-success', dotColor: 'bg-success', value: 800000 },
]

const totalDeals = pipelineStages.reduce((sum, s) => sum + s.count, 0)
const totalValue = pipelineStages.reduce((sum, s) => sum + s.value, 0)

/* ─── Activity Data ─── */
const activities = [
  { id: '1', title: 'Nouveau contact ajouté', description: 'Marie Dubois — acheteuse, recherche 4 pièces à Champel', time: 'Il y a 25 min' },
  { id: '2', title: 'Visite planifiée', description: 'Appartement Eaux-Vives — Jean-Marc Weber, demain 14h', time: 'Il y a 2h' },
  { id: '3', title: 'Offre reçue', description: "Villa Cologny — CHF 2'800'000 par Famille Rossi", time: 'Il y a 4h' },
  { id: '4', title: 'Document uploadé', description: 'Passeport de Pierre Lefèvre — dossier KYC #12', time: 'Hier, 16:30' },
  { id: '5', title: 'Deal signé', description: "Duplex Champel — CHF 1'250'000, acheteur confirmé", time: 'Hier, 11:00' },
]

/* ─── Component ─── */
export default function DashboardPage() {
  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <button className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Nouvelle transaction
          </button>
        </div>

        {/* KPIs — inline row with dividers */}
        <div className="flex items-stretch rounded-xl border border-theme-border divide-x divide-theme-border">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="flex-1 px-5 py-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-theme-primary">{kpi.value}</span>
                <span className="text-sm text-theme-tertiary">{kpi.label}</span>
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
              <h2 className="text-base font-semibold text-theme-primary">Pipeline</h2>
              <p className="text-sm text-theme-tertiary mt-0.5">
                {totalDeals} deals · {formatCHF(totalValue)}
              </p>
            </div>
            <a href="/dashboard/pipeline" className="text-sm text-accent hover:text-accent/80 font-medium transition-colors">
              Voir le pipeline →
            </a>
          </div>

          {/* Pipeline bar */}
          <div className="flex rounded-lg overflow-hidden h-7 mb-5">
            {pipelineStages.map((stage) => (
              <div
                key={stage.label}
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
              key={stage.label}
              className={cn(
                'flex items-center gap-3 py-2.5',
                i < pipelineStages.length - 1 && 'border-b border-theme-border'
              )}
            >
              <div className={cn('h-2 w-2 rounded-full shrink-0', stage.dotColor)} />
              <span className="text-sm text-theme-primary flex-1">{stage.label}</span>
              <span className="text-sm font-medium text-theme-primary tabular-nums">
                {stage.count} deal{stage.count > 1 ? 's' : ''}
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
            <h2 className="text-base font-semibold text-theme-primary">Activité récente</h2>
            <button className="text-sm text-accent hover:text-accent/80 font-medium transition-colors">
              Voir tout
            </button>
          </div>

          {activities.map((activity, i) => (
            <div
              key={activity.id}
              className={cn(
                'flex items-center gap-4 py-3.5 cursor-pointer group',
                i < activities.length - 1 && 'border-b border-theme-border'
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-theme-primary group-hover:text-accent transition-colors">
                  {activity.title}
                </p>
                <p className="text-xs text-theme-tertiary mt-0.5">{activity.description}</p>
              </div>
              <span className="text-xs text-theme-tertiary whitespace-nowrap shrink-0">
                {activity.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
