import {
  Building2, TrendingUp, Users, CalendarDays, Plus,
  UserPlus, Eye, FileText, HandshakeIcon,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { cn, formatDate, formatCHF } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/layout/PageHeader'
import PageTransition from '@/components/layout/PageTransition'

/* ─── KPI Data ─── */
interface KpiCardData {
  label: string
  value: string
  trend: { value: string; positive: boolean }
  icon: React.ElementType
  iconBg: string
}

const kpis: KpiCardData[] = [
  {
    label: 'Biens actifs',
    value: '12',
    trend: { value: '+2 ce mois', positive: true },
    icon: Building2,
    iconBg: 'bg-accent/10 text-accent',
  },
  {
    label: 'Transactions en cours',
    value: '8',
    trend: { value: '+12% ce mois', positive: true },
    icon: TrendingUp,
    iconBg: 'bg-success/10 text-success',
  },
  {
    label: 'Contacts',
    value: '156',
    trend: { value: '+8 cette semaine', positive: true },
    icon: Users,
    iconBg: 'bg-warning/10 text-warning',
  },
  {
    label: 'Visites ce mois',
    value: '23',
    trend: { value: '-3 vs dernier mois', positive: false },
    icon: CalendarDays,
    iconBg: 'bg-danger/10 text-danger',
  },
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
interface Activity {
  id: string
  icon: React.ElementType
  iconColor: string
  title: string
  description: string
  time: string
}

const activities: Activity[] = [
  {
    id: '1',
    icon: UserPlus,
    iconColor: 'text-accent bg-accent/10',
    title: 'Nouveau contact ajouté',
    description: 'Marie Dubois — acheteuse, recherche 4 pièces à Champel',
    time: 'Il y a 25 min',
  },
  {
    id: '2',
    icon: Eye,
    iconColor: 'text-warning bg-warning/10',
    title: 'Visite planifiée',
    description: 'Appartement Eaux-Vives — Jean-Marc Weber, demain 14h',
    time: 'Il y a 2h',
  },
  {
    id: '3',
    icon: TrendingUp,
    iconColor: 'text-success bg-success/10',
    title: 'Offre reçue',
    description: "Villa Cologny — CHF 2'800'000 par Famille Rossi",
    time: 'Il y a 4h',
  },
  {
    id: '4',
    icon: FileText,
    iconColor: 'text-theme-muted bg-theme-active',
    title: 'Document uploadé',
    description: 'Passeport de Pierre Lefèvre — dossier KYC #12',
    time: 'Hier, 16:30',
  },
  {
    id: '5',
    icon: HandshakeIcon,
    iconColor: 'text-success bg-success/10',
    title: 'Deal signé',
    description: "Duplex Champel — CHF 1'250'000, acheteur confirmé",
    time: 'Hier, 11:00',
  },
]

/* ─── Component ─── */
export default function DashboardPage() {
  const today = formatDate(new Date())

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Bonjour Gregory"
          subtitle={today}
          actions={
            <Button className="gap-2 rounded-button self-start">
              <Plus className="h-4 w-4" />
              Nouvelle transaction
            </Button>
          }
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <div key={kpi.label} className="bg-theme-card rounded-card p-5 shadow-card border border-theme-border">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', kpi.iconBg)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-theme-primary">{kpi.value}</p>
                <p className="text-sm text-theme-muted mt-0.5">{kpi.label}</p>
                <div className="flex items-center gap-1 mt-2">
                  {kpi.trend.positive ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-danger" />
                  )}
                  <span className={cn('text-xs font-medium', kpi.trend.positive ? 'text-success' : 'text-danger')}>
                    {kpi.trend.value}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pipeline — full width */}
        <div className="bg-theme-card rounded-card p-5 shadow-card border border-theme-border">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-theme-primary">Pipeline</h2>
              <p className="text-sm text-theme-muted mt-0.5">
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

          {/* Detailed legend — stages as rows */}
          <div className="space-y-0">
            {pipelineStages.map((stage, i) => (
              <div
                key={stage.label}
                className={cn(
                  'flex items-center gap-3 py-2.5 px-1',
                  i < pipelineStages.length - 1 && 'border-b border-theme-border/50'
                )}
              >
                <div className={cn('h-2 w-2 rounded-full shrink-0', stage.dotColor)} />
                <span className="text-sm text-theme-primary flex-1">{stage.label}</span>
                <span className="text-sm font-medium text-theme-primary tabular-nums w-16 text-right">
                  {stage.count} deal{stage.count > 1 ? 's' : ''}
                </span>
                <span className="text-sm text-theme-secondary tabular-nums w-28 text-right">
                  {formatCHF(stage.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-theme-card rounded-card p-5 shadow-card border border-theme-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-theme-primary">Activité récente</h2>
            <button className="text-sm text-accent hover:text-accent/80 font-medium transition-colors">
              Voir tout
            </button>
          </div>
          <div className="space-y-0">
            {activities.map((activity, i) => {
              const Icon = activity.icon
              return (
                <div
                  key={activity.id}
                  className={cn(
                    'flex items-start gap-4 py-3.5 group cursor-pointer',
                    i < activities.length - 1 && 'border-b border-theme-border/50'
                  )}
                >
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', activity.iconColor)}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-theme-primary group-hover:text-accent transition-colors">
                      {activity.title}
                    </p>
                    <p className="text-xs text-theme-muted mt-0.5">{activity.description}</p>
                  </div>
                  <span className="text-xs text-theme-muted whitespace-nowrap flex-shrink-0 mt-0.5">
                    {activity.time}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
