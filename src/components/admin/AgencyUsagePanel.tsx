// P6a — Onglet « Usage & quotas » d'une agence (super-admin).
// Indicateurs d'usage du mois courant + plafonds configurés (barres usage/cap) +
// bouton d'édition (AgencyQuotaForm). Storage = estimation (documents + KYC).
// Grammaire Sugar : bentos séparés par l'ombre, dépassements en tons du kit
// (warn/err) et non en classes de couleur Tailwind, chiffres tabulaires.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Home, Users, Sparkles, MessageCircle, HardDrive, Activity, SlidersHorizontal } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import {
  AdminCard,
  AdminDivider,
  AdminError,
  AdminGhostBtn,
  AdminIc,
  AdminSkeleton,
  AdminStat,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import AgencyQuotaForm from '@/components/admin/AgencyQuotaForm'
import AgencyInvoicesSection from '@/components/admin/AgencyInvoicesSection'
import { useAdminAgencyUsage, type AgencyQuotas } from '@/hooks/useAdminAgencyUsage'

/** Grille d'indicateurs — s'adapte sans media query (2 colonnes en étroit, 3+ au large). */
const STAT_GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12 } as const

/**
 * Ligne « usage / plafond » avec sa barre de remplissage.
 *
 * La barre normale est à l'accent Sugar (encre), pas au violet de la console :
 * le violet est le repère de contexte, jamais une donnée. Seuls le seuil
 * d'alerte (`warn`) et le dépassement (`err`) colorent la barre.
 */
function QuotaBar({ label, used, cap, threshold }: { label: string; used: number; cap: number | null; threshold: number }) {
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSugar()

  if (cap == null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 2px' }}>
        <span style={{ fontSize: 12.5, color: sp.sub }}>{label}</span>
        <span style={{ fontSize: 12, color: sp.soft }}>{t('usage.quota.unlimited')}</span>
      </div>
    )
  }

  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
  const breached = cap > 0 && used >= cap * threshold / 100
  const over = cap > 0 && used >= cap
  const fill = over ? tones.err : breached ? tones.warn : sp.accent

  return (
    <div style={{ padding: '9px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, color: sp.sub }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: over ? tones.err : breached ? tones.warn : sp.soft }}>
          {used} / {cap} ({pct}%)
        </span>
      </div>
      <div style={{ height: 6, borderRadius: ADMIN_RADII.pill, background: surf.cardSub, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: ADMIN_RADII.pill, background: fill, transition: 'width .3s ease' }} />
      </div>
    </div>
  )
}

/** Panneau d'usage : indicateurs du mois, plafonds, factures Stripe et édition des quotas. */
export default function AgencyUsagePanel({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const { usage, usageLoading, usageError, quotas, quotasLoading } = useAdminAgencyUsage(agencyId)
  const [editing, setEditing] = useState(false)

  if (usageLoading || quotasLoading) {
    return (
      <div style={STAT_GRID}>
        {Array.from({ length: 6 }).map((_, i) => (
          <AdminSkeleton key={i} height={62} radius={ADMIN_RADII.card} />
        ))}
      </div>
    )
  }

  if (usageError || !usage) {
    return (
      <AdminCard>
        <AdminError message={t('usage.error')} />
      </AdminCard>
    )
  }

  const q: AgencyQuotas | null = quotas
  const threshold = q?.alert_threshold_pct ?? 80

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Indicateurs d'usage — mois courant */}
      <div style={STAT_GRID}>
        <AdminStat label={t('usage.card.properties')} value={usage.active_properties} icon={Home} />
        <AdminStat label={t('usage.card.contacts')} value={usage.contacts_count} icon={Users} />
        <AdminStat
          label={t('usage.card.aiCost')}
          value={`$${usage.ai_cost_month_usd.toFixed(2)}`}
          hint={t('usage.card.aiCalls', { count: usage.ai_calls_month })}
          icon={Sparkles}
          tone="info"
        />
        <AdminStat label={t('usage.card.whatsapp')} value={usage.wa_messages_month} icon={MessageCircle} />
        <AdminStat
          label={t('usage.card.storage')}
          value={`${usage.storage_est_mb} MB`}
          hint={t('usage.card.storageEstimate')}
          icon={HardDrive}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', fontSize: 12, color: sp.soft }}>
        <AdminIc icon={Activity} size={14} color={sp.soft} />
        {t('usage.lastActivity')} : {usage.last_activity_at ? formatRelativeDate(usage.last_activity_at) : t('usage.never')}
      </div>

      {/* Plafonds */}
      <AdminCard>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>{t('usage.quota.heading')}</div>
            <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 2 }}>{t('usage.quota.headingSub', { threshold })}</div>
          </div>
          <AdminGhostBtn icon={SlidersHorizontal} onClick={() => setEditing(true)}>
            {t('usage.quota.edit')}
          </AdminGhostBtn>
        </div>

        <QuotaBar label={t('usage.quota.aiCost')} used={usage.ai_cost_month_usd} cap={q?.ai_monthly_cost_cap_usd ?? null} threshold={threshold} />
        <AdminDivider />
        <QuotaBar label={t('usage.quota.properties')} used={usage.active_properties} cap={q?.active_properties_cap ?? null} threshold={threshold} />
        <AdminDivider />
        <QuotaBar label={t('usage.quota.whatsapp')} used={usage.wa_messages_month} cap={q?.whatsapp_monthly_cap ?? null} threshold={threshold} />
        <AdminDivider />
        <QuotaBar label={t('usage.quota.storage')} used={usage.storage_est_mb} cap={q?.storage_cap_mb ?? null} threshold={threshold} />
      </AdminCard>

      {/* Factures Stripe (chargées à la demande) */}
      <AgencyInvoicesSection agencyId={agencyId} />

      {editing && <AgencyQuotaForm agencyId={agencyId} current={q} onClose={() => setEditing(false)} />}
    </div>
  )
}
