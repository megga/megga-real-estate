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
// Vue Liste / Split / Carte (Phase 4) : toggle dans la FilterBar, état dans
// l'URL via `?view=`. Le mode 'split' est désactivé sous 1024px (le défaut
// y est 'list'). La carte est sticky dans le viewport quand visible.
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
import PxListingsMap from '@/components/propertyx/sections/PxListingsMap'
import PxListingsViewToggle, {
  useViewMode,
} from '@/components/propertyx/sections/PxListingsViewToggle'
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

/**
 * Section résultats : toggle vue + grid/map selon le mode.
 *
 * Layout :
 *   - 'list' : grid pleine largeur
 *   - 'map' : carte plein écran (h = 80vh)
 *   - 'split' : grid 50% / carte 50% sticky (uniquement >= 1024px)
 */
function ResultsSection({ context }: { context: 'buy' | 'rent' }) {
  const { mode, setMode } = useViewMode()

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        background: PX.neutral200,
        paddingBottom: 160,
      }}
    >
      {/* Toggle bar — aligné avec le max-width de la grid */}
      <div
        style={{
          width: '100%',
          maxWidth: 1392,
          margin: '0 auto',
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 24,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <PxListingsViewToggle mode={mode} onChange={setMode} />
      </div>

      {mode === 'list' && <PxListingsGrid context={context} layout="full" />}

      {mode === 'map' && (
        <div
          style={{
            width: '100%',
            maxWidth: 1392,
            margin: '0 auto',
            padding: '24px 24px 0',
            height: 'min(80vh, 880px)',
          }}
        >
          <PxListingsMap context={context} />
        </div>
      )}

      {mode === 'split' && (
        <div
          style={{
            width: '100%',
            maxWidth: 1392,
            margin: '0 auto',
            padding: '24px 24px 0',
            display: 'flex',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: '1 1 50%', minWidth: 0 }}>
            <PxListingsGrid context={context} layout="compact" />
          </div>
          <div
            style={{
              flex: '1 1 50%',
              position: 'sticky',
              top: 16,
              height: 'calc(100vh - 32px)',
              minWidth: 0,
            }}
          >
            <PxListingsMap context={context} />
          </div>
        </div>
      )}
    </div>
  )
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
      <ResultsSection context={context} />
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
