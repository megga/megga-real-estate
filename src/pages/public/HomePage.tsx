// MEGGA Homepage — port 1:1 du Claude Design bundle (megga-hero + megga-trust
// + megga-body + megga-regions + megga-footer).
// Ordre des sections fidèle au proto :
//   Hero · Stats · TrustBar · Split · MapPreview · Featured · Regions · FAQ
//   · Testimonial · CTABanner · FooterMega
// Les anciens composants BentoCards / ExploreCities / Testimonials carousel /
// FeaturedCarousel / RecentListings / Footer (light) ne sont plus utilisés ici
// — ils restent dans /components pour réutilisation potentielle ailleurs.

import HomeHeroSection from '@/components/home/HomeHeroSection'
import HomeStats from '@/components/home/HomeStats'
import TrustBar from '@/components/home/TrustBar'
import HomeSplit from '@/components/home/HomeSplit'
import HomeMapPreview from '@/components/home/HomeMapPreview'
import HomeFeaturedGrid from '@/components/home/HomeFeaturedGrid'
import HomeRegions from '@/components/home/HomeRegions'
import HomeFAQ from '@/components/home/HomeFAQ'
import HomeTestimonialSingle from '@/components/home/HomeTestimonialSingle'
import HomeCTABanner from '@/components/home/HomeCTABanner'
import Navbar from '@/components/layout/Navbar'
import FooterMega from '@/components/layout/FooterMega'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar transparent />

      <main id="main-content" className="-mt-[72px]">
        <HomeHeroSection />
        <HomeStats />
        <TrustBar />
        <HomeSplit />
        <HomeMapPreview />
        <HomeFeaturedGrid />
        <HomeRegions />
        <HomeFAQ />
        <HomeTestimonialSingle />
        <HomeCTABanner />
      </main>

      <FooterMega />
    </div>
  )
}
