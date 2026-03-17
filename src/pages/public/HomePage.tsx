import HeroSearch from '@/components/search/HeroSearch';
import FeaturedCarousel from '@/components/home/FeaturedCarousel';
import BentoCards from '@/components/home/BentoCards';
import ExploreCities from '@/components/home/ExploreCities';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

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
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/25" />
        {/* Grain texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        {/* Content */}
        <div className="relative z-10 w-full px-4 md:px-6 pt-28 pb-20 md:pt-32 md:pb-28">
          <HeroSearch />
        </div>
      </section>

      {/* Featured listings carousel */}
      <FeaturedCarousel />

      {/* Bento cards — Acheter / Louer / Estimer */}
      <BentoCards />

      {/* Explorer par ville */}
      <ExploreCities />

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
