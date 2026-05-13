// MEGGA Marketplace — Nouvelle HomePage basée sur le template Property X.
// Refonte progressive : sections ajoutées au fur et à mesure.

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxHero from '@/components/propertyx/sections/PxHero'
import PxSearchBar from '@/components/propertyx/sections/PxSearchBar'
import PxAboutSection from '@/components/propertyx/sections/PxAboutSection'
import PxFeaturedProperties from '@/components/propertyx/sections/PxFeaturedProperties'
import PxAllProperties from '@/components/propertyx/sections/PxAllProperties'
import PxHowItWorks from '@/components/propertyx/sections/PxHowItWorks'
import PxExploreCTA from '@/components/propertyx/sections/PxExploreCTA'
import PxTestimonials from '@/components/propertyx/sections/PxTestimonials'
import PxFooter from '@/components/propertyx/sections/PxFooter'

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
      <PxSearchBar />
      <PxAboutSection />
      <PxFeaturedProperties />
      <PxAllProperties />
      <PxHowItWorks />
      <PxExploreCTA />
      <PxTestimonials />
      <PxFooter />
    </div>
  )
}
