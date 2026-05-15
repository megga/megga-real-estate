// MEGGA Marketplace — Design System "Icons" reference page.
// Route : /design-system/icons
// Source Figma : node 11723:19978 (page "📱 Icons" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxIconsStyleGuide from '@/components/propertyx/sections/PxIconsStyleGuide'

export default function PropertyXDesignSystemIconsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxIconsStyleGuide />
    </div>
  )
}
