// MEGGA Marketplace — Page "About" (Property X "🏢 Properties" template).
// Source : Figma node 9552:21438 — "🏢 Properties"
// (https://www.figma.com/design/fZovI4RREX4XHpLazsz8JB/?node-id=9552-21438)
//
// Structure fidèle Figma :
//   <Page bg-neutral200 (#fafafb), flex-col gap-47, isolate, position relative>
//     <Header Wrapper absolute top-0 z-4>   ← PxNavPropertyX (EN, overlay hero)
//     <Hero Section z-3>                    ← PxPropertiesHero (dark hero + Browser absolu)
//     <Articles Section z-2>                ← PxPropertiesGrid (6 cards V2)
//     <Footer V1>                            ← PxPostPropertyEN + PxFooterPropertyX
//   </Page>
//
// Variants EN spécifiques /about pour fidélité Figma maximale (la nav, le
// post-property et le footer du reste du site restent MEGGA-FR).

import { PX } from '@/components/propertyx/tokens'
import PxNavPropertyX from '@/components/propertyx/sections/PxNavPropertyX'
import PxPropertiesHero from '@/components/propertyx/sections/PxPropertiesHero'
import PxPropertiesGrid from '@/components/propertyx/sections/PxPropertiesGrid'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

export default function AboutPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.neutral200,
      fontFamily: PX.font.sans,
      color: PX.ink,
      // Figma : flex-col gap-47 isolate, relative pour ancrer la nav absolute
      display: 'flex',
      flexDirection: 'column',
      gap: 47,
      alignItems: 'stretch',
      position: 'relative',
      isolation: 'isolate',
    }}>
      <PxNavPropertyX />
      <PxPropertiesHero />
      <PxPropertiesGrid />
      {/* PostProperty + Footer = un seul "Footer V1" Figma — gap-24 interne
          (assuré par paddingBottom:24 sur PxPostPropertyEN). On les wrap
          dans un div pour qu'AboutPage n'applique pas son gap-47 entre eux. */}
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
