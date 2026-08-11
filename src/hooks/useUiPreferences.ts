// MEGGA CRM Sugar v2 — Préférences UI agent (langue, fuseau, thème, etc.).
// Lit/écrit le sous-objet `ui` dans `profiles.preferences` (JSON).
// Coexiste avec tout futur sous-objet de `profiles.preferences` — et avec
// `notifications`, resté en base après le retrait de sa section (11 août 2026)
// puisque plus aucun code ne l'écrit ni ne le lit.

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { PrefsData } from '@/components/crm-sugar/settings/PreferencesSection.types'

const DEFAULT_PREFS: PrefsData = {
  language: 'fr',
  timezone: 'Europe/Zurich',
  currency: 'CHF',
  units: 'metric',
  dateFormat: 'dd.MM.yyyy',
  firstDayOfWeek: 'monday',
  defaultScreen: 'today',
  defaultPipelineView: 'kanban',
  density: 'comfort',
  theme: 'system',
  accent: 'black',
  spellcheck: true,
  autosave: true,
  aiAssist: 'balanced',
  aiTone: 'neutre',
}

interface ProfilePrefsRow {
  preferences: Record<string, unknown> | null
}

export interface UseUiPreferencesReturn {
  preferences: PrefsData
  isLoading: boolean
  isSaving: boolean
  hasBackend: boolean
  save: (next: PrefsData) => Promise<void>
}

/**
 * Lit/écrit les préférences UI de l'agent (sous-objet `ui` de `profiles.preferences`).
 * `save` fait un read-modify-write pour préserver les autres sous-clés (notifications…).
 * `hasBackend` reste `false` tant que le profil n'est pas chargé.
 */
export function useUiPreferences(): UseUiPreferencesReturn {
  const { profile } = useAuth()
  const profileId = profile?.id
  const queryClient = useQueryClient()
  const [local, setLocal] = useState<PrefsData>(DEFAULT_PREFS)

  const { data, isLoading } = useQuery({
    queryKey: ['ui-prefs', profileId],
    queryFn: async (): Promise<PrefsData> => {
      if (!profileId) return DEFAULT_PREFS
      const { data: row, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', profileId)
        .maybeSingle<ProfilePrefsRow>()
      if (error) throw error
      const prefs = row?.preferences ?? {}
      const ui = (prefs as { ui?: Partial<PrefsData> }).ui ?? {}
      return { ...DEFAULT_PREFS, ...ui }
    },
    enabled: !!profileId,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (data) setLocal(data)
  }, [data])

  const mutation = useMutation({
    mutationFn: async (next: PrefsData) => {
      if (!profileId) throw new Error('Profil non chargé')
      // Read-modify-write — préserve les autres sous-clés (notifications, etc.)
      const { data: row, error: readErr } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', profileId)
        .single<ProfilePrefsRow>()
      if (readErr) throw readErr
      const prefs = row?.preferences ?? {}
      const updated = { ...prefs, ui: next }
      const { error: writeErr } = await supabase
        .from('profiles')
        .update({ preferences: updated as unknown as import('@/types/database').Json })
        .eq('id', profileId)
      if (writeErr) throw writeErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ui-prefs', profileId] })
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
