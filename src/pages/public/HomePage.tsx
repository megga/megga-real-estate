import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import SearchBar from '@/components/search/SearchBar'
import ListingGrid from '@/components/listings/ListingGrid'
import { Button } from '@/components/ui/button'
import { MOCK_LISTINGS, toCardData } from '@/lib/mockData'

const listings = MOCK_LISTINGS.slice(0, 6).map(toCardData)

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative h-[500px] md:h-[560px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a8?w=1920&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />

        <div className="relative h-full flex flex-col items-center justify-center px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-3">
            Trouvez votre bien idéal en Suisse
          </h1>
          <p className="text-base md:text-lg text-white/70 text-center mb-10 max-w-xl">
            Le premier portail immobilier suisse avec recherche intelligente
          </p>
          <SearchBar />
        </div>
      </section>

      {/* Biens en vedette */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-2xl font-semibold text-primary-900">
              Biens en vedette
            </h2>
            <p className="text-muted-foreground mt-1">
              Découvrez notre sélection à Genève et environs
            </p>
          </div>
          <Link
            to="/search"
            className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-200"
          >
            Voir tout
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ListingGrid listings={listings} />

        <div className="mt-8 text-center md:hidden">
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
          >
            Voir tous les biens
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* CTA Agents */}
      <section className="bg-section">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-primary-900 mb-4">
              Vous êtes agent immobilier ?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Rejoignez MEGGA et bénéficiez d'un CRM intégré, d'une gestion de pipeline
              complète et d'outils d'assistance intelligente pour développer votre activité.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/register">
                <Button size="lg" className="rounded-full px-8 h-12 text-base gap-2">
                  Commencer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/search">
                <Button variant="outline" size="lg" className="rounded-full px-8 h-12 text-base border-gray-200 hover:bg-gray-50">
                  Découvrir la plateforme
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-xl font-bold tracking-tight text-primary-900">MEGGA</span>
            <p className="text-sm text-muted-foreground">
              © 2026 MEGGA Real Estate. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
