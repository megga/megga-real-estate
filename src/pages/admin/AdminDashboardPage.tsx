import { Building2, Users, Home, GitBranch, CreditCard, ShieldAlert, AlertTriangle, Bell } from 'lucide-react'
import { useAdminStats } from '@/hooks/useAdminStats'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import BillingDashboard from '@/components/admin/BillingDashboard'
import OnboardingTracker from '@/components/admin/OnboardingTracker'
import ActivityLog from '@/components/admin/ActivityLog'
import { formatRelativeDate } from '@/lib/utils'

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

export default function AdminDashboardPage() {
  const { kpis, kpisLoading, alerts, alertsLoading } = useAdminStats()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with admin badge */}
      <div className="flex items-center gap-3">
        <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-semibold text-admin-accent">Admin MEGGA</span>
        </div>
        <h1 className="text-xl font-semibold text-theme-primary">Vue d'ensemble</h1>
      </div>

      {/* KPI Grid */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-5 animate-pulse">
              <div className="h-3 bg-theme-hover rounded w-20 mb-3" />
              <div className="h-7 bg-theme-hover rounded w-16" />
            </div>
          ))}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <AdminKpiCard
            label="Agences"
            value={kpis.activeAgencies}
            icon={Building2}
            trend={{ value: kpis.newAgenciesThisMonth, label: 'ce mois' }}
          />
          <AdminKpiCard
            label="Utilisateurs"
            value={kpis.totalUsers}
            icon={Users}
            trend={{ value: kpis.newUsersThisMonth, label: 'ce mois' }}
          />
          <AdminKpiCard label="Biens actifs" value={kpis.activeProperties} icon={Home} />
          <AdminKpiCard label="Transactions" value={kpis.activeTransactions} icon={GitBranch} />
          <AdminKpiCard label="MRR estime" value={`CHF ${kpis.estimatedMRR}`} icon={CreditCard} />
          <AdminKpiCard
            label="KYC a risque"
            value={kpis.highRiskKyc}
            icon={ShieldAlert}
            variant={kpis.highRiskKyc > 0 ? 'danger' : 'default'}
          />
        </div>
      ) : null}

      {/* Revenue & Billing */}
      <BillingDashboard />

      {/* Alerts feed */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-sm font-semibold text-theme-primary mb-4">Alertes recentes</h2>
        {alertsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-theme-hover rounded-lg animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-theme-secondary py-8 text-center">Aucune alerte recente</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => {
              const Icon = ALERT_ICONS[alert.action] ?? Bell
              const borderColor = ALERT_BORDER_COLORS[alert.action] ?? 'border-l-gray-300'
              const label = ALERT_LABELS[alert.action] ?? alert.action
              return (
                <div key={alert.id} className={`flex items-center gap-3 p-3 rounded-lg border-l-4 ${borderColor} bg-theme-hover/50`}>
                  <Icon className="h-4 w-4 text-theme-secondary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-theme-primary">{label}</p>
                  </div>
                  <span className="text-xs text-theme-muted flex-shrink-0">{formatRelativeDate(alert.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Onboarding tracker — activation funnel per agency */}
      <OnboardingTracker />

      {/* Activity Log */}
      <ActivityLog />
    </div>
  )
}
