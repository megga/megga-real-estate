// MEGGA CRM — Disponibilités de l'agent pour l'auto-réservation client.
//
// Lit/écrit `agent_booking_settings` (1 ligne par agent) et `agent_time_off`.
// L'agent écrit DIRECTEMENT via RLS (policies abs_self_write / ato_self_write) :
// aucune RPC ici. Les RPC `SECURITY DEFINER` du module servent le chemin PUBLIC
// (le client anonyme), pas l'agent authentifié.
//
// La forme de `weekly_hours` est validée en base par le trigger
// trg_validate_agent_weekly_hours : plages ordonnées, disjointes, fin > début,
// clés 1..7. Une erreur d'écriture remonte donc telle quelle et doit être
// affichée — c'est le seul retour que l'agent aura sur une grille incohérente.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/** { "1".."7" (ISO, 1 = lundi) : [[HH:MM, HH:MM], …] }, en heure locale du fuseau. */
export type WeeklyHours = Record<string, [string, string][]>

export interface AgentBookingSettings {
  is_open: boolean
  timezone: string
  slot_minutes: number
  buffer_minutes: number
  min_notice_hours: number
  max_advance_days: number
  weekly_hours: WeeklyHours
  location_label: string | null
  default_mode: 'sur_place' | 'video'
}

export interface AgentTimeOff {
  id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

/** Mêmes valeurs que les DEFAULT de la table — l'agent voit ce que la base ferait. */
export const DEFAULT_BOOKING_SETTINGS: AgentBookingSettings = {
  is_open: false,
  timezone: 'Europe/Zurich',
  slot_minutes: 30,
  buffer_minutes: 15,
  min_notice_hours: 24,
  max_advance_days: 30,
  weekly_hours: {},
  location_label: null,
  default_mode: 'sur_place',
}

export interface UseAgentBookingSettingsReturn {
  settings: AgentBookingSettings
  timeOff: AgentTimeOff[]
  isLoading: boolean
  isSaving: boolean
  hasBackend: boolean
  /** Rejette avec le message du trigger si la grille est incohérente. */
  save: (next: AgentBookingSettings) => Promise<void>
  addTimeOff: (input: { starts_at: string; ends_at: string; reason?: string | null }) => Promise<void>
  removeTimeOff: (id: string) => Promise<void>
}

export function useAgentBookingSettings(options?: { enabled?: boolean }): UseAgentBookingSettingsReturn {
  const enabled = options?.enabled ?? true
  const { profile } = useAuth()
  const agentId = profile?.id
  const agencyId = profile?.agency_id
  const queryClient = useQueryClient()

  // Pas de copie locale ici : la section garde SON brouillon (édition composée
  // puis enregistrée d'un bloc). Un miroir dans le hook aurait imposé un
  // `useEffect` de synchronisation — deux états pour une seule vérité, et le
  // classique décalage quand le serveur répond pendant la saisie.
  const settingsQuery = useQuery({
    queryKey: ['agent-booking-settings', agentId],
    queryFn: async (): Promise<AgentBookingSettings> => {
      if (!agentId) return DEFAULT_BOOKING_SETTINGS
      const { data, error } = await supabase
        .from('agent_booking_settings')
        .select('is_open, timezone, slot_minutes, buffer_minutes, min_notice_hours, max_advance_days, weekly_hours, location_label, default_mode')
        .eq('agent_id', agentId)
        .maybeSingle()
      if (error) throw error
      // Aucune ligne = auto-réservation jamais configurée. Ce n'est pas une
      // erreur : c'est un opt-in non exercé, et les défauts de la table sont
      // exactement ce que l'agent doit voir avant de l'activer.
      if (!data) return DEFAULT_BOOKING_SETTINGS
      return {
        is_open: !!data.is_open,
        timezone: data.timezone ?? DEFAULT_BOOKING_SETTINGS.timezone,
        slot_minutes: data.slot_minutes ?? DEFAULT_BOOKING_SETTINGS.slot_minutes,
        buffer_minutes: data.buffer_minutes ?? DEFAULT_BOOKING_SETTINGS.buffer_minutes,
        min_notice_hours: data.min_notice_hours ?? DEFAULT_BOOKING_SETTINGS.min_notice_hours,
        max_advance_days: data.max_advance_days ?? DEFAULT_BOOKING_SETTINGS.max_advance_days,
        weekly_hours: (data.weekly_hours as WeeklyHours | null) ?? {},
        location_label: data.location_label ?? null,
        default_mode: (data.default_mode as 'sur_place' | 'video') ?? 'sur_place',
      }
    },
    enabled: enabled && !!agentId,
    staleTime: 60_000,
  })

  const timeOffQuery = useQuery({
    queryKey: ['agent-time-off', agentId],
    queryFn: async (): Promise<AgentTimeOff[]> => {
      if (!agentId) return []
      const { data, error } = await supabase
        .from('agent_time_off')
        .select('id, starts_at, ends_at, reason')
        .eq('agent_id', agentId)
        .gte('ends_at', new Date().toISOString())   // les absences passées n'aident plus personne
        .order('starts_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as AgentTimeOff[]
    },
    enabled: enabled && !!agentId,
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: async (next: AgentBookingSettings) => {
      if (!agentId || !agencyId) throw new Error('Profil non chargé')
      const { error } = await supabase
        .from('agent_booking_settings')
        .upsert({
          agent_id: agentId,
          agency_id: agencyId,
          is_open: next.is_open,
          timezone: next.timezone,
          slot_minutes: next.slot_minutes,
          buffer_minutes: next.buffer_minutes,
          min_notice_hours: next.min_notice_hours,
          max_advance_days: next.max_advance_days,
          weekly_hours: next.weekly_hours as unknown as import('@/types/database').Json,
          location_label: next.location_label,
          default_mode: next.default_mode,
        }, { onConflict: 'agent_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-booking-settings', agentId] })
    },
  })

  const addMutation = useMutation({
    mutationFn: async (input: { starts_at: string; ends_at: string; reason?: string | null }) => {
      if (!agentId || !agencyId) throw new Error('Profil non chargé')
      const { error } = await supabase.from('agent_time_off').insert({
        agent_id: agentId,
        agency_id: agencyId,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        reason: input.reason ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agent-time-off', agentId] }) },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agent_time_off').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agent-time-off', agentId] }) },
  })

  return {
    settings: settingsQuery.data ?? DEFAULT_BOOKING_SETTINGS,
    timeOff: timeOffQuery.data ?? [],
    isLoading: settingsQuery.isLoading,
    isSaving: saveMutation.isPending || addMutation.isPending || removeMutation.isPending,
    hasBackend: !!agentId && !!agencyId,
    // Pas d'optimisme : le trigger de validation peut REFUSER la grille, et
    // afficher un état enregistré qu'il faudrait ensuite reprendre serait pire
    // que d'attendre la réponse. L'invalidation recharge la vérité au succès.
    save: async (next) => { await saveMutation.mutateAsync(next) },
    addTimeOff: async (input) => { await addMutation.mutateAsync(input) },
    removeTimeOff: async (id) => { await removeMutation.mutateAsync(id) },
  }
}
