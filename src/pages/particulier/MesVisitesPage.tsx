import { CalendarDays, Star, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { MOCK_SELLER_DATA } from '@/lib/mockSellerData'
import type { SellerVisit } from '@/lib/mockSellerData'

const STATUS_CONFIG: Record<SellerVisit['status'], { label: string; icon: React.ElementType; color: string }> = {
  planned: { label: 'Planifiée', icon: Clock, color: 'text-blue-500' },
  confirmed: { label: 'Confirmée', icon: CalendarDays, color: 'text-blue-500' },
  done: { label: 'Effectuée', icon: CheckCircle2, color: 'text-emerald-500' },
  cancelled: { label: 'Annulée', icon: XCircle, color: 'text-theme-muted' },
  no_show: { label: 'Absent', icon: AlertCircle, color: 'text-orange-500' },
}

export default function MesVisitesPage() {
  const { visits, kpis } = MOCK_SELLER_DATA

  const upcoming = visits.filter(v => v.status === 'planned' || v.status === 'confirmed')
  const past = visits.filter(v => v.status === 'done' || v.status === 'cancelled' || v.status === 'no_show')

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-theme-primary">Visites</h1>
        <p className="text-sm text-theme-tertiary mt-1">
          {kpis.visits_total} visite{kpis.visits_total > 1 ? 's' : ''} au total · {kpis.visits_this_month} ce mois
        </p>
      </div>

      {/* Upcoming visits */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <h2 className="text-xs text-blue-500 uppercase tracking-wider font-medium mb-3">
            Prochaines visites
          </h2>
          <div className="space-y-3">
            {upcoming.map((visit) => {
              const config = STATUS_CONFIG[visit.status]
              const Icon = config.icon
              const visitDate = new Date(visit.date)
              return (
                <div key={visit.id} className="flex items-center gap-3 rounded-lg border border-theme-border bg-theme-card p-4">
                  <div className="shrink-0 text-center">
                    <p className="text-2xl font-semibold text-theme-primary">{visitDate.getDate()}</p>
                    <p className="text-[10px] text-theme-tertiary uppercase">
                      {visitDate.toLocaleDateString('fr-CH', { month: 'short' })}
                    </p>
                  </div>
                  <div className="h-10 w-px bg-theme-border" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-theme-primary">
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
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-xs text-theme-tertiary uppercase tracking-wider mb-4">
          Visites passées
        </h2>

        {past.length === 0 ? (
          <p className="text-sm text-theme-muted text-center py-8">Aucune visite passée</p>
        ) : (
          <div className="space-y-0">
            {past.map((visit, i) => {
              const config = STATUS_CONFIG[visit.status]
              const Icon = config.icon
              return (
                <div key={visit.id} className={cn('py-4', i < past.length - 1 && 'border-b border-theme-border-subtle')}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('w-4 h-4', config.color)} />
                      <p className="text-sm font-medium text-theme-primary">{formatDate(visit.date)}</p>
                    </div>
                    <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
                  </div>

                  {visit.feedback && (
                    <div className="ml-6 mt-2">
                      <p className="text-[10px] text-theme-muted mb-1">Retour de l'acquéreur potentiel :</p>
                      <p className="text-sm text-theme-secondary italic leading-relaxed">
                        "{visit.feedback}"
                      </p>
                      {visit.rating != null && (
                        <div className="flex items-center gap-0.5 mt-2">
                          {Array.from({ length: 5 }).map((_, starIdx) => (
                            <Star
                              key={starIdx}
                              className={cn(
                                'w-3.5 h-3.5',
                                starIdx < visit.rating! ? 'text-amber-400 fill-amber-400' : 'text-theme-border'
                              )}
                            />
                          ))}
                          <span className="text-xs text-theme-muted ml-1">{visit.rating}/5</span>
                        </div>
                      )}
                    </div>
                  )}

                  {visit.status === 'cancelled' && (
                    <p className="ml-6 mt-1 text-xs text-theme-muted italic">Visite annulée</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-theme-muted text-center">
        Les retours sont anonymisés pour protéger la confidentialité des acquéreurs potentiels.
      </p>
    </div>
  )
}
