// MEGGA Marketplace — Page FAQs (port fidèle Figma node 9552:21493).
// Structure : Header/V1 + FAQs Section + Post Property Cards + Footer/V1
//
// Réutilise les sections existantes (PxNav, PxPostPropertyEN, PxFooterPropertyX)
// + une nouvelle section dédiée PxFAQ pour l'accordéon.

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxFAQ from '@/components/propertyx/sections/PxFAQ'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

export default function PropertyXFAQPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: PX.neutral200,
        fontFamily: PX.font.sans,
        color: PX.ink,
      }}
    >
      <PxNav bg={PX.neutral200} />
      <PxFAQ />
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
