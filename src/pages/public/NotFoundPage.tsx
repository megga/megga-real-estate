// MEGGA Marketplace — Page 404 Not Found (port fidèle Figma node 9552:21503).
// Structure : PxNotFound (header + hero) + PxPostPropertyEN (cards Footer/V1)
// + PxFooterPropertyX (dark footer).

import PxNotFound from '@/components/propertyx/sections/PxNotFound'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { PX } from '@/components/propertyx/tokens'

export default function NotFoundPage() {
  return (
    <div style={{ background: PX.neutral200, minHeight: '100vh' }}>
      <PxNotFound />
      <PxPostPropertyEN />
      <PxFooterPropertyX />
    </div>
  )
}
