// MEGGA Marketplace — Design System "Links" reference page.
// Route : /design-system/links
// Source Figma : node 11708:31063 (page "🔗 Links" du UI Kit Property X).

import { PX } from '@/components/propertyx/tokens'
import PxLinksStyleGuide from '@/components/propertyx/sections/PxLinksStyleGuide'

export default function PropertyXDesignSystemLinksPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      padding: 32,
    }}>
      <PxLinksStyleGuide />
    </div>
  )
}
