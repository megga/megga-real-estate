// MEGGA Marketplace — Design System "Shadows" reference page.
// Route : /design-system/shadows
// Source Figma : node 11703:26319 (page "🌑 Shadow Styles" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxShadowsStylesGuide from '@/components/propertyx/sections/PxShadowsStylesGuide'

export default function PropertyXDesignSystemShadowsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxShadowsStylesGuide />
    </div>
  )
}
