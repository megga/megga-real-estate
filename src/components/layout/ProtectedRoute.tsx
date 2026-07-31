/**
 * Garde de route de toute surface `/dashboard/*`. Enchaîne les gates dans
 * l'ordre : session en cours de résolution → non authentifié (redirige vers
 * megga.ch/connexion) → consentements nLPD (`ConsentGate`), puis rend le contenu
 * protégé. (L'ancien gate onboarding/premier-jour a été retiré : l'agence est
 * désormais auto-provisionnée au signup — migration 20260718130000.)
 */
import { Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'
import BootSplash from '@/components/layout/BootSplash'
import BootCurtain, { CurtainLift } from '@/components/layout/BootCurtain'
import ConsentGate from '@/components/layout/ConsentGate'
import SmartPageLoader from '@/components/skeletons/SmartPageLoader'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/** Applique la chaîne de gates puis rend `children` (enveloppés du gate consentement). */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  // 1. Session encore en cours de résolution → pas de flash de contenu protégé.
  //    `loading` ne vaut true qu'au démarrage à froid de l'app (AuthProvider ne
  //    se remonte pas à la navigation) : c'est donc exactement l'arrivée sur le
  //    CRM, et l'écran d'arrivée y prolonge sans coupure celui d'index.html.
  if (loading) {
    return <BootSplash />
  }

  // 2. Non authentifié → connexion sur la VITRINE (megga.ch/connexion, câblé
  //    Supabase). Le modal de connexion interne (ancienne direction) a été
  //    retiré ; le retour se fait via /auth/callback. (En bypass dev,
  //    user = MOCK_USER, donc on n'est jamais redirigé à tort.)
  //    On tient l'écran d'arrivée pendant le rebond plutôt que de rendre `null` :
  //    la vitrine est sombre elle aussi, donc la bascule ne montre plus de blanc.
  if (!user) {
    if (typeof window !== 'undefined') window.location.replace('https://megga.ch/connexion')
    return <BootSplash />
  }

  // 3. Gate consentements nLPD (modal bloquante si les versions courantes des
  //    CGU/confidentialité n'ont pas été acceptées — preuve en user_consents),
  //    puis le contenu protégé sous le rideau d'arrivée.
  //
  //    La frontière Suspense est LOCALE et non celle d'App : le rideau doit lui
  //    survivre (posé en frère, hors de la frontière) pendant que les chunks du
  //    CRM se chargent. `<CurtainLift>` est à l'intérieur — son montage signale
  //    que plus rien ne suspend, donc que la page est réellement rendue.
  return (
    <>
      <Suspense fallback={<SmartPageLoader />}>
        <ConsentGate>{children}</ConsentGate>
        <CurtainLift />
      </Suspense>
      <BootCurtain />
    </>
  )
}
