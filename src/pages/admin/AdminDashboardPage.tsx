import { Building2, Users, Home, GitBranch, ShieldAlert, AlertTriangle, Bell, CreditCard, CheckCircle, AlertCircle, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAdminStats } from '@/hooks/useAdminStats'
import { useAdminWidgets, type DashboardWidget } from '@/hooks/useAdminWidgets'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import BillingDashboard from '@/components/admin/BillingDashboard'
import WeeklyReportPreview from '@/components/admin/WeeklyReportPreview'
import OnboardingTracker from '@/components/admin/OnboardingTracker'
import ActivityLog from '@/components/admin/ActivityLog'
import WidgetConfigurator from '@/components/admin/WidgetConfigurator'
import { cn, formatRelativeDate } from '@/lib/utils'
import type { ReactNode } from 'react'

const ALERT_ICONS: Record<string, typeof AlertTriangle> = {
  agency_created: Building2,
  kyc_screening_match: ShieldAlert,
  subscription_cancelled: CreditCard,
  edge_function_error: AlertTriangle,
  ticket_created: Bell,
}

const ALERT_LABELS: Record<string, string> = {
  agency_created: 'Nouvelle agence inscrite',
  kyc_screening_match: 'Alerte PEP/Sanctions',
  subscription_cancelled: 'Abonnement annule',
  edge_function_error: 'Erreur Edge Function',
  ticket_created: 'Nouveau ticket support',
}

const ALERT_BORDER_COLORS: Record<string, string> = {
  agency_created: 'border-l-admin-accent',
  kyc_screening_match: 'border-l-red-500',
  subscription_cancelled: 'border-l-amber-500',
  edge_function_error: 'border-l-red-500',
  ticket_created: 'border-l-blue-500',
}

/* ── Sortable widget wrapper ── */
function SortableWidget({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/drag relative rounded-xl transition-shadow',
        isDragging && 'z-50 shadow-lg shadow-admin-accent/10 opacity-90'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute -left-1 top-3 h-6 w-5 flex items-center justify-center rounded opacity-0 group-hover/drag:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10 text-theme-muted hover:text-admin-accent"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {children}
    </div>
  )
}

export default function AdminDashboardPage() {
  const { kpis, kpisLoading, alerts, alertsLoading } = useAdminStats()
  const { visibleWidgets, reorderWidgets } = useAdminWidgets()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const isWidgetVisible = (id: string) => visibleWidgets.some(w => w.id === id)

  const healthStatus = (kpis?.highRiskKyc ?? 0) > 0 ? 'warning' : 'healthy'

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderWidgets(active.id as string, over.id as string)
    }
  }

  /* ── Widget renderer ── */
  function renderWidget(widget: DashboardWidget) {
    switch (widget.id) {
      case 'kpis':
        return kpisLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-theme-border px-3.5 py-2.5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded bg-theme-hover" />
                  <div><div className="h-5 bg-theme-hover rounded w-10 mb-1" /><div className="h-2.5 bg-theme-hover rounded w-16" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : kpis ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <AdminKpiCard compact label="Agences" value={kpis.activeAgencies} icon={Building2}
              trend={kpis.newAgenciesThisMonth > 0 ? { value: kpis.newAgenciesThisMonth, label: '' } : undefined} />
            <AdminKpiCard compact label="Utilisateurs" value={kpis.totalUsers} icon={Users} variant="blue"
              trend={kpis.newUsersThisMonth > 0 ? { value: kpis.newUsersThisMonth, label: '' } : undefined} />
            <AdminKpiCard compact label="Biens actifs" value={kpis.activeProperties} icon={Home} variant="blue" />
            <AdminKpiCard compact label="Transactions" value={kpis.activeTransactions} icon={GitBranch} variant="success" />
            <AdminKpiCard compact label="KYC a risque" value={kpis.highRiskKyc} icon={ShieldAlert}
              variant={kpis.highRiskKyc > 0 ? 'danger' : 'default'} />
          </div>
        ) : null

      case 'alerts':
        return (
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary mb-3">Alertes</h2>
            {alertsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-theme-hover rounded-lg animate-pulse" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Aucune alerte — tout est en ordre</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {alerts.map((alert) => {
                  const Icon = ALERT_ICONS[alert.action] ?? Bell
                  const borderColor = ALERT_BORDER_COLORS[alert.action] ?? 'border-l-gray-300'
                  const label = ALERT_LABELS[alert.action] ?? alert.action
                  return (
                    <div key={alert.id} className={`flex items-center gap-3 p-2.5 rounded-lg border-l-4 ${borderColor} bg-theme-hover/30`}>
                      <Icon className="h-3.5 w-3.5 text-theme-secondary flex-shrink-0" />
                      <p className="text-sm text-theme-primary flex-1 truncate">{label}</p>
                      <span className="text-[10px] text-theme-muted flex-shrink-0">{formatRelativeDate(alert.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      case 'activity':
        return <ActivityLog />

      case 'billing':
        return <BillingDashboard />

      case 'report':
        return <WeeklyReportPreview />

      case 'onboarding':
        return <OnboardingTracker />

      default:
        return null
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-semibold text-admin-accent">Admin MEGGA</span>
          </div>
          <h1 className="text-xl font-semibold text-theme-primary">Vue d'ensemble</h1>
        </div>
        <WidgetConfigurator />
      </div>

      {/* ── Health Pulse ── */}
      {kpis && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors',
          healthStatus === 'healthy'
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5'
            : 'border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5'
        )}>
          {healthStatus === 'healthy' ? (
            <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          )}
          <p className="text-sm text-theme-primary">
            <span className={cn('font-medium', healthStatus === 'healthy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
              {healthStatus === 'healthy' ? 'Plateforme saine' : 'Attention requise'}
            </span>
            <span className="text-theme-secondary mx-1.5">·</span>
            <span className="text-theme-secondary">
              {kpis.activeAgencies} agence{kpis.activeAgencies !== 1 ? 's' : ''}
              <span className="mx-1">·</span>
              {kpis.activeProperties} bien{kpis.activeProperties !== 1 ? 's' : ''}
              <span className="mx-1">·</span>
              {kpis.activeTransactions} transaction{kpis.activeTransactions !== 1 ? 's' : ''}
              {kpis.highRiskKyc > 0 && (
                <><span className="mx-1">·</span><span className="text-red-500 font-medium">{kpis.highRiskKyc} KYC a risque</span></>
              )}
            </span>
          </p>
        </div>
      )}

      {/* ── Sortable widgets ── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-5">
            {visibleWidgets.map(widget => (
              <SortableWidget key={widget.id} id={widget.id}>
                {renderWidget(widget)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
