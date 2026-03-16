import Navbar from '@/components/layout/Navbar'
import SearchBar from '@/components/search/SearchBar'
import ListingGrid from '@/components/listings/ListingGrid'
import type { ListingCardData } from '@/components/listings/ListingCard'

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
    photos: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
    ],
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
    photos: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
    ],
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
    photos: [
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&h=600&fit=crop',
    ],
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
    photos: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
    ],
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
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
    ],
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
    photos: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
    ],
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative h-[420px] md:h-[460px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=900&fit=crop"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative h-full flex flex-col items-center justify-center px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-8">
            Trouvez votre bien idéal
          </h1>
          <SearchBar />
        </div>
      </section>

      {/* Listings vedettes */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-primary-900">
              Biens en vedette
            </h2>
            <p className="text-muted-foreground mt-1">
              Découvrez notre sélection à Genève et environs
            </p>
          </div>
          <button className="hidden md:inline-flex text-sm font-medium text-accent hover:text-accent-hover transition-colors">
            Voir tout →
          </button>
        </div>

        <ListingGrid listings={MOCK_LISTINGS} />
      </section>
    </div>
  )
}
