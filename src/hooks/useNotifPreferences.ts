// MEGGA CRM Sugar v2 — Préférences de notifications agent.
// Lit/écrit le sous-objet `notifications` dans `profiles.preferences` (JSON).
// Coexiste avec les autres préférences UI (accent color, density, etc.) qui
// utilisent la même colonne.

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface NotifPreferences {
  email: boolean
  sms: boolean
  messages: boolean
  inapp: boolean
}

const DEFAULT_NOTIFS: NotifPreferences = {
  email: true,
  sms: true,
  messages: true,
  inapp: true,
}

interface ProfilePrefsRow {
  preferences: Record<string, unknown> | null
}

export interface UseNotifPreferencesReturn {
  preferences: NotifPreferences
  isLoading: boolean
  isSaving: boolean
  hasBackend: boolean
  save: (next: NotifPreferences) => Promise<void>
}

export function useNotifPreferences(): UseNotifPreferencesReturn {
  const { profile } = useAuth()
  const profileId = profile?.id
  const queryClient = useQueryClient()
  const [local, setLocal] = useState<NotifPreferences>(DEFAULT_NOTIFS)

  const { data, isLoading } = useQuery({
    queryKey: ['notif-prefs', profileId],
    queryFn: async (): Promise<NotifPreferences> => {
      if (!profileId) return DEFAULT_NOTIFS
      const { data: row, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', profileId)
        .maybeSingle<ProfilePrefsRow>()
      if (error) throw error
      const prefs = row?.preferences ?? {}
      const notifs = (prefs as { notifications?: Partial<NotifPreferences> }).notifications ?? {}
      return { ...DEFAULT_NOTIFS, ...notifs }
    },
    enabled: !!profileId,
    staleTime: 60_000,
  })

  // Sync data → local quand le serveur répond
  useEffect(() => {
    if (data) setLocal(data)
  }, [data])

  const mutation = useMutation({
    mutationFn: async (next: NotifPreferences) => {
      if (!profileId) throw new Error('Profil non chargé')
      // Read-modify-write : on récupère prefs existantes pour ne pas écraser
      // les autres sous-clés (accent color, density, etc.).
      const { data: row, error: readErr } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', profileId)
        .single<ProfilePrefsRow>()
      if (readErr) throw readErr
      const prefs = row?.preferences ?? {}
      const updated = { ...prefs, notifications: next }
      const { error: writeErr } = await supabase
        .from('profiles')
        .update({ preferences: updated as unknown as import('@/types/database').Json })
        .eq('id', profileId)
      if (writeErr) throw writeErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notif-prefs', profileId] })
    },
  })

  return {
    preferences: local,
    isLoading,
    isSaving: mutation.isPending,
    hasBackend: !!profileId,
    save: async (next) => { await mutation.mutateAsync(next) },
  }
}
