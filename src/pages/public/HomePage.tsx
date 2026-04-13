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
      {/* Hero — editorial, photo-first */}
      <section className="relative h-screen flex items-end justify-center overflow-hidden">
        <img
          src="/hero-megga.jpg"
          alt="Villa d'architecte en Suisse avec vue sur le lac et les Alpes"
          className="absolute inset-0 w-full h-full object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="relative z-10 w-full px-4 md:px-6 pb-16 md:pb-24">
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
