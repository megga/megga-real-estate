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
 * Les squelettes sont eux-mêmes lazy pour ne pas alourdir le bundle d'entrée :
 * ils ne sont téléchargés que si une frontière Suspense en a besoin.
 *
 * Repli : toute route sans squelette dédié garde le spinner (`<DefaultLoader>`).
 */

const CrmPageSkeleton = lazy(
  () => import('@/components/skeletons/CrmPageSkeleton'),
)

/** Spinner générique — fallback pour toute route sans squelette dédié. */
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

  // Toutes les surfaces `/dashboard` portent désormais le chrome Sugar : la
  // coquille legacy `AgentLayout` a été retirée, et avec elle la liste de routes
  // tenue à la main qui distinguait les deux squelettes.
  const skeleton = pathname.startsWith('/dashboard')
    ? <CrmPageSkeleton />
    : <DefaultLoader />

  // Les squelettes sont lazy — on les enveloppe d'un Suspense imbriqué dont le
  // fallback est le spinner. Sur un réseau rapide le chunk arrive avant que le
  // spinner ne soit perceptible ; sur un réseau lent il tient ~50 ms puis cède.
  return <Suspense fallback={<DefaultLoader />}>{skeleton}</Suspense>
}
