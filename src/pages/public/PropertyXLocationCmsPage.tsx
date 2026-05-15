// MEGGA Marketplace — Property X "📍 Location CMS" page.
// Source : Figma node 9552:21441 — page assemblée à partir des sections.
//
// Composition :
// - <PxLocationCms /> : header + hero (image full-bg + title overlay + Browser flottant)
//                      + Featured properties dark + grille 2 cards V2
// - <PxFooterPropertyX /> : footer dark complet (newsletter + colonnes + logo)

import PxLocationCms from '@/components/propertyx/sections/PxLocationCms'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { PX } from '@/components/propertyx'

export default function PropertyXLocationCmsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.neutral200,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PxLocationCms />
      <PxFooterPropertyX />
    </div>
  )
}
