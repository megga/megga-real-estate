// MEGGA Marketplace — Property X "Single Property" page.
// Source : Figma node 9552:21451 (🏠 Single Property frame, 1440×4681).
//
// Composition (top → bottom) :
//   1. PxNav (glass)
//   2. PxSinglePropertyHero (5-image gallery)
//   3. PxSinglePropertyBody (rich text gauche + sidebar droite)
//   4. PxExploreCTA (CTA/V1 réutilisé)
//   5. PxSinglePropertyRelated (More properties — 2 cards)
//   6. PxPostPropertyEN (post property block du footer)
//   7. PxFooterPropertyX (footer V1)

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxSinglePropertyHero from '@/components/propertyx/sections/PxSinglePropertyHero'
import PxSinglePropertyBody from '@/components/propertyx/sections/PxSinglePropertyBody'
import PxSinglePropertyRelated from '@/components/propertyx/sections/PxSinglePropertyRelated'
import PxSinglePropertyCTA from '@/components/propertyx/sections/PxSinglePropertyCTA'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

export default function PropertyXSinglePropertyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav glass />
      <PxSinglePropertyHero />
      <PxSinglePropertyBody />
      <PxSinglePropertyCTA />
      <PxSinglePropertyRelated />
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
