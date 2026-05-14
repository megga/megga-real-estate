// MEGGA Marketplace — Property X "Password Protected" utility page.
// Source : Figma node 9552:21506 — page assemblée à partir des sections.
//
// Composition :
// - <PxPasswordProtected /> : header + hero card + 2 footer cards
// - <PxFooterPropertyX /> : footer dark complet (newsletter + colonnes + logo)

import PxPasswordProtected from '@/components/propertyx/sections/PxPasswordProtected'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { PX } from '@/components/propertyx'

export default function PropertyXPasswordProtectedPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.neutral200,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PxPasswordProtected />
      <PxFooterPropertyX />
    </div>
  )
}
