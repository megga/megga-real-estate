// P6b — Clients finaux (audiences sans compte auth).
// 3 sections : Portails vendeurs · Leads entrants (inboxes) · Parcours KYC.
// Aucune donnée sensible : les RPC ne renvoient ni token ni IP (voir migration
// 20260713140000). Les vendeurs/leads/KYC publics forment une audience
// distincte des comptes auth (AdminUsersPage) et de la modération de biens.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Users, ShieldCheck, Eye, Clock } from 'lucide-react'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import PageTransition from '@/components/layout/PageTransition'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import { SellerLeadsInbox, ContactMessagesInbox } from '@/components/admin/AdminModerationInbox'
import { useEndUserStats, useSellerPortals, useKycMagicLinks } from '@/hooks/useAdminEndUsers'

const PORTAL_FILTERS = ['', 'active', 'expired', 'revoked'] as const
const KYC_FILTERS = ['', 'pending', 'opened', 'uploading', 'verifying', 'submitted', 'expired'] as const

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-theme-primary mb-3">{children}</h2>
}

function StatusPills<T extends string>({ options, value, onChange, prefix }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; prefix: string
}) {
  const { t } = useTranslation('admin')
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map(opt => (
        <button
          key={opt || 'all'}
          onClick={() => onChange(opt)}
          className={cn(
            'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
            value === opt ? 'bg-theme-active text-theme-primary' : 'text-theme-secondary hover:text-theme-primary'
          )}
        >
          {opt === '' ? t('common.all') : t(`${prefix}.${opt}`)}
        </button>
      ))}
    </div>
  )
}

export default function AdminEndUsersPage() {
  const { t } = useTranslation('admin')
  const { data: stats, isLoading: statsLoading } = useEndUserStats()
  const [portalStatus, setPortalStatus] = useState<typeof PORTAL_FILTERS[number]>('')
  const [kycStatus, setKycStatus] = useState<typeof KYC_FILTERS[number]>('')
  const { data: portals, isLoading: portalsLoading } = useSellerPortals(portalStatus || null)
  const { data: kycLinks, isLoading: kycLoading } = useKycMagicLinks(kycStatus || null)

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-medium text-admin-accent">{t('common.adminBadge')}</span>
          </div>
          <h1 className="text-2xl font-semibold text-theme-primary">{t('endUsers.title')}</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">{t('endUsers.subtitle')}</p>
        </div>

        {/* Section 1 — Portails vendeurs */}
        <section>
          <SectionTitle>{t('endUsers.portals.title')}</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <AdminKpiCard label={t('endUsers.portals.active')} value={statsLoading ? '—' : stats?.portals.active ?? 0} icon={FileText} variant="success" />
            <AdminKpiCard label={t('endUsers.portals.expired')} value={statsLoading ? '—' : stats?.portals.expired ?? 0} icon={Clock} />
            <AdminKpiCard label={t('endUsers.portals.viewed7d')} value={statsLoading ? '—' : stats?.portals.viewed_7d ?? 0} icon={Eye} variant="blue" />
            <AdminKpiCard label={t('endUsers.portals.totalViews')} value={statsLoading ? '—' : stats?.portals.total_views ?? 0} icon={Eye} />
          </div>
          <div className="mb-3"><StatusPills options={PORTAL_FILTERS} value={portalStatus} onChange={setPortalStatus} prefix="endUsers.portalStatus" /></div>
          <div className="rounded-xl border border-theme-border overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_90px_110px] px-4 py-2 bg-theme-hover text-xs font-medium text-theme-tertiary tracking-wide">
              <span>{t('endUsers.portals.col.contact')}</span>
              <span>{t('endUsers.portals.col.agency')}</span>
              <span>{t('endUsers.portals.col.property')}</span>
              <span className="text-center">{t('endUsers.portals.col.views')}</span>
              <span className="text-right">{t('endUsers.portals.col.expires')}</span>
            </div>
            {portalsLoading ? (
              <div className="px-4 py-8 text-center text-sm text-theme-tertiary">{t('common.loading')}</div>
            ) : (portals ?? []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-theme-tertiary">{t('endUsers.portals.empty')}</div>
            ) : (
              (portals ?? []).map((p, i) => (
                <div key={p.id} className={cn('grid grid-cols-[1.4fr_1fr_1fr_90px_110px] px-4 py-2.5 text-xs items-center', i > 0 && 'border-t border-theme-border-subtle')}>
                  <span className="text-theme-primary font-medium truncate pr-2">{p.contact_name ?? '—'}</span>
                  <span className="text-theme-secondary truncate pr-2">{p.agency_name ?? '—'}</span>
                  <span className="text-theme-secondary truncate pr-2">{p.property_title ?? '—'}</span>
                  <span className="text-center text-theme-secondary">{p.view_count}</span>
                  <span className="text-right text-theme-tertiary">{formatDate(p.expires_at)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Section 2 — Leads entrants (inboxes déménagées de la modération) */}
        <section>
          <SectionTitle>{t('endUsers.leads.title')}</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <AdminKpiCard label={t('endUsers.leads.total')} value={statsLoading ? '—' : stats?.leads.total ?? 0} icon={Users} />
            <AdminKpiCard label={t('endUsers.leads.new30d')} value={statsLoading ? '—' : stats?.leads.new_30d ?? 0} icon={Users} variant="blue" />
            <AdminKpiCard label={t('endUsers.leads.messages')} value={statsLoading ? '—' : stats?.contact_messages.total ?? 0} icon={FileText} />
          </div>
          <div className="space-y-4">
            <SellerLeadsInbox />
            <ContactMessagesInbox />
          </div>
        </section>

        {/* Section 3 — Parcours KYC publics */}
        <section>
          <SectionTitle>{t('endUsers.kyc.title')}</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <AdminKpiCard label={t('endUsers.kyc.sent')} value={statsLoading ? '—' : stats?.magic_links.total_30d ?? 0} icon={ShieldCheck} />
            <AdminKpiCard label={t('endUsers.kyc.opened')} value={statsLoading ? '—' : stats?.magic_links.opened ?? 0} icon={ShieldCheck} />
            <AdminKpiCard label={t('endUsers.kyc.uploaded')} value={statsLoading ? '—' : stats?.magic_links.uploaded ?? 0} icon={ShieldCheck} variant="blue" />
            <AdminKpiCard label={t('endUsers.kyc.confirmed')} value={statsLoading ? '—' : stats?.magic_links.confirmed ?? 0} icon={ShieldCheck} variant="success" />
            <AdminKpiCard label={t('endUsers.kyc.conversion')} value={statsLoading ? '—' : `${stats?.magic_links.conversion_pct ?? 0}%`} icon={ShieldCheck} />
          </div>
          <div className="mb-3"><StatusPills options={KYC_FILTERS} value={kycStatus} onChange={setKycStatus} prefix="endUsers.kycStatus" /></div>
          <div className="rounded-xl border border-theme-border overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1fr_100px_1fr_110px] px-4 py-2 bg-theme-hover text-xs font-medium text-theme-tertiary tracking-wide">
              <span>{t('endUsers.kyc.col.contact')}</span>
              <span>{t('endUsers.kyc.col.agency')}</span>
              <span>{t('endUsers.kyc.col.status')}</span>
              <span>{t('endUsers.kyc.col.mode')}</span>
              <span className="text-right">{t('endUsers.kyc.col.sent')}</span>
            </div>
            {kycLoading ? (
              <div className="px-4 py-8 text-center text-sm text-theme-tertiary">{t('common.loading')}</div>
            ) : (kycLinks ?? []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-theme-tertiary">{t('endUsers.kyc.empty')}</div>
            ) : (
              (kycLinks ?? []).map((k, i) => (
                <div key={k.id} className={cn('grid grid-cols-[1.4fr_1fr_100px_1fr_110px] px-4 py-2.5 text-xs items-center', i > 0 && 'border-t border-theme-border-subtle')}>
                  <span className="text-theme-primary font-medium truncate pr-2">{k.contact_name ?? '—'}</span>
                  <span className="text-theme-secondary truncate pr-2">{k.agency_name ?? '—'}</span>
                  <span className="text-theme-secondary">{t(`endUsers.kycStatus.${k.status}`, { defaultValue: k.status })}</span>
                  <span className="text-theme-secondary truncate pr-2">{k.mode}</span>
                  <span className="text-right text-theme-tertiary">{formatRelativeDate(k.sent_at)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </PageTransition>
  )
}
