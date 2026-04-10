import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, ArrowDownRight, Plus, AlertTriangle,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { TRANSACTION_STAGE_LABELS } from '@/lib/constants'
import type { TransactionStage } from '@/lib/constants'
import PageTransition from '@/components/layout/PageTransition'
import NewTransactionDialog from '@/components/transactions/NewTransactionDialog'
import { useDashboardStats } from '@/hooks/useDashboardStats'

/* ─── Stage colors ─── */

const STAGE_COLORS: Record<TransactionStage, string> = {
  new_lead: 'bg-gray-400',
  to_qualify: 'bg-gray-500',
  active_search: 'bg-blue-500',
  visit_planned: 'bg-cyan-500',
  visit_done: 'bg-teal-500',
  interest_confirmed: 'bg-green-500',
  offer: 'bg-emerald-600',
  negotiation: 'bg-amber-500',
  reserved: 'bg-orange-500',
  financing: 'bg-purple-500',
  notary: 'bg-indigo-600',
  signed: 'bg-green-700',
  lost: 'bg-red-500',
  to_recontact: 'bg-yellow-500',
}

const STAGE_DOT_COLORS: Record<TransactionStage, string> = STAGE_COLORS

/* ─── Activity dot colors by action type ─── */

function activityDotColor(action: string): string {
  if (action.includes('create') || action.includes('new')) return 'bg-blue-400'
  if (action.includes('visit')) return 'bg-amber-400'
  if (action.includes('offer') || action.includes('sign')) return 'bg-emerald-400'
  if (action.includes('document') || action.includes('upload')) return 'bg-gray-400'
  if (action.includes('kyc') || action.includes('screening')) return 'bg-purple-400'
  if (action.includes('stage') || action.includes('pipeline')) return 'bg-cyan-400'
  return 'bg-gray-400'
}

function translateAction(action: string): string {
  const map: Record<string, string> = {
    contact_created: 'Nouveau contact ajouté',
    transaction_created: 'Nouvelle transaction',
    stage_change: 'Changement d\'étape pipeline',
    visit_created: 'Visite planifiée',
    visit_completed: 'Visite effectuée',
    document_uploaded: 'Document uploadé',
    kyc_created: 'Dossier KYC créé',
    kyc_screening: 'Screening KYC effectué',
    kyc_validated: 'Dossier KYC validé',
    offer_received: 'Offre reçue',
    match_sent: 'Bien envoyé',
    email_sent: 'Email envoyé',
    note_added: 'Note ajoutée',
    property_created: 'Bien créé',
  }
  return map[action] || action.replace(/_/g, ' ')
}

/* ─── Ordered stages for funnel ─── */

const FUNNEL_STAGES: TransactionStage[] = [
  'new_lead', 'to_qualify', 'active_search', 'visit_planned',
  'visit_done', 'interest_confirmed', 'offer', 'negotiation',
  'reserved', 'financing', 'notary', 'signed', 'lost', 'to_recontact',
]

/* ─── Component ─── */
export default function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const [showNewTransaction, setShowNewTransaction] = useState(false)

  const {
    kpis, kpisLoading,
    pipeline, pipelineLoading,
    atRiskDeals, atRiskLoading,
    activity, activityLoading,
  } = useDashboardStats()

  /* ─── Pipeline computed values ─── */
  const totalDeals = pipeline.reduce((sum, s) => sum + s.count, 0)
  const totalValue = pipeline.reduce((sum, s) => sum + s.value, 0)
  const signedCount = pipeline.find((s) => s.stage === 'signed')?.count ?? 0
  const conversionRate = totalDeals > 0 ? ((signedCount / totalDeals) * 100).toFixed(1) : '0'
  const quarterProjection = totalDeals > 0 && Number(conversionRate) > 0
    ? totalValue * (Number(conversionRate) / 100)
    : 0

  /* ─── Ordered pipeline stages for display ─── */
  const orderedPipeline = FUNNEL_STAGES
    .map((stage) => {
      const found = pipeline.find((s) => s.stage === stage)
      return { stage, count: found?.count ?? 0, value: found?.value ?? 0 }
    })
    .filter((s) => s.count > 0)

  /* ─── KPI config ─── */
  const kpiItems = [
    { labelKey: 'kpi.activeProperties', value: kpis?.activeProperties ?? 0, trend: '+2 ce mois', positive: true },
    { labelKey: 'kpi.activeTransactions', value: kpis?.activeTransactions ?? 0, trend: '+12%', positive: true },
    { labelKey: 'kpi.pipelineValue', value: kpis ? formatCHF(kpis.pipelineValue) : 'CHF 0', isCHF: true, trend: '', positive: true },
    { labelKey: 'kpi.contacts', value: kpis?.totalContacts ?? 0, trend: '+8 cette sem.', positive: true },
    { labelKey: 'kpi.visitsThisMonth', value: kpis?.visitsThisMonth ?? 0, trend: '', positive: true },
  ]

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6">
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

        {/* KPIs — 5 items in a row */}
        <div className={cn(
          'grid grid-cols-2 md:grid-cols-5 rounded-xl border border-theme-border md:divide-x divide-theme-border',
          kpisLoading && 'animate-pulse',
        )}>
          {kpiItems.map((kpi, idx) => (
            <div
              key={kpi.labelKey}
              className={cn(
                'px-4 py-3 md:px-5 md:py-4',
                idx < 4 && idx % 2 === 0 && 'border-r md:border-r-0 border-theme-border',
                idx < 2 && 'border-b md:border-b-0 border-theme-border',
                idx >= 2 && idx < 4 && 'border-b md:border-b-0 border-theme-border',
              )}
            >
              <div className="flex items-baseline gap-2">
                <span className={cn('font-bold text-theme-primary', kpi.isCHF ? 'text-lg' : 'text-2xl')}>
                  {kpi.isCHF ? kpi.value : kpi.value}
                </span>
              </div>
              <span className="text-xs text-theme-tertiary">{t(kpi.labelKey)}</span>
              {kpi.trend && (
                <div className="flex items-center gap-1 mt-1">
                  {kpi.positive ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span className={cn('text-xs', kpi.positive ? 'text-emerald-500' : 'text-red-500')}>
                    {kpi.trend}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pipeline + Deals at risk — 2 columns on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Pipeline (3/5) */}
          <div className={cn(
            'lg:col-span-3 rounded-xl border border-theme-border p-6',
            pipelineLoading && 'animate-pulse',
          )}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-theme-primary">{t('pipeline.title')}</h2>
                <p className="text-sm text-theme-tertiary mt-0.5">
                  {totalDeals} {totalDeals > 1 ? t('pipeline.dealsPlural') : t('pipeline.deals')} · {formatCHF(totalValue)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-theme-primary tabular-nums">
                  {t('pipeline.conversionRate')} {conversionRate}%
                </span>
                <a href="/dashboard/pipeline" className="text-sm text-accent hover:text-accent/80 font-medium transition-colors">
                  {t('pipeline.viewPipeline')}
                </a>
              </div>
            </div>

            {/* Funnel bar */}
            {totalDeals > 0 ? (
              <div className="flex rounded-lg overflow-hidden h-7 mb-5">
                {orderedPipeline.map((stage) => (
                  <div
                    key={stage.stage}
                    className={cn(
                      'flex items-center justify-center text-xs font-semibold text-white transition-all',
                      STAGE_COLORS[stage.stage],
                    )}
                    style={{ width: `${(stage.count / totalDeals) * 100}%`, minWidth: stage.count > 0 ? '24px' : 0 }}
                    title={`${TRANSACTION_STAGE_LABELS[stage.stage]}: ${stage.count}`}
                  >
                    {stage.count}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-7 mb-5 rounded-lg bg-theme-section" />
            )}

            {/* Detailed legend */}
            {orderedPipeline.map((stage, i) => (
              <div
                key={stage.stage}
                className={cn(
                  'flex items-center gap-3 py-2.5',
                  i < orderedPipeline.length - 1 && 'border-b border-theme-border',
                )}
              >
                <div className={cn('h-2 w-2 rounded-full shrink-0', STAGE_DOT_COLORS[stage.stage])} />
                <span className="text-sm text-theme-primary flex-1">
                  {TRANSACTION_STAGE_LABELS[stage.stage]}
                </span>
                <span className="text-sm font-medium text-theme-primary tabular-nums">
                  {stage.count} {stage.count > 1 ? t('pipeline.dealsPlural') : t('pipeline.deals')}
                </span>
                <span className="text-sm text-theme-tertiary tabular-nums w-28 text-right">
                  {formatCHF(stage.value)}
                </span>
              </div>
            ))}

            {totalDeals === 0 && !pipelineLoading && (
              <p className="text-sm text-theme-tertiary py-4 text-center">{t('pipeline.empty')}</p>
            )}

            {/* Projection */}
            {quarterProjection > 0 && (
              <p className="text-xs text-theme-tertiary mt-4">
                {t('pipeline.projection', { rate: conversionRate, amount: formatCHF(quarterProjection) })}
              </p>
            )}
          </div>

          {/* Deals at risk (2/5) */}
          <div className={cn(
            'lg:col-span-2 rounded-xl border border-theme-border p-6',
            atRiskLoading && 'animate-pulse',
          )}>
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-base font-semibold text-theme-primary">{t('atRisk.title')}</h2>
              {atRiskDeals.length > 0 && (
                <span className="text-xs font-medium text-red-500">{atRiskDeals.length}</span>
              )}
            </div>

            {atRiskDeals.length === 0 && !atRiskLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-theme-secondary">{t('atRisk.empty')}</p>
                <p className="text-xs text-theme-tertiary mt-1">{t('atRisk.emptyDescription')}</p>
              </div>
            ) : (
              <div className="space-y-0">
                {atRiskDeals.map((deal, i) => (
                  <div
                    key={deal.id}
                    className={cn(
                      'group flex items-start gap-3 py-3 cursor-pointer',
                      i < atRiskDeals.length - 1 && 'border-b border-theme-border',
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/dashboard/pipeline`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/dashboard/pipeline`) } }}
                  >
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme-primary group-hover:text-accent transition-colors truncate">
                        {deal.buyer
                          ? `${deal.buyer.first_name} ${deal.buyer.last_name}`
                          : t('atRisk.unknownContact')}
                      </p>
                      {deal.property && (
                        <p className="text-xs text-theme-tertiary truncate">
                          {deal.property.address}, {deal.property.city}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          'text-xs font-medium px-1.5 py-0.5 rounded',
                          'bg-theme-section text-theme-secondary',
                        )}>
                          {TRANSACTION_STAGE_LABELS[deal.stage]}
                        </span>
                        <span className="text-xs text-red-500">
                          {t('atRisk.daysSince', { count: deal.daysSinceUpdate })}
                        </span>
                      </div>
                    </div>
                    <button className="text-xs text-theme-secondary hover:text-theme-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {t('atRisk.view')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activité récente — transparent bento */}
        <div className={cn(
          'rounded-xl border border-theme-border p-6',
          activityLoading && 'animate-pulse',
        )}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-theme-primary">{t('activity.title')}</h2>
          </div>

          {activity.length === 0 && !activityLoading ? (
            <p className="text-sm text-theme-tertiary py-4 text-center">{t('activity.empty')}</p>
          ) : (
            activity.map((evt, i) => (
              <div
                key={evt.id}
                className={cn(
                  'flex items-start gap-3 py-3 cursor-pointer group',
                  i < activity.length - 1 && 'border-b border-theme-border',
                )}
              >
                <div className={cn('h-2 w-2 rounded-full shrink-0 mt-1.5', activityDotColor(evt.action))} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary group-hover:text-accent transition-colors">
                    {translateAction(evt.action)}
                  </p>
                  <p className="text-xs text-theme-tertiary mt-0.5">
                    {evt.actor?.full_name && <span>{evt.actor.full_name} · </span>}
                    <span>{formatRelativeDate(evt.created_at)}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  )
}
