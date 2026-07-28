/**
 * Page super-admin — détail d'une agence.
 *
 * Route : `/agencies/:id`. Vue en lecture seule organisée en 6 onglets (infos,
 * usage, équipe, activité, biens, transactions), chacun alimenté par un hook
 * `useAgency*` dédié. Sert aussi de point d'entrée à l'impersonation d'un
 * membre — précédée d'un audit serveur (cf. `EquipeTab`).
 *
 * Rendu en grammaire Sugar (kit `components/admin/kit`) : bentos séparés par
 * l'ombre et non par une bordure, statuts en pilules pleines, tableaux réels
 * (`AdminTh`/`AdminTd`) au lieu de grilles de `<span>`. Le repère « console
 * admin » vit désormais une seule fois, dans le rail du shell.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Mail, Phone, Clock, Eye } from 'lucide-react'
import { formatDate, formatRelativeDate, formatCHF } from '@/lib/utils'
import {
  useAdminAgency,
  useAgencyMembers,
  useAgencyProperties,
  useAgencyTransactions,
  useAgencyActivity,
} from '@/hooks/useAdminAgencies'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminAvatar,
  AdminCard,
  AdminDivider,
  AdminEmpty,
  AdminIc,
  AdminPill,
  AdminSkeleton,
  AdminTd,
  AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { ADMIN_CONSOLE_PATH, openImpersonation } from '@/lib/adminEntry'
import AdminBillingCard from '@/components/admin/AdminBillingCard'
import AgencyUsagePanel from '@/components/admin/AgencyUsagePanel'

type Tab = 'infos' | 'equipe' | 'activite' | 'biens' | 'transactions' | 'usage'

const TAB_KEYS: { key: Tab; i18nKey: string }[] = [
  { key: 'infos', i18nKey: 'agencyDetail.tab.infos' },
  { key: 'usage', i18nKey: 'agencyDetail.tab.usage' },
  { key: 'equipe', i18nKey: 'agencyDetail.tab.team' },
  { key: 'activite', i18nKey: 'agencyDetail.tab.activity' },
  { key: 'biens', i18nKey: 'agencyDetail.tab.properties' },
  { key: 'transactions', i18nKey: 'agencyDetail.tab.transactions' },
]

const PLAN_I18N: Record<string, string> = {
  starter: 'common.plan.starter',
  pro: 'common.plan.pro',
  entreprise: 'common.plan.entreprise',
}

const STATUS_I18N: Record<string, string> = {
  active: 'common.status.active',
  suspended: 'common.status.suspended',
}

const PROPERTY_STATUS_I18N: Record<string, string> = {
  draft: 'common.status.draft',
  active: 'common.status.active',
  reserved: 'common.status.reserved',
  sold: 'common.status.sold',
  off_market: 'common.status.offMarket',
  archived: 'common.status.archived',
}

const STAGE_I18N: Record<string, string> = {
  new_lead: 'agencyDetail.stage.newLead',
  to_qualify: 'agencyDetail.stage.toQualify',
  active_search: 'agencyDetail.stage.activeSearch',
  visit_planned: 'agencyDetail.stage.visitPlanned',
  visit_done: 'agencyDetail.stage.visitDone',
  interest_confirmed: 'agencyDetail.stage.interestConfirmed',
  offer: 'agencyDetail.stage.offer',
  negotiation: 'agencyDetail.stage.negotiation',
  reserved: 'agencyDetail.stage.reserved',
  financing: 'agencyDetail.stage.financing',
  notary: 'agencyDetail.stage.notary',
  signed: 'agencyDetail.stage.signed',
  closed: 'agencyDetail.stage.closed',
  lost: 'agencyDetail.stage.lost',
  to_recontact: 'agencyDetail.stage.toRecontact',
}

/**
 * Tons de pilule des statuts de bien et d'affaire.
 *
 * `sold` / `completed` étaient en violet : le violet est le repère « tu es dans
 * la console », jamais un statut métier — ils passent donc en `info`. Les
 * statuts non listés restent neutres, comme avant (ils n'avaient pas de signal).
 */
const PROPERTY_TONE: Record<string, AdminToneName> = { active: 'ok', sold: 'info' }
const TRANSACTION_TONE: Record<string, AdminToneName> = { active: 'ok', completed: 'info', cancelled: 'err' }

/** Deux initiales à partir d'un nom complet (« Marie Dupont » → « MD »). */
function initialsOf(name: string): string {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/**
 * Retour à la liste des agences.
 *
 * Reprend la grammaire d'`AdminGhostBtn` mais reste une ancre : un `<button>`
 * perdrait le clic-milieu, le survol d'URL et l'ouverture en nouvel onglet.
 */
function BackToAgencies({ label }: { label: string }) {
  const { sp, surf } = useAdminSugar()
  return (
    <Link
      to={`${ADMIN_CONSOLE_PATH}/agencies`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 34, padding: '0 15px', borderRadius: ADMIN_RADII.pill,
        fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', textDecoration: 'none',
        color: sp.ink, background: surf.card, boxShadow: sp.shadowSm,
      }}
    >
      <AdminIc icon={ArrowLeft} size={15} color={sp.ink} />
      {label}
    </Link>
  )
}

/** Empilement de lignes fantômes pendant le chargement d'un onglet. */
function TabSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <AdminCard padding={14}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <AdminSkeleton key={i} height={38} />
        ))}
      </div>
    </AdminCard>
  )
}

/** Barre d'onglets monochrome : soulignement à l'accent, pas de pastille colorée. */
function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const { t } = useTranslation('admin')
  const { sp, dark } = useAdminSugar()
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto',
        boxShadow: `inset 0 -1px 0 ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'}`,
      }}
    >
      {TAB_KEYS.map((tab) => {
        const on = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            style={{
              border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              padding: '9px 14px 11px', whiteSpace: 'nowrap',
              fontSize: 12.5, fontWeight: on ? 800 : 600, letterSpacing: -0.1,
              color: on ? sp.ink : sp.sub,
              boxShadow: on ? `inset 0 -2px 0 ${sp.accent}` : undefined,
              transition: 'color .18s ease',
            }}
          >
            {t(tab.i18nKey)}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Composant de page : en-tête agence (nom, plan, statut) + barre d'onglets.
 * Gère les états chargement / introuvable, puis délègue le contenu à l'onglet actif.
 */
export default function AdminAgencyDetailPage() {
  const { t } = useTranslation('admin')
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('infos')

  const { data: agency, isLoading } = useAdminAgency(id ?? '')

  const plan = agency ? t(PLAN_I18N[agency.plan ?? ''] ?? 'common.plan.starter') : null
  const statusKey = agency?.status ?? 'active'

  return (
    <AdminPage
      // Le nom n'est connu qu'après chargement ; « — » est le placeholder de
      // valeur absente déjà utilisé par les tableaux de cette page.
      title={agency?.name ?? '—'}
      subtitle={agency ? `${plan} · ${formatDate(agency.created_at)}` : undefined}
      width="wide"
      actions={
        <>
          {agency && (
            <AdminPill
              label={t(STATUS_I18N[statusKey] ?? 'common.status.active')}
              tone={agency.status === 'active' ? 'ok' : 'err'}
            />
          )}
          <BackToAgencies label={t('admin:agencyDetail.back')} />
        </>
      }
    >
      {isLoading ? (
        <TabSkeleton rows={4} />
      ) : !agency ? (
        <AdminCard>
          <AdminEmpty icon={Building2} title={t('admin:agencyDetail.notFound')} />
        </AdminCard>
      ) : (
        <>
          <TabBar active={activeTab} onSelect={setActiveTab} />

          {activeTab === 'infos' && <InfosTab agency={agency} />}
          {activeTab === 'usage' && <AgencyUsagePanel agencyId={agency.id} />}
          {activeTab === 'equipe' && <EquipeTab agencyId={agency.id} />}
          {activeTab === 'activite' && <ActiviteTab agencyId={agency.id} />}
          {activeTab === 'biens' && <BiensTab agencyId={agency.id} />}
          {activeTab === 'transactions' && <TransactionsTab agencyId={agency.id} />}
        </>
      )}
    </AdminPage>
  )
}

/** Onglet « Infos » : coordonnées de l'agence + carte d'abonnement (override manuel du plan). */
function InfosTab({ agency }: { agency: Record<string, unknown> }) {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const fields = [
    { icon: Building2, label: t('admin:agencyDetail.info.address'), value: agency.address as string | null },
    { icon: Phone, label: t('admin:agencyDetail.info.phone'), value: agency.phone as string | null },
    { icon: Mail, label: t('admin:agencyDetail.info.email'), value: agency.email as string | null },
    { icon: Clock, label: t('admin:agencyDetail.info.slug'), value: agency.slug as string | null },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AdminCard padding={8}>
        {fields.map((f, i) => (
          <div key={f.label}>
            {i > 0 && <AdminDivider margin="0 6px" />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', minWidth: 0 }}>
              <AdminIc icon={f.icon} size={16} color={sp.soft} />
              <span style={{ width: 96, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: sp.sub }}>{f.label}</span>
              <span style={{ minWidth: 0, fontSize: 13, fontWeight: 600, color: f.value ? sp.ink : sp.soft, letterSpacing: -0.1 }}>
                {f.value || t('admin:common.notProvided')}
              </span>
            </div>
          </div>
        ))}
      </AdminCard>

      {/* Abonnement + override manuel de plan (P4 admin) */}
      <AdminBillingCard agencyId={agency.id as string} />
    </div>
  )
}

/**
 * Onglet « Équipe » : liste des membres de l'agence. Chaque ligne expose (au
 * survol) un bouton qui ouvre le CRM en vue impersonée (l'audit serveur y est
 * fait avant activation).
 */
function EquipeTab({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const { data: members, isLoading } = useAgencyMembers(agencyId)

  if (isLoading) return <TabSkeleton />

  if (!members || members.length === 0) {
    return (
      <AdminCard>
        <AdminEmpty title={t('admin:agencyDetail.team.noMembers')} />
      </AdminCard>
    )
  }

  return (
    <AdminCard padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }} className="scrollbar-hide">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead>
            <tr>
              <AdminTh>{t('admin:agencyDetail.team.table.name')}</AdminTh>
              <AdminTh width={180}>{t('admin:agencyDetail.team.table.email')}</AdminTh>
              <AdminTh width={110}>{t('admin:agencyDetail.team.table.role')}</AdminTh>
              <AdminTh width={110} align="right">{t('admin:agencyDetail.team.table.registration')}</AdminTh>
              {/* Colonne d'action (impersonation) : en-tête sans libellé. */}
              <AdminTh width={54}>{null}</AdminTh>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="group">
                <AdminTd>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <AdminAvatar initials={initialsOf(member.full_name ?? t('admin:common.user'))} size={28} />
                    <span style={{ fontWeight: 700, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.full_name ?? t('admin:common.noName')}
                    </span>
                  </span>
                </AdminTd>
                <AdminTd style={{ color: sp.sub, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.email}
                </AdminTd>
                <AdminTd style={{ color: sp.sub, textTransform: 'capitalize' }}>
                  {member.role ?? 'agent'}
                </AdminTd>
                <AdminTd align="right" numeric style={{ color: sp.soft }}>
                  {formatDate(member.created_at ?? '')}
                </AdminTd>
                <AdminTd align="right">
                  <button
                    // Nouvel onglet ; c'est le CRM qui journalise avant
                    // d'activer la vue (audit-first).
                    onClick={() => openImpersonation(member.id)}
                    aria-label={t('admin:agencyDetail.team.impersonate', { name: member.full_name ?? t('admin:common.user') })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0,
                      background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center',
                    }}
                  >
                    <AdminIc icon={Eye} size={15} color={sp.soft} />
                  </button>
                </AdminTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  )
}

/** Onglet « Activité » : flux chronologique des événements de l'agence. */
function ActiviteTab({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const { data: events, isLoading } = useAgencyActivity(agencyId)

  if (isLoading) return <TabSkeleton />

  if (!events || events.length === 0) {
    return (
      <AdminCard>
        <AdminEmpty title={t('admin:agencyDetail.activity.noActivity')} />
      </AdminCard>
    )
  }

  return (
    <AdminCard padding={8}>
      {events.map((event) => (
        <div key={event.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 10px' }}>
          {/* Puce de repère chronologique : aucun signal, donc encre douce et pas de couleur vive. */}
          <span style={{ width: 6, height: 6, borderRadius: ADMIN_RADII.pill, background: sp.soft, marginTop: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: sp.ink }}>
              <span style={{ fontWeight: 700 }}>{event.action}</span>
              {event.entity_type && (
                <span style={{ color: sp.sub }}> {t('admin:agencyDetail.activity.on')} {event.entity_type}</span>
              )}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: sp.soft }}>
              {formatRelativeDate(event.created_at)}
            </p>
          </div>
        </div>
      ))}
    </AdminCard>
  )
}

/** Onglet « Biens » : tableau des annonces de l'agence (titre, statut, prix, ville, date). */
function BiensTab({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const { data: properties, isLoading } = useAgencyProperties(agencyId)

  if (isLoading) return <TabSkeleton />

  if (!properties || properties.length === 0) {
    return (
      <AdminCard>
        <AdminEmpty title={t('admin:agencyDetail.properties.noProperties')} />
      </AdminCard>
    )
  }

  return (
    <AdminCard padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }} className="scrollbar-hide">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <AdminTh>{t('admin:agencyDetail.properties.table.title')}</AdminTh>
              <AdminTh width={120}>{t('admin:agencyDetail.properties.table.status')}</AdminTh>
              <AdminTh width={130} align="right">{t('admin:agencyDetail.properties.table.price')}</AdminTh>
              <AdminTh width={110}>{t('admin:agencyDetail.properties.table.city')}</AdminTh>
              <AdminTh width={110} align="right">{t('admin:agencyDetail.properties.table.date')}</AdminTh>
            </tr>
          </thead>
          <tbody>
            {properties.map((prop) => (
              <tr key={prop.id}>
                <AdminTd style={{ fontWeight: 600, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prop.title || t('admin:common.noTitle')}
                </AdminTd>
                <AdminTd>
                  <AdminPill
                    label={t(PROPERTY_STATUS_I18N[prop.status] ?? 'common.status.draft')}
                    tone={PROPERTY_TONE[prop.status] ?? 'neutral'}
                  />
                </AdminTd>
                <AdminTd align="right" numeric style={{ fontWeight: 700 }}>
                  {prop.price ? formatCHF(prop.price) : '—'}
                </AdminTd>
                <AdminTd style={{ color: sp.sub }}>{prop.city ?? '—'}</AdminTd>
                <AdminTd align="right" numeric style={{ color: sp.soft }}>
                  {formatDate(prop.created_at)}
                </AdminTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  )
}

/** Onglet « Transactions » : tableau des affaires (stade pipeline, statut, montant, date). */
function TransactionsTab({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const { data: transactions, isLoading } = useAgencyTransactions(agencyId)

  if (isLoading) return <TabSkeleton />

  if (!transactions || transactions.length === 0) {
    return (
      <AdminCard>
        <AdminEmpty title={t('admin:agencyDetail.transactions.noTransactions')} />
      </AdminCard>
    )
  }

  return (
    <AdminCard padding={0} style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }} className="scrollbar-hide">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <AdminTh>{t('admin:agencyDetail.transactions.table.stage')}</AdminTh>
              <AdminTh width={120}>{t('admin:agencyDetail.transactions.table.status')}</AdminTh>
              <AdminTh width={130} align="right">{t('admin:agencyDetail.transactions.table.amount')}</AdminTh>
              <AdminTh width={110} align="right">{t('admin:agencyDetail.transactions.table.date')}</AdminTh>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <AdminTd style={{ fontWeight: 600 }}>
                  {STAGE_I18N[tx.stage] ? t(STAGE_I18N[tx.stage]) : tx.stage ?? '—'}
                </AdminTd>
                <AdminTd>
                  {tx.status
                    ? <AdminPill label={tx.status} tone={TRANSACTION_TONE[tx.status] ?? 'neutral'} />
                    : <span style={{ color: sp.soft }}>—</span>}
                </AdminTd>
                <AdminTd align="right" numeric style={{ fontWeight: 700 }}>
                  {tx.price_offered ? formatCHF(tx.price_offered) : '—'}
                </AdminTd>
                <AdminTd align="right" numeric style={{ color: sp.soft }}>
                  {formatDate(tx.created_at)}
                </AdminTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  )
}
