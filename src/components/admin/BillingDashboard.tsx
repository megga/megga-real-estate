/**
 * Tableau de bord facturation (section super-admin).
 *
 * Alimenté par `useAdminBilling` — source Stripe si connecté, repli Supabase
 * sinon. Agrège KPI (MRR, revenu, ARPU, churn, échecs), répartition par plan,
 * historique de revenus sur 6 mois, renouvellements à venir et paiements récents.
 *
 * Rendu en grammaire Sugar : le bento enveloppant a laissé place à un titre de
 * groupe coiffant des cartes sœurs (un bento dans un bento se lit mal quand la
 * séparation vient de l'ombre), statuts de paiement en pilules pleines, montants
 * en chiffres tabulaires.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCHF, formatRelativeDate } from '@/lib/utils'
import { useAdminBilling } from '@/hooks/useAdminBilling'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import MrrSparkline from '@/components/admin/MrrSparkline'
import { CreditCard, Users, TrendingDown, TrendingUp, DollarSign, AlertTriangle, Clock, Zap } from 'lucide-react'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import {
  AdminCard,
  AdminDivider,
  AdminEmpty,
  AdminGroupTitle,
  AdminIc,
  AdminPill,
  AdminSkeleton,
  AdminTd,
  AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

const PLAN_LABEL_KEYS: Record<string, string> = {
  starter: 'common.plan.starter',
  pro: 'common.plan.pro',
  entreprise: 'common.plan.entreprise',
}

/** Ton de pilule d'un paiement Stripe ; tout autre statut reste sans signal. */
const PAYMENT_STATUS: Record<string, { tone: AdminToneName; key: string }> = {
  succeeded: { tone: 'ok', key: 'billing.payment.status.succeeded' },
  failed: { tone: 'err', key: 'billing.payment.status.failed' },
  refunded: { tone: 'warn', key: 'billing.payment.status.refunded' },
}

/** Section facturation : bloc KPI + trois cartes (plans, revenus, renouvellements) + table paiements. */
export default function BillingDashboard() {
  'use no memo'
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSugar()
  const { data, isLoading } = useAdminBilling()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <AdminSkeleton key={i} height={62} radius={ADMIN_RADII.card} />
        ))}
      </div>
    )
  }

  if (!data) return null

  const cardTitle: CSSProperties = { margin: '0 0 12px', fontSize: 13, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }

  // Répartition par plan : trois teintes froides distinctes. Le violet de la
  // plateforme est exclu — ici c'est une donnée métier, pas un repère de contexte.
  const planColor = (plan: string): string => {
    switch (plan) {
      case 'pro': return tones.info
      case 'entreprise':
      case 'agency': return tones.cyan
      case 'starter': return sp.soft
      default: return sp.sub
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AdminGroupTitle
        label={t('billing.title')}
        tone="ok"
        right={data.source === 'stripe'
          ? <AdminPill label={t('billing.stripeConnected')} tone="ok" icon={Zap} />
          : <span style={{ fontSize: 11.5, color: sp.sub }}>{t('billing.supabaseSource')}</span>}
      />

      {/* KPI grid — compact 3 columns on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <AdminKpiCard compact label={t('billing.kpi.mrr')} value={formatCHF(data.mrr)} icon={CreditCard} variant="success" />
        <AdminKpiCard compact label={t('billing.kpi.revenue')} value={formatCHF(data.revenueThisMonth)} icon={DollarSign} variant="success"
          trend={data.revenueGrowth !== 0 ? { value: data.revenueGrowth, label: '' } : undefined} />
        <AdminKpiCard compact label={t('billing.kpi.subscriptions')} value={data.activeSubscriptions} icon={Users} variant="blue" />
        <AdminKpiCard compact label={t('billing.kpi.arpu')} value={formatCHF(data.arpu)} icon={TrendingUp} />
        <AdminKpiCard compact label={t('billing.kpi.churn')} value={data.churnedThisMonth} icon={TrendingDown}
          variant={data.churnedThisMonth > 0 ? 'danger' : 'default'} />
        <AdminKpiCard compact label={t('billing.kpi.failed')} value={data.failedPaymentsThisMonth + data.pastDue} icon={AlertTriangle}
          variant={(data.failedPaymentsThisMonth + data.pastDue) > 0 ? 'danger' : 'default'} />
      </div>

      {/* Tendance MRR estimé (P7 — platform_metrics) */}
      <MrrSparkline />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Plan breakdown */}
        <AdminCard>
          <h3 style={cardTitle}>{t('billing.plans')}</h3>
          {data.planBreakdown.length === 0 ? (
            <AdminEmpty title={t('billing.noSubscription')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {data.planBreakdown.map(p => {
                const total = data.activeSubscriptions || 1
                const pct = Math.round((p.count / total) * 100)
                const color = planColor(p.plan)
                return (
                  <div key={p.plan}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: ADMIN_RADII.pill, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink }}>
                          {PLAN_LABEL_KEYS[p.plan] ? t(PLAN_LABEL_KEYS[p.plan]) : p.plan}
                        </span>
                      </div>
                      <span style={{ fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {p.count} ({pct}%)
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: ADMIN_RADII.pill, background: surf.cardSub, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: ADMIN_RADII.pill, background: color, transition: 'width .5s ease' }} />
                    </div>
                    <p style={{ margin: '5px 0 0', fontSize: 11, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCHF(p.mrr)}/mois
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </AdminCard>

        {/* Revenue history */}
        <AdminCard>
          <h3 style={cardTitle}>{t('billing.revenue6Months')}</h3>
          {data.revenueHistory.length === 0 ? (
            <AdminEmpty title={t('common.noData')} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 128 }}>
              {data.revenueHistory.map((m, i) => {
                const max = Math.max(...data.revenueHistory.map(h => h.amount), 1)
                const height = Math.max((m.amount / max) * 100, 4)
                return (
                  <div key={i} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 10.5, color: sp.sub, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {m.amount > 0 ? formatCHF(m.amount) : '-'}
                    </span>
                    {/* Piste à hauteur DÉFINIE : sans elle, le `height` en % de la
                        barre se résout contre une colonne auto et la barre disparaît. */}
                    <div style={{ flex: 1, width: '100%', minHeight: 0, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%', height: `${height}%`, background: sp.accent,
                        borderRadius: `${ADMIN_RADII.pill}px ${ADMIN_RADII.pill}px 0 0`,
                      }} />
                    </div>
                    <span style={{ fontSize: 10.5, color: sp.sub }}>{m.month}</span>
                  </div>
                )
              })}
            </div>
          )}
        </AdminCard>

        {/* Upcoming renewals */}
        <AdminCard>
          <h3 style={cardTitle}>{t('billing.upcomingRenewals')}</h3>
          {data.upcomingRenewals.length === 0 ? (
            <AdminEmpty title={t('billing.noRenewals')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.upcomingRenewals.map((r, i) => {
                const date = new Date(r.date * 1000)
                const daysUntil = Math.ceil((date.getTime() - Date.now()) / 86400000)
                return (
                  <div key={i}>
                    {i > 0 && <AdminDivider />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                      <AdminIc icon={Clock} size={14} color={sp.soft} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCHF(r.amount)}
                      </span>
                      <span style={{
                        fontSize: 11.5, fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                        color: daysUntil <= 3 ? tones.warn : sp.sub,
                      }}>
                        {daysUntil <= 0 ? "Aujourd'hui" : `J-${daysUntil}`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </AdminCard>
      </div>

      {/* Recent payments table */}
      {data.recentPayments.length > 0 && (
        <AdminCard padding={0}>
          <h3 style={{ ...cardTitle, margin: 0, padding: '15px 16px 10px' }}>{t('billing.recentPayments')}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <AdminTh width="26%">{t('billing.payment.table.email')}</AdminTh>
                  <AdminTh>{t('billing.payment.table.description')}</AdminTh>
                  <AdminTh align="right" width={116}>{t('billing.payment.table.amount')}</AdminTh>
                  <AdminTh align="center" width={124}>{t('billing.payment.table.status')}</AdminTh>
                  <AdminTh align="right" width={124}>{t('billing.payment.table.date')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map(p => {
                  const statusCfg = PAYMENT_STATUS[p.status]
                  return (
                    <tr key={p.id}>
                      {/* `table-layout: fixed` borne la colonne : une adresse longue
                          est coupée à l'ellipse. Le `title` rend la valeur entière
                          lisible au survol — porté par un `span` intérieur, seule
                          la partie VISIBLE de la cellule étant survolable. */}
                      <AdminTd style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={p.customer_email ?? undefined}>{p.customer_email ?? '-'}</span>
                      </AdminTd>
                      <AdminTd style={{ fontSize: 11.5, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={p.description ?? undefined}>{p.description ?? '-'}</span>
                      </AdminTd>
                      <AdminTd align="right" numeric style={{ fontWeight: 700 }}>{formatCHF(p.amount)}</AdminTd>
                      <AdminTd align="center">
                        <AdminPill
                          label={statusCfg ? t(statusCfg.key) : p.status}
                          tone={statusCfg?.tone ?? 'neutral'}
                        />
                      </AdminTd>
                      <AdminTd align="right" numeric style={{ fontSize: 11.5, color: sp.sub }}>
                        {formatRelativeDate(p.created)}
                      </AdminTd>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </section>
  )
}
