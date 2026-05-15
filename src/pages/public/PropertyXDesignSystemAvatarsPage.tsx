// MEGGA Marketplace — Design System "Avatars" reference page.
// Route : /design-system/avatars
// Source Figma : node 11723:24553 (page "👥 Avatars" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxAvatarsStyleGuide from '@/components/propertyx/sections/PxAvatarsStyleGuide'

export default function PropertyXDesignSystemAvatarsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxAvatarsStyleGuide />
    </div>
  )
}
