// MEGGA Marketplace — Page "Properties for sale" (port fidèle Figma node 9552:21447).
// Structure : Header overlay light + Hero dark + Browser search + Listings grid +
// Post Property Cards + Footer dark.
//
// Le header est overlay (absolute top-0 z-4 light text) sur le hero dark —
// PxNavPropertyX matche exactement le Figma (logo Property X EN, nav Home/About/
// Pages/Cart, CTA white "Start exploring").

import { PX } from '@/components/propertyx/tokens'
import PxNavPropertyX from '@/components/propertyx/sections/PxNavPropertyX'
import PxListingsHero from '@/components/propertyx/sections/PxListingsHero'
import PxListingsGrid from '@/components/propertyx/sections/PxListingsGrid'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

export default function PropertyXListingsPage() {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: PX.neutral200,
        fontFamily: PX.font.sans,
        color: PX.ink,
        overflowX: 'hidden',
      }}
    >
      {/* Header overlay light (absolute top-0 z-4) */}
      <PxNavPropertyX />
      {/* Hero dark + browser search (z-3) */}
      <PxListingsHero />
      {/* Articles grid 2 properties (z-2) */}
      <PxListingsGrid />
      {/* Cards CTA + Footer dark — wrap pour éviter gap parent */}
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
