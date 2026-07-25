/**
 * Page super-admin — détail d'une agence.
 *
 * Route : `/agencies/:id` (accent violet). Vue en
 * lecture seule organisée en 5 onglets (infos, équipe, activité, biens,
 * transactions), chacun alimenté par un hook `useAgency*` dédié. Sert aussi de
 * point d'entrée à l'impersonation d'un membre — précédée d'un audit serveur
 * (cf. `EquipeTab`).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Mail, Phone, Clock, Eye } from 'lucide-react'
import { cn, formatDate, formatRelativeDate, formatCHF } from '@/lib/utils'
import {
  useAdminAgency,
  useAgencyMembers,
  useAgencyProperties,
  useAgencyTransactions,
  useAgencyActivity,
} from '@/hooks/useAdminAgencies'
import PageTransition from '@/components/layout/PageTransition'
import { openImpersonationInCrm } from '@/lib/adminEntry'
import AdminBillingCard from '@/components/admin/AdminBillingCard'

type Tab = 'infos' | 'equipe' | 'activite' | 'biens' | 'transactions'

const TAB_KEYS: { key: Tab; i18nKey: string }[] = [
  { key: 'infos', i18nKey: 'agencyDetail.tab.infos' },
  { key: 'equipe', i18nKey: 'agencyDetail.tab.team' },
  { key: 'activite', i18nKey: 'agencyDetail.tab.activity' },
  { key: 'biens', i18nKey: 'agencyDetail.tab.properties' },
  { key: 'transactions', i18nKey: 'agencyDetail.tab.transactions' },
]

const PLAN_I18N: Record<string, string> = {
  starter: 'common.plan.starter',
  pro: 'common.plan.pro',
  agency: 'common.plan.agency',
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

/** Pastille ronde avec les initiales d'un membre ; couleur déterministe dérivée du nom. */
function MemberAvatar({ name }: { name: string }) {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const colors = ['bg-admin-accent', 'bg-accent', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length
  return (
    <div className={cn('h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0', colors[idx])}>
      <span className="text-xs font-semibold text-white">{initials}</span>
    </div>
  )
}

/** Placeholder animé affiché pendant le chargement du détail de l'agence. */
function SkeletonDetail() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-theme-hover" />
      <div className="h-4 w-32 rounded bg-theme-hover" />
      <div className="h-px bg-theme-border my-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-64 rounded bg-theme-hover" />
        ))}
      </div>
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

  if (isLoading) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto space-y-5">
          <Link
            to="/agencies"
            className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('admin:agencyDetail.back')}
          </Link>
          <SkeletonDetail />
        </div>
      </PageTransition>
    )
  }

  if (!agency) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto space-y-5">
          <Link
            to="/agencies"
            className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('admin:agencyDetail.back')}
          </Link>
          <div className="px-4 py-16 text-center">
            <Building2 className="h-8 w-8 mx-auto text-theme-tertiary mb-3" />
            <p className="text-sm text-theme-secondary">{t('admin:agencyDetail.notFound')}</p>
          </div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Back link */}
        <Link
          to="/agencies"
          className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Agences
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-admin-accent" />
              <span className="text-xs font-medium text-admin-accent">{t('admin:common.adminBadge')}</span>
            </div>
            <h1 className="text-2xl font-semibold text-theme-primary">{agency.name}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs font-medium text-theme-secondary">
                {t(PLAN_I18N[agency.plan ?? ''] ?? 'common.plan.starter')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn(
                  'h-2 w-2 rounded-full',
                  agency.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                )} />
                <span className="text-xs text-theme-secondary">
                  {t(STATUS_I18N[agency.status ?? 'active'] ?? 'common.status.active')}
                </span>
              </span>
              <span className="text-xs text-theme-tertiary">
                {formatDate(agency.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-theme-border">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px',
                activeTab === tab.key
                  ? 'text-theme-primary border-theme-primary font-medium'
                  : 'text-theme-secondary border-transparent hover:text-theme-primary'
              )}
            >
              {t(tab.i18nKey)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'infos' && <InfosTab agency={agency} />}
          {activeTab === 'equipe' && <EquipeTab agencyId={agency.id} />}
          {activeTab === 'activite' && <ActiviteTab agencyId={agency.id} />}
          {activeTab === 'biens' && <BiensTab agencyId={agency.id} />}
          {activeTab === 'transactions' && <TransactionsTab agencyId={agency.id} />}
        </div>
      </div>
    </PageTransition>
  )
}

/** Onglet « Infos » : coordonnées de l'agence + carte d'abonnement (override manuel du plan). */
function InfosTab({ agency }: { agency: Record<string, unknown> }) {
  const { t } = useTranslation('admin')
  const fields = [
    { icon: Building2, label: t('admin:agencyDetail.info.address'), value: agency.address as string | null },
    { icon: Phone, label: t('admin:agencyDetail.info.phone'), value: agency.phone as string | null },
    { icon: Mail, label: t('admin:agencyDetail.info.email'), value: agency.email as string | null },
    { icon: Clock, label: t('admin:agencyDetail.info.slug'), value: agency.slug as string | null },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-theme-border divide-y divide-theme-border">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center gap-3 px-4 py-3.5">
            <f.icon className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
            <span className="text-sm text-theme-secondary w-24 flex-shrink-0">{f.label}</span>
            <span className="text-sm text-theme-primary">
              {f.value || <span className="text-theme-tertiary">{t('admin:common.notProvided')}</span>}
            </span>
          </div>
        ))}
      </div>

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
  const { data: members, isLoading } = useAgencyMembers(agencyId)

  if (isLoading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">{t('admin:common.loading')}</p>
      </div>
    )
  }

  if (!members || members.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">{t('admin:agencyDetail.team.noMembers')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-theme-border">
      {/* Header */}
      <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary tracking-wide">
        <span className="flex-1">{t('admin:agencyDetail.team.table.name')}</span>
        <span className="w-40">{t('admin:agencyDetail.team.table.email')}</span>
        <span className="w-24">{t('admin:agencyDetail.team.table.role')}</span>
        <span className="w-24 text-right">{t('admin:agencyDetail.team.table.registration')}</span>
        <span className="w-10" />
      </div>

      {members.map((member, i) => (
        <div
          key={member.id}
          className={cn(
            'group flex items-center px-4 py-3',
            i < members.length - 1 && 'border-b border-theme-border'
          )}
        >
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <MemberAvatar name={member.full_name ?? t('admin:common.user')} />
            <span className="text-sm font-medium text-theme-primary truncate">
              {member.full_name ?? t('admin:common.noName')}
            </span>
          </div>
          <span className="w-40 text-xs text-theme-secondary truncate">
            {member.email}
          </span>
          <span className="w-24 text-xs text-theme-secondary capitalize">
            {member.role ?? 'agent'}
          </span>
          <span className="w-24 text-xs text-theme-tertiary text-right">
            {formatDate(member.created_at ?? '')}
          </span>
          <span className="w-10 flex justify-end">
            <button
              // La vue impersonée appartient au CRM (autre origine) : on l'y
              // ouvre, et c'est lui qui journalise avant d'activer (audit-first).
              onClick={() => openImpersonationInCrm(member.id)}
              aria-label={t('admin:agencyDetail.team.impersonate', { name: member.full_name ?? t('admin:common.user') })}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-admin-accent hover:bg-admin-accent/5 transition-all"
            >
              <Eye className="h-4 w-4" />
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Onglet « Activité » : flux chronologique des événements de l'agence. */
function ActiviteTab({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { data: events, isLoading } = useAgencyActivity(agencyId)

  if (isLoading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">{t('admin:common.loading')}</p>
      </div>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">{t('admin:agencyDetail.activity.noActivity')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-theme-hover transition-colors"
        >
          <div className="h-2 w-2 rounded-full bg-admin-accent mt-1.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-theme-primary">
              <span className="font-medium">{event.action}</span>
              {event.entity_type && (
                <span className="text-theme-secondary"> {t('admin:agencyDetail.activity.on')} {event.entity_type}</span>
              )}
            </p>
            <p className="text-xs text-theme-tertiary mt-0.5">
              {formatRelativeDate(event.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Onglet « Biens » : tableau des annonces de l'agence (titre, statut, prix, ville, date). */
function BiensTab({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { data: properties, isLoading } = useAgencyProperties(agencyId)

  if (isLoading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">{t('admin:common.loading')}</p>
      </div>
    )
  }

  if (!properties || properties.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">{t('admin:agencyDetail.properties.noProperties')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-theme-border">
      {/* Header */}
      <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary tracking-wide">
        <span className="flex-1">{t('admin:agencyDetail.properties.table.title')}</span>
        <span className="w-24">{t('admin:agencyDetail.properties.table.status')}</span>
        <span className="w-28 text-right">{t('admin:agencyDetail.properties.table.price')}</span>
        <span className="w-24">{t('admin:agencyDetail.properties.table.city')}</span>
        <span className="w-24 text-right">{t('admin:agencyDetail.properties.table.date')}</span>
      </div>

      {properties.map((prop, i) => (
        <div
          key={prop.id}
          className={cn(
            'flex items-center px-4 py-3',
            i < properties.length - 1 && 'border-b border-theme-border'
          )}
        >
          <span className="flex-1 text-sm text-theme-primary truncate">
            {prop.title || t('admin:common.noTitle')}
          </span>
          <span className="w-24">
            <span className={cn(
              'text-xs font-medium',
              prop.status === 'active' ? 'text-emerald-500' :
              prop.status === 'sold' ? 'text-admin-accent' :
              'text-theme-secondary'
            )}>
              {t(PROPERTY_STATUS_I18N[prop.status] ?? 'common.status.draft')}
            </span>
          </span>
          <span className="w-28 text-sm text-theme-primary text-right font-medium">
            {prop.price ? formatCHF(prop.price) : '—'}
          </span>
          <span className="w-24 text-xs text-theme-secondary">
            {prop.city ?? '—'}
          </span>
          <span className="w-24 text-xs text-theme-tertiary text-right">
            {formatDate(prop.created_at)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Onglet « Transactions » : tableau des affaires (stade pipeline, statut, montant, date). */
function TransactionsTab({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation('admin')
  const { data: transactions, isLoading } = useAgencyTransactions(agencyId)

  if (isLoading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">{t('admin:common.loading')}</p>
      </div>
    )
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">{t('admin:agencyDetail.transactions.noTransactions')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-theme-border">
      {/* Header */}
      <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary tracking-wide">
        <span className="flex-1">{t('admin:agencyDetail.transactions.table.stage')}</span>
        <span className="w-20">{t('admin:agencyDetail.transactions.table.status')}</span>
        <span className="w-28 text-right">{t('admin:agencyDetail.transactions.table.amount')}</span>
        <span className="w-24 text-right">{t('admin:agencyDetail.transactions.table.date')}</span>
      </div>

      {transactions.map((tx, i) => (
        <div
          key={tx.id}
          className={cn(
            'flex items-center px-4 py-3',
            i < transactions.length - 1 && 'border-b border-theme-border'
          )}
        >
          <span className="flex-1 text-sm text-theme-primary">
            {STAGE_I18N[tx.stage] ? t(STAGE_I18N[tx.stage]) : tx.stage ?? '—'}
          </span>
          <span className="w-20">
            <span className={cn(
              'text-xs font-medium',
              tx.status === 'active' ? 'text-emerald-500' :
              tx.status === 'completed' ? 'text-admin-accent' :
              tx.status === 'cancelled' ? 'text-red-500' :
              'text-theme-secondary'
            )}>
              {tx.status ?? '—'}
            </span>
          </span>
          <span className="w-28 text-sm text-theme-primary text-right font-medium">
            {tx.price_offered ? formatCHF(tx.price_offered) : '—'}
          </span>
          <span className="w-24 text-xs text-theme-tertiary text-right">
            {formatDate(tx.created_at)}
          </span>
        </div>
      ))}
    </div>
  )
}
