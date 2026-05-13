// MEGGA Marketplace — Nouvelle HomePage basée sur le template Property X.
// Refonte progressive : sections ajoutées au fur et à mesure.

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxHero from '@/components/propertyx/sections/PxHero'

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
      {/* TODO : SearchBar, AboutSection, FeaturedProperties, AllProperties,
                 HowItWorks, ExploreCTA, Testimonials, Footer */}
    </div>
  )
}
