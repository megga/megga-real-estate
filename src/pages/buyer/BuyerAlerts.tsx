import { Link } from 'react-router-dom'
import { Bell, BellOff, MapPin, ArrowRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Alert {
  id: string
  label: string
  filters: string
  enabled: boolean
  lastNotification: string
  matchCount: number
}

const MOCK_ALERTS: Alert[] = [
  {
    id: 'a1',
    label: '3 pièces à Champel, max CHF 900\'000',
    filters: 'Appartement · Genève · 3 pièces · CHF 600\'000–900\'000',
    enabled: true,
    lastNotification: 'il y a 2h',
    matchCount: 3,
  },
  {
    id: 'a2',
    label: 'Maison avec jardin à Carouge',
    filters: 'Maison · Carouge · CHF 800\'000–1\'500\'000',
    enabled: true,
    lastNotification: 'il y a 2 jours',
    matchCount: 0,
  },
]

export default function BuyerAlerts() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Mes alertes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recevez une notification quand un nouveau bien correspond à vos critères.
        </p>
      </div>

      {MOCK_ALERTS.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-200 mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Aucune alerte configurée</p>
          <Link
            to="/acheter"
            className="inline-block mt-4 text-sm font-medium text-accent hover:text-accent/80"
          >
            Créer une alerte depuis la recherche
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {MOCK_ALERTS.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'bg-white rounded-xl border p-5 transition-all',
                alert.enabled ? 'border-accent/20 shadow-sm' : 'border-gray-100'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                      alert.enabled ? 'bg-accent/10 text-accent' : 'bg-gray-50 text-gray-300'
                    )}>
                      {alert.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-primary">{alert.label}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{alert.filters}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 ml-[46px]">
                    <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Dernière notification : {alert.lastNotification}
                    </span>
                    {alert.matchCount > 0 && (
                      <span className="text-xs font-medium text-accent">
                        {alert.matchCount} nouveau{alert.matchCount > 1 ? 'x' : ''} bien{alert.matchCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Toggle */}
                <button
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4',
                    alert.enabled ? 'bg-accent' : 'bg-gray-200'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
                      alert.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    )}
                  />
                </button>
              </div>

              {alert.matchCount > 0 && (
                <Link
                  to="/acheter"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 mt-3 ml-[46px] transition-colors"
                >
                  Voir les nouveaux biens
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-primary">Comment créer une alerte ?</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Lancez une recherche sur la page{' '}
              <Link to="/acheter" className="text-accent hover:underline">Acheter</Link>,
              ajustez vos filtres, puis cliquez sur "Sauvegarder la recherche" et activez les alertes.
              Vous recevrez un email dès qu'un nouveau bien correspond à vos critères.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
