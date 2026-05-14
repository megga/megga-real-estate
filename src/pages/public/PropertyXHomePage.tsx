// MEGGA Marketplace — HomePage alignée sur home-v3 du template Webflow.
// Ordre des sections 1:1 home-v3 (https://juliens-sublime-site-cc2c1f.webflow.io/home-pages/home-v3) :
//   1. Hero
//   2. About / Value section
//   3. Featured Properties
//   4. All Properties grid
//   5. How It Works / Process
//   6. Explore CTA v3 (iPad)
//   7. Testimonials
//   8. Blog teaser
//   9. Footer V1 (Property X variant)
//
// Retiré vs version précédente : PxSearchBar (pas dans home-v3), PxPostProperty
// (intégré dans le Footer V1). PxFooter (FR MEGGA) remplacé par PxFooterPropertyX
// (variant BRIX qui matche le footer de home-v3).
// Refonte progressive : chaque section sera mise à jour pour matcher home-v3
// dimensions/animations/structure au fur et à mesure.

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxHero from '@/components/propertyx/sections/PxHero'
import PxAboutSection from '@/components/propertyx/sections/PxAboutSection'
import PxFeaturedProperties from '@/components/propertyx/sections/PxFeaturedProperties'
import PxAllProperties from '@/components/propertyx/sections/PxAllProperties'
import PxHowItWorks from '@/components/propertyx/sections/PxHowItWorks'
import PxExploreCTA from '@/components/propertyx/sections/PxExploreCTA'
import PxTestimonials from '@/components/propertyx/sections/PxTestimonials'
import PxBlogTeaser from '@/components/propertyx/sections/PxBlogTeaser'
import PxNewsletter from '@/components/propertyx/sections/PxNewsletter'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

export default function PropertyXHomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav glass />
      <PxHero />
      <PxAboutSection />
      <PxFeaturedProperties />
      <PxAllProperties />
      <PxHowItWorks />
      <PxExploreCTA />
      <PxTestimonials />
      <PxBlogTeaser />
      <PxNewsletter />
      {/* Footer V1 = PostProperty CTA + Footer dark (idem /a-propos) */}
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
