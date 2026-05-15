// MEGGA Marketplace — Property X "👤 Agent Single" page.
// Source : Figma node 9552:21460 (1440×3784).
//
// Composition (top → bottom) :
//   1. PxNav
//   2. PxAgentProfile (Hero + Properties + Articles)
//   3. PxPostPropertyEN (réutilisé — "Post a free/paid property")
//   4. PxFooterPropertyX (réutilisé)

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxAgentProfile from '@/components/propertyx/sections/PxAgentProfile'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

export default function PropertyXAgentProfilePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.surfaceBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav bg={PX.surfaceBg} />
      <PxAgentProfile />
      <PxPostPropertyEN />
      <PxFooterPropertyX />
    </div>
  )
}
