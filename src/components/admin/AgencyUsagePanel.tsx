// P6a — Onglet « Usage & quotas » d'une agence (super-admin).
// Cartes d'usage du mois courant + plafonds configurés (barres usage/cap) +
// bouton d'édition (AgencyQuotaForm). Storage = estimation (documents + KYC).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Home, Users, Sparkles, MessageCircle, HardDrive, FileText, Activity, SlidersHorizontal } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import AgencyQuotaForm from '@/components/admin/AgencyQuotaForm'
import AgencyInvoicesSection from '@/components/admin/AgencyInvoicesSection'
import { useAdminAgencyUsage, type AgencyQuotas } from '@/hooks/useAdminAgencyUsage'

function QuotaBar({ label, used, cap, threshold }: { label: string; used: number; cap: number | null; threshold: number }) {
  const { t } = useTranslation('admin')
  if (cap == null) {
    return (
      <div className="flex items-center justify-between text-xs py-1.5">
        <span className="text-theme-secondary">{label}</span>
        <span className="text-theme-muted">{t('usage.quota.unlimited')}</span>
      </div>
    )
  }
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
  const breached = cap > 0 && used >= cap * threshold / 100
  const over = cap > 0 && used >= cap
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-theme-secondary">{label}</span>
        <span className={cn('font-medium', over ? 'text-red-500' : breached ? 'text-amber-500' : 'text-theme-tertiary')}>
          {used} / {cap} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-theme-hover overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', over ? 'bg-red-500' : breached ? 'bg-amber-500' : 'bg-admin-accent')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function AgencyUsagePanel({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { usage, usageLoading, usageError, quotas, quotasLoading } = useAdminAgencyUsage(agencyId)
  const [editing, setEditing] = useState(false)

  if (usageLoading || quotasLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-theme-border p-5 animate-pulse">
            <div className="h-3 bg-theme-hover rounded w-20 mb-3" />
            <div className="h-6 bg-theme-hover rounded w-12" />
          </div>
        ))}
      </div>
    )
  }

  if (usageError || !usage) {
    return <p className="text-sm text-theme-tertiary pt-4">{t('usage.error')}</p>
  }

  const q: AgencyQuotas | null = quotas
  const threshold = q?.alert_threshold_pct ?? 80

  return (
    <div className="pt-4 space-y-6">
      {/* Cartes d'usage — mois courant */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <AdminKpiCard label={t('usage.card.properties')} value={usage.active_properties} icon={Home} />
        <AdminKpiCard label={t('usage.card.contacts')} value={usage.contacts_count} icon={Users} />
        <AdminKpiCard label={t('usage.card.aiCost')} value={`$${usage.ai_cost_month_usd.toFixed(2)}`} subtitle={t('usage.card.aiCalls', { count: usage.ai_calls_month })} icon={Sparkles} variant="blue" />
        <AdminKpiCard label={t('usage.card.whatsapp')} value={usage.wa_messages_month} icon={MessageCircle} />
        <AdminKpiCard label={t('usage.card.storage')} value={`${usage.storage_est_mb} MB`} subtitle={t('usage.card.storageEstimate')} icon={HardDrive} />
        <AdminKpiCard label={t('usage.card.portals')} value={usage.portals_active} icon={FileText} />
      </div>

      <div className="flex items-center gap-2 text-xs text-theme-tertiary">
        <Activity className="h-3.5 w-3.5" />
        {t('usage.lastActivity')} : {usage.last_activity_at ? formatRelativeDate(usage.last_activity_at) : t('usage.never')}
      </div>

      {/* Quotas */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-theme-primary">{t('usage.quota.heading')}</h3>
            <p className="text-xs text-theme-tertiary mt-0.5">{t('usage.quota.headingSub', { threshold })}</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('usage.quota.edit')}
          </button>
        </div>
        <div className="divide-y divide-theme-border-subtle">
          <QuotaBar label={t('usage.quota.aiCost')} used={usage.ai_cost_month_usd} cap={q?.ai_monthly_cost_cap_usd ?? null} threshold={threshold} />
          <QuotaBar label={t('usage.quota.properties')} used={usage.active_properties} cap={q?.active_properties_cap ?? null} threshold={threshold} />
          <QuotaBar label={t('usage.quota.whatsapp')} used={usage.wa_messages_month} cap={q?.whatsapp_monthly_cap ?? null} threshold={threshold} />
          <QuotaBar label={t('usage.quota.storage')} used={usage.storage_est_mb} cap={q?.storage_cap_mb ?? null} threshold={threshold} />
        </div>
      </div>

      {/* Factures Stripe (chargées à la demande) */}
      <AgencyInvoicesSection agencyId={agencyId} />

      {editing && <AgencyQuotaForm agencyId={agencyId} current={q} onClose={() => setEditing(false)} />}
    </div>
  )
}
