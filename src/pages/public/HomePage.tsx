import Navbar from '@/components/layout/Navbar'
import SearchBar from '@/components/search/SearchBar'
import ListingGrid from '@/components/listings/ListingGrid'
import { MOCK_LISTINGS, toCardData } from '@/lib/mockData'

const listings = MOCK_LISTINGS.slice(0, 6).map(toCardData)

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main id="main-content">
        {/* Hero */}
        <section className="relative h-[420px] md:h-[460px] overflow-hidden" aria-label="Recherche immobilière">
          <img
            src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&h=900&fit=crop"
            alt="Villa moderne avec de grandes baies vitrées et une piscine"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

          <div className="relative h-full flex flex-col items-center justify-center px-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-8">
              Trouvez votre bien idéal
            </h1>
            <SearchBar />
          </div>
        </section>

        {/* Listings vedettes */}
        <section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16" aria-label="Biens en vedette">
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
              Voir tout <span aria-hidden="true">→</span>
            </button>
          </div>

          <ListingGrid listings={listings} />
        </section>
      </main>
    </div>
  )
}
