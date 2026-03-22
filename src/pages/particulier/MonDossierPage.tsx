import {
  Eye, CalendarDays, HandCoins, Clock,
  Mail, Check, ChevronRight,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MOCK_SELLER_DATA, MANDATE_STEPS, getStepIndex } from '@/lib/mockSellerData'

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

export default function MonDossierPage() {
  const { property, kpis, activities } = MOCK_SELLER_DATA
  const currentStepIdx = getStepIndex(kpis.current_step)

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

      {/* Mandate progress */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-[10px] text-theme-muted uppercase tracking-wider mb-4">Avancement de la vente</h2>
        <div className="flex items-center gap-1">
          {MANDATE_STEPS.map((step, i) => {
            const isCompleted = i <= currentStepIdx
            const isCurrent = i === currentStepIdx
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center">
                <div className={cn('h-1.5 w-full rounded-full transition-colors', isCompleted ? 'bg-theme-primary' : 'bg-theme-border')} />
                <p className={cn(
                  'text-[10px] mt-2 text-center leading-tight',
                  isCurrent ? 'text-theme-primary font-semibold' : isCompleted ? 'text-theme-secondary' : 'text-theme-muted'
                )}>
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reassurance — subtil, monochrome */}
      <div className="rounded-xl border border-theme-border p-4">
        <p className="text-sm text-theme-secondary">Votre bien est entre de bonnes mains</p>
        <p className="text-xs text-theme-muted mt-1">
          {kpis.visits_total} visites effectuées et {kpis.offers_total} offre{kpis.offers_total > 1 ? 's' : ''} reçue{kpis.offers_total > 1 ? 's' : ''} en {kpis.days_on_market} jours.
          Votre agent travaille activement sur la vente de votre bien.
        </p>
      </div>

      {/* Recent activity — monochrome icons */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] text-theme-muted uppercase tracking-wider">Activité récente</h2>
          <button className={cn('text-xs text-theme-muted hover:text-theme-secondary transition-colors flex items-center gap-0.5', FOCUS_RING, 'rounded')}>
            Tout voir
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-0">
          {activities.slice(0, 7).map((activity, i) => {
            const Icon = ACTIVITY_ICONS[activity.type] || Check
            return (
              <div key={activity.id} className={cn('flex items-start gap-3 py-3', i < 6 && 'border-b border-theme-border-subtle')}>
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
      </div>
    </div>
  )
}
