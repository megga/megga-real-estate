import { X, Bell, BellOff, Search, Trash2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSavedSearches, type SavedSearch } from '@/hooks/useSavedSearches'
import { formatRelativeDate } from '@/lib/utils'

interface SavedSearchesPanelProps {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: Record<string, unknown>) => void
}

function getFilterPills(filters: Record<string, unknown>): string[] {
  const pills: string[] = []
  const f = filters as Record<string, string | string[]>

  if (f.context === 'rent') pills.push('Location')
  else pills.push('Achat')

  if (Array.isArray(f.types) && f.types.length) {
    const labels: Record<string, string> = {
      apartment: 'Appart.', house: 'Maison', villa: 'Villa',
      commercial: 'Commercial', land: 'Terrain',
    }
    f.types.forEach((t: string) => pills.push(labels[t] || t))
  }
  if (f.rooms) pills.push(`${f.rooms}p.`)
  if (f.maxPrice) {
    const p = Number(f.maxPrice)
    pills.push(p >= 1000000 ? `≤${p / 1000000}M` : `≤${Math.round(p / 1000)}K`)
  }
  if (f.city) pills.push(String(f.city))
  if (Array.isArray(f.lifestyleTags) && f.lifestyleTags.length) {
    pills.push(`+${f.lifestyleTags.length} critères`)
  }
  return pills
}

export default function SavedSearchesPanel({ isOpen, onClose, onApply }: SavedSearchesPanelProps) {
  const { savedSearches, isLoading, remove, toggleAlert } = useSavedSearches()

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-modal z-50 flex flex-col transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Mes recherches sauvegardées
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="w-6 h-6 border-2 border-gray-200 border-t-accent rounded-full animate-spin" />
            </div>
          ) : savedSearches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Aucune recherche sauvegardée
              </p>
              <p className="text-xs text-gray-500">
                Sauvegardez vos recherches pour les retrouver facilement
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {savedSearches.map((search) => (
                <SavedSearchItem
                  key={search.id}
                  search={search}
                  onApply={() => {
                    onApply(search.filters)
                    onClose()
                  }}
                  onDelete={() => remove(search.id)}
                  onToggleAlert={(enabled) =>
                    toggleAlert({ id: search.id, enabled })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function SavedSearchItem({
  search,
  onApply,
  onDelete,
  onToggleAlert,
}: {
  search: SavedSearch
  onApply: () => void
  onDelete: () => void
  onToggleAlert: (enabled: boolean) => void
}) {
  const pills = getFilterPills(search.filters)

  return (
    <div className="px-5 py-4 hover:bg-gray-50 transition-colors group">
      {/* Name + date */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {search.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-400">
              {formatRelativeDate(search.created_at)}
            </span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              {search.results_count} bien{search.results_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1 mb-3">
        {pills.map((pill, i) => (
          <span
            key={i}
            className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
          >
            {pill}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onApply}
          className="flex-1 h-8 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Search className="h-3 w-3" />
          Appliquer
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleAlert(!search.alert_enabled)
          }}
          className={cn(
            'h-8 px-3 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5',
            search.alert_enabled
              ? 'bg-accent/10 border-accent/20 text-accent'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          )}
        >
          {search.alert_enabled ? (
            <>
              <Bell className="h-3 w-3" />
              Alerte ON
            </>
          ) : (
            <>
              <BellOff className="h-3 w-3" />
              Alerte
            </>
          )}
        </button>
      </div>
    </div>
  )
}
