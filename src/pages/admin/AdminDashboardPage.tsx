/**
 * Page super-admin — tableau de bord plateforme (accueil de la section admin).
 *
 * Route : `/dashboard/admin` (accent violet). Empile un pouls de santé, 5 KPIs
 * (agences, users, biens, transactions, KYC à risque), le flux d'alertes, le
 * journal d'activité, le suivi d'onboarding et le dashboard de facturation.
 *
 * Grammaire Sugar : le titre et l'action « rapport hebdo » vivent dans
 * `AdminPage` (la pastille violette + le badge Admin sont désormais dans le rail,
 * une seule fois) ; le pouls de santé est une carte NEUTRE dont le signal passe
 * par des pilules ; une alerte est repérée par une pastille de ton, l'ancien
 * liseré gauche mettant du violet de plateforme sur un événement métier.
 */
import { useTranslation } from 'react-i18next'
import { Building2, Users, Home, GitBranch, ShieldAlert, AlertTriangle, Bell, CreditCard, CheckCircle, AlertCircle } from 'lucide-react'
import { useAdminStats } from '@/hooks/useAdminStats'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import BillingDashboard from '@/components/admin/BillingDashboard'
import WeeklyReportPreview from '@/components/admin/WeeklyReportPreview'
import OnboardingTracker from '@/components/admin/OnboardingTracker'
import ActivityLog from '@/components/admin/ActivityLog'
import AdminPage from '@/components/admin/kit/AdminPage'
import { AdminCard, AdminEmpty, AdminGroupTitle, AdminIc, AdminPill, AdminSkeleton } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { formatRelativeDate } from '@/lib/utils'

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

/** Tons de signal d'une alerte — le violet de plateforme n'est pas un statut métier. */
type AlertTone = 'ok' | 'warn' | 'err' | 'info'

/** `agency_created` était en violet ; c'est une bonne nouvelle, donc un ton « ok ». */
const ALERT_TONES: Record<string, AlertTone> = {
  agency_created: 'ok',
  kyc_screening_match: 'err',
  subscription_cancelled: 'warn',
  edge_function_error: 'err',
  ticket_created: 'info',
}

/** Vue d'ensemble : dérive l'état de santé des KPIs et compose les bandeaux/sections. */
export default function AdminDashboardPage() {
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSugar()
  const { kpis, kpisLoading, alerts, alertsLoading } = useAdminStats()

  const healthStatus = (kpis?.highRiskKyc ?? 0) > 0 ? 'warning' : 'healthy'

  return (
    <AdminPage title={t('dashboard.title')} width="wide" actions={<WeeklyReportPreview />}>
      {/* ── Pouls de santé — carte neutre, le signal est dans les pilules ── */}
      {kpis && (
        <AdminCard padding="12px 14px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <AdminPill
              tone={healthStatus === 'healthy' ? 'ok' : 'warn'}
              icon={healthStatus === 'healthy' ? CheckCircle : AlertCircle}
              label={healthStatus === 'healthy' ? t('dashboard.platformHealthy') : t('dashboard.attentionRequired')}
            />
            {kpis.highRiskKyc > 0 && (
              <AdminPill
                tone="err"
                label={`${kpis.highRiskKyc} KYC ${t('dashboard.kpi.kycAtRisk').toLowerCase()}`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            )}
          </div>
        </AdminCard>
      )}

      {/* ── KPIs (5 cards) ── */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <AdminSkeleton key={i} height={64} radius={ADMIN_RADII.card} />
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
      <AdminCard padding="8px 12px 14px">
        <AdminGroupTitle label={t('dashboard.alerts')} tone="warn" />
        {alertsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <AdminSkeleton key={i} height={40} />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <AdminEmpty icon={CheckCircle} title={t('dashboard.noAlerts')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {alerts.map((alert) => {
              const Icon = ALERT_ICONS[alert.action] ?? Bell
              const tone = ALERT_TONES[alert.action]
              const labelKey = ALERT_LABEL_KEYS[alert.action]
              const label = labelKey ? t(labelKey) : alert.action
              return (
                <div
                  key={alert.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, minWidth: 0,
                    padding: '10px 12px', borderRadius: ADMIN_RADII.row, background: surf.cardSub,
                  }}
                >
                  {/* La pastille remplace le liseré de 4 px : seul repère coloré autorisé. */}
                  <span style={{
                    width: 8, height: 8, borderRadius: ADMIN_RADII.pill, flexShrink: 0,
                    background: tone ? tones[tone] : sp.soft,
                  }} />
                  <AdminIc icon={Icon} size={15} color={sp.sub} />
                  <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 12.5, fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                  </p>
                  <span style={{ flexShrink: 0, fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                    {formatRelativeDate(alert.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </AdminCard>

      {/* ── Activity (full-width) ── */}
      <ActivityLog />

      {/* ── Onboarding (full-width) ── */}
      <OnboardingTracker />

      {/* ── Billing (full-width, dense) ── */}
      <BillingDashboard />
    </AdminPage>
  )
}
