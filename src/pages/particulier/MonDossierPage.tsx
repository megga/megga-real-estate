import { useState } from 'react'
import {
  Eye, CalendarDays, HandCoins, Clock,
  Mail, Check, ChevronDown, HelpCircle,
  FileText, ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MANDATE_STEPS, getStepIndex } from '@/lib/mockSellerData'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'

// ── Pipeline step explanations ───────────────────────────────────────────

const STEP_HELP: Record<string, string> = {
  mandate_signed: 'Le mandat de vente est signé entre vous et votre agent. Il définit les conditions de mise en vente.',
  published: 'Votre bien est publié sur les portails immobiliers et visible par les acheteurs potentiels.',
  visits: 'Les visites sont organisées par votre agent. Vous recevez les retours des acquéreurs.',
  offers: 'Des offres d\'achat sont en cours de réception ou d\'analyse par votre agent.',
  negotiation: 'Votre agent négocie les conditions de vente avec l\'acquéreur retenu.',
  notary: 'Le dossier est transmis au notaire pour la préparation de l\'acte de vente.',
  sold: 'La vente est finalisée. L\'acte est signé chez le notaire.',
}

// ── Activity filter types ────────────────────────────────────────────────

type ActivityFilter = 'all' | 'visits' | 'offers' | 'documents'

const ACTIVITY_FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'visits', label: 'Visites' },
  { key: 'offers', label: 'Offres' },
  { key: 'documents', label: 'Documents' },
]

const FILTER_TYPES: Record<ActivityFilter, string[]> = {
  all: [],
  visits: ['visit_planned', 'visit_done'],
  offers: ['offer_received'],
  documents: ['document_added', 'publication', 'mandate_signed'],
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  visit_planned: CalendarDays,
  visit_done: Eye,
  offer_received: HandCoins,
  document_added: Check,
  publication: Check,
  mandate_signed: Check,
  message: Mail,
  price_update: Clock,
}

// ── Notifications data (derived from mock) ───────────────────────────────

interface Notification {
  id: string
  label: string
  description: string
  link: string
  linkLabel: string
  isNew: boolean
}

function getNotifications(visits: { status: string; date: string }[], offers: { status: string; amount: number }[]): Notification[] {
  const notifs: Notification[] = []

  // Upcoming visits to confirm
  const upcoming = visits.filter(v => v.status === 'planned' || v.status === 'confirmed')
  if (upcoming.length > 0) {
    const nextVisit = upcoming[0]
    const d = new Date(nextVisit.date)
    notifs.push({
      id: 'visit-upcoming',
      label: 'Visite à venir',
      description: `Le ${d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })} à ${d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`,
      link: '/portail/visites',
      linkLabel: 'Voir les visites',
      isNew: true,
    })
  }

  // Active offers
  const activeOffers = offers.filter(o => o.status === 'pending' || o.status === 'counter_offer')
  if (activeOffers.length > 0) {
    notifs.push({
      id: 'offers-active',
      label: `${activeOffers.length} offre${activeOffers.length > 1 ? 's' : ''} en cours`,
      description: `Meilleure offre : CHF ${Math.max(...activeOffers.map(o => o.amount)).toLocaleString('fr-CH').replace(/,/g, "'")}`,
      link: '/portail/offres',
      linkLabel: 'Voir les offres',
      isNew: true,
    })
  }

  // Missing documents
  notifs.push({
    id: 'docs-missing',
    label: '2 documents manquants',
    description: 'Diagnostic amiante et certificat CECB à fournir',
    link: '/portail/documents',
    linkLabel: 'Voir les documents',
    isNew: false,
  })

  return notifs
}

// ── Next action for seller ───────────────────────────────────────────────

function getNextAction(): { label: string; description: string; link: string; linkLabel: string } {
  // Priority: missing docs > confirm visit > respond to offer
  return {
    label: 'Fournir le diagnostic amiante',
    description: 'Ce document est nécessaire avant la signature chez le notaire.',
    link: '/portail/documents',
    linkLabel: 'Déposer le document',
  }
}

export default function MonDossierPage() {
  const portalData = useSellerPortalData()
  const { property, kpis, activities, visits, offers } = portalData
  const currentStepIdx = getStepIndex(kpis.current_step)
  const nextStepLabel = currentStepIdx < MANDATE_STEPS.length - 1 ? MANDATE_STEPS[currentStepIdx + 1].label : null
  const notifications = getNotifications(visits, offers)
  const nextAction = getNextAction()
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [hoveredStep, setHoveredStep] = useState<string | null>(null)

  const filteredActivities = activityFilter === 'all'
    ? activities
    : activities.filter(a => FILTER_TYPES[activityFilter].includes(a.type))
  const displayedActivities = showAllActivity ? filteredActivities : filteredActivities.slice(0, 5)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Property header */}
      <div className="rounded-xl overflow-hidden border border-theme-border">
        <div className="relative h-48 md:h-56">
          <img src={property.photo} alt={property.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="text-white/60 text-[10px] font-medium uppercase tracking-wider mb-1">
              {property.mandate_type === 'exclusive' ? 'Mandat exclusif' : 'Mandat simple'}
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-white">{property.title}</h1>
            <p className="text-white/50 text-sm mt-1">{property.address}, {property.postal_code} {property.city}</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-theme-border-subtle">
          <p className="text-lg font-semibold text-theme-primary">{formatCHF(property.price)}</p>
          <p className="text-xs text-theme-muted">
            {property.rooms} pièces · {property.surface_m2} m² · {property.city} ({property.canton})
          </p>
        </div>
      </div>

      {/* Notifications — what's new */}
      {notifications.length > 0 && (
        <div className="rounded-xl border border-theme-border p-5">
          <h2 className="text-[10px] text-theme-muted uppercase tracking-wider mb-3">Nouveautés</h2>
          <div className="space-y-0">
            {notifications.map((notif, i) => (
              <div key={notif.id} className={cn('flex items-center gap-3 py-2.5', i < notifications.length - 1 && 'border-b border-theme-border-subtle')}>
                {notif.isNew && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                {!notif.isNew && <span className="w-1.5 h-1.5 rounded-full bg-theme-border shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-theme-primary">{notif.label}</p>
                  <p className="text-xs text-theme-muted mt-0.5">{notif.description}</p>
                </div>
                <Link
                  to={notif.link}
                  className={cn('text-xs text-theme-muted hover:text-theme-secondary transition-colors flex items-center gap-0.5 shrink-0', FOCUS_RING, 'rounded')}
                >
                  {notif.linkLabel}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next action — what the seller should do */}
      <div className="rounded-xl border border-theme-border p-4">
        <p className="text-[10px] text-theme-muted uppercase tracking-wider mb-2">Prochaine action recommandée</p>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-theme-primary">{nextAction.label}</p>
            <p className="text-xs text-theme-muted mt-0.5">{nextAction.description}</p>
          </div>
          <Link
            to={nextAction.link}
            className={cn('h-8 px-3.5 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors shrink-0 flex items-center gap-1.5', FOCUS_RING)}
          >
            <FileText className="w-3 h-3" />
            {nextAction.linkLabel}
          </Link>
        </div>
      </div>

      {/* KPI cards — monochrome */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Visites', value: String(kpis.visits_total), sub: `${kpis.visits_this_month} ce mois` },
          { label: 'Offres', value: String(kpis.offers_total), sub: kpis.offers_total > 0 ? 'reçues' : 'en attente' },
          { label: 'Vues en ligne', value: String(kpis.online_views), sub: 'sur les portails' },
          { label: 'Jours en vente', value: String(kpis.days_on_market), sub: 'depuis publication' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-theme-border p-4">
            <p className="text-[10px] text-theme-muted uppercase tracking-wider mb-2">{kpi.label}</p>
            <p className="text-2xl font-semibold text-theme-primary">{kpi.value}</p>
            <p className="text-xs text-theme-muted mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Mandate progress with tooltips */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] text-theme-muted uppercase tracking-wider">Avancement de la vente</h2>
          <div className="flex items-center gap-1 text-[10px] text-theme-muted">
            <HelpCircle className="w-3 h-3" />
            <span>Survolez une étape</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {MANDATE_STEPS.map((step, i) => {
            const isCompleted = i <= currentStepIdx
            const isCurrent = i === currentStepIdx
            return (
              <div
                key={step.key}
                className="flex-1 flex flex-col items-center relative cursor-default"
                onMouseEnter={() => setHoveredStep(step.key)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <div className={cn('h-1.5 w-full rounded-full transition-colors', isCompleted ? 'bg-theme-primary' : 'bg-theme-border')} />
                <p className={cn(
                  'text-[10px] mt-2 text-center leading-tight',
                  isCurrent ? 'text-theme-primary font-semibold' : isCompleted ? 'text-theme-secondary' : 'text-theme-muted'
                )}>
                  {step.label}
                </p>
                {/* Tooltip */}
                {hoveredStep === step.key && STEP_HELP[step.key] && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-30 w-56 bg-theme-primary text-theme-inverse text-[11px] leading-relaxed px-3 py-2 rounded-lg pointer-events-none animate-in fade-in-0 duration-100">
                    {STEP_HELP[step.key]}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {nextStepLabel && (
          <p className="text-xs text-theme-muted mt-3">
            Prochaine étape : <span className="text-theme-secondary font-medium">{nextStepLabel}</span>
          </p>
        )}
      </div>

      {/* Recent activity with filters */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] text-theme-muted uppercase tracking-wider">Activité récente</h2>
          <div className="flex items-center gap-1">
            {ACTIVITY_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => { setActivityFilter(f.key); setShowAllActivity(false) }}
                className={cn(
                  'h-6 px-2 rounded text-[10px] transition-colors',
                  FOCUS_RING,
                  activityFilter === f.key
                    ? 'bg-theme-active text-theme-primary font-medium'
                    : 'text-theme-muted hover:text-theme-secondary'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-0">
          {displayedActivities.map((activity, i) => {
            const Icon = ACTIVITY_ICONS[activity.type] || Check
            return (
              <div key={activity.id} className={cn('flex items-start gap-3 py-3', i < displayedActivities.length - 1 && 'border-b border-theme-border-subtle')}>
                <div className="mt-0.5 shrink-0">
                  <Icon className="w-4 h-4 text-theme-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-theme-primary">{activity.description}</p>
                  <p className="text-xs text-theme-muted mt-0.5">{formatRelativeDate(activity.date)}</p>
                </div>
              </div>
            )
          })}
        </div>
        {filteredActivities.length === 0 && (
          <p className="text-xs text-theme-muted text-center py-4">Aucune activité dans cette catégorie</p>
        )}
        {filteredActivities.length > 5 && (
          <button
            onClick={() => setShowAllActivity(!showAllActivity)}
            className={cn('mt-3 text-xs text-theme-muted hover:text-theme-secondary transition-colors flex items-center gap-1', FOCUS_RING, 'rounded')}
          >
            {showAllActivity ? 'Réduire' : `Voir les ${filteredActivities.length} activités`}
            <ChevronDown className={cn('w-3 h-3 transition-transform', showAllActivity && 'rotate-180')} />
          </button>
        )}
      </div>
    </div>
  )
}
