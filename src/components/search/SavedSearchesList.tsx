import { createPortal } from 'react-dom'
import { X, Bell, BellOff, Trash2, Search } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useSavedSearches, type SavedSearchFilters } from '@/hooks/useSavedSearches'

interface SavedSearchesListProps {
  open: boolean
  onClose: () => void
  onApplyFilters: (filters: SavedSearchFilters) => void
}

function formatFilterSummary(filters: SavedSearchFilters): string {
  const parts: string[] = []
  if (filters.context === 'rent') parts.push('Location')
  if (filters.types?.length) parts.push(filters.types.join(', '))
  if (filters.canton) parts.push(filters.canton)
  if (filters.city) parts.push(filters.city)
  if (filters.rooms) parts.push(`${filters.rooms}+ pièces`)
  if (filters.minPrice || filters.maxPrice) {
    const min = filters.minPrice ? `${Math.round(Number(filters.minPrice) / 1000)}K` : ''
    const max = filters.maxPrice ? `${Math.round(Number(filters.maxPrice) / 1000)}K` : ''
    if (min && max) parts.push(`${min} - ${max}`)
    else if (max) parts.push(`max ${max}`)
    else if (min) parts.push(`min ${min}`)
  }
  return parts.join(' · ') || 'Tous les biens'
}

export default function SavedSearchesList({ open, onClose, onApplyFilters }: SavedSearchesListProps) {
  const { searches, deleteSearch, toggleAlert } = useSavedSearches()

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Mes recherches sauvegardées</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 scrollbar-hide">
          {searches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <Search className="h-10 w-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">Aucune recherche sauvegardée</p>
              <p className="text-xs text-gray-500 text-center">Sauvegardez une recherche depuis la page Acheter pour recevoir des alertes quand de nouveaux biens correspondent</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {searches.map((search) => (
                <div
                  key={search.id}
                  className="px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  {/* Name + actions */}
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => { onApplyFilters(search.filters); onClose() }}
                      className="text-left flex-1 min-w-0"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{search.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{formatFilterSummary(search.filters)}</p>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Alert toggle */}
                      <button
                        onClick={() => toggleAlert(search.id)}
                        className={cn(
                          'h-7 w-7 rounded-full flex items-center justify-center transition-colors',
                          search.alertEnabled
                            ? 'text-accent bg-accent/10 hover:bg-accent/20'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        )}
                        title={search.alertEnabled ? 'Désactiver les alertes' : 'Activer les alertes'}
                      >
                        {search.alertEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => deleteSearch(search.id)}
                        className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                    {search.resultsCount > 0 && (
                      <span>{search.resultsCount.toLocaleString('fr-CH')} biens</span>
                    )}
                    <span>{formatRelativeDate(search.createdAt)}</span>
                    {search.alertEnabled && (
                      <span className="text-accent font-medium">
                        Alerte {search.alertFrequency === 'daily' ? 'quotidienne' : 'hebdomadaire'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
