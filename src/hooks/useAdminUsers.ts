/**
 * Hooks super-admin — annuaire des utilisateurs de la plateforme.
 *
 * `useAdminUsers` liste tous les profils (nom d'agence résolu) et expose la
 * mutation de rôle via RPC `admin_set_user_role`. `useUserActivity` charge les
 * 10 derniers événements d'audit d'un utilisateur ; `useDsarExport` télécharge
 * l'export DSAR (nLPD art. 25) journalisé côté serveur.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminUser {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: string
  phone: string | null
  created_at: string
  agency_id: string | null
  agency_name: string | null
  is_suspended: boolean
  /** Dernière activité (`activity_events`), null si le compte n'en a aucune. */
  last_activity_at: string | null
  /** Jours révolus depuis la dernière activité ; null sans activité (§5.4). */
  stale_days: number | null
  /** Invité mais jamais connecté (`team_invitations` pending, C3). */
  never: boolean
  /** Consentements : type × version × date (`user_consents`). */
  consents: Array<{ type: string; version: string; accepted_at: string }>
  /** Marketing = présence d'une ligne de consentement (§5.4). */
  marketing: boolean
}

/** Ligne brute de `get_admin_users()`. Re-typée à la main NON par absence des types
 *  générés — la RPC y est entrée avec #1064 — mais parce que le générateur perd la
 *  NULLABILITÉ des colonnes d'un `returns table` : il déclare `agency`, `phone` et
 *  `deleted_at` non-nullables, alors qu'elles sont nulles en prod (mesuré le 02.08.2026 :
 *  respectivement 2, 6 et 7 profils sur 7), et il rend `consents` en `Json` opaque. Le
 *  type ci-dessous est donc le plus vrai des deux. */
interface AdminUserRow {
  id: string; name: string | null; email: string; phone: string | null; role: string
  agency_id: string | null; agency: string | null; since: string; last: string | null
  stale_days: number | null; suspended: boolean; deleted_at: string | null
  never: boolean; invited_at: string | null; marketing: boolean
  consents: Array<{ type: string; version: string; accepted_at: string }>
  avatar_url: string | null
}

/** Liste des profils (récents d'abord) avec nom d'agence résolu, plus la mutation de rôle (RPC super-admin). */
export function useAdminUsers() {
  const queryClient = useQueryClient()

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<AdminUser[]> => {
      // Étape 15 : UN appel là où il en fallait deux (profiles, puis agencies pour
      // résoudre les noms). La RPC joint côté serveur et apporte en plus les champs de
      // §5.4 que ce registre ne savait pas afficher : dernière activité, ancienneté
      // d'inactivité, « invité jamais connecté » et consentements.
      const { data, error } = await supabase.rpc('get_admin_users', { p_limit: 2000, p_offset: 0 })
      if (error) throw error

      return ((data ?? []) as AdminUserRow[]).map(u => ({
        id: u.id,
        full_name: u.name ?? '',
        email: u.email,
        avatar_url: u.avatar_url,
        role: u.role,
        phone: u.phone,
        created_at: u.since,
        agency_id: u.agency_id,
        agency_name: u.agency,
        is_suspended: u.suspended,
        last_activity_at: u.last,
        stale_days: u.stale_days === null ? null : Number(u.stale_days),
        never: u.never,
        consents: u.consents ?? [],
        marketing: u.marketing,
      }))
    },
    staleTime: 30_000,
  })

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      // profiles.role is no longer writable by the client — goes through the
      // admin_set_user_role SECURITY DEFINER RPC (guarded by is_super_admin()).
      const { error } = await supabase.rpc('admin_set_user_role', { p_user_id: id, p_role: role })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return {
    users: users.data ?? [],
    isLoading: users.isLoading,
    isError: users.isError,
    refetch: users.refetch,
    updateRole,
  }
}

/** 10 derniers événements d'audit (`activity_events`) émis par un utilisateur donné. */
export function useUserActivity(userId: string) {
  return useQuery({
    queryKey: ['admin-user-activity', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, metadata, created_at')
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

// Export DSAR (nLPD art. 25) — télécharge le JSON agrégé produit par l'edge
// admin-dsar-export (l'export est journalisé côté serveur AVANT le retour).
export function useDsarExport() {
  return useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-dsar-export', {
        body: { user_id: userId },
      })
      if (error) throw error
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toLocaleDateString('fr-CH').replace(/\//g, '.')
      a.href = url
      a.download = `dsar-${email.replace(/[^a-z0-9.@-]/gi, '_')}-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
  })
}
