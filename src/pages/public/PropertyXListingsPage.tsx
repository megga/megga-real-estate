// MEGGA Marketplace — Page listings (Property X design).
// Branchée sur Supabase via PxListingsGrid (infinite query, 24 biens/page).
//
// Le prop `context` filtre par transaction_type :
//   - 'buy'  → biens à vendre  → route /acheter
//   - 'rent' → biens à louer    → route /louer

import { PX } from '@/components/propertyx/tokens'
import PxNavPropertyX from '@/components/propertyx/sections/PxNavPropertyX'
import PxListingsHero from '@/components/propertyx/sections/PxListingsHero'
import PxListingsGrid from '@/components/propertyx/sections/PxListingsGrid'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

interface PropertyXListingsPageProps {
  context?: 'buy' | 'rent'
}

export default function PropertyXListingsPage({ context = 'buy' }: PropertyXListingsPageProps) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: PX.neutral200,
        fontFamily: PX.font.sans,
        color: PX.ink,
        overflowX: 'hidden',
      }}
    >
      <PxNavPropertyX />
      <PxListingsHero />
      <PxListingsGrid context={context} />
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
