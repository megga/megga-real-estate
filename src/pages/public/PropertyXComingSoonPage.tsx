// MEGGA Marketplace — Property X "Coming Soon" page.
// Source : Figma node 9552:21496 — frame "🔔 Coming Soon" (1440×1313).
//
// Composition :
//   1. PxComingSoonHero : header centré + hero rounded avec image aérienne ville
//      + titre 72 white + paragraph + email subscribe pill
//   2. PxFooterV3 : footer compact dark (logo + 4 link items + copyright + socials)
//
// Route : /coming-soon (lien depuis le footer V1 colonne Blog)

import { PX } from '@/components/propertyx/tokens'
import PxComingSoonHero from '@/components/propertyx/sections/PxComingSoonHero'
import PxFooterV3 from '@/components/propertyx/sections/PxFooterV3'

export default function PropertyXComingSoonPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
    }}>
      <PxComingSoonHero />
      <PxFooterV3 />
    </div>
  )
}
