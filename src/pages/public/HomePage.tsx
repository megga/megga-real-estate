// MEGGA Homepage — port 1:1 du Claude Design bundle (megga-hero + megga-trust
// + megga-body + megga-regions + megga-footer + megga-header).
// Ordre des sections fidèle au proto :
//   Hero (avec nav overlay) · Stats · TrustBar · Split · MapPreview · Featured
//   · Regions · FAQ · Testimonial · CTABanner · FooterMega
//
// Architecture navbar (proto-fidèle, deux composants) :
// - HeroNavOverlay (à l'intérieur de HomeHeroSection) : visible quand
//   l'utilisateur est sur le hero · glass pill au centre, logo blanc + login.
// - HomeStickyHeader : hidden au load, slide-down quand scrollY > 80%
//   viewport · opaque white + logo noir + nav center.
// Les deux se relayent : l'overlay scroll-out avec le hero, le sticky
// slide-down apparaît juste après. L'utilisateur a toujours une nav.

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
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import FooterMega from '@/components/layout/FooterMega'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky header (hidden au load, slides down après hero) */}
      <HomeStickyHeader />

      <main id="main-content">
        {/* Hero contient sa propre nav overlay (glass pill) — toujours
            visible quand l'utilisateur est sur le hero, scroll-out avec lui. */}
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
