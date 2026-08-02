// Migrated to @supabase-cache-helpers/postgrest-react-query.
//
// Agent calendar (useVisits) + public lookup/reschedule/cancel/feedback +
// useBookVisit migrated.
//
// useBookVisit is a multi-step flow (upsert contact → maybe generate video
// link → insert visit → send 2 emails → log activity). The contact upsert
// + visit insert use Cache Helpers mutations so caches for those tables
// auto-invalidate. The auth.getUser equivalent and edge function calls stay
// as raw supabase calls — they're orthogonal to query caching.

import { useMutation, useQuery as useRqQuery } from '@tanstack/react-query'
import {
  useQuery,
  useInsertMutation,
  useUpdateMutation,
  useDeleteMutation,
} from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { useAuth } from '@/hooks/useAuth'
import type { CalendarEvent, EventColor, VisitStatus } from '@/components/calendar/week-view-types'
import type { TablesInsert } from '@/types/database'

// ── Supabase visit row shape ────────────────────────────────────────────────

export interface VisitRow {
  id: string
  agency_id: string
  property_id: string
  contact_id: string
  transaction_id: string | null
  scheduled_at: string
  completed_at: string | null
  status: VisitStatus
  feedback_buyer: string | null
  feedback_agent: string | null
  ai_objections: Record<string, unknown> | null
  rating: number | null
  created_at: string
  // Visit enhancements
  manage_token: string | null
  qualification: Record<string, unknown> | null
  buyer_name: string | null
  buyer_email: string | null
  buyer_phone: string | null
  buyer_message: string | null
  visit_type: 'sur_place' | 'video' | null
  video_platform: 'google_meet' | 'facetime' | null
  video_link: string | null
  reminder_sent: boolean
  feedback_sent: boolean
  group_id: string | null
  // Joined data
  contact?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  property?: { title: string; address: string; city: string } | { title: string; address: string; city: string }[] | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function unwrapJoin<T>(val: T | T[] | null): T | null {
  if (Array.isArray(val)) return val[0] ?? null
  return val
}

/** Map visit status to event color */
function visitStatusToColor(status: VisitStatus): EventColor {
  switch (status) {
    case 'done': return 'green'
    case 'cancelled': return 'gray'
    case 'no_show': return 'red'
    case 'confirmed': return 'blue'
    default: return 'blue'
  }
}

/** Convert a Supabase visit row to a CalendarEvent */
function visitToCalendarEvent(visit: VisitRow): CalendarEvent {
  const contact = unwrapJoin(visit.contact)
  const property = unwrapJoin(visit.property)

  const contactName = contact ? `${contact.first_name} ${contact.last_name}` : ''
  const propertyInfo = property ? `${property.title || property.address}` : ''
  const title = propertyInfo
    ? `Visite — ${propertyInfo}${contactName ? ` (${contactName})` : ''}`
    : `Visite${contactName ? ` — ${contactName}` : ''}`

  const start = new Date(visit.scheduled_at)
  const end = new Date(start.getTime() + 60 * 60 * 1000) // Default 1h duration

  return {
    id: visit.id,
    title,
    start,
    end,
    color: visitStatusToColor(visit.status),
    visitStatus: visit.status,
    contactId: visit.contact_id,
    propertyId: visit.property_id,
    location: property ? `${property.address}, ${property.city}` : undefined,
    feedbackBuyer: visit.feedback_buyer ?? undefined,
    feedbackAgent: visit.feedback_agent ?? undefined,
    rating: visit.rating ?? undefined,
  }
}

/** Convert a CalendarEvent back to a visit insert/update payload */
function calendarEventToVisitPayload(event: CalendarEvent, agencyId: string) {
  return {
    agency_id: agencyId,
    property_id: event.propertyId || null,
    contact_id: event.contactId || null,
    scheduled_at: event.start.toISOString(),
    completed_at: event.visitStatus === 'done' ? new Date().toISOString() : null,
    status: event.visitStatus || 'planned',
    feedback_buyer: event.feedbackBuyer || null,
    feedback_agent: event.feedbackAgent || null,
    rating: event.rating || null,
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Visites de l'agence courante mappées en `CalendarEvent` pour le calendrier agent,
 * plus les mutations create/update/delete (Cache Helpers, invalidation auto).
 * L'update est partiel : le `status` n'est écrasé que s'il est explicitement fourni.
 */
export function useVisits() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  // List query — Cache Helpers derives the key from query shape.
  const visitsQuery = useQuery(
    supabase
      .from('visits')
      .select('*, contact:contacts(first_name, last_name), property:properties(title, address, city)')
      .eq('agency_id', agencyId ?? '00000000-0000-0000-0000-000000000000')
      .order('scheduled_at', { ascending: true }),
    {
      enabled: !!agencyId,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }
  )

  const visits = ((visitsQuery.data ?? []) as unknown as VisitRow[]).map(visitToCalendarEvent)

  const insertVisit = useInsertMutation(supabase.from('visits'), ['id'])
  const updateVisit = useUpdateMutation(supabase.from('visits'), ['id'])
  const deleteVisit = useDeleteMutation(supabase.from('visits'), ['id'])

  const createVisit = async (event: CalendarEvent) => {
    if (!agencyId) throw new Error('No agency')
    if (!event.contactId || !event.propertyId) {
      throw new Error('Contact and property are required for visits')
    }
    const payload = calendarEventToVisitPayload(event, agencyId)
    const rows = await insertVisit.mutateAsync([
      payload as unknown as TablesInsert<'visits'>,
    ])
    return Array.isArray(rows) ? rows[0] : rows
  }

  const updateVisitFn = async (event: CalendarEvent) => {
    // Mise à jour partielle : on ne touche au `status` QUE s'il est explicitement
    // fourni (un simple re-scheduling ne doit pas écraser confirmed/done/no_show).
    const updatePayload: Record<string, unknown> = {
      id: event.id,
      scheduled_at: event.start.toISOString(),
    }
    if (event.visitStatus !== undefined) {
      updatePayload.status = event.visitStatus
      if (event.visitStatus === 'done') {
        updatePayload.completed_at = new Date().toISOString()
      }
    }
    if (event.feedbackBuyer !== undefined) {
      updatePayload.feedback_buyer = event.feedbackBuyer
    }
    if (event.feedbackAgent !== undefined) {
      updatePayload.feedback_agent = event.feedbackAgent
    }
    if (event.rating !== undefined) {
      updatePayload.rating = event.rating
    }
    await updateVisit.mutateAsync(
      updatePayload as unknown as Parameters<typeof updateVisit.mutateAsync>[0]
    )
  }

  return {
    visits,
    isLoading: visitsQuery.isLoading,
    createVisit,
    updateVisit: updateVisitFn,
    deleteVisit: async (visitId: string) => {
      await deleteVisit.mutateAsync({ id: visitId })
    },
    isCreating: insertVisit.isPending,
    isUpdating: updateVisit.isPending,
  }
}

// ── Focus radar v3 : visites pour la file Focus (signal columns bruts) ──────
//
// useVisits() mappe en CalendarEvent (lossy : pas de rapport / feedback_sent /
// status brut), inadapté pour détecter « débrief à saisir ». Ce hook lean lit
// les colonnes de signal directement, agence-scopé par RLS (get_user_agency_id).
// Exclut les annulées. Borné (limit) : la file Focus est une « liste courte ».

export interface FocusVisitRow {
  id: string
  scheduledAt: string
  status: VisitStatus
  /** rapport (débrief agent) ET feedback_agent absents → pas encore débriefée. */
  debriefMissing: boolean
  contactId: string
  contactName: string
  propertyTitle: string | null
  propertyCity: string | null
}

/**
 * Colonnes de signal brutes des visites pour la file Focus (débrief manquant, no-show),
 * bornées à la fenêtre actionnable [-21 j … fin de journée]. Voir le commentaire du WHERE.
 */
export function useFocusVisits(limit = 100) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  return useRqQuery({
    queryKey: ['focus-visits', agencyId, limit],
    enabled: !!agencyId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<FocusVisitRow[]> => {
      if (!agencyId) return []
      // FENÊTRE actionnable bornée [aujourd'hui - 21 j … fin de journée] : les
      // sous-signaux Focus (préparer aujourd'hui / débriefer une visite récente /
      // no-show) vivent tous autour de « maintenant ». Sans ce plancher, un tri
      // ascendant + limit remonterait les visites les PLUS ANCIENNES (vieux 'done'
      // déjà débriefés) et noierait les visites du jour hors fenêtre. Le plafond
      // « fin de journée » exclut les visites futures (non surfacées de toute façon).
      const now = Date.now()
      const floorIso = new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString()
      const ceil = new Date(now)
      ceil.setHours(23, 59, 59, 999)
      const ceilIso = ceil.toISOString()
      const { data, error } = await supabase
        .from('visits')
        .select('id, scheduled_at, status, rapport, feedback_agent, contact_id, contact:contacts(first_name, last_name), property:properties(title, city)')
        .eq('agency_id', agencyId)
        .neq('status', 'cancelled')
        .gte('scheduled_at', floorIso)
        .lte('scheduled_at', ceilIso)
        .order('scheduled_at', { ascending: true })
        .limit(limit)
      if (error) throw error
      return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => {
        const contact = unwrapJoin(row.contact as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null)
        const property = unwrapJoin(row.property as { title: string; city: string } | { title: string; city: string }[] | null)
        const feedbackAgent = (row.feedback_agent as string | null) ?? null
        const debriefMissing = row.rapport == null && (feedbackAgent == null || feedbackAgent.trim() === '')
        return {
          id: row.id as string,
          scheduledAt: row.scheduled_at as string,
          status: row.status as VisitStatus,
          debriefMissing,
          contactId: row.contact_id as string,
          contactName: contact ? `${contact.first_name} ${contact.last_name}`.trim() : '',
          propertyTitle: property?.title ?? null,
          propertyCity: property?.city ?? null,
        }
      })
    },
  })
}

// ── Public visit booking (no auth required) ─────────────────────────────────
// useBookVisit stays on raw useMutation because it issues N sequential
// queries (lookup contact, maybe insert contact, fetch agent email, insert
// visit, 2 edge function calls, activity log). The contact + visit inserts
// flow through raw Supabase calls — the agent-side cache lives in
// useContacts() / useVisits() which use Cache Helpers and will pick up the
// new rows on next refetch (RLS-scoped data anyway).
// ── Public visit lookup by manage token ──────────────────────────────────────

// Pas de `manage_token` ici : la RPC ne renvoie plus le token dans sa réponse. Le
// client le détient déjà (il est dans son lien) et aucun composant ne le lisait — le
// réécho ne faisait que multiplier les endroits où un capability token peut fuiter.
export interface PublicVisitData {
  id: string
  scheduled_at: string
  status: VisitStatus
  buyer_name: string | null
  buyer_email: string | null
  property: { title: string; address: string; city: string; photos: string[] } | null
}

// Public token-based lookup — via RPC SECURITY DEFINER `get_visit_by_token`
// (migration 20260711190000). L'ancienne lecture directe de `visits` reposait
// sur une policy anon `manage_token IS NOT NULL` qui exposait TOUTES les
// visites (faille advisor rls_policy_always_true) ; la RPC ne renvoie que la
// visite dont le client détient le token (uuid = capability non devinable).
/** Lecture publique d'une visite par capability token (RPC SECURITY DEFINER `get_visit_by_token`). */
export function usePublicVisit(token: string | undefined) {
  return useRqQuery({
    queryKey: ['public-visit', token],
    queryFn: async (): Promise<PublicVisitData | null> => {
      if (!token) return null
      const res = await supabase.rpc('get_visit_by_token', { p_token: token })
      if (res.error || !res.data) return null
      return res.data as unknown as PublicVisitData
    },
    enabled: !!token,
  })
}

// ── Public visit reschedule/cancel ──────────────────────────────────────────

// Mutations par token — via RPC SECURITY DEFINER (mêmes transitions que les
// anciens updates directs ; la policy anon UPDATE barn-door a été supprimée).
// `fn` prend l'union des noms connus de `database.ts`, pas `string` : un dispatcher typé
// `string` éteint la vérification pour TOUS ses appelants d'un coup.
//
// Et `args` est indexé PAR le nom : un `Record<string, unknown>` laissait passer
// `{ p_token_TYPO: … }` en silence, pour finir en PGRST202 à l'exécution — sur des gestes
// publics par token, donc côté acheteur non authentifié. Le cast est confiné à cette
// ligne : TS ne sait pas resoudre `Args` sur un `N` encore générique, mais chaque appelant,
// lui, passe un nom littéral et voit donc ses arguments vérifiés.
type PgFns = Database['public']['Functions']

const rpcByToken = <N extends keyof PgFns>(fn: N, args: PgFns[N]['Args']) =>
  supabase.rpc(fn, args as never)

/**
 * Message porté par un refus de geste public. Distinct d'une panne réseau : le
 * lien a été compris, il n'ouvre simplement plus ce droit-là.
 */
export const VISIT_TOKEN_REFUSED = 'visit_token_refused'

/**
 * Les trois gestes par token renvoient un `boolean` : `false` = refus métier
 * (jeton hors fenêtre, visite déjà annulée/close, avis déjà déposé), et non une
 * erreur PostgREST. Sans cette conversion, `error` est `null`, la mutation
 * réussit, et la page affiche son écran de succès pour un geste qui n'a rien
 * écrit — l'acheteur croit sa visite annulée, l'agent n'est jamais prévenu et se
 * déplace. Le refus doit donc voyager comme une exception, pas comme un `false`
 * silencieux.
 */
type GestePublic = 'reschedule_visit_by_token' | 'cancel_visit_by_token' | 'submit_visit_feedback_by_token'

async function gesteParJeton<N extends GestePublic>(fn: N, args: PgFns[N]['Args']): Promise<void> {
  // Même confinement que `rpcByToken` juste au-dessus : sur un `N` encore générique, TS
  // ne sait pas réduire `Returns`, alors que les trois gestes rendent tous un booléen.
  // L'annotation est bornée à cette ligne ; `N` continue de faire vérifier les arguments
  // chez chaque appelant, qui passe un nom littéral.
  const { data, error } = (await rpcByToken(fn, args)) as {
    data: boolean | null
    error: { message: string } | null
  }
  if (error) throw new Error(error.message)
  if (data !== true) throw new Error(VISIT_TOKEN_REFUSED)
}

/** Replanification publique (par token) via RPC `reschedule_visit_by_token`. */
export function useRescheduleVisit() {
  return useMutation({
    mutationFn: ({ token, newDate }: { token: string; newDate: string }) =>
      gesteParJeton('reschedule_visit_by_token', { p_token: token, p_new_at: newDate }),
  })
}

/** Annulation publique (par token) via RPC `cancel_visit_by_token`. */
export function useCancelVisit() {
  return useMutation({
    mutationFn: (token: string) => gesteParJeton('cancel_visit_by_token', { p_token: token }),
  })
}

// ── Public visit feedback ───────────────────────────────────────────────────

export interface VisitFeedbackInput {
  token: string
  rating: number
  strengths: string[]
  objections: string[]
  comment: string
  offerInterest: 'yes' | 'maybe' | 'no'
}

/** Dépôt public du feedback visite (note + objections/intérêt) via RPC `submit_visit_feedback_by_token`. */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (input: VisitFeedbackInput) =>
      // Même capability token que la lecture/replanification : RPC SECURITY DEFINER
      // (submit_visit_feedback_by_token) — l'update direct anon n'existe plus.
      gesteParJeton('submit_visit_feedback_by_token', {
        p_token: input.token,
        p_rating: input.rating,
        p_comment: input.comment || '',
        p_ai: {
          strengths: input.strengths,
          objections: input.objections,
          offer_interest: input.offerInterest,
        },
      }),
  })
}
