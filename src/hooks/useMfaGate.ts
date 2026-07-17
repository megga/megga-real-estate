import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Gate AAL2 du login (step-up 2FA) — N'INTERVIENT PAS dans le modèle de connexion.
//
// Quand un agent connecté est en AAL1 mais possède un facteur TOTP vérifié, il
// doit saisir son code (carte 'mfa' du même écran auth-bento) avant d'entrer
// dans le CRM. `getAuthenticatorAssuranceLevel()` lit le JWT en mémoire (pas un
// appel réseau). On mémoïse « gate franchi » par user.id pour ne pas re-checker
// à chaque changement de layout ; on invalide le cache à la déconnexion (un
// re-login redéclenche donc bien le step-up).

let satisfiedFor: string | null = null

// Listener indépendant (ne touche pas useAuth) : à la déconnexion, on oublie le
// cache pour que le prochain login repasse par le gate.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') satisfiedFor = null
})

export interface MfaGateState {
  /** Résolution du niveau AAL en cours (évite un flash du contenu protégé). */
  checking: boolean
  /** L'utilisateur doit valider son code 2FA avant d'accéder au CRM. */
  needsMfa: boolean
  /** Re-évalue le niveau AAL (appelé après une vérification réussie). */
  recheck: () => void
}

/**
 * Gate step-up AAL2 : indique si l'agent connecté (AAL1 avec facteur TOTP vérifié)
 * doit saisir son code 2FA avant d'entrer dans le CRM. Le passage est mémoïsé par
 * `userId` (cache module) ; en cas d'absence de session réelle ou d'erreur, ne bloque pas.
 */
export function useMfaGate(userId: string | null | undefined): MfaGateState {
  const cached = !!userId && satisfiedFor === userId
  const [checking, setChecking] = useState<boolean>(!cached && !!userId)
  const [needsMfa, setNeedsMfa] = useState(false)

  const run = useCallback(async () => {
    if (!userId) {
      setChecking(false)
      setNeedsMfa(false)
      return
    }
    if (satisfiedFor === userId) {
      setChecking(false)
      setNeedsMfa(false)
      return
    }
    setChecking(true)
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      const needs = data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2'
      if (needs) {
        setNeedsMfa(true)
      } else {
        satisfiedFor = userId
        setNeedsMfa(false)
      }
    } catch {
      // Pas de vraie session (ex. bypass dev) ou MFA indispo → on NE bloque PAS.
      satisfiedFor = userId
      setNeedsMfa(false)
    } finally {
      setChecking(false)
    }
  }, [userId])

  useEffect(() => {
    void run()
  }, [run])

  return { checking, needsMfa, recheck: run }
}
