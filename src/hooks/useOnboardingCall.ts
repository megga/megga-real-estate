/**
 * Appel d'accueil MEGGA : lecture et gestes, côté client.
 *
 * Quatre surfaces se partagent ces hooks :
 *   - l'écran de réservation qui suit le wizard d'identité (`useOnboardingSlots`,
 *     `useBookOnboardingCall`) ;
 *   - le rappel persistant du CRM (`useMyOnboardingCall`) ;
 *   - la page publique à jeton (`usePublicOnboardingCall`, `useManageOnboardingCall`) ;
 *   - la console admin, qui a ses propres hooks (`useAdminOnboardingCalls`).
 *
 * Aucun calcul de disponibilité ici. Les créneaux viennent de l'edge function, qui
 * seule voit les agendas des hôtes : un créneau fabriqué côté navigateur serait au
 * mieux faux, au pire une réservation sur un horaire déjà pris.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/** Clé de mise en sommeil du rappel, par agence : passer n'est pas refuser. */
export const ONBOARDING_CALL_SNOOZE_KEY = 'megga.onboardingCall.snoozed'
/** Route de l'écran de réservation, atteinte à la sortie du wizard d'identité. */
export const ONBOARDING_CALL_ROUTE = '/dashboard/rendez-vous-accueil'

export interface OnboardingCallRow {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  host_display_name: string
  meeting_url: string | null
  manage_token: string
  rescheduled_count: number
}

export interface PublicOnboardingCall {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  host_name: string
  host_timezone: string
  meeting_url: string | null
  attendee_name: string | null
  agency_name: string | null
  rescheduled_count: number
  can_manage: boolean
  can_reschedule: boolean
}

export interface SlotsResponse {
  slots: string[]
  duration_minutes: number
  pool_empty: boolean
  degraded: boolean
}

/** Fuseau du navigateur, celui dans lequel le visiteur lit ses créneaux. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Zurich'
  } catch {
    return 'Europe/Zurich'
  }
}

/** L'appel confirmé de mon agence, s'il existe. Lu par RLS, pas par RPC. */
export function useMyOnboardingCall() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null

  return useQuery({
    queryKey: ['onboarding-call', agencyId],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<OnboardingCallRow | null> => {
      const { data, error } = await supabase
        .from('onboarding_calls')
        .select('id, scheduled_at, duration_minutes, status, host_display_name, meeting_url, manage_token, rescheduled_count')
        // `enabled: !!agencyId` garantit la valeur ; le client typé refuse
        // désormais un filtre nul, ce que le cast masquait.
        .eq('agency_id', agencyId!)
        .eq('status', 'confirmed')
        .maybeSingle()
      if (error) throw error
      return (data as OnboardingCallRow | null) ?? null
    },
  })
}

/**
 * Créneaux libres sur la fenêtre demandée. `manageToken` bascule l'edge function en
 * mode public, pour la replanification depuis l'e-mail.
 */
export function useOnboardingSlots(
  fromIso: string | null,
  toIso: string | null,
  manageToken?: string,
) {
  return useQuery({
    queryKey: ['onboarding-slots', fromIso, toIso, manageToken ?? 'session'],
    enabled: !!fromIso && !!toIso,
    // Un créneau se prend à la minute : une liste vieille de dix minutes ferait
    // proposer des horaires déjà partis, et le refus serait incompréhensible.
    staleTime: 30_000,
    queryFn: async (): Promise<SlotsResponse> => {
      const { data, error } = await supabase.functions.invoke('onboarding-slots', {
        body: { from: fromIso, to: toIso, ...(manageToken ? { manage_token: manageToken } : {}) },
      })
      if (error) throw error
      return data as SlotsResponse
    },
  })
}

export interface BookInput {
  slot: string
  phone?: string
  note?: string
  /**
   * Réponses du formulaire de réservation — identité confirmée et questions de
   * calibration. Transmises telles quelles : ce sont des CHOIX de l'agent, pas des
   * mesures, et les interpréter ici figerait une lecture que le produit n'a pas
   * encore arrêtée. Elles atterrissent dans `onboarding_calls.attendee_answers`.
   */
  answers?: Record<string, string>
}

export interface BookResult {
  id: string
  manage_token: string
  manage_url: string
  scheduled_at: string
  duration_minutes: number
  host_name: string
  meeting_url: string | null
}

/**
 * Réserve. Les refus attendus (`slot_taken`, `already_booked`, `no_host_available`)
 * remontent tels quels : l'écran doit pouvoir dire lequel s'est produit, et rafraîchir
 * la liste dans le cas d'un créneau parti entre l'affichage et le clic.
 */
export function useBookOnboardingCall() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: BookInput): Promise<BookResult> => {
      const { data, error } = await supabase.functions.invoke('onboarding-call-book', {
        body: {
          slot: input.slot,
          phone: input.phone,
          note: input.note,
          answers: input.answers,
          timezone: browserTimezone(),
          locale: 'fr',
        },
      })
      // `functions.invoke` enveloppe un 409 dans une FunctionsHttpError dont le corps
      // porte notre code. Sans cette relecture, tous les refus se ressembleraient.
      if (error) {
        const body = await readFunctionError(error)
        throw new Error(body ?? error.message)
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
      return data as BookResult
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding-call'] })
      void queryClient.invalidateQueries({ queryKey: ['onboarding-slots'] })
    },
  })
}

/** L'appel vu depuis le lien public. Rend `null` sur un jeton inconnu. */
export function usePublicOnboardingCall(token: string | undefined) {
  return useQuery({
    queryKey: ['onboarding-call-public', token],
    enabled: !!token,
    retry: false,
    queryFn: async (): Promise<PublicOnboardingCall | null> => {
      // `enabled: !!token` garantit que la requête ne part pas sans jeton ; le
      // `!` le dit au typage plutôt que de rouvrir une porte avec un cast large.
      const { data, error } = await supabase.rpc('get_onboarding_call_by_token', {
        p_token: token!,
      })
      if (error || !data) return null
      // La RPC rend un `jsonb` : le générateur le type `Json`, la forme exacte est
      // celle que la migration construit (jsonb_build_object).
      return data as unknown as PublicOnboardingCall
    },
  })
}

export interface ManageInput {
  token: string
  action: 'reschedule' | 'cancel'
  slot?: string
  reason?: string
}

/** Replanifie ou annule depuis le lien public. */
export function useManageOnboardingCall() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ManageInput) => {
      const { data, error } = await supabase.functions.invoke('onboarding-call-manage', {
        body: {
          manage_token: input.token,
          action: input.action,
          slot: input.slot,
          reason: input.reason,
          timezone: browserTimezone(),
          locale: 'fr',
        },
      })
      if (error) {
        const body = await readFunctionError(error)
        throw new Error(body ?? error.message)
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
      return data as { status: string; scheduled_at?: string }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding-call-public'] })
      void queryClient.invalidateQueries({ queryKey: ['onboarding-slots'] })
    },
  })
}

/**
 * Extrait le code d'erreur du corps de réponse d'une edge function.
 *
 * `supabase.functions.invoke` ne jette qu'un « Edge Function returned a non-2xx
 * status code », qui ne distingue pas un créneau pris d'une panne. Le corps, lui,
 * porte le code métier : sans cette lecture, l'écran ne peut afficher qu'un message
 * générique là où l'utilisateur a besoin de savoir quoi faire.
 */
async function readFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown })?.context
  if (!context || typeof (context as Response).json !== 'function') return null
  try {
    const body = await (context as Response).json()
    return typeof body?.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

/** Le rappel a-t-il été mis en sommeil pour cette agence ? */
export function isOnboardingCallSnoozed(agencyId: string | null | undefined): boolean {
  if (!agencyId || typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(ONBOARDING_CALL_SNOOZE_KEY)
    if (!raw) return false
    return (JSON.parse(raw) as string[]).includes(agencyId)
  } catch {
    return false
  }
}

export function snoozeOnboardingCall(agencyId: string | null | undefined): void {
  if (!agencyId || typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(ONBOARDING_CALL_SNOOZE_KEY)
    const list = raw ? (JSON.parse(raw) as string[]) : []
    if (!list.includes(agencyId)) list.push(agencyId)
    window.localStorage.setItem(ONBOARDING_CALL_SNOOZE_KEY, JSON.stringify(list))
  } catch {
    // Un stockage indisponible ne doit pas empêcher de passer l'écran.
  }
}
