// MEGGA CRM — Appareils & sessions de l'utilisateur courant.
//
// Câblage RÉEL (aucune migration) : table `user_devices` (RLS SELECT + DELETE
// self déjà en place, alimentée par l'Edge Function detect-new-device au login).
//
// Limites assumées (passe ultérieure) :
//   - « Appareil courant » : sans empreinte stable côté client, on marque comme
//     courant la ligne la plus récente (last_seen_at max). C'est une heuristique
//     d'affichage, pas une garantie cryptographique.
//   - « Déconnecter » invalide la vraie session GoTrue distante via l'edge
//     function revoke-device-session (RPC service_role revoke_user_session sur
//     auth.sessions), puis retire la ligne. Limite Supabase assumée : coupe le
//     REFRESH ; l'access token déjà émis reste valide jusqu'à son exp (~1h).

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface UserDevice {
  id: string
  user_agent: string | null
  browser: string | null
  os: string | null
  ip: string | null
  country: string | null
  city: string | null
  trusted: boolean
  first_seen_at: string
  last_seen_at: string
}

interface UserDevicesState {
  devices: UserDevice[]
  isLoading: boolean
  /** Révoque la vraie session (edge revoke-device-session) puis retire la ligne. */
  revoke: (id: string) => Promise<void>
  /** Id de l'appareil considéré comme « courant » (last_seen_at max). */
  currentId: string | null
  error: string | null
}

const COLS = 'id,user_agent,browser,os,ip,country,city,trusted,first_seen_at,last_seen_at'

/**
 * Charge les appareils/sessions de l'utilisateur courant (`user_devices`, RLS self).
 * `revoke` invalide la vraie session GoTrue via l'edge `revoke-device-session`
 * (retrait optimiste, rollback par rechargement si l'appel échoue).
 */
export function useUserDevices(): UserDevicesState {
  const [devices, setDevices] = useState<UserDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) {
        setDevices([])
        setCurrentId(null)
        return
      }
      const { data, error: selErr } = await supabase
        .from('user_devices')
        .select(COLS)
        .eq('user_id', uid)
        .order('last_seen_at', { ascending: false })
      if (selErr) throw selErr
      const rows = (data ?? []) as UserDevice[]
      setDevices(rows)
      // Heuristique « appareil courant » : ligne la plus récemment vue.
      setCurrentId(rows[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des appareils')
      setDevices([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const revoke = useCallback(async (id: string) => {
    // Optimiste : on retire la ligne de l'UI, puis on confirme côté DB.
    setDevices(prev => prev.filter(d => d.id !== id))
    try {
      // Révocation RÉELLE : l'edge function invalide la session GoTrue (coupe le
      // refresh) puis retire la ligne. Remplace l'ancien delete direct qui ne
      // coupait que le suivi. cf. supabase/functions/revoke-device-session.
      const { error: fnErr } = await supabase.functions.invoke('revoke-device-session', {
        body: { device_id: id },
      })
      if (fnErr) throw fnErr
    } catch (err) {
      // Rollback en rechargeant la vérité serveur si la révocation échoue.
      setError(err instanceof Error ? err.message : 'Échec de la révocation')
      await load()
    }
  }, [load])

  return { devices, isLoading, revoke, currentId, error }
}
