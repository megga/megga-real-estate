import HeroSearch from '@/components/search/HeroSearch';
import ListingCard from '@/components/listings/ListingCard';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const FEATURED_LISTINGS = [
  {
    id: '1',
    title: 'Appartement lumineux Champel',
    price: 1250000,
    address: 'Rue de Champel 15, 1206 Genève',
    rooms: 4,
    bedrooms: 2,
    surface: 95,
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    isHot: true,
  },
  {
    id: '2',
    title: 'Villa contemporaine Cologny',
    price: 3950000,
    address: 'Chemin de Ruth 8, 1223 Cologny',
    rooms: 7,
    bedrooms: 4,
    surface: 280,
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
  },
  {
    id: '3',
    title: 'Loft rénové Plainpalais',
    price: 890000,
    address: 'Rue de Carouge 42, 1205 Genève',
    rooms: 3,
    bedrooms: 1,
    surface: 78,
    imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
  },
  {
    id: '4',
    title: 'Penthouse vue lac',
    price: 2750000,
    address: 'Quai du Mont-Blanc 3, 1201 Genève',
    rooms: 5,
    bedrooms: 3,
    surface: 160,
    imageUrl: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&q=80',
    isHot: true,
  },
  {
    id: '5',
    title: 'Appartement familial Eaux-Vives',
    price: 1580000,
    address: 'Rue du Lac 27, 1207 Genève',
    rooms: 5,
    bedrooms: 3,
    surface: 120,
    imageUrl: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80',
  },
  {
    id: '6',
    title: 'Studio design Pâquis',
    price: 485000,
    address: 'Rue de Berne 12, 1201 Genève',
    rooms: 2,
    bedrooms: 1,
    surface: 42,
    imageUrl: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&q=80',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar — fixed, transparent over hero, solid on scroll */}
      <Navbar transparent />

      {/* Hero */}
      <section className="relative min-h-[560px] flex items-center justify-center overflow-hidden">

        {/* Background image */}
        <img
          src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient overlay — CRITIQUE #1: stronger */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/50 to-black/30" />
        {/* Grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        {/* Bottom fade to white — MINEUR #2: smooth transition */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full px-4 md:px-6 pt-28 pb-20 md:pt-32 md:pb-28">
          <HeroSearch />
        </div>
      </section>

      {/* Featured listings */}
      <section className="pt-16 pb-12 md:pt-20 md:pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
            Biens en vedette
          </h2>
          <p className="text-gray-500 mt-2">
            Découvrez notre sélection de biens d&apos;exception en Suisse
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {FEATURED_LISTINGS.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA for agents */}
      <section className="py-12 md:py-16 bg-[var(--color-bg-section)]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
            Vous êtes agent immobilier ?
          </h2>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            Gérez vos biens, contacts et transactions avec notre plateforme tout-en-un. CRM intégré, pipeline KYC et portail vendeur inclus.
          </p>
          <a
            href="/register"
            className="inline-flex items-center mt-6 px-8 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-full transition-colors text-sm"
          >
            Créer mon compte agent
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
