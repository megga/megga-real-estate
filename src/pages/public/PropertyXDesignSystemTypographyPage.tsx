// MEGGA Marketplace — Design System "Typography" reference page.
// Route : /design-system/typography
// Source Figma : node 11703:26347 (page "✍️ Typography Styles" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxTypographyStylesGuide from '@/components/propertyx/sections/PxTypographyStylesGuide'

export default function PropertyXDesignSystemTypographyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxTypographyStylesGuide />
    </div>
  )
}
