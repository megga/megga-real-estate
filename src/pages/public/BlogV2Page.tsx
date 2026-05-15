// MEGGA Marketplace — Page "Blog V2" (port fidèle Figma node 9552:21472).
// Structure : PxBlogV2 (header + hero dark + articles section avec sidebar) +
// PxPostPropertyEN (2 cartes "Post a property" EN) + PxFooterPropertyX
// (dark footer EN).

import PxBlogV2 from '@/components/propertyx/sections/PxBlogV2'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { PX } from '@/components/propertyx/tokens'

export default function BlogV2Page() {
  return (
    <div style={{ background: PX.neutral200, minHeight: '100vh' }}>
      <PxBlogV2 />
      <PxPostPropertyEN />
      <PxFooterPropertyX />
    </div>
  )
}
