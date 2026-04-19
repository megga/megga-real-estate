import { useState } from 'react'
import {
  Eye, CalendarDays, HandCoins, Clock,
  Mail, Check, ChevronDown, HelpCircle,
  FileText, ArrowRight, ShieldCheck, TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MANDATE_STEPS, getStepIndex } from '@/lib/mockSellerData'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'

// ─── Pipeline step explanations ──────────────────────────────────────────
// One-liner per step, shown on hover in a dark tooltip. Copy tone: direct,
// reassuring, no jargon — the seller is not an industry pro.

const STEP_HELP: Record<string, string> = {
  mandate_signed: 'Le mandat de vente est signé entre vous et votre agent. Il définit les conditions de mise en vente.',
  published: 'Votre bien est publié sur les portails immobiliers et visible par les acheteurs potentiels.',
  visits: 'Les visites sont organisées par votre agent. Vous recevez les retours des acquéreurs.',
  offers: "Des offres d'achat sont en cours de réception ou d'analyse par votre agent.",
  negotiation: "Votre agent négocie les conditions de vente avec l'acquéreur retenu.",
  notary: "Le dossier est transmis au notaire pour la préparation de l'acte de vente.",
  sold: "La vente est finalisée. L'acte est signé chez le notaire.",
}

// ─── Activity filter types ───────────────────────────────────────────────

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

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 dark:focus-visible:ring-white/30'

// Shared design tokens. Kept inline so future theme toggle only needs to
// wrap this page in a `dark` class container (Tailwind's native dark: prefix).
const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500'
const CARD = 'rounded-2xl bg-white border border-gray-100 dark:bg-gray-900 dark:border-gray-800'
const CARD_HOVER = 'transition-all duration-200 hover:border-gray-200 dark:hover:border-gray-700'

// ─── Notifications data (derived from mock) ──────────────────────────────

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

  const upcoming = visits.filter((v) => v.status === 'planned' || v.status === 'confirmed')
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

  const activeOffers = offers.filter((o) => o.status === 'pending' || o.status === 'counter_offer')
  if (activeOffers.length > 0) {
    notifs.push({
      id: 'offers-active',
      label: `${activeOffers.length} offre${activeOffers.length > 1 ? 's' : ''} en cours`,
      description: `Meilleure offre : CHF ${Math.max(...activeOffers.map((o) => o.amount)).toLocaleString('fr-CH').replace(/,/g, "'")}`,
      link: '/portail/offres',
      linkLabel: 'Voir les offres',
      isNew: true,
    })
  }

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

// ─── Next action for seller ─────────────────────────────────────────────

function getNextAction(): { label: string; description: string; link: string; linkLabel: string } {
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
    : activities.filter((a) => FILTER_TYPES[activityFilter].includes(a.type))
  const displayedActivities = showAllActivity ? filteredActivities : filteredActivities.slice(0, 5)

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── Hero: property showcase ─────────────────────────────────────
         Photo large, price prominent, "Mandat exclusif" as an emerald pill.
         The seller should feel their asset is showcased, not just listed. */}
      <section className={cn(CARD, 'overflow-hidden')}>
        <div className="relative aspect-[16/7] md:aspect-[16/6] w-full">
          <img
            src={property.photo}
            alt={property.title}
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-900 backdrop-blur-sm">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              {property.mandate_type === 'exclusive' ? 'Mandat exclusif' : 'Mandat simple'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">{property.title}</h1>
            <p className="text-white/70 text-sm mt-1">
              {property.address}, {property.postal_code} {property.city}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-4 px-6 md:px-8 py-5 border-t border-gray-100 dark:border-gray-800">
          <p className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight tabular-nums">
            {formatCHF(property.price)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {property.rooms} pièces · {property.surface_m2} m² · {property.city} ({property.canton})
          </p>
        </div>
      </section>

      {/* ── Nouveautés: what the seller should glance at first ──────────
         Emerald dot for "new/unread", gray for informational. Keep it
         tight — too many rows and the seller gets overwhelmed. */}
      {notifications.length > 0 && (
        <section className={cn(CARD, 'p-6')}>
          <p className={cn(SECTION_LABEL, 'mb-4')}>Nouveautés</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 -my-2">
            {notifications.map((notif) => (
              <div key={notif.id} className="flex items-center gap-3 py-3 group">
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0 transition-colors',
                    notif.isNew
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                      : 'bg-gray-300 dark:bg-gray-700',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{notif.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{notif.description}</p>
                </div>
                <Link
                  to={notif.link}
                  className={cn(
                    'text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1 shrink-0 rounded',
                    FOCUS_RING,
                  )}
                >
                  {notif.linkLabel}
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Prochaine action recommandée ────────────────────────────────
         Single clearest action. The emerald tint signals "positive next
         step", not an alert. CTA uses the premium pill style from /login. */}
      <section
        className={cn(
          CARD,
          'p-6 flex flex-col md:flex-row md:items-center gap-4 border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/10 dark:to-gray-900 dark:border-emerald-900/40',
        )}
      >
        <div className="flex-1 min-w-0">
          <p className={cn(SECTION_LABEL, 'mb-1.5 text-emerald-700 dark:text-emerald-500')}>
            Prochaine action recommandée
          </p>
          <p className="text-base font-semibold text-gray-900 dark:text-white">{nextAction.label}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{nextAction.description}</p>
        </div>
        <Link
          to={nextAction.link}
          className={cn(
            'inline-flex items-center gap-2 h-10 px-5 rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-medium shrink-0 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.3)]',
            FOCUS_RING,
          )}
        >
          <FileText className="w-4 h-4" />
          {nextAction.linkLabel}
        </Link>
      </section>

      {/* ── KPI tiles: 4 up ─────────────────────────────────────────────
         Big numbers, tabular-nums so they line up. Sub-labels grey-500. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Visites', value: kpis.visits_total, sub: `${kpis.visits_this_month} ce mois`, icon: Eye },
          { label: 'Offres', value: kpis.offers_total, sub: kpis.offers_total > 0 ? 'reçues' : 'en attente', icon: HandCoins },
          { label: 'Vues en ligne', value: kpis.online_views, sub: 'sur les portails', icon: TrendingUp },
          { label: 'Jours en vente', value: kpis.days_on_market, sub: 'depuis publication', icon: Clock },
        ].map((kpi) => (
          <div key={kpi.label} className={cn(CARD, CARD_HOVER, 'p-5')}>
            <div className="flex items-center justify-between mb-3">
              <p className={SECTION_LABEL}>{kpi.label}</p>
              <kpi.icon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-3xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight">
              {kpi.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Avancement de la vente ──────────────────────────────────────
         Dots + connecting line. Emerald for completed, darker gray for
         the current step (with ring), gray-200 for pending. Hover reveals
         tooltip with the step explanation. */}
      <section className={cn(CARD, 'p-6')}>
        <div className="flex items-center justify-between mb-6">
          <p className={SECTION_LABEL}>Avancement de la vente</p>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <HelpCircle className="w-3 h-3" />
            <span>Survolez une étape</span>
          </div>
        </div>
        <div className="relative">
          {/* Base line */}
          <div className="absolute top-2.5 left-0 right-0 h-px bg-gray-200 dark:bg-gray-800" />
          {/* Progress line — emerald, stretched to current step */}
          <div
            className="absolute top-2.5 left-0 h-px bg-emerald-500 transition-all duration-500"
            style={{
              width: `${(currentStepIdx / (MANDATE_STEPS.length - 1)) * 100}%`,
            }}
          />
          <div className="relative flex items-start justify-between">
            {MANDATE_STEPS.map((step, i) => {
              const isCompleted = i < currentStepIdx
              const isCurrent = i === currentStepIdx
              return (
                <div
                  key={step.key}
                  className="flex flex-col items-center gap-2 flex-1 cursor-default relative"
                  onMouseEnter={() => setHoveredStep(step.key)}
                  onMouseLeave={() => setHoveredStep(null)}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center transition-all relative z-10',
                      isCompleted && 'bg-emerald-500',
                      isCurrent && 'bg-white dark:bg-gray-900 border-2 border-emerald-500 ring-4 ring-emerald-500/15',
                      !isCompleted && !isCurrent && 'bg-gray-200 dark:bg-gray-800',
                    )}
                  >
                    {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  </div>
                  <p
                    className={cn(
                      'text-[11px] text-center leading-tight transition-colors',
                      isCurrent && 'text-gray-900 dark:text-white font-semibold',
                      isCompleted && 'text-gray-600 dark:text-gray-300',
                      !isCompleted && !isCurrent && 'text-gray-400 dark:text-gray-600',
                    )}
                  >
                    {step.label}
                  </p>
                  {hoveredStep === step.key && STEP_HELP[step.key] && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-30 w-64 bg-gray-900 dark:bg-gray-950 text-white text-xs leading-relaxed px-3 py-2.5 rounded-lg pointer-events-none animate-in fade-in-0 slide-in-from-top-1 duration-150 shadow-xl">
                      {STEP_HELP[step.key]}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-950 rotate-45" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {nextStepLabel && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-5">
            Prochaine étape :{' '}
            <span className="text-gray-900 dark:text-white font-medium">{nextStepLabel}</span>
          </p>
        )}
      </section>

      {/* ── Activité récente ────────────────────────────────────────────
         Timeline-lite. Pill tabs for filtering. Icon in a gray circle
         per event type — subtle but visually scannable. */}
      <section className={cn(CARD, 'p-6')}>
        <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
          <p className={SECTION_LABEL}>Activité récente</p>
          <div className="inline-flex items-center gap-0.5 rounded-full bg-gray-50 dark:bg-gray-800/60 p-0.5">
            {ACTIVITY_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setActivityFilter(f.key)
                  setShowAllActivity(false)
                }}
                className={cn(
                  'h-7 px-3 rounded-full text-xs font-medium transition-all',
                  FOCUS_RING,
                  activityFilter === f.key
                    ? 'bg-white text-gray-900 dark:bg-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {displayedActivities.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800 -my-2">
            {displayedActivities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type] || Check
              return (
                <div key={activity.id} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100">{activity.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 tabular-nums">
                      {formatRelativeDate(activity.date)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-8">
            <img
              src="/illustrations/maggy/EmptyState.svg"
              alt=""
              className="w-36 h-28 mb-3 opacity-60"
              loading="lazy"
              decoding="async"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">Aucune activité dans cette catégorie</p>
          </div>
        )}

        {filteredActivities.length > 5 && (
          <button
            onClick={() => setShowAllActivity(!showAllActivity)}
            className={cn(
              'mt-5 w-full h-9 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-700 transition-all flex items-center justify-center gap-1.5',
              FOCUS_RING,
            )}
          >
            {showAllActivity ? 'Réduire' : `Voir les ${filteredActivities.length} activités`}
            <ChevronDown className={cn('w-3 h-3 transition-transform', showAllActivity && 'rotate-180')} />
          </button>
        )}
      </section>
    </div>
  )
}
