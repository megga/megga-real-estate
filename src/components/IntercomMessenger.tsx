// src/components/IntercomMessenger.tsx
// Monte le Messenger Intercom globalement (au root de App, dans AuthProvider).
//
// - Anonyme tant que personne n'est connecté (pages publiques de l'app : /help…).
// - Identifié dès qu'un agent est connecté (user_id + user_hash HMAC via l'edge
//   `intercom-identity`) + company (agence) + attributs de support.
// - JAMAIS identifié pendant une impersonation super-admin (sinon pollution Intercom
//   + faux contact facturé + fuite d'identité). cf. useImpersonate.
//
// No-op complet si `VITE_INTERCOM_APP_ID` est absent (cf. src/lib/intercom.ts).
import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useImpersonate } from '@/hooks/useImpersonate'
import { supabase } from '@/lib/supabase'
import { bootIntercom, shutdownIntercom, isIntercomEnabled } from '@/lib/intercom'

async function fetchUserJwt(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('intercom-identity')
    if (error) return null
    return (data as { intercom_user_jwt?: string } | null)?.intercom_user_jwt ?? null
  } catch {
    return null
  }
}

export default function IntercomMessenger() {
  const { user, profile, loading } = useAuth()
  const { impersonating } = useImpersonate()
  // Évite les re-boots inutiles + protège du double-mount StrictMode.
  const bootedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!isIntercomEnabled() || loading) return

    const identified = !!(user && profile && !impersonating)
    const identityKey = identified ? `user:${user!.id}` : 'anon'
    if (bootedFor.current === identityKey) return

    let cancelled = false

    async function run() {
      if (identified && user && profile) {
        const jwt = await fetchUserJwt()
        if (cancelled) return
        // stripe_customer_id de l'agence (best-effort, null-safe) → permettra à une
        // future action Fin « facturation » de scoper sur le bon client Stripe.
        // RLS: un membre lit la ligne de SON agence (agencies_members_select).
        let stripeCustomerId: string | null = null
        if (profile.agency_id) {
          const { data: agencyRow } = await supabase
            .from('agencies')
            .select('stripe_customer_id')
            .eq('id', profile.agency_id)
            .maybeSingle()
          if (cancelled) return
          stripeCustomerId = agencyRow?.stripe_customer_id ?? null
        }
        shutdownIntercom() // referme une éventuelle session anonyme avant d'identifier
        bootIntercom({
          user_id: user.id,
          email: profile.email ?? user.email ?? undefined,
          name: profile.full_name ?? undefined,
          created_at: profile.created_at
            ? Math.floor(new Date(profile.created_at).getTime() / 1000)
            : undefined,
          intercom_user_jwt: jwt ?? undefined,
          company: profile.agency_id
            ? {
                company_id: profile.agency_id,
                ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
              }
            : undefined,
          role: profile.role ?? undefined,
          canton: profile.canton ?? undefined,
          onboarding_completed: profile.onboarding_completed ?? undefined,
        })
      } else {
        shutdownIntercom()
        bootIntercom() // anonyme
      }
      if (!cancelled) bootedFor.current = identityKey
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [user, profile, loading, impersonating])

  return null
}
