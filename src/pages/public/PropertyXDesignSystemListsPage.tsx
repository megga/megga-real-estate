// MEGGA Marketplace — Design System "Lists" reference page.
// Route : /design-system/lists
// Source Figma : node 11723:19659 (page "🎛️ Lists" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxListsStyleGuide from '@/components/propertyx/sections/PxListsStyleGuide'

export default function PropertyXDesignSystemListsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxListsStyleGuide />
    </div>
  )
}
