import { Calendar, Clock, User, CheckCircle2, XCircle, CalendarClock } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { SELLER_VISITS, type SellerVisit } from './sellerMockData'

function statusConfig(status: SellerVisit['status']) {
  switch (status) {
    case 'planned':   return { label: 'Planifiée', icon: CalendarClock, cls: 'bg-accent/10 text-accent' }
    case 'done':      return { label: 'Réalisée', icon: CheckCircle2, cls: 'bg-success/10 text-success' }
    case 'cancelled': return { label: 'Annulée', icon: XCircle, cls: 'bg-danger/10 text-danger' }
  }
}

export default function SellerVisits() {
  const planned = SELLER_VISITS.filter((v) => v.status === 'planned')
  const past = SELLER_VISITS.filter((v) => v.status !== 'planned')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Visites</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {SELLER_VISITS.length} visites au total · {planned.length} à venir
        </p>
      </div>

      {/* Upcoming visits */}
      {planned.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-primary-800 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent" />
            Prochaines visites
          </h2>
          <div className="grid gap-3">
            {planned.map((visit) => (
              <div
                key={visit.id}
                className="bg-accent/5 border border-accent/20 rounded-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-900">{visit.visitor_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(visit.date)}</span>
                        <Clock className="h-3 w-3 ml-1" />
                        <span>{visit.time}</span>
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-badge bg-accent/10 text-accent">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Planifiée
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past visits */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-primary-800 uppercase tracking-wider">
          Visites passées
        </h2>
        <div className="bg-white rounded-card border border-border divide-y divide-border">
          {past.map((visit) => {
            const sc = statusConfig(visit.status)
            const Icon = sc.icon
            return (
              <div key={visit.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary-900">{visit.visitor_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDate(visit.date)}</span>
                        <span>·</span>
                        <span>{visit.time}</span>
                      </div>
                    </div>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-badge', sc.cls)}>
                    <Icon className="h-3.5 w-3.5" />
                    {sc.label}
                  </span>
                </div>
                {visit.agent_feedback && (
                  <div className="mt-3 ml-12 bg-section rounded-lg p-3">
                    <p className="text-xs font-medium text-primary-700 mb-1">Retour de l'agent :</p>
                    <p className="text-xs text-muted-foreground">{visit.agent_feedback}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
