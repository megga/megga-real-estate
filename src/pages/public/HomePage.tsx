import HeroSearch from '@/components/search/HeroSearch'
import TrustBar from '@/components/home/TrustBar'
import FeaturedCarousel from '@/components/home/FeaturedCarousel'
import RecentListings from '@/components/home/RecentListings'
import BentoCards from '@/components/home/BentoCards'
import ExploreCities from '@/components/home/ExploreCities'
import PopularAreas from '@/components/home/PopularAreas'
import WhyMegga from '@/components/home/WhyMegga'
import Testimonials from '@/components/home/Testimonials'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import BuyerSidebar from '@/components/search/BuyerSidebar'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <BuyerSidebar className="hidden md:flex fixed top-[72px] bottom-0 left-0 z-40" />

      <main id="main-content">
      {/* Hero */}
      <section className="relative min-h-[calc(100vh-72px)] flex items-center justify-center overflow-hidden">
        <img
          src="/hero-megga.jpg"
          alt="Agent immobilier et client devant une villa d'architecte en Suisse"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/25" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 w-full px-4 md:px-6 pt-28 pb-24 md:pt-36 md:pb-36">
          <HeroSearch />
        </div>
      </section>

      <TrustBar />
      <FeaturedCarousel />
      <RecentListings />
      <BentoCards />

      <ExploreCities />

      <PopularAreas />

      {/* Feature carousel — Tout ce dont vous avez besoin */}
      <WhyMegga />

      <Testimonials />
      </main>

      <Footer />
    </div>
  )
}
