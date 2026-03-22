import { CalendarDays, Star, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { MOCK_SELLER_DATA } from '@/lib/mockSellerData'
import type { SellerVisit } from '@/lib/mockSellerData'

const STATUS_CONFIG: Record<SellerVisit['status'], { label: string; icon: React.ElementType; color: string; bg: string }> = {
  planned: { label: 'Planifiée', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  confirmed: { label: 'Confirmée', icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50' },
  done: { label: 'Effectuée', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cancelled: { label: 'Annulée', icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-50' },
  no_show: { label: 'Absent', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
}

export default function MesVisitesPage() {
  const { visits, kpis } = MOCK_SELLER_DATA

  const upcoming = visits.filter(v => v.status === 'planned' || v.status === 'confirmed')
  const past = visits.filter(v => v.status === 'done' || v.status === 'cancelled' || v.status === 'no_show')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">Visites</h1>
        <p className="text-sm text-gray-400 mt-1">
          {kpis.visits_total} visite{kpis.visits_total > 1 ? 's' : ''} au total · {kpis.visits_this_month} ce mois
        </p>
      </div>

      {/* Upcoming visits */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
          <h2 className="text-xs text-blue-600 uppercase tracking-wider font-medium mb-3">
            Prochaines visites
          </h2>
          <div className="space-y-3">
            {upcoming.map((visit) => {
              const config = STATUS_CONFIG[visit.status]
              const Icon = config.icon
              const visitDate = new Date(visit.date)
              return (
                <div key={visit.id} className="flex items-center gap-3 bg-white rounded-lg p-4 border border-blue-100">
                  <div className="shrink-0 text-center">
                    <p className="text-2xl font-semibold text-[#1A1A1A]">{visitDate.getDate()}</p>
                    <p className="text-[10px] text-gray-400 uppercase">
                      {visitDate.toLocaleDateString('fr-CH', { month: 'short' })}
                    </p>
                  </div>
                  <div className="h-10 w-px bg-gray-200" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1A1A1A]">
                      {visitDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Icon className={cn('w-3.5 h-3.5', config.color)} />
                      <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Past visits */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-4">
          Visites passées
        </h2>

        {past.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucune visite passée</p>
        ) : (
          <div className="space-y-0">
            {past.map((visit, i) => {
              const config = STATUS_CONFIG[visit.status]
              const Icon = config.icon
              return (
                <div
                  key={visit.id}
                  className={cn(
                    'py-4',
                    i < past.length - 1 && 'border-b border-gray-100'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('w-4 h-4', config.color)} />
                      <p className="text-sm font-medium text-[#1A1A1A]">
                        {formatDate(visit.date)}
                      </p>
                    </div>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', config.bg, config.color)}>
                      {config.label}
                    </span>
                  </div>

                  {/* Feedback (anonymized) */}
                  {visit.feedback && (
                    <div className="ml-6 mt-2">
                      <p className="text-xs text-gray-400 mb-1">Retour de l'acquéreur potentiel :</p>
                      <p className="text-sm text-gray-600 italic leading-relaxed">
                        "{visit.feedback}"
                      </p>

                      {/* Star rating */}
                      {visit.rating != null && (
                        <div className="flex items-center gap-0.5 mt-2">
                          {Array.from({ length: 5 }).map((_, starIdx) => (
                            <Star
                              key={starIdx}
                              className={cn(
                                'w-3.5 h-3.5',
                                starIdx < visit.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
                              )}
                            />
                          ))}
                          <span className="text-xs text-gray-400 ml-1">{visit.rating}/5</span>
                        </div>
                      )}
                    </div>
                  )}

                  {visit.status === 'cancelled' && (
                    <p className="ml-6 mt-1 text-xs text-gray-400 italic">Visite annulée</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="text-center">
        <p className="text-[11px] text-gray-300">
          Les retours sont anonymisés pour protéger la confidentialité des acquéreurs potentiels.
        </p>
      </div>
    </div>
  )
}
