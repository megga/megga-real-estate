import { useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import BootSplash from '@/components/layout/BootSplash'

/**
 * `<SmartPageLoader>` is the Suspense fallback for the entire app. It uses
 * the current URL to render a route-appropriate skeleton instead of the
 * generic spinner the app used previously.
 *
 * Why per-route:
 *   - During the 200–1500 ms lazy-chunk download, the eye has time to
 *     recognize layout. A skeleton matching the destination route
 *     reduces perceived load time and increases premium feel (Linear /
 *     Notion / Vercel pattern).
 *   - Generic spinner ≈ "site is broken / slow" feeling.
 *   - Route-specific skeleton ≈ "the listings page is loading, I'm
 *     in the right place".
 *
 * The skeletons themselves are lazy-loaded so they don't bloat the main
 * bundle — they only ship if a Suspense boundary actually needs them.
 *
 * Fallback: any route not matched by the routing rules below still shows
 * the original spinner (`<DefaultLoader>`).
 */

const MarketplaceListingsSkeleton = lazy(
  () => import('@/components/skeletons/MarketplaceListingsSkeleton'),
)
const PropertyDetailSkeleton = lazy(
  () => import('@/components/skeletons/PropertyDetailSkeleton'),
)
const DashboardSkeleton = lazy(
  () => import('@/components/skeletons/DashboardSkeleton'),
)

/** Spinner générique — fallback pour toute route sans skeleton dédié. */
function DefaultLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-5 w-5 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
    </div>
  )
}

export default function SmartPageLoader() {
  const { pathname } = useLocation()

  // Trajet post-connexion (retour de megga.ch/login) : on prolonge l'écran
  // d'arrivée plutôt que d'ouvrir un spinner nu, sinon le fond blanc réapparaît
  // le temps de télécharger le chunk AuthCallbackPage. Volontairement HORS du
  // Suspense ci-dessous et non lazy : un écran d'arrivée qui attendrait son
  // propre chunk raterait précisément le moment qu'il doit couvrir.
  if (pathname === '/' || pathname === '/auth/callback') {
    return <BootSplash />
  }

  const skeleton = (() => {
    // Marketplace listings (highest-traffic public routes)
    if (pathname === '/rent' || pathname === '/buy') {
      return <MarketplaceListingsSkeleton />
    }
    // Property detail (both legacy and Property X variants)
    if (pathname.startsWith('/propriete') || pathname.startsWith('/listing/')) {
      return <PropertyDetailSkeleton />
    }
    // Agent CRM (any /dashboard sub-route)
    if (pathname.startsWith('/dashboard')) {
      return <DashboardSkeleton />
    }
    return <DefaultLoader />
  })()

  // The skeletons themselves are lazy — wrap in a nested Suspense whose
  // fallback is the default spinner. On a fast network the skeleton chunk
  // resolves before the user sees the spinner; on slow networks the spinner
  // appears for ~50 ms then the skeleton takes over.
  return <Suspense fallback={<DefaultLoader />}>{skeleton}</Suspense>
}
