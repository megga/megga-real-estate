import {
  Building2, TrendingUp, Users, CalendarDays, Plus,
  UserPlus, Eye, FileText, HandshakeIcon, AlertTriangle,
  ShieldAlert, Phone, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DASHBOARD_KPIS, DASHBOARD_PIPELINE, DASHBOARD_ACTIVITIES, DASHBOARD_TASKS,
  type DashboardKpi, type DashboardActivity, type DashboardTask,
} from '@/lib/mockData'

/* ─── Icon maps ─── */
const kpiIconMap: Record<DashboardKpi['iconName'], React.ElementType> = {
  Building2, TrendingUp, Users, CalendarDays,
}

const activityIconMap: Record<DashboardActivity['iconName'], React.ElementType> = {
  UserPlus, Eye, TrendingUp, FileText, HandshakeIcon,
}

const taskIconMap: Record<DashboardTask['iconName'], React.ElementType> = {
  ShieldAlert, Phone, CalendarDays, Clock,
}

const totalDeals = DASHBOARD_PIPELINE.reduce((sum, s) => sum + s.count, 0)

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
          <h1 className="text-2xl md:text-3xl font-semibold text-primary-900">
            Bonjour Gregory 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{today}</p>
        </div>
        <Button className="gap-2 rounded-button self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouvelle transaction
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DASHBOARD_KPIS.map((kpi) => {
          const Icon = kpiIconMap[kpi.iconName]
          return (
            <div key={kpi.label} className="bg-white rounded-card p-6 shadow-card border border-border hover:shadow-card-hover transition-shadow duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className={cn('h-11 w-11 rounded-button flex items-center justify-center', kpi.iconBg)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex items-center gap-1">
                  {kpi.trend.positive ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                  )}
                  <span className={cn('text-xs font-medium', kpi.trend.positive ? 'text-success' : 'text-danger')}>
                    {kpi.trend.value}
                  </span>
                </div>
              </div>
              <p className="text-3xl font-bold text-primary-900 tracking-tight">{kpi.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          )
        })}
      </div>

      {/* Pipeline + Tasks row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Mini Pipeline */}
        <div className="lg:col-span-3 bg-white rounded-card p-6 shadow-card border border-border">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-primary-900">Pipeline</h2>
            <span className="text-sm font-medium text-primary-700">{totalDeals} deals</span>
          </div>

          {/* Pipeline bar */}
          <div className="flex rounded-full overflow-hidden h-9 mb-5 bg-section">
            {DASHBOARD_PIPELINE.map((stage) => {
              const pct = (stage.count / totalDeals) * 100
              return (
                <div
                  key={stage.label}
                  className={cn('flex items-center justify-center text-xs font-semibold text-white transition-all duration-300', stage.color)}
                  style={{ width: `${pct}%` }}
                  title={`${stage.label}: ${stage.count}`}
                >
                  {pct >= 10 && stage.count}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {DASHBOARD_PIPELINE.map((stage) => (
              <div key={stage.label} className="flex items-center gap-2">
                <div className={cn('h-2.5 w-2.5 rounded-full', stage.color)} />
                <span className="text-xs text-muted-foreground">{stage.label}</span>
                <span className="text-xs font-semibold text-primary-900">{stage.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent Tasks */}
        <div className="lg:col-span-2 bg-white rounded-card p-6 shadow-card border border-border">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-warning" aria-hidden="true" />
              Tâches urgentes
            </h2>
            <span className="text-xs font-medium text-muted-foreground">{DASHBOARD_TASKS.length} tâches</span>
          </div>
          <div className="space-y-2">
            {DASHBOARD_TASKS.map((task) => {
              const Icon = taskIconMap[task.iconName]
              return (
                <div key={task.id} className="flex items-start gap-3 group cursor-pointer rounded-button p-2.5 -mx-1 transition-colors hover:bg-section focus-within:ring-2 focus-within:ring-accent/20 focus-within:rounded-button">
                  <div className={cn('h-8 w-8 rounded-button flex items-center justify-center flex-shrink-0 mt-0.5', priorityStyles[task.priority])}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-primary-900 group-hover:text-accent transition-colors truncate">
                        {task.title}
                      </p>
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge border flex-shrink-0', priorityStyles[task.priority])}>
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
      <div className="bg-white rounded-card p-6 shadow-card border border-border">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-primary-900">Activité récente</h2>
          <button className="text-sm text-accent hover:text-accent-hover font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 rounded-button px-2.5 py-1">
            Voir tout <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="space-y-0">
          {DASHBOARD_ACTIVITIES.map((activity, i) => {
            const Icon = activityIconMap[activity.iconName]
            return (
              <div
                key={activity.id}
                className={cn(
                  'flex items-start gap-4 py-3.5 px-2 -mx-2 group cursor-pointer rounded-button transition-colors hover:bg-section',
                  i < DASHBOARD_ACTIVITIES.length - 1 && 'border-b border-border-light'
                )}
              >
                <div className={cn('h-9 w-9 rounded-button flex items-center justify-center flex-shrink-0', activity.iconColor)}>
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
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
