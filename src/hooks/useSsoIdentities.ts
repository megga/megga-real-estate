// MEGGA CRM — Identités SSO liées (Google / Microsoft) via Supabase Auth.
//
// Câblage RÉEL (aucune migration) : les identités liées vivent dans le système
// d'auth de Supabase (auth.identities), pas dans une table applicative.
//   - getUserIdentities()      → liste des providers liés (google, azure…)
//   - linkIdentity({provider}) → démarre l'OAuth de liaison (redirect)
//   - unlinkIdentity(identity) → délie un provider
//
// Supabase nomme Microsoft/Outlook « azure » en interne — on mappe l'UI
// ('microsoft') vers 'azure' pour les appels d'auth.
//
// Si « Manual linking » est désactivé côté projet, linkIdentity renvoie une
// erreur : on l'expose proprement (message FR) plutôt que de planter.

import { useCallback, useEffect, useState } from 'react'
import type { UserIdentity } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** Providers exposés par l'UI Sécurité. */
export type SsoProvider = 'google' | 'microsoft'

/** Mappe le provider UI vers le nom interne Supabase. */
const SUPA_PROVIDER: Record<SsoProvider, 'google' | 'azure'> = {
  google: 'google',
  microsoft: 'azure',
}

interface SsoIdentitiesState {
  identities: UserIdentity[]
  /** Vrai si le provider UI est lié au compte. */
  isLinked: (provider: SsoProvider) => boolean
  /** Email associé à l'identité d'un provider (depuis identity_data), si dispo. */
  emailFor: (provider: SsoProvider) => string | null
  /** Démarre l'OAuth de liaison (redirige hors de l'app). */
  link: (provider: SsoProvider) => Promise<void>
  /** Délie un provider. */
  unlink: (provider: SsoProvider) => Promise<boolean>
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/** Traduit une erreur d'auth Supabase en message FR actionnable (fallback : message brut). */
function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('manual linking') || (m.includes('linking') && m.includes('disabled'))) {
    return "La liaison de comptes n'est pas activée sur ce projet. Contactez votre administrateur."
  }
  if (m.includes('single identity') || m.includes('last identity')) {
    return 'Impossible de délier votre seule méthode de connexion.'
  }
  if (m.includes('already') && m.includes('linked')) return 'Ce compte est déjà lié à un autre utilisateur.'
  return message
}

/** État + actions pour lier/délier les identités SSO (Google/Microsoft) du compte courant. */
export function useSsoIdentities(): SsoIdentitiesState {
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: idErr } = await supabase.auth.getUserIdentities()
      if (idErr) throw idErr
      setIdentities(data?.identities ?? [])
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erreur de chargement des identités'))
      setIdentities([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const findIdentity = useCallback(
    (provider: SsoProvider) => identities.find(i => i.provider === SUPA_PROVIDER[provider]) ?? null,
    [identities],
  )

  const isLinked = useCallback(
    (provider: SsoProvider) => Boolean(findIdentity(provider)),
    [findIdentity],
  )

  const emailFor = useCallback(
    (provider: SsoProvider) => {
      const id = findIdentity(provider)
      const raw = id?.identity_data?.email
      return typeof raw === 'string' ? raw : null
    },
    [findIdentity],
  )

  const link = useCallback(async (provider: SsoProvider) => {
    setError(null)
    try {
      const { error: linkErr } = await supabase.auth.linkIdentity({
        provider: SUPA_PROVIDER[provider],
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (linkErr) throw linkErr
      // En cas de succès, le navigateur est redirigé vers l'OAuth du provider.
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erreur de liaison'))
    }
  }, [])

  const unlink = useCallback(
    async (provider: SsoProvider) => {
      const identity = findIdentity(provider)
      if (!identity) return false
      setError(null)
      setIsLoading(true)
      try {
        const { error: unErr } = await supabase.auth.unlinkIdentity(identity)
        if (unErr) throw unErr
        await refresh()
        return true
      } catch (err) {
        setError(friendlyError(err instanceof Error ? err.message : 'Erreur de déliaison'))
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [findIdentity, refresh],
  )

  return { identities, isLinked, emailFor, link, unlink, isLoading, error, refresh }
}
