import { useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import BootSplash from '@/components/layout/BootSplash'

/**
 * `<SmartPageLoader>` est le fallback Suspense de l'app : il choisit, d'après
 * l'URL, un écran d'attente qui ressemble à la page qui arrive plutôt qu'un
 * spinner nu.
 *
 * Pourquoi par route : pendant les 200-1500 ms de téléchargement du chunk,
 * l'œil a le temps de reconnaître une mise en page. Un squelette au bon gabarit
 * dit « la bonne page charge » ; un spinner dit « le site est cassé ».
 *
 * ⚠ `/dashboard` recouvre DEUX chromes différents (deux routes parentes dans
 * App.tsx) — d'où l'aiguillage `isLegacyChrome()` ci-dessous. Servir le mauvais
 * des deux fait exactement le défaut qu'on cherche à éviter : un écran d'attente
 * qui n'a aucun rapport avec la page qui suit.
 *
 * Les squelettes sont eux-mêmes lazy pour ne pas alourdir le bundle d'entrée :
 * ils ne sont téléchargés que si une frontière Suspense en a besoin.
 *
 * Repli : toute route sans squelette dédié garde le spinner (`<DefaultLoader>`).
 */

const DashboardSkeleton = lazy(
  () => import('@/components/skeletons/DashboardSkeleton'),
)
const SugarPageSkeleton = lazy(
  () => import('@/components/skeletons/SugarPageSkeleton'),
)

/** Spinner générique — fallback pour toute route sans squelette dédié. */
function DefaultLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-5 w-5 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
    </div>
  )
}

/**
 * Routes `/dashboard` encore rendues par `AgentLayout` (vraie sidebar + header),
 * par opposition aux surfaces Sugar qui portent leur propre chrome. Liste tenue
 * à la main car les deux routes parentes partagent le préfixe `/dashboard` —
 * voir la seconde `<Route path="/dashboard">` d'App.tsx.
 *
 * Piège de préfixe : `listings` et `listings/:id` sont Sugar, mais
 * `listings/new` et `listings/:id/edit` sont AgentLayout.
 */
function isLegacyChrome(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard/admin')
    || pathname === '/dashboard/contacts/import'
    || pathname === '/dashboard/listings/new'
    || /^\/dashboard\/listings\/[^/]+\/edit$/.test(pathname)
    || pathname.startsWith('/dashboard/market/')
    || pathname.startsWith('/dashboard/marche/')
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

  const skeleton = pathname.startsWith('/dashboard')
    ? (isLegacyChrome(pathname) ? <DashboardSkeleton /> : <SugarPageSkeleton />)
    : <DefaultLoader />

  // Les squelettes sont lazy — on les enveloppe d'un Suspense imbriqué dont le
  // fallback est le spinner. Sur un réseau rapide le chunk arrive avant que le
  // spinner ne soit perceptible ; sur un réseau lent il tient ~50 ms puis cède.
  return <Suspense fallback={<DefaultLoader />}>{skeleton}</Suspense>
}
