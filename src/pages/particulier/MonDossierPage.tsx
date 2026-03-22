import {
  Eye, CalendarDays, HandCoins, Clock,
  Phone, Mail, Check,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MOCK_SELLER_DATA, MANDATE_STEPS, getStepIndex } from '@/lib/mockSellerData'

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  visit_planned: { icon: CalendarDays, color: 'text-blue-500' },
  visit_done: { icon: Eye, color: 'text-emerald-500' },
  offer_received: { icon: HandCoins, color: 'text-amber-500' },
  document_added: { icon: Check, color: 'text-gray-500' },
  publication: { icon: Check, color: 'text-blue-500' },
  mandate_signed: { icon: Check, color: 'text-emerald-500' },
  message: { icon: Mail, color: 'text-gray-500' },
  price_update: { icon: Clock, color: 'text-orange-500' },
}

export default function MonDossierPage() {
  const { property, kpis, activities, agent } = MOCK_SELLER_DATA
  const currentStepIdx = getStepIndex(kpis.current_step)

  return (
    <div className="space-y-6">
      {/* Property header */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
        <div className="relative h-48 md:h-56">
          <img
            src={property.photo}
            alt={property.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p className="text-white/80 text-xs font-medium uppercase tracking-wider mb-1">
              {property.mandate_type === 'exclusive' ? 'Mandat exclusif' : 'Mandat simple'}
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-white">{property.title}</h1>
            <p className="text-white/70 text-sm mt-1">{property.address}, {property.postal_code} {property.city}</p>
          </div>
        </div>

        {/* Price bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-lg font-semibold text-[#1A1A1A]">{formatCHF(property.price)}</p>
          <p className="text-xs text-gray-400">
            {property.rooms} pièces · {property.surface_m2} m² · {property.city} ({property.canton})
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Visites', value: String(kpis.visits_total), sub: `${kpis.visits_this_month} ce mois`, icon: Eye, color: 'text-blue-500' },
          { label: 'Offres', value: String(kpis.offers_total), sub: kpis.offers_total > 0 ? 'reçues' : 'en attente', icon: HandCoins, color: 'text-amber-500' },
          { label: 'Vues en ligne', value: String(kpis.online_views), sub: 'sur les portails', icon: Eye, color: 'text-emerald-500' },
          { label: 'Jours en vente', value: String(kpis.days_on_market), sub: 'depuis publication', icon: Clock, color: 'text-gray-500' },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-4 h-4', kpi.color)} />
                <span className="text-xs text-gray-400 uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className="text-2xl font-semibold text-[#1A1A1A]">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Mandate progress */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-4">Avancement de la vente</h2>
        <div className="flex items-center gap-1">
          {MANDATE_STEPS.map((step, i) => {
            const isCompleted = i <= currentStepIdx
            const isCurrent = i === currentStepIdx
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center">
                {/* Bar */}
                <div className="w-full flex items-center">
                  <div
                    className={cn(
                      'h-1.5 w-full rounded-full transition-colors',
                      isCompleted ? 'bg-[#1A1A1A]' : 'bg-gray-200'
                    )}
                  />
                </div>
                {/* Label */}
                <p className={cn(
                  'text-[10px] mt-2 text-center leading-tight',
                  isCurrent ? 'text-[#1A1A1A] font-semibold' : isCompleted ? 'text-gray-600' : 'text-gray-300'
                )}>
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reassurance message */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm text-emerald-800 font-medium">
          Votre bien est entre de bonnes mains
        </p>
        <p className="text-xs text-emerald-600 mt-1">
          {kpis.visits_total} visites effectuées et {kpis.offers_total} offre{kpis.offers_total > 1 ? 's' : ''} reçue{kpis.offers_total > 1 ? 's' : ''} en {kpis.days_on_market} jours.
          Votre agent travaille activement sur la vente de votre bien.
        </p>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-4">Activité récente</h2>
        <div className="space-y-0">
          {activities.slice(0, 7).map((activity, i) => {
            const config = ACTIVITY_ICONS[activity.type] || { icon: Check, color: 'text-gray-400' }
            const Icon = config.icon
            return (
              <div
                key={activity.id}
                className={cn(
                  'flex items-start gap-3 py-3',
                  i < activities.length - 1 && 'border-b border-gray-100'
                )}
              >
                <div className={cn('mt-0.5 shrink-0', config.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1A1A1A]">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatRelativeDate(activity.date)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Agent contact */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Votre agent</h2>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {agent.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[#1A1A1A]">{agent.name}</p>
            <p className="text-xs text-gray-400">MEGGA Immobilier</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`tel:${agent.phone}`}
              className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#1A1A1A] hover:border-gray-400 transition-colors"
            >
              <Phone className="w-4 h-4" />
            </a>
            <a
              href={`mailto:${agent.email}`}
              className="h-9 w-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#1A1A1A] hover:border-gray-400 transition-colors"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
