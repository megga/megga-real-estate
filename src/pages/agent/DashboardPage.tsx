import {
  Building2, TrendingUp, Users, CalendarDays, Plus,
  UserPlus, Eye, FileText, HandshakeIcon, AlertTriangle,
  ShieldAlert, Phone, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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
  { label: 'Lead', count: 5, color: 'bg-primary-300' },
  { label: 'Qualifié', count: 3, color: 'bg-accent' },
  { label: 'Visite', count: 4, color: 'bg-warning' },
  { label: 'Offre', count: 2, color: 'bg-orange-500' },
  { label: 'Signé', count: 1, color: 'bg-success' },
]

const totalDeals = pipelineStages.reduce((sum, s) => sum + s.count, 0)

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
    description: 'Villa Cologny — CHF 2\'800\'000 par Famille Rossi',
    time: 'Il y a 4h',
  },
  {
    id: '4',
    icon: FileText,
    iconColor: 'text-primary-500 bg-primary-100',
    title: 'Document uploadé',
    description: 'Passeport de Pierre Lefèvre — dossier KYC #12',
    time: 'Hier, 16:30',
  },
  {
    id: '5',
    icon: HandshakeIcon,
    iconColor: 'text-success bg-success/10',
    title: 'Deal signé',
    description: 'Duplex Champel — CHF 1\'250\'000, acheteur confirmé',
    time: 'Hier, 11:00',
  },
]

/* ─── Tasks Data ─── */
interface Task {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  icon: React.ElementType
}

const tasks: Task[] = [
  {
    id: '1',
    title: 'Dossier KYC incomplet',
    description: 'Pierre Lefèvre — documents manquants : justificatif de domicile',
    priority: 'high',
    icon: ShieldAlert,
  },
  {
    id: '2',
    title: 'Relance client',
    description: 'Jean-Marc Weber n\'a pas répondu depuis 5 jours — visite à replanifier',
    priority: 'high',
    icon: Phone,
  },
  {
    id: '3',
    title: 'Visite à confirmer',
    description: 'Appartement Plainpalais — Sophie Muller, vendredi 14h',
    priority: 'medium',
    icon: CalendarDays,
  },
  {
    id: '4',
    title: 'Mandat à renouveler',
    description: 'Villa Cologny — mandat expire dans 10 jours',
    priority: 'medium',
    icon: Clock,
  },
]

const priorityStyles = {
  high: 'bg-danger/10 text-danger border-danger/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-accent/10 text-accent border-accent/20',
}

const priorityLabels = {
  high: 'Urgent',
  medium: 'Important',
  low: 'Normal',
}

/* ─── Component ─── */
export default function DashboardPage() {
  const today = formatDate(new Date())

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-primary-900">
            Bonjour Gregory 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{today}</p>
        </div>
        <Button className="gap-2 rounded-button self-start">
          <Plus className="h-4 w-4" />
          Nouvelle transaction
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="bg-white rounded-card p-5 shadow-card border border-border">
              <div className="flex items-start justify-between mb-3">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', kpi.iconBg)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-primary-900">{kpi.value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{kpi.label}</p>
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

      {/* Pipeline + Tasks row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Mini Pipeline */}
        <div className="lg:col-span-3 bg-white rounded-card p-5 shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary-900">Pipeline</h2>
            <span className="text-sm text-muted-foreground">{totalDeals} deals</span>
          </div>

          {/* Pipeline bar */}
          <div className="flex rounded-full overflow-hidden h-8 mb-4">
            {pipelineStages.map((stage) => (
              <div
                key={stage.label}
                className={cn('flex items-center justify-center text-xs font-semibold text-white transition-all', stage.color)}
                style={{ width: `${(stage.count / totalDeals) * 100}%` }}
              >
                {stage.count}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {pipelineStages.map((stage) => (
              <div key={stage.label} className="flex items-center gap-1.5">
                <div className={cn('h-2.5 w-2.5 rounded-full', stage.color)} />
                <span className="text-xs text-muted-foreground">{stage.label}</span>
                <span className="text-xs font-medium text-primary-700">{stage.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent Tasks */}
        <div className="lg:col-span-2 bg-white rounded-card p-5 shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-warning" />
              Tâches urgentes
            </h2>
            <span className="text-xs text-muted-foreground">{tasks.length} tâches</span>
          </div>
          <div className="space-y-3">
            {tasks.map((task) => {
              const Icon = task.icon
              return (
                <div key={task.id} className="flex items-start gap-3 group cursor-pointer">
                  <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', priorityStyles[task.priority])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-primary-900 group-hover:text-accent transition-colors truncate">
                        {task.title}
                      </p>
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge border', priorityStyles[task.priority])}>
                        {priorityLabels[task.priority]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-card p-5 shadow-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary-900">Activité récente</h2>
          <button className="text-sm text-accent hover:text-accent-hover font-medium transition-colors">
            Voir tout →
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
                  i < activities.length - 1 && 'border-b border-border-light'
                )}
              >
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', activity.iconColor)}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary-900 group-hover:text-accent transition-colors">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                  {activity.time}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
