// MEGGA Marketplace — Design System "Icon Fonts" reference page.
// Route : /design-system/iconfonts
// Source Figma : node 11723:20206 (page "📱 Icon font" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxIconFontsStyleGuide from '@/components/propertyx/sections/PxIconFontsStyleGuide'

export default function PropertyXDesignSystemIconFontsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxIconFontsStyleGuide />
    </div>
  )
}
