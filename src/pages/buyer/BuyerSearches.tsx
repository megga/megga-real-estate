import { Link } from 'react-router-dom'
import { Search, Bell, BellOff, Trash2, MapPin, ArrowRight } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'

interface SavedSearch {
  id: string
  label: string
  filters: { type?: string; city?: string; minPrice?: number; maxPrice?: number; rooms?: number }
  resultsCount: number
  newResults: number
  alertEnabled: boolean
  createdAt: string
}

const MOCK_SEARCHES: SavedSearch[] = [
  {
    id: 's1',
    label: '3 pièces à Champel',
    filters: { type: 'Appartement', city: 'Genève', minPrice: 600000, maxPrice: 900000, rooms: 3 },
    resultsCount: 24,
    newResults: 3,
    alertEnabled: true,
    createdAt: '12.03.2026',
  },
  {
    id: 's2',
    label: 'Maison avec jardin',
    filters: { type: 'Maison', city: 'Carouge', minPrice: 800000, maxPrice: 1500000 },
    resultsCount: 8,
    newResults: 0,
    alertEnabled: true,
    createdAt: '08.03.2026',
  },
  {
    id: 's3',
    label: 'Studio centre-ville',
    filters: { type: 'Appartement', city: 'Genève', maxPrice: 500000, rooms: 1 },
    resultsCount: 42,
    newResults: 5,
    alertEnabled: false,
    createdAt: '01.03.2026',
  },
]

export default function BuyerSearches() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Recherches sauvées</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {MOCK_SEARCHES.length} recherche{MOCK_SEARCHES.length > 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/acheter"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
        >
          Nouvelle recherche
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {MOCK_SEARCHES.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-gray-200 mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Aucune recherche sauvée</p>
          <Link
            to="/acheter"
            className="inline-block mt-4 text-sm font-medium text-accent hover:text-accent/80"
          >
            Lancer une recherche
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {MOCK_SEARCHES.map((search) => (
            <div
              key={search.id}
              className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-card-hover transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-primary">{search.label}</h3>
                    {search.newResults > 0 && (
                      <span className="text-[10px] font-semibold text-white bg-accent px-2 py-0.5 rounded-full">
                        {search.newResults} nouveau{search.newResults > 1 ? 'x' : ''}
                      </span>
                    )}
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {search.filters.type && (
                      <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">{search.filters.type}</span>
                    )}
                    {search.filters.city && (
                      <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {search.filters.city}
                      </span>
                    )}
                    {(search.filters.minPrice || search.filters.maxPrice) && (
                      <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                        {search.filters.minPrice ? formatCHF(search.filters.minPrice) : '–'} – {search.filters.maxPrice ? formatCHF(search.filters.maxPrice) : '–'}
                      </span>
                    )}
                    {search.filters.rooms && (
                      <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">{search.filters.rooms} pièces</span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-2.5">
                    {search.resultsCount} résultats · Créée le {search.createdAt}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-4">
                  <button
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      search.alertEnabled
                        ? 'text-accent bg-accent/10 hover:bg-accent/20'
                        : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
                    )}
                    title={search.alertEnabled ? 'Alerte activée' : 'Activer l\'alerte'}
                  >
                    {search.alertEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </button>
                  <button
                    className="p-2 rounded-lg text-gray-300 hover:text-danger hover:bg-danger/10 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* CTA */}
              <Link
                to="/acheter"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 mt-3 transition-colors"
              >
                Voir les résultats
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
