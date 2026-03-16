import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '@/components/layout/Navbar'
import SearchFilters, { type SearchFiltersState } from '@/components/search/SearchFilters'
import ListingCard from '@/components/listings/ListingCard'
import type { ListingCardData } from '@/components/listings/ListingCard'
import MapView from '@/components/map/MapView'

const MOCK_LISTINGS: ListingCardData[] = [
  {
    id: '1',
    title: 'Appartement lumineux aux Eaux-Vives',
    price: 720000,
    address: 'Rue du Lac 12',
    city: 'Genève',
    rooms: 4,
    bedrooms: 2,
    surface_m2: 95,
    is_hot: true,
    photos: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop'],
  },
  {
    id: '2',
    title: 'Duplex moderne à Champel',
    price: 1250000,
    address: 'Avenue de Champel 45',
    city: 'Genève',
    rooms: 5,
    bedrooms: 3,
    surface_m2: 140,
    photos: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop'],
  },
  {
    id: '3',
    title: 'Studio rénové à Plainpalais',
    price: 385000,
    address: 'Rue de Carouge 78',
    city: 'Genève',
    rooms: 2,
    bedrooms: 1,
    surface_m2: 42,
    photos: ['https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&h=600&fit=crop'],
  },
  {
    id: '4',
    title: 'Villa avec vue sur le lac',
    price: 2950000,
    address: 'Chemin des Crêts 5',
    city: 'Cologny',
    rooms: 7,
    bedrooms: 4,
    surface_m2: 280,
    is_hot: true,
    photos: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop'],
  },
  {
    id: '5',
    title: 'Loft industriel aux Pâquis',
    price: 890000,
    address: 'Rue de Berne 22',
    city: 'Genève',
    rooms: 3,
    bedrooms: 1,
    surface_m2: 110,
    photos: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop'],
  },
  {
    id: '6',
    title: 'Appartement familial à Carouge',
    price: 650000,
    address: 'Place du Marché 8',
    city: 'Carouge',
    rooms: 4,
    bedrooms: 2,
    surface_m2: 88,
    photos: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop'],
  },
  {
    id: '7',
    title: 'Penthouse avec terrasse panoramique',
    price: 3200000,
    address: 'Quai du Mont-Blanc 18',
    city: 'Genève',
    rooms: 6,
    bedrooms: 3,
    surface_m2: 210,
    is_hot: true,
    photos: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop'],
  },
  {
    id: '8',
    title: 'Maison de ville rénovée',
    price: 1450000,
    address: 'Rue Ancienne 34',
    city: 'Carouge',
    rooms: 5,
    bedrooms: 3,
    surface_m2: 160,
    photos: ['https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop'],
  },
]

const mapMarkers = MOCK_LISTINGS.map((l, i) => ({
  id: l.id,
  lat: 46.2 + i * 0.005,
  lng: 6.14 + i * 0.008,
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
  const filtered = MOCK_LISTINGS.filter((l) => {
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

      <div className="flex-1 flex overflow-hidden">
        {/* Results panel */}
        <div className="w-full lg:w-1/2 xl:w-[55%] flex flex-col overflow-hidden border-r border-border">
          {/* Filters */}
          <div className="px-4 md:px-6 py-4 border-b border-border bg-white">
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
                  >
                    <ListingCard listing={listing} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map panel */}
        <div className="hidden lg:block lg:w-1/2 xl:w-[45%]">
          <MapView
            markers={filteredMarkers}
            selectedId={selectedListing}
            onMarkerClick={setSelectedListing}
            className="h-full rounded-none"
          />
        </div>
      </div>
    </div>
  )
}
