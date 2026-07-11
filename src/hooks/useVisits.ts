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

export interface VisitBookingInput {
  propertyId: string
  agencyId: string
  scheduledAt: string // ISO string
  buyerName: string
  buyerEmail: string
  buyerPhone?: string
  buyerMessage?: string
  visitType?: 'sur_place' | 'video'
  videoPlatform?: 'google_meet' | 'facetime'
  qualification?: {
    budget?: string
    financing?: string
    firstVisit?: boolean
  }
}

// useBookVisit stays on raw useMutation because it issues N sequential
// queries (lookup contact, maybe insert contact, fetch agent email, insert
// visit, 2 edge function calls, activity log). The contact + visit inserts
// flow through raw Supabase calls — the agent-side cache lives in
// useContacts() / useVisits() which use Cache Helpers and will pick up the
// new rows on next refetch (RLS-scoped data anyway).
export function useBookVisit() {
  return useMutation({
    mutationFn: async (input: VisitBookingInput) => {
      // 1. Upsert contact by email
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', input.buyerEmail)
        .eq('agency_id', input.agencyId)
        .limit(1)

      let contactId: string
      if (existingContacts && existingContacts.length > 0) {
        contactId = existingContacts[0].id
      } else {
        const nameParts = input.buyerName.trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            agency_id: input.agencyId,
            first_name: firstName,
            last_name: lastName,
            email: input.buyerEmail,
            phone: input.buyerPhone || null,
            type: 'buyer',
            source: 'website',
            score: 'warm',
          })
          .select('id')
          .single()
        if (contactError) throw contactError
        contactId = newContact.id
      }

      // 2. Generate video link if needed
      let videoLink: string | null = null
      if (input.visitType === 'video' && input.videoPlatform === 'facetime') {
        // Fetch agent email for FaceTime link
        const { data: agents } = await supabase
          .from('profiles')
          .select('email')
          .eq('agency_id', input.agencyId)
          .limit(1)
        const agentEmail = agents?.[0]?.email
        if (agentEmail) {
          videoLink = `facetime:${agentEmail}`
        }
      }
      // Google Meet link will be generated server-side via Calendar API when agent confirms

      // 3. Create visit
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert({
          agency_id: input.agencyId,
          property_id: input.propertyId,
          contact_id: contactId,
          scheduled_at: input.scheduledAt,
          status: 'planned',
          buyer_name: input.buyerName,
          buyer_email: input.buyerEmail,
          buyer_phone: input.buyerPhone || null,
          buyer_message: input.buyerMessage || null,
          qualification: input.qualification || {},
          visit_type: input.visitType || 'sur_place',
          video_platform: input.visitType === 'video' ? (input.videoPlatform || 'google_meet') : null,
          video_link: videoLink,
        })
        .select('id, manage_token')
        .single()
      if (visitError) throw visitError

      // 4. Send confirmation email via Edge Function
      try {
        await supabase.functions.invoke('send-visit-email', {
          body: {
            type: 'confirmation_buyer',
            visit_id: visit.id,
            agency_id: input.agencyId,
          },
        })
        // Also notify agent
        await supabase.functions.invoke('send-visit-email', {
          body: {
            type: 'notification_agent',
            visit_id: visit.id,
            agency_id: input.agencyId,
          },
        })
      } catch {
        // Email failure shouldn't block the visit creation
      }

      // 5. Log activity
      await supabase.from('activity_events').insert({
        agency_id: input.agencyId,
        action: 'visit_requested',
        entity_type: 'visit',
        entity_id: visit.id,
        metadata: {
          buyer_name: input.buyerName,
          buyer_email: input.buyerEmail,
          property_id: input.propertyId,
          scheduled_at: input.scheduledAt,
        },
      })

      return { visitId: visit.id, manageToken: visit.manage_token }
    },
  })
}

// ── Public visit lookup by manage token ──────────────────────────────────────

export interface PublicVisitData {
  id: string
  scheduled_at: string
  status: VisitStatus
  buyer_name: string | null
  buyer_email: string | null
  manage_token: string
  property: { title: string; address: string; city: string; photos: string[] } | null
}

// Public token-based lookup — via RPC SECURITY DEFINER `get_visit_by_token`
// (migration 20260711190000). L'ancienne lecture directe de `visits` reposait
// sur une policy anon `manage_token IS NOT NULL` qui exposait TOUTES les
// visites (faille advisor rls_policy_always_true) ; la RPC ne renvoie que la
// visite dont le client détient le token (uuid = capability non devinable).
// Les RPC token ne sont pas dans les types générés (database.ts en retard) →
// cast localisé, même pattern que useFollowupSuggestions.
export function usePublicVisit(token: string | undefined) {
  return useRqQuery({
    queryKey: ['public-visit', token],
    queryFn: async (): Promise<PublicVisitData | null> => {
      if (!token) return null
      const res = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(
        'get_visit_by_token', { p_token: token },
      )
      if (res.error || !res.data) return null
      return res.data as PublicVisitData
    },
    enabled: !!token,
  })
}

// ── Public visit reschedule/cancel ──────────────────────────────────────────

// Mutations par token — via RPC SECURITY DEFINER (mêmes transitions que les
// anciens updates directs ; la policy anon UPDATE barn-door a été supprimée).
const rpcByToken = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(fn, args)

export function useRescheduleVisit() {
  return useMutation({
    mutationFn: async ({ token, newDate }: { token: string; newDate: string }) => {
      const { error } = await rpcByToken('reschedule_visit_by_token', { p_token: token, p_new_at: newDate })
      if (error) throw new Error(error.message)
    },
  })
}

export function useCancelVisit() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { error } = await rpcByToken('cancel_visit_by_token', { p_token: token })
      if (error) throw new Error(error.message)
    },
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

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async (input: VisitFeedbackInput) => {
      // Même capability token que la lecture/replanification : RPC SECURITY DEFINER
      // (submit_visit_feedback_by_token) — l'update direct anon n'existe plus.
      const { error } = await rpcByToken('submit_visit_feedback_by_token', {
        p_token: input.token,
        p_rating: input.rating,
        p_comment: input.comment || '',
        p_ai: {
          strengths: input.strengths,
          objections: input.objections,
          offer_interest: input.offerInterest,
        },
      })
      if (error) throw new Error(error.message)
    },
  })
}
