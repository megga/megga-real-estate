/**
 * P6b — Clients finaux (audiences sans compte auth), en grammaire Sugar.
 *
 * 2 sections : Leads entrants (inboxes) · Parcours KYC.
 * La section « Portails vendeurs » est partie avec la fonctionnalité (2026-07-26).
 * Aucune donnée sensible : les RPC ne renvoient ni token ni IP (voir migration
 * 20260713140000). Les vendeurs/leads/KYC publics forment une audience
 * distincte des comptes auth (AdminUsersPage) et de la modération de biens.
 *
 * Présentation portée sur le kit `admin/kit` (grammaire des Paramètres du CRM) :
 * bentos séparés par l'ombre, indicateurs `AdminStat`, vrais tableaux
 * `AdminTh`/`AdminTd`, statut KYC en pilule pleine. Le repère « Admin MEGGA » a
 * quitté la page : il vit une seule fois dans le rail du shell.
 */

import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Users, ShieldCheck } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminDivider, AdminEmpty, AdminGroupTitle,
  AdminPill, AdminSkeleton, AdminStat, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'
import { SellerLeadsInbox, ContactMessagesInbox } from '@/components/admin/AdminModerationInbox'
import { useEndUserStats, useKycMagicLinks } from '@/hooks/useAdminEndUsers'

const KYC_FILTERS = ['', 'pending', 'opened', 'uploading', 'verifying', 'submitted', 'expired'] as const

/** Troncature d'une cellule de tableau (les colonnes ont une largeur fixe). */
const CLIP = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

/** Ton de pilule d'un statut de parcours KYC — `neutral` = aucun signal. */
function kycTone(status: string): AdminToneName {
  switch (status) {
    case 'submitted': case 'confirmed': return 'ok'
    case 'verifying': return 'warn'
    case 'expired': case 'revoked': return 'err'
    case 'opened': return 'info'
    case 'uploading': return 'cyan'
    default: return 'neutral'
  }
}

/** Filtres de statut en pilules segmentées (actif = accent noir, texte blanc). */
function StatusPills<T extends string>({ options, value, onChange, prefix }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; prefix: string
}) {
  const { t } = useTranslation('admin')
  const { sp, surf } = useAdminSurfaces()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {options.map(opt => {
        const on = value === opt
        return (
          <button
            key={opt || 'all'}
            onClick={() => onChange(opt)}
            style={{
              height: 30, padding: '0 13px', borderRadius: ADMIN_RADII.pill, border: 0,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap',
              background: on ? sp.accent : surf.cardSub, color: on ? sp.accentInk : sp.soft,
              transition: 'background .18s ease',
            }}
          >
            {opt === '' ? t('common.all') : t(`${prefix}.${opt}`)}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Bento de liste : barre de filtres, puis tableau — ou chargement / vide.
 *
 * Le tableau défile HORIZONTALEMENT dans son propre conteneur : `tableLayout:
 * fixed` fige les largeurs de colonnes (c'est ce qui permet la troncature des
 * cellules), donc sans ce conteneur les colonnes se tasseraient sur mobile.
 */
function ListBento({ filters, columns, loading, isEmpty, empty, rows, minWidth }: {
  filters: ReactNode
  columns: ReactNode
  loading: boolean
  isEmpty: boolean
  empty: ReactNode
  rows: ReactNode
  minWidth: number
}) {
  const { t } = useTranslation('admin')
  return (
    <AdminCard padding={0}>
      <div style={{ padding: '11px 13px' }}>{filters}</div>
      <AdminDivider />
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
          {/* Le libellé ne va que sur le PREMIER squelette : `label` transforme le
              bloc en `role="status"`, donc le poser sur les quatre ferait annoncer
              « Chargement… » quatre fois. Les trois autres restent décoratifs. */}
          {[0, 1, 2, 3].map(i => (
            <AdminSkeleton key={i} height={34} label={i === 0 ? t('common.loading') : undefined} />
          ))}
        </div>
      ) : isEmpty ? empty : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead><tr>{columns}</tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
    </AdminCard>
  )
}

export default function AdminEndUsersPage() {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSurfaces()
  const { data: stats, isLoading: statsLoading } = useEndUserStats()
  const [kycStatus, setKycStatus] = useState<typeof KYC_FILTERS[number]>('')
  const { data: kycLinks, isLoading: kycLoading } = useKycMagicLinks(kycStatus || null)

  const sub = { color: sp.sub } as const

  return (
    <AdminPage title={t('endUsers.title')} subtitle={t('endUsers.subtitle')} width="wide">
      {/* Section 1 — Leads entrants (inboxes déménagées de la modération) */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AdminGroupTitle label={t('endUsers.leads.title')} tone="cyan" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AdminStat label={t('endUsers.leads.total')} value={statsLoading ? '—' : stats?.leads.total ?? 0} icon={Users} />
          <AdminStat label={t('endUsers.leads.new30d')} value={statsLoading ? '—' : stats?.leads.new_30d ?? 0} icon={Users} tone="info" />
          <AdminStat label={t('endUsers.leads.messages')} value={statsLoading ? '—' : stats?.contact_messages.total ?? 0} icon={FileText} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SellerLeadsInbox />
          <ContactMessagesInbox />
        </div>
      </section>

      {/* Section 2 — Parcours KYC publics */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AdminGroupTitle label={t('endUsers.kyc.title')} tone="ok" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <AdminStat label={t('endUsers.kyc.sent')} value={statsLoading ? '—' : stats?.magic_links.total_30d ?? 0} icon={ShieldCheck} />
          <AdminStat label={t('endUsers.kyc.opened')} value={statsLoading ? '—' : stats?.magic_links.opened ?? 0} icon={ShieldCheck} />
          <AdminStat label={t('endUsers.kyc.uploaded')} value={statsLoading ? '—' : stats?.magic_links.uploaded ?? 0} icon={ShieldCheck} tone="info" />
          <AdminStat label={t('endUsers.kyc.confirmed')} value={statsLoading ? '—' : stats?.magic_links.confirmed ?? 0} icon={ShieldCheck} tone="ok" />
          <AdminStat label={t('endUsers.kyc.conversion')} value={statsLoading ? '—' : `${stats?.magic_links.conversion_pct ?? 0}%`} icon={ShieldCheck} />
        </div>
        <ListBento
          minWidth={680}
          loading={kycLoading}
          filters={<StatusPills options={KYC_FILTERS} value={kycStatus} onChange={setKycStatus} prefix="endUsers.kycStatus" />}
          isEmpty={(kycLinks ?? []).length === 0}
          empty={<AdminEmpty icon={ShieldCheck} title={t('endUsers.kyc.empty')} />}
          columns={
            <>
              <AdminTh width="28%">{t('endUsers.kyc.col.contact')}</AdminTh>
              <AdminTh width="22%">{t('endUsers.kyc.col.agency')}</AdminTh>
              <AdminTh width={150}>{t('endUsers.kyc.col.status')}</AdminTh>
              <AdminTh>{t('endUsers.kyc.col.mode')}</AdminTh>
              <AdminTh align="right" width={120}>{t('endUsers.kyc.col.sent')}</AdminTh>
            </>
          }
          rows={(kycLinks ?? []).map(k => (
            <tr key={k.id}>
              <AdminTd style={{ ...CLIP, fontWeight: 600 }}>{k.contact_name ?? '—'}</AdminTd>
              <AdminTd style={{ ...CLIP, ...sub }}>{k.agency_name ?? '—'}</AdminTd>
              <AdminTd>
                <AdminPill
                  label={t(`endUsers.kycStatus.${k.status}`, { defaultValue: k.status })}
                  tone={kycTone(k.status)}
                />
              </AdminTd>
              <AdminTd style={{ ...CLIP, ...sub }}>{k.mode}</AdminTd>
              <AdminTd align="right" numeric style={sub}>{formatRelativeDate(k.sent_at)}</AdminTd>
            </tr>
          ))}
        />
      </section>
    </AdminPage>
  )
}
