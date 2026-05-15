// MEGGA Marketplace — Property X "City Properties" page (Property CSM).
// Source : Figma node 9552:21444 — page assemblée à partir des sections.
//
// Composition :
// - <PxCityProperties /> : header + hero (title + image + Browser search) + Featured Row + Grid 4 cards
// - <PxFooterPropertyX /> : footer dark complet (newsletter + colonnes + logo)

import PxCityProperties from '@/components/propertyx/sections/PxCityProperties'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { PX } from '@/components/propertyx'

export default function PropertyXCityPropertiesPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.neutral200,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PxCityProperties />
      <PxFooterPropertyX />
    </div>
  )
}
