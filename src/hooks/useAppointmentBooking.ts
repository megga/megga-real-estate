// MEGGA — Hooks publics de la prise de rendez-vous KYC (côté client, sans compte).
//
// Même contrat que useMagicLinkClient : pas d'auth Supabase, fetch direct vers
// les edge functions, qui vérifient le token HMAC.
//
// Les réponses d'erreur sont RENVOYÉES et non levées. La page doit distinguer
// « l'agent n'a pas ouvert l'auto-réservation » de « son agenda est
// injoignable » de « ce lien a déjà servi » — trois situations qui appellent
// trois messages différents. Un `throw` uniforme les écraserait toutes en
// « une erreur est survenue ».

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLIC_ANON_KEY } from '@/lib/supabase'

/**
 * ⛔ L'URL DES FONCTIONS ET LA CLÉ PUBLIQUE VIENNENT DE `lib/supabase`, JAMAIS
 * D'UNE LECTURE NUE DE L'ENVIRONNEMENT.
 *
 * Ce module lisait les deux variables de build SANS les replis que
 * `src/lib/supabase.ts` porte depuis toujours. Quand l'URL manque — un checkout
 * sans `.env`, un build dont le secret n'a pas été injecté — la chaîne vaut
 * `undefined`, l'URL construite devient RELATIVE, et le serveur y répond par le
 * repli SPA : **200, avec du HTML**. `res.ok` est vrai, `res.json()` lève, et la
 * page finit sur un écran vide sans que rien ne signale la cause.
 *
 * Mesuré le 15 août 2026 : `/kyc/<jeton>` rendait une page BLANCHE en dev, et la
 * requête partait sur `/kyc/undefined/functions/v1/magic-link-get`.
 *
 * ⚠ C'est AUSSI ce qui rendait cette face impossible à monter sur un banc :
 * l'intercepteur de `bancSupabase` reconnaît les appels à leur URL ABSOLUE.
 */
const SUPABASE_URL = SUPABASE_FUNCTIONS_URL.replace(/\/functions\/v1$/, '')
const SUPABASE_ANON_KEY = SUPABASE_PUBLIC_ANON_KEY

const FN_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

/** Créneau proposable — bornes ISO 8601 en UTC. */
export interface AppointmentSlot {
  start: string
  end: string
}

/** Liste blanche renvoyée par `get_kyc_appointment_public`. */
export interface PublicAppointment {
  id: string
  starts_at: string
  ends_at: string
  status: 'confirmed' | 'cancelled' | 'done' | 'no_show'
  mode: 'sur_place' | 'video'
  location: string | null
  video_link: string | null
  timezone: string
  reschedule_count: number
  /** L'UI grise « déplacer / annuler » au lieu de laisser cliquer pour rien. */
  can_change: boolean
}

/**
 * Lit le corps JSON en tolérant une réponse qui n'en est pas une.
 *
 * Un 200 porteur de HTML n'est pas théorique : portail captif d'un wifi d'hôtel,
 * proxy d'entreprise, ou repli index.html d'un SPA quand l'URL de base est mal
 * configurée. `res.json()` lève alors, la requête part en erreur, et une page
 * qui n'affiche que « chargement » tant qu'elle n'a pas de données reste bloquée
 * indéfiniment. On renvoie `null` pour que l'appelant traite le cas.
 */
async function parseJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Motifs pour lesquels aucun créneau n'est proposable. */
export type SlotsUnavailableReason =
  | 'booking_closed'        // l'agent n'a jamais ouvert l'auto-réservation
  | 'calendar_unavailable'  // agenda connecté mais injoignable → on n'invente rien
  | 'link_invalid'
  | 'link_expired'
  | 'network'

export interface SlotsView {
  booking_open: boolean
  slots: AppointmentSlot[]
  timezone: string
  slot_minutes: number
  mode: 'sur_place' | 'video'
  location: string | null
  min_notice_hours: number
  max_advance_days: number
  /** Le lien a déjà servi : on affiche le rendez-vous plutôt que des créneaux. */
  already_booked?: boolean
  appointment?: PublicAppointment
  unavailable?: SlotsUnavailableReason
}

const EMPTY: Omit<SlotsView, 'unavailable'> = {
  booking_open: false,
  slots: [],
  timezone: 'Europe/Zurich',
  slot_minutes: 30,
  mode: 'sur_place',
  location: null,
  min_notice_hours: 24,
  max_advance_days: 30,
}

/**
 * Créneaux proposables pour un lien magique KYC.
 *
 * `staleTime` court et `refetchOnWindowFocus` : entre l'affichage et le clic, un
 * autre client (ou l'agent) a pu prendre le créneau. Mieux vaut le retirer de la
 * liste que de laisser le client le choisir pour recevoir `slot_taken`.
 */
export function useAppointmentSlots(token: string | undefined, days?: number) {
  return useQuery({
    queryKey: ['appointment-slots', token, days],
    queryFn: async (): Promise<SlotsView> => {
      if (!token) throw new Error('No token')
      const params = new URLSearchParams({ token })
      if (days) params.set('days', String(days))

      const res = await fetch(`${SUPABASE_URL}/functions/v1/appointment-slots?${params}`, {
        headers: FN_HEADERS,
      })
      const body = await parseJson(res)

      if (!res.ok) {
        if (res.status === 410) return { ...EMPTY, unavailable: 'link_expired' }
        if (res.status === 401) return { ...EMPTY, unavailable: 'link_invalid' }
        if (res.status === 503) return { ...EMPTY, unavailable: 'calendar_unavailable' }
        return { ...EMPTY, unavailable: 'network' }
      }
      // Un 200 illisible n'est PAS « aucune disponibilité » : annoncer un agenda
      // complet là où la requête a simplement échoué enverrait le client
      // renoncer pour rien.
      if (!body) return { ...EMPTY, unavailable: 'network' }

      if (body.already_booked) {
        return { ...EMPTY, booking_open: true, already_booked: true, appointment: body.appointment as PublicAppointment }
      }
      if (body.booking_open === false) return { ...EMPTY, unavailable: 'booking_closed' }

      return {
        booking_open: true,
        slots: (body.slots as AppointmentSlot[]) ?? [],
        timezone: String(body.timezone ?? EMPTY.timezone),
        slot_minutes: Number(body.slot_minutes ?? EMPTY.slot_minutes),
        mode: (body.mode as 'sur_place' | 'video') ?? 'sur_place',
        location: (body.location as string | null) ?? null,
        min_notice_hours: Number(body.min_notice_hours ?? EMPTY.min_notice_hours),
        max_advance_days: Number(body.max_advance_days ?? EMPTY.max_advance_days),
      }
    },
    enabled: !!token,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false, // les cas d'échec sont porteurs de sens, pas transitoires
  })
}

/** Erreur de réservation, telle que la page doit la traiter. */
export interface BookingFailure {
  code: string
  /** true si recharger la liste des créneaux est la bonne réaction. */
  staleSlots: boolean
}

const STALE_CODES = new Set(['slot_taken', 'too_soon', 'too_far', 'outside_hours'])

export interface BookInput {
  token: string
  startsAt: string
  note?: string | null
}

/** Réserve le créneau. Rejette avec un `BookingFailure` exploitable par l'UI. */
export function useBookAppointment() {
  const queryClient = useQueryClient()
  return useMutation<PublicAppointment, BookingFailure, BookInput>({
    mutationFn: async (input): Promise<PublicAppointment> => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/appointment-book`, {
        method: 'POST',
        headers: { ...FN_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: input.token, starts_at: input.startsAt, note: input.note ?? null }),
      })
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        const code = String(body.reason ?? body.error ?? 'unknown')
        throw { code, staleSlots: STALE_CODES.has(code) } satisfies BookingFailure
      }
      return body.appointment as PublicAppointment
    },
    onSettled: (_data, _err, variables) => {
      // Succès comme échec : dans les deux cas la liste affichée n'est plus la
      // vérité (le créneau vient d'être pris, ou l'était déjà).
      queryClient.invalidateQueries({ queryKey: ['appointment-slots', variables.token] })
    },
  })
}

/** Vue d'un rendez-vous depuis son lien de gestion (jeton k='appt'). */
export type AppointmentLoadError = { error: 'invalid' | 'expired' | 'not_found' | 'network' }

export function useAppointmentByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['appointment-manage', token],
    queryFn: async (): Promise<PublicAppointment | AppointmentLoadError> => {
      if (!token) throw new Error('No token')
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/appointment-manage?token=${encodeURIComponent(token)}`,
        { headers: FN_HEADERS },
      )
      if (!res.ok) {
        if (res.status === 410) return { error: 'expired' }
        if (res.status === 404) return { error: 'not_found' }
        return { error: 'invalid' }
      }
      const body = await parseJson(res)
      // Réponse illisible : c'est un incident de transport, pas un rendez-vous
      // absent. Les confondre afficherait « introuvable » sur un lien parfaitement
      // valide, et le client renoncerait à un rendez-vous qui existe.
      if (!body) return { error: 'network' }
      return (body.appointment as PublicAppointment | null) ?? { error: 'not_found' }
    },
    enabled: !!token,
    staleTime: 15_000,
    retry: false,
  })
}

export interface ManageInput {
  token: string
  action: 'cancel' | 'reschedule'
  startsAt?: string
}

/** Reporte ou annule. Mêmes codes d'erreur que les RPC, remontés tels quels. */
export function useManageAppointment() {
  const queryClient = useQueryClient()
  return useMutation<PublicAppointment, BookingFailure, ManageInput>({
    mutationFn: async (input): Promise<PublicAppointment> => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/appointment-manage`, {
        method: 'POST',
        headers: { ...FN_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: input.token,
          action: input.action,
          ...(input.startsAt ? { starts_at: input.startsAt } : {}),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        const code = String(body.reason ?? body.error ?? 'unknown')
        throw { code, staleSlots: STALE_CODES.has(code) } satisfies BookingFailure
      }
      return body.appointment as PublicAppointment
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appointment-manage', variables.token] })
    },
  })
}
