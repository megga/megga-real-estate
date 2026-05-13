// MEGGA Marketplace — Page "About" (Property X "🏢 Properties" template).
// Source : Figma node 9552:21438 — "🏢 Properties"
// (https://www.figma.com/design/fZovI4RREX4XHpLazsz8JB/?node-id=9552-21438)
//
// Structure fidèle Figma :
//   <Page bg-neutral200 (#fafafb), flex-col gap-47, isolate>
//     <Header Wrapper>          ← PxNav (composant déjà migré du Header/V1)
//     <Hero Section z-3>        ← PxPropertiesHero (dark hero + Browser absolu)
//     <Articles Section z-2>    ← PxPropertiesGrid (6 cards V2 en 2 colonnes)
//     <Footer/V1>               ← PxPostProperty (cards "Publier") + PxFooter (dark)
//   </Page>

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxPropertiesHero from '@/components/propertyx/sections/PxPropertiesHero'
import PxPropertiesGrid from '@/components/propertyx/sections/PxPropertiesGrid'
import PxPostProperty from '@/components/propertyx/sections/PxPostProperty'
import PxFooter from '@/components/propertyx/sections/PxFooter'

export default function AboutPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.neutral200,
      fontFamily: PX.font.sans,
      color: PX.ink,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      // Figma : gap-47 (entre Hero et Articles Section). On compense le
      // -48 du Browser dans Hero par un gap équivalent + pt-64 sur la grille.
    }}>
      <PxNav />
      <PxPropertiesHero />
      <PxPropertiesGrid />
      <PxPostProperty />
      <PxFooter />
    </div>
  )
}
