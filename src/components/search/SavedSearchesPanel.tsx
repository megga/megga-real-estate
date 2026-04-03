import { ArrowLeft, Bell, BellOff, Trash2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSavedSearches } from '@/hooks/useSavedSearches'

interface Props {
  onBack: () => void
  onApplyFilters: (filters: Record<string, string>) => void
}

export default function SavedSearchesPanel({ onBack, onApplyFilters }: Props) {
  const { searches, deleteSearch, toggleAlert, count } = useSavedSearches()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-bold text-gray-900">Mes recherches</h2>
        <span className="text-xs text-gray-400 font-medium">{count}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        {searches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <img src="/illustrations/maggy/Folder.svg" alt="" className="w-44 h-36 mx-auto mb-3" loading="lazy" decoding="async" />
            <p className="text-sm font-medium text-gray-700 mb-1">Aucune recherche sauvegardée</p>
            <p className="text-xs text-gray-400 max-w-[220px]">
              Sauvegardez une recherche pour la retrouver ici et recevoir des alertes
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {searches.map(search => (
              <div key={search.id} className="rounded-xl border border-gray-100 p-3.5 hover:border-gray-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{search.name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search.filters.types?.length ? search.filters.types.join(', ') : 'Tous types'}
                      {search.filters.minPrice || search.filters.maxPrice ? (
                        <> · {search.filters.minPrice ? `dès ${Number(search.filters.minPrice).toLocaleString('fr-CH')}` : ''}{search.filters.minPrice && search.filters.maxPrice ? ' – ' : ''}{search.filters.maxPrice ? `max ${Number(search.filters.maxPrice).toLocaleString('fr-CH')}` : ''}</>
                      ) : null}
                      {search.filters.rooms ? ` · ${search.filters.rooms}p` : ''}
                      {search.filters.canton ? ` · ${search.filters.canton}` : ''}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => toggleAlert(search.id)}
                    className={cn(
                      'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer',
                      search.alertEnabled
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-gray-50 text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {search.alertEnabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                    {search.alertEnabled ? 'Alertes ON' : 'Alertes OFF'}
                  </button>

                  <button
                    onClick={() => {
                      const f: Record<string, string> = {}
                      if (search.filters.minPrice) f.minPrice = search.filters.minPrice
                      if (search.filters.maxPrice) f.maxPrice = search.filters.maxPrice
                      if (search.filters.rooms) f.rooms = search.filters.rooms
                      if (search.filters.canton) f.canton = search.filters.canton
                      if (search.filters.types?.length) f.types = search.filters.types.join(',')
                      onApplyFilters(f)
                    }}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors cursor-pointer ml-auto"
                  >
                    Voir <ArrowRight className="h-3 w-3" />
                  </button>

                  <button
                    onClick={() => deleteSearch(search.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
