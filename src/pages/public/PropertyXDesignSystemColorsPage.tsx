// MEGGA Marketplace — Design System "Colors" reference page.
// Route : /design-system/colors
// Source Figma : node 11703:26465 (page "🎨 Color Styles" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxColorStylesGuide from '@/components/propertyx/sections/PxColorStylesGuide'

export default function PropertyXDesignSystemColorsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxColorStylesGuide />
    </div>
  )
}
