import { ArrowLeft, Bell, BellOff, ArrowRight } from 'lucide-react'
import { useSavedSearches } from '@/hooks/useSavedSearches'

interface Props {
  onBack: () => void
  onApplyFilters: (filters: Record<string, string>) => void
}

export default function AlertsPanel({ onBack, onApplyFilters }: Props) {
  const { searches, toggleAlert } = useSavedSearches()
  const alertSearches = searches.filter(s => s.alertEnabled)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-bold text-gray-900">Mes alertes</h2>
        <span className="text-xs text-gray-400 font-medium">{alertSearches.length}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        {alertSearches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
              <Bell className="h-5 w-5 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Aucune alerte active</p>
            <p className="text-xs text-gray-400 max-w-[220px]">
              Activez les alertes sur une recherche sauvegardée pour être notifié des nouveaux biens
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alertSearches.map(search => (
              <div key={search.id} className="rounded-xl border border-gray-100 p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-3.5 w-3.5 text-blue-500" />
                  <p className="text-sm font-bold text-gray-900 truncate flex-1">{search.name}</p>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Fréquence : {search.alertFrequency === 'daily' ? 'Quotidienne' : search.alertFrequency === 'weekly' ? 'Hebdomadaire' : 'Instantanée'}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const f: Record<string, string> = {}
                      if (search.filters.minPrice) f.minPrice = search.filters.minPrice
                      if (search.filters.maxPrice) f.maxPrice = search.filters.maxPrice
                      if (search.filters.rooms) f.rooms = search.filters.rooms
                      if (search.filters.canton) f.canton = search.filters.canton
                      onApplyFilters(f)
                    }}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    Voir les résultats <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => toggleAlert(search.id)}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer ml-auto"
                  >
                    <BellOff className="h-3 w-3" />
                    Désactiver
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
