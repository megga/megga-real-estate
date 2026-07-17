/**
 * Page super-admin — tableau de bord plateforme (accueil de la section admin).
 *
 * Route : `/dashboard/admin` (accent violet). Empile un pouls de santé, 5 KPIs
 * (agences, users, biens, transactions, KYC à risque), le flux d'alertes, le
 * journal d'activité, le suivi d'onboarding et le dashboard de facturation.
 */
import { useTranslation } from 'react-i18next'
import { Building2, Users, Home, GitBranch, ShieldAlert, AlertTriangle, Bell, CreditCard, CheckCircle, AlertCircle } from 'lucide-react'
import { useAdminStats } from '@/hooks/useAdminStats'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import BillingDashboard from '@/components/admin/BillingDashboard'
import WeeklyReportPreview from '@/components/admin/WeeklyReportPreview'
import OnboardingTracker from '@/components/admin/OnboardingTracker'
import ActivityLog from '@/components/admin/ActivityLog'
import { cn, formatRelativeDate } from '@/lib/utils'

const ALERT_ICONS: Record<string, typeof AlertTriangle> = {
  agency_created: Building2,
  kyc_screening_match: ShieldAlert,
  subscription_cancelled: CreditCard,
  edge_function_error: AlertTriangle,
  ticket_created: Bell,
}

const ALERT_LABEL_KEYS: Record<string, string> = {
  agency_created: 'dashboard.alert.agencyCreated',
  kyc_screening_match: 'dashboard.alert.kycScreeningMatch',
  subscription_cancelled: 'dashboard.alert.subscriptionCancelled',
  edge_function_error: 'dashboard.alert.edgeFunctionError',
  ticket_created: 'dashboard.alert.ticketCreated',
}

const ALERT_BORDER_COLORS: Record<string, string> = {
  agency_created: 'border-l-admin-accent',
  kyc_screening_match: 'border-l-red-500',
  subscription_cancelled: 'border-l-amber-500',
  edge_function_error: 'border-l-red-500',
  ticket_created: 'border-l-blue-500',
}

/** Vue d'ensemble : dérive l'état de santé des KPIs et compose les bandeaux/sections. */
export default function AdminDashboardPage() {
  const { t } = useTranslation('admin')
  const { kpis, kpisLoading, alerts, alertsLoading } = useAdminStats()

  const healthStatus = (kpis?.highRiskKyc ?? 0) > 0 ? 'warning' : 'healthy'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* ── Header + Weekly Report action ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-semibold text-admin-accent">{t('common.adminBadge')}</span>
          </div>
          <h1 className="text-xl font-semibold text-theme-primary">{t('dashboard.title')}</h1>
        </div>
        <WeeklyReportPreview />
      </div>

      {/* ── Health Pulse (simplified — no redundant counts) ── */}
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
          <p className="text-sm">
            <span className={cn('font-medium', healthStatus === 'healthy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
              {healthStatus === 'healthy' ? t('dashboard.platformHealthy') : t('dashboard.attentionRequired')}
            </span>
            {kpis.highRiskKyc > 0 && (
              <span className="text-red-500 font-medium ml-2">{kpis.highRiskKyc} KYC {t('dashboard.kpi.kycAtRisk').toLowerCase()}</span>
            )}
          </p>
        </div>
      )}

      {/* ── KPIs (5 cards) ── */}
      {kpisLoading ? (
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
          <AdminKpiCard compact label={t('dashboard.kpi.agencies')} value={kpis.activeAgencies} icon={Building2}
            trend={kpis.newAgenciesThisMonth > 0 ? { value: kpis.newAgenciesThisMonth, label: '' } : undefined} />
          <AdminKpiCard compact label={t('dashboard.kpi.users')} value={kpis.totalUsers} icon={Users} variant="blue"
            trend={kpis.newUsersThisMonth > 0 ? { value: kpis.newUsersThisMonth, label: '' } : undefined} />
          <AdminKpiCard compact label={t('dashboard.kpi.activeProperties')} value={kpis.activeProperties} icon={Home} variant="blue" />
          <AdminKpiCard compact label={t('dashboard.kpi.transactions')} value={kpis.activeTransactions} icon={GitBranch} variant="success" />
          <AdminKpiCard compact label={t('dashboard.kpi.kycAtRisk')} value={kpis.highRiskKyc} icon={ShieldAlert}
            variant={kpis.highRiskKyc > 0 ? 'danger' : 'default'} />
        </div>
      ) : null}

      {/* ── Alerts (full-width) ── */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-sm font-semibold text-theme-primary mb-3">{t('dashboard.alerts')}</h2>
        {alertsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-theme-hover rounded-lg animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('dashboard.noAlerts')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {alerts.map((alert) => {
              const Icon = ALERT_ICONS[alert.action] ?? Bell
              const borderColor = ALERT_BORDER_COLORS[alert.action] ?? 'border-l-theme-border'
              const labelKey = ALERT_LABEL_KEYS[alert.action]
              const label = labelKey ? t(labelKey) : alert.action
              return (
                <div key={alert.id} className={`flex items-center gap-3 p-2.5 rounded-lg border-l-4 ${borderColor} bg-theme-hover/30`}>
                  <Icon className="h-3.5 w-3.5 text-theme-secondary flex-shrink-0" />
                  <p className="text-sm text-theme-primary flex-1 truncate">{label}</p>
                  <span className="text-xs text-theme-muted flex-shrink-0">{formatRelativeDate(alert.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Activity (full-width) ── */}
      <ActivityLog />

      {/* ── Onboarding (full-width) ── */}
      <OnboardingTracker />

      {/* ── Billing (full-width, dense) ── */}
      <BillingDashboard />
    </div>
  )
}
