// MEGGA Marketplace — Page 404 Not Found (port fidèle Figma node 9552:21503).
// Structure : PxNotFound (header + hero + cards) + PxFooterPropertyX (dark footer).

import PxNotFound from '@/components/propertyx/sections/PxNotFound'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { PX } from '@/components/propertyx/tokens'

export default function NotFoundPage() {
  return (
    <div style={{ background: PX.neutral200, minHeight: '100vh' }}>
      <PxNotFound />
      <PxFooterPropertyX />
    </div>
  )
}
