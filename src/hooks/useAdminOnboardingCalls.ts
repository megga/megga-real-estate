/**
 * Console super-admin — appels d'accueil et pool d'hôtes.
 *
 * Toutes les lectures passent par des RPC `SECURITY DEFINER` gardées
 * `is_super_admin()` (migration `20260803214105_onboarding_calls`), jamais par un
 * `.from()` direct : `onboarding_hosts` et `onboarding_host_exceptions` n'accordent
 * aucun droit au client, précisément pour qu'aucune policy trop permissive écrite
 * plus tard ne puisse les ouvrir.
 *
 * Même patron que `useAdminAgencies` : bornes larges côté serveur, filtrage et
 * pagination côté écran (les volumes sont ceux d'une plateforme, pas d'un catalogue).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminOnboardingCall {
  id: string
  agency_id: string
  agency_name: string | null
  agency_slug: string | null
  verification_status: string | null
  booked_by: string
  booked_by_name: string | null
  booked_by_email: string | null
  host_id: string
  host_name: string
  scheduled_at: string
  duration_minutes: number
  status: string
  meeting_url: string | null
  attendee_phone: string | null
  attendee_note: string | null
  attendee_answers: Record<string, string> | null
  rescheduled_count: number
  cancel_reason: string | null
  created_at: string
}

export interface AdminOnboardingHost {
  id: string
  profile_id: string
  display_name: string
  profile_email: string | null
  timezone: string
  is_active: boolean
  weekly_hours: { dow: number; start: string; end: string }[]
  slot_minutes: number
  duration_minutes: number
  buffer_after_minutes: number
  min_notice_hours: number
  horizon_days: number
  max_per_day: number | null
  upcoming_calls: number
  created_at: string
}

/**
 * jsonb libre en base : ne garde que des paires chaîne → chaîne, le contrat que
 * `sanitizeAnswers` (onboarding-call-book) impose à l'écriture — une ligne écrite
 * par une version antérieure du parcours ne doit pas casser l'écran qui l'affiche.
 */
function toAnswersRecord(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value) out[key] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

export function useAdminOnboardingCalls(status?: string) {
  return useQuery({
    queryKey: ['admin-onboarding-calls', status ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminOnboardingCall[]> => {
      const { data, error } = await supabase.rpc('get_admin_onboarding_calls', {
        p_status: status ?? undefined,
        p_limit: 2000,
        p_offset: 0,
      })
      if (error) throw error
      return ((data ?? []) as Array<Omit<AdminOnboardingCall, 'attendee_answers'> & { attendee_answers: unknown }>)
        .map((call) => ({ ...call, attendee_answers: toAnswersRecord(call.attendee_answers) }))
    },
  })
}

export function useAdminOnboardingHosts() {
  return useQuery({
    queryKey: ['admin-onboarding-hosts'],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminOnboardingHost[]> => {
      const { data, error } = await supabase.rpc('get_admin_onboarding_hosts')
      if (error) throw error
      return ((data ?? []) as AdminOnboardingHost[]).map((h) => ({
        ...h,
        weekly_hours: Array.isArray(h.weekly_hours) ? h.weekly_hours : [],
      }))
    },
  })
}

/**
 * Enveloppe §10.1 des gestes de console : `{ ok, data? }` ou `{ ok:false, error }`.
 *
 * Toute RPC admin qui ÉCRIT laisse une ligne au registre `admin_log` (chaîne
 * d'empreintes) et rend cette forme partagée, jamais une valeur nue : l'écran teste
 * une seule clé au lieu de connaître la forme particulière de chaque geste.
 */
interface AdminEnvelope {
  ok: boolean
  data?: Record<string, unknown>
  /** Vocabulaire fermé : not_found, conflict, precondition_failed, unauthorized… */
  code?: string
  /** Seul texte que l'écran a à montrer : `admin_error` l'exige non vide. */
  message_fr?: string
}

function unwrap(payload: unknown): Record<string, unknown> {
  const envelope = payload as AdminEnvelope | null
  if (!envelope || envelope.ok !== true) {
    throw new Error(envelope?.message_fr ?? envelope?.code ?? 'admin_gesture_failed')
  }
  return envelope.data ?? {}
}

export interface UpsertHostInput {
  profileId: string
  displayName: string
  timezone: string
  weeklyHours: { dow: number; start: string; end: string }[]
  slotMinutes: number
  durationMinutes: number
  bufferAfterMinutes: number
  minNoticeHours: number
  horizonDays: number
  maxPerDay: number | null
}

export function useUpsertOnboardingHost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpsertHostInput) => {
      const { data, error } = await supabase.rpc('admin_upsert_onboarding_host', {
        p_profile_id: input.profileId,
        p_display_name: input.displayName,
        p_timezone: input.timezone,
        p_weekly_hours: input.weeklyHours,
        p_slot_minutes: input.slotMinutes,
        p_duration_minutes: input.durationMinutes,
        p_buffer_after_minutes: input.bufferAfterMinutes,
        p_min_notice_hours: input.minNoticeHours,
        p_horizon_days: input.horizonDays,
        p_max_per_day: input.maxPerDay ?? undefined,
      })
      if (error) throw error
      return unwrap(data).host_id as string
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-onboarding-hosts'] }) },
  })
}

export function useSetOnboardingHostActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ hostId, active }: { hostId: string; active: boolean }) => {
      const { data, error } = await supabase.rpc('admin_set_onboarding_host_active', {
        p_host_id: hostId,
        p_active: active,
      })
      if (error) throw error
      unwrap(data)
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-onboarding-hosts'] }) },
  })
}

/**
 * Marque l'issue d'un appel passé. Volontairement borné à `done` et `no_show` :
 * annuler prévient l'agence et touche l'agenda de l'hôte, donc annuler passe par
 * l'edge function `onboarding-call-manage`, pas par cette RPC.
 */
export function useSetOnboardingCallOutcome() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ callId, status }: { callId: string; status: 'done' | 'no_show' }) => {
      const { data, error } = await supabase.rpc('admin_set_onboarding_call_outcome', {
        p_call_id: callId,
        p_status: status,
      })
      if (error) throw error
      unwrap(data)
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-onboarding-calls'] }) },
  })
}

/** Annulation côté MEGGA : passe par l'edge function, qui prévient et libère l'agenda. */
export function useAdminCancelOnboardingCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ callId, reason }: { callId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('onboarding-call-manage', {
        body: { call_id: callId, action: 'cancel', reason },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-onboarding-calls'] }) },
  })
}

/** Les appels d'une agence donnée, pour la carte de la fiche agence. */
export function useAgencyOnboardingCalls(agencyId: string | undefined) {
  const all = useAdminOnboardingCalls()
  return {
    ...all,
    data: agencyId ? (all.data ?? []).filter((c) => c.agency_id === agencyId) : [],
  }
}
