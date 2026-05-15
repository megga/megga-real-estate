// MEGGA Marketplace — Page listings (Property X design).
// Branchée sur Supabase via PxListingsGrid (infinite query, 24 biens/page).
//
// L'état des filtres vit dans l'URL (useSearchParams). Hero, FilterBar et
// Grid lisent les mêmes paramètres via useMarketFilters → tout reste
// synchronisé sans prop drilling.
//
// Le prop `context` filtre par transaction_type :
//   - 'buy'  → biens à vendre  → route /acheter
//   - 'rent' → biens à louer    → route /louer

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxListingsHero from '@/components/propertyx/sections/PxListingsHero'
import PxListingsFilterBar from '@/components/propertyx/sections/PxListingsFilterBar'
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
      <PxNav />
      <PxListingsHero context={context} />
      {/* Padding-top : laisse l'espace pour le débordement de la search bar
          (position absolute top: 383 dans le hero). */}
      <div style={{ paddingTop: 80, paddingBottom: 16, background: PX.neutral200 }}>
        <PxListingsFilterBar context={context} />
      </div>
      <PxListingsGrid context={context} />
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
