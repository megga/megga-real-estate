// MEGGA Marketplace — Design System "Inputs" reference page.
// Route : /design-system/inputs
// Source Figma : node 11723:27991 (page "📨 Inputs" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxInputsStyleGuide from '@/components/propertyx/sections/PxInputsStyleGuide'

export default function PropertyXDesignSystemInputsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxInputsStyleGuide />
    </div>
  )
}
