// MEGGA Marketplace — Design System "Buttons" reference page.
// Route : /design-system/buttons
// Source Figma : node 11706:23422 (page "🧱 Buttons" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxButtonsStyleGuide from '@/components/propertyx/sections/PxButtonsStyleGuide'

export default function PropertyXDesignSystemButtonsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxButtonsStyleGuide />
    </div>
  )
}
