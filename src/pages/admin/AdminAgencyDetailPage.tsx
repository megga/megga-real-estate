import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Mail, Phone, MapPin, Clock, Eye } from 'lucide-react'
import { cn, formatDate, formatRelativeDate, formatCHF } from '@/lib/utils'
import {
  useAdminAgency,
  useAgencyMembers,
  useAgencyProperties,
  useAgencyTransactions,
  useAgencyActivity,
} from '@/hooks/useAdminAgencies'
import PageTransition from '@/components/layout/PageTransition'
import { useImpersonate } from '@/hooks/useImpersonate'

type Tab = 'infos' | 'equipe' | 'activite' | 'biens' | 'transactions'

const TABS: { key: Tab; label: string }[] = [
  { key: 'infos', label: 'Infos' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'activite', label: 'Activite' },
  { key: 'biens', label: 'Biens' },
  { key: 'transactions', label: 'Transactions' },
]

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
}

const PROPERTY_STATUS: Record<string, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  reserved: 'Reserve',
  sold: 'Vendu',
  off_market: 'Retire',
  archived: 'Archive',
}

const STAGE_LABEL: Record<string, string> = {
  new_lead: 'Nouveau lead',
  to_qualify: 'A qualifier',
  active_search: 'Recherche active',
  visit_planned: 'Visite planifiee',
  visit_done: 'Visite effectuee',
  interest_confirmed: 'Interet confirme',
  offer: 'Offre',
  negotiation: 'Negociation',
  reserved: 'Reserve',
  financing: 'Financement',
  notary: 'Notaire',
  signed: 'Signe',
  closed: 'Cloture',
  lost: 'Perdu',
  to_recontact: 'A relancer',
}

function MemberAvatar({ name }: { name: string }) {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const colors = ['bg-admin-accent', 'bg-accent', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length
  return (
    <div className={cn('h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0', colors[idx])}>
      <span className="text-[10px] font-semibold text-white">{initials}</span>
    </div>
  )
}

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

export default function AdminAgencyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('infos')

  const { data: agency, isLoading } = useAdminAgency(id ?? '')

  if (isLoading) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto space-y-5">
          <Link
            to="/dashboard/admin/agencies"
            className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Agences
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
            to="/dashboard/admin/agencies"
            className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Agences
          </Link>
          <div className="px-4 py-16 text-center">
            <Building2 className="h-8 w-8 mx-auto text-theme-tertiary mb-3" />
            <p className="text-sm text-theme-secondary">Agence introuvable</p>
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
          to="/dashboard/admin/agencies"
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
              <span className="text-xs font-medium text-admin-accent">Admin MEGGA</span>
            </div>
            <h1 className="text-2xl font-semibold text-theme-primary">{agency.name}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs font-medium text-theme-secondary">
                {PLAN_LABEL[agency.plan ?? ''] ?? agency.plan ?? 'Starter'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn(
                  'h-2 w-2 rounded-full',
                  agency.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                )} />
                <span className="text-xs text-theme-secondary">
                  {STATUS_LABEL[agency.status ?? 'active'] ?? agency.status}
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
          {TABS.map((tab) => (
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
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'infos' && <InfosTab agency={agency} />}
          {activeTab === 'equipe' && <EquipeTab agencyId={agency.id} agencyName={agency.name as string ?? ''} />}
          {activeTab === 'activite' && <ActiviteTab agencyId={agency.id} />}
          {activeTab === 'biens' && <BiensTab agencyId={agency.id} />}
          {activeTab === 'transactions' && <TransactionsTab agencyId={agency.id} />}
        </div>
      </div>
    </PageTransition>
  )
}

/* ─── Tab: Infos ─── */
function InfosTab({ agency }: { agency: Record<string, unknown> }) {
  const fields = [
    { icon: Building2, label: 'Adresse', value: agency.address as string | null },
    { icon: Phone, label: 'Telephone', value: agency.phone as string | null },
    { icon: Mail, label: 'Email', value: agency.email as string | null },
    { icon: Clock, label: 'Slug', value: agency.slug as string | null },
  ]

  return (
    <div className="rounded-xl border border-theme-border divide-y divide-theme-border">
      {fields.map((f) => (
        <div key={f.label} className="flex items-center gap-3 px-4 py-3.5">
          <f.icon className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
          <span className="text-sm text-theme-secondary w-24 flex-shrink-0">{f.label}</span>
          <span className="text-sm text-theme-primary">
            {f.value || <span className="text-theme-tertiary">Non renseigne</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─── Tab: Equipe ─── */
function EquipeTab({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const { data: members, isLoading } = useAgencyMembers(agencyId)
  const { startImpersonate } = useImpersonate()

  if (isLoading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">Chargement...</p>
      </div>
    )
  }

  if (!members || members.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">Aucun membre</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-theme-border">
      {/* Header */}
      <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-[11px] font-medium text-theme-tertiary uppercase tracking-wider">
        <span className="flex-1">Nom</span>
        <span className="w-40">Email</span>
        <span className="w-24">Role</span>
        <span className="w-24 text-right">Inscription</span>
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
            <MemberAvatar name={member.full_name ?? 'Utilisateur'} />
            <span className="text-sm font-medium text-theme-primary truncate">
              {member.full_name ?? 'Sans nom'}
            </span>
          </div>
          <span className="w-40 text-xs text-theme-secondary truncate">
            {member.email}
          </span>
          <span className="w-24 text-xs text-theme-secondary capitalize">
            {member.role ?? 'agent'}
          </span>
          <span className="w-24 text-xs text-theme-tertiary text-right">
            {formatDate(member.created_at)}
          </span>
          <span className="w-10 flex justify-end">
            <button
              onClick={() => startImpersonate({
                id: member.id,
                full_name: member.full_name ?? 'Utilisateur',
                email: member.email,
                role: member.role ?? 'agent',
                agency_id: agencyId,
                agency_name: agencyName,
              })}
              aria-label={`Se connecter en tant que ${member.full_name ?? 'utilisateur'}`}
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

/* ─── Tab: Activite ─── */
function ActiviteTab({ agencyId }: { agencyId: string }) {
  const { data: events, isLoading } = useAgencyActivity(agencyId)

  if (isLoading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">Chargement...</p>
      </div>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">Aucune activite recente</p>
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
                <span className="text-theme-secondary"> sur {event.entity_type}</span>
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

/* ─── Tab: Biens ─── */
function BiensTab({ agencyId }: { agencyId: string }) {
  const { data: properties, isLoading } = useAgencyProperties(agencyId)

  if (isLoading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">Chargement...</p>
      </div>
    )
  }

  if (!properties || properties.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">Aucun bien</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-theme-border">
      {/* Header */}
      <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-[11px] font-medium text-theme-tertiary uppercase tracking-wider">
        <span className="flex-1">Titre</span>
        <span className="w-24">Statut</span>
        <span className="w-28 text-right">Prix</span>
        <span className="w-24">Ville</span>
        <span className="w-24 text-right">Date</span>
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
            {prop.title || 'Sans titre'}
          </span>
          <span className="w-24">
            <span className={cn(
              'text-xs font-medium',
              prop.status === 'active' ? 'text-emerald-500' :
              prop.status === 'sold' ? 'text-admin-accent' :
              'text-theme-secondary'
            )}>
              {PROPERTY_STATUS[prop.status] ?? prop.status}
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

/* ─── Tab: Transactions ─── */
function TransactionsTab({ agencyId }: { agencyId: string }) {
  const { data: transactions, isLoading } = useAgencyTransactions(agencyId)

  if (isLoading) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">Chargement...</p>
      </div>
    )
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-theme-tertiary">Aucune transaction</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-theme-border">
      {/* Header */}
      <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-[11px] font-medium text-theme-tertiary uppercase tracking-wider">
        <span className="flex-1">Etape</span>
        <span className="w-20">Statut</span>
        <span className="w-28 text-right">Montant</span>
        <span className="w-24 text-right">Date</span>
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
            {STAGE_LABEL[tx.stage] ?? tx.stage ?? '—'}
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
