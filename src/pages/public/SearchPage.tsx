import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '@/components/layout/Navbar'
import SearchFilters, { type SearchFiltersState } from '@/components/search/SearchFilters'
import ListingCard from '@/components/listings/ListingCard'
import MapView from '@/components/map/MapView'
import { MOCK_LISTINGS, toCardData } from '@/lib/mockData'

const ALL_CARDS = MOCK_LISTINGS.map(toCardData)

const mapMarkers = MOCK_LISTINGS.map((l) => ({
  id: l.id,
  lat: l.lat,
  lng: l.lng,
  price: l.price,
  label: l.title,
}))

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const [selectedListing, setSelectedListing] = useState<string>()
  const [filters, setFilters] = useState<SearchFiltersState>({
    type: '',
    minPrice: '',
    maxPrice: '',
    minRooms: '',
    city: searchParams.get('city') || '',
    sortBy: 'newest',
  })

  // Simple client-side filtering on mock data
  const filtered = ALL_CARDS.filter((l) => {
    if (filters.city && l.city !== filters.city) return false
    if (filters.minPrice && l.price < Number(filters.minPrice)) return false
    if (filters.minRooms && l.rooms < Number(filters.minRooms)) return false
    return true
  }).sort((a, b) => {
    if (filters.sortBy === 'price_asc') return a.price - b.price
    if (filters.sortBy === 'price_desc') return b.price - a.price
    if (filters.sortBy === 'surface_desc') return b.surface_m2 - a.surface_m2
    return 0
  })

  const filteredMarkers = mapMarkers.filter((m) => filtered.some((l) => l.id === m.id))

  return (
    <div className="h-screen flex flex-col bg-white">
      <Navbar />

      <main id="main-content" className="flex-1 flex overflow-hidden">
        {/* Results panel */}
        <section className="w-full lg:w-1/2 xl:w-[55%] flex flex-col overflow-hidden border-r border-border" aria-label="Résultats de recherche">
          {/* Filters */}
          <div className="px-4 md:px-6 py-4 border-b border-border bg-white">
            <h1 className="sr-only">Résultats de recherche</h1>
            <SearchFilters
              filters={filters}
              onChange={setFilters}
              resultCount={filtered.length}
            />
          </div>

          {/* Scrollable results */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-lg font-medium text-primary-700 mb-1">
                  Aucun bien trouvé
                </p>
                <p className="text-sm text-muted-foreground">
                  Essayez de modifier vos critères de recherche
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map((listing) => (
                  <div
                    key={listing.id}
                    onMouseEnter={() => setSelectedListing(listing.id)}
                    onMouseLeave={() => setSelectedListing(undefined)}
                    onFocus={() => setSelectedListing(listing.id)}
                    onBlur={() => setSelectedListing(undefined)}
                  >
                    <ListingCard listing={listing} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Map panel */}
        <section className="hidden lg:block lg:w-1/2 xl:w-[45%]" aria-label="Carte des biens">
          <MapView
            markers={filteredMarkers}
            selectedId={selectedListing}
            onMarkerClick={setSelectedListing}
            className="h-full rounded-none"
          />
        </section>
      </main>
    </div>
  )
}
