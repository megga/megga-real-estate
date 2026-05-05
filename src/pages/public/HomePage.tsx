import HomeHeroSection from '@/components/home/HomeHeroSection'
import TrustBar from '@/components/home/TrustBar'
import FeaturedCarousel from '@/components/home/FeaturedCarousel'
import RecentListings from '@/components/home/RecentListings'
import BentoCards from '@/components/home/BentoCards'
import ExploreCities from '@/components/home/ExploreCities'
import Testimonials from '@/components/home/Testimonials'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar transparent />

      <main id="main-content" className="-mt-[72px]">
        <HomeHeroSection />

        <TrustBar />
        <FeaturedCarousel />
        <RecentListings />
        <BentoCards />

        <ExploreCities />

        <Testimonials />
      </main>

      <Footer />
    </div>
  )
}
