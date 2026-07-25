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
 * Résout l'accès super-admin côté UI. Le rôle du profil sert de pré-filtre
 * (aucun aller-retour pour les agents) ; la RPC tranche.
 */
export function useSuperAdminGate(): SuperAdminGateState {
  const { user, profile, loading } = useAuth()
  const roleOk = profile?.role === 'super_admin'

  const { data, isPending } = useQuery({
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

  if (DEV_BYPASS) return { checking: loading, allowed: !loading && roleOk }
  if (loading) return { checking: true, allowed: false }
  // Sans le rôle, la requête est désactivée : inutile d'attendre sa résolution.
  if (!roleOk) return { checking: false, allowed: false }

  return { checking: isPending, allowed: data === true }
}
