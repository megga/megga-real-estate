// Gate d'accès à la console super-admin (frontend, UX seulement — le mur réel
// est en DB : is_super_admin() + allowlist, et sur les edges : require-super-admin).
//
// La vérification est DÉLÉGUÉE à la DB : `supabase.rpc('is_super_admin')`
// renvoie rôle ET email allowlisté (migration 20260705160000), pour le SEUL
// appelant. L'ancienne allowlist embarquée (src/lib/superAdmin.ts) expédiait
// deux adresses personnelles dans le bundle public ; la RPC ne divulgue rien
// et ne peut plus diverger de la source SQL.

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

// Bypass dev (playwright.admin.config, VITE_DEV_BYPASS_ROLE=super_admin) : le
// profil est un mock sans session Supabase, la RPC répondrait donc toujours
// faux. Même garde-fou que useAuth — inopérant en prod (import.meta.env.DEV).
const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

export interface SuperAdminGateState {
  /** Résolution en cours (profil ou RPC) — ne rien rendre pendant ce temps. */
  checking: boolean
  /** Rôle super_admin confirmé par la DB. */
  allowed: boolean
}

/**
 * Décide de l'état du gate. Isolée du hook pour être testable sans React ni
 * réseau — c'est ici que vit la règle, pas dans le câblage.
 *
 * Le rôle décide de l'AFFICHAGE ; la RPC ne sert qu'à RETIRER l'entrée quand
 * elle répond explicitement `false` (rôle posé sur un email hors allowlist).
 *
 * Ne pas conditionner l'affichage à la réussite de l'aller-retour : ce gate est
 * UX, le mur est en DB (RLS + is_super_admin) et sur les edges. Attendre la
 * réponse créait un mode de panne silencieux — un hoquet réseau, une RPC
 * momentanément indisponible, et l'entrée disparaissait DÉFINITIVEMENT du menu
 * (`retry: false`), sans rien afficher pour l'expliquer : un super-admin ne
 * pouvait plus atteindre la console alors qu'il en avait le droit.
 */
export function resolveSuperAdminGate(input: {
  loading: boolean
  roleOk: boolean
  /** Verdict de la RPC : `undefined` tant qu'elle n'a pas répondu (ou a échoué). */
  rpc: boolean | undefined
  devBypass?: boolean
}): SuperAdminGateState {
  const { loading, roleOk, rpc, devBypass = false } = input
  if (devBypass) return { checking: loading, allowed: !loading && roleOk }
  if (loading) return { checking: true, allowed: false }
  // Sans le rôle, la requête est désactivée : inutile d'attendre sa résolution.
  if (!roleOk) return { checking: false, allowed: false }
  return { checking: false, allowed: rpc !== false }
}

/** Résout l'accès super-admin côté UI (cf. `resolveSuperAdminGate` pour la règle). */
export function useSuperAdminGate(): SuperAdminGateState {
  const { user, profile, loading } = useAuth()
  const roleOk = profile?.role === 'super_admin'

  const { data } = useQuery({
    queryKey: ['is-super-admin', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_super_admin')
      if (error) throw error
      return data === true
    },
    enabled: !loading && roleOk && !DEV_BYPASS,
    staleTime: 5 * 60_000,
    retry: false,
  })

  return resolveSuperAdminGate({ loading, roleOk, rpc: data, devBypass: DEV_BYPASS })
}
