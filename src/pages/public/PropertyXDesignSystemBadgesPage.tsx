// MEGGA Marketplace — Design System "Badges" reference page.
// Route : /design-system/badges
// Source Figma : node 11708:31239 (page "🎖️ Badges" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxBadgesStyleGuide from '@/components/propertyx/sections/PxBadgesStyleGuide'

export default function PropertyXDesignSystemBadgesPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxBadgesStyleGuide />
    </div>
  )
}
