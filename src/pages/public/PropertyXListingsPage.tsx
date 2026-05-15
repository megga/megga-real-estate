// MEGGA Marketplace — Page listings (Property X design).
// Branchée sur Supabase via PxListingsGrid (infinite query, 24 biens/page).
//
// L'état des filtres vit dans l'URL (useSearchParams). Hero, FilterBar et
// Grid lisent les mêmes paramètres via useMarketFilters → tout reste
// synchronisé sans prop drilling.
//
// Cold start (Phase 2) : si pas de canton dans l'URL → banner onboarding
// "Où cherchez-vous ?". Si l'user a déjà choisi un canton dans une session
// passée (localStorage), on lui propose en un clic. La sélection (URL ou
// banner) écrit dans localStorage pour la prochaine visite.
//
// Le prop `context` filtre par transaction_type :
//   - 'buy'  → biens à vendre  → route /acheter
//   - 'rent' → biens à louer    → route /louer

import { useEffect } from 'react'
import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxListingsHero from '@/components/propertyx/sections/PxListingsHero'
import PxListingsFilterBar from '@/components/propertyx/sections/PxListingsFilterBar'
import PxListingsGrid from '@/components/propertyx/sections/PxListingsGrid'
import PxLocationOnboarding from '@/components/propertyx/sections/PxLocationOnboarding'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { useMarketFilters } from '@/hooks/useMarketFilters'
import { useLocationPreference } from '@/hooks/useLocationPreference'

interface PropertyXListingsPageProps {
  context?: 'buy' | 'rent'
}

/**
 * Sync URL canton → localStorage : dès que l'user pose un canton (via la
 * FilterBar, le banner, ou un deep-link), on persiste son choix pour la
 * prochaine visite. Isolé dans un sous-composant pour profiter du même
 * `useMarketFilters` que les autres lecteurs (cohérent avec useSearchParams).
 */
function LocationSyncer({ context }: { context: 'buy' | 'rent' }) {
  const { filters } = useMarketFilters(context)
  const { saved, setSaved } = useLocationPreference()

  useEffect(() => {
    if (filters.canton && filters.canton !== saved?.canton) {
      setSaved(filters.canton)
    }
  }, [filters.canton, saved?.canton, setSaved])

  return null
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
      <LocationSyncer context={context} />
      <PxNav />
      <PxListingsHero context={context} />
      {/* Padding-top : laisse l'espace pour le débordement de la search bar
          (position absolute top: 383 dans le hero). */}
      <div style={{ paddingTop: 80, paddingBottom: 16, background: PX.neutral200 }}>
        <PxLocationOnboarding context={context} />
      </div>
      <div style={{ paddingTop: 0, paddingBottom: 16, background: PX.neutral200 }}>
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
