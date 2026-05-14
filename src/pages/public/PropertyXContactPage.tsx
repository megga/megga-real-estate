// MEGGA Marketplace — Property X "Contact V1" page.
// Source : Figma node 9552:21481 (📩 Contact V1 frame, 1440×3732).
//
// Composition (top → bottom) :
//   1. PxNav (glass)
//   2. PxContactHero — bento dark 994h : "Contact us" + form 660 + Reach us 422
//   3. PxContactFAQs — accordion 4 items
//   4. PxContactOffices — badge + H2 + button + 2 images (954 + 221)
//   5. PxPostPropertyEN (réutilisé)
//   6. PxFooterPropertyX (réutilisé)

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxContactHero from '@/components/propertyx/sections/PxContactHero'
import PxContactFAQs from '@/components/propertyx/sections/PxContactFAQs'
import PxContactOffices from '@/components/propertyx/sections/PxContactOffices'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

export default function PropertyXContactPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav glass />
      <PxContactHero />
      <PxContactFAQs />
      <PxContactOffices />
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
