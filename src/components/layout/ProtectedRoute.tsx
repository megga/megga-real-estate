/**
 * Garde de route de toute surface `/dashboard/*`. Enchaîne les gates dans
 * l'ordre : session en cours de résolution → non authentifié (redirige vers
 * megga.ch/login) → consentements nLPD (`ConsentGate`), puis rend le contenu
 * protégé. (L'ancien gate onboarding/premier-jour a été retiré : l'agence est
 * désormais auto-provisionnée au signup — migration 20260718130000.)
 */
import { useAuth } from '@/hooks/useAuth'
import ConsentGate from '@/components/layout/ConsentGate'
import SmartPageLoader from '@/components/skeletons/SmartPageLoader'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/** Applique la chaîne de gates puis rend `children` (enveloppés du gate consentement). */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  // 1. Session encore en cours de résolution → pas de flash de contenu protégé.
  if (loading) {
    return <SmartPageLoader />
  }

  // 2. Non authentifié → connexion sur la VITRINE (megga.ch/login, câblé
  //    Supabase). Le modal de connexion interne (ancienne direction) a été
  //    retiré ; le retour se fait via /auth/callback. (En bypass dev,
  //    user = MOCK_USER, donc on n'est jamais redirigé à tort.)
  if (!user) {
    if (typeof window !== 'undefined') window.location.replace('https://megga.ch/login')
    return null
  }

  // 3. Gate consentements nLPD (modal bloquante si les versions courantes des
  //    CGU/confidentialité n'ont pas été acceptées — preuve en user_consents).
  return <ConsentGate>{children}</ConsentGate>
}
