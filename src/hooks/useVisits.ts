import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CalendarEvent, EventColor, VisitStatus } from '@/components/calendar/week-view-types'

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
  const queryClient = useQueryClient()
  const agencyId = profile?.agency_id

  // ── Fetch all visits as CalendarEvents ──
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['visits', agencyId],
    queryFn: async (): Promise<CalendarEvent[]> => {
      if (!agencyId) return []

      const { data, error } = await supabase
        .from('visits')
        .select('*, contact:contacts(first_name, last_name), property:properties(title, address, city)')
        .eq('agency_id', agencyId)
        .order('scheduled_at', { ascending: true })

      if (error) throw error
      return ((data || []) as VisitRow[]).map(visitToCalendarEvent)
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000,   // 5 minutes — avoid refetch on every focus
    gcTime: 30 * 60 * 1000,     // 30 minutes cache
  })

  // ── Create a visit ──
  const createVisitMutation = useMutation({
    mutationFn: async (event: CalendarEvent) => {
      if (!agencyId) throw new Error('No agency')
      if (!event.contactId || !event.propertyId) {
        throw new Error('Contact and property are required for visits')
      }

      const payload = calendarEventToVisitPayload(event, agencyId)
      const { data, error } = await supabase
        .from('visits')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] })
    },
  })

  // ── Update a visit (reschedule, status change, feedback) ──
  const updateVisitMutation = useMutation({
    mutationFn: async (event: CalendarEvent) => {
      const updatePayload: Record<string, unknown> = {
        scheduled_at: event.start.toISOString(),
        status: event.visitStatus || 'planned',
      }

      if (event.visitStatus === 'done') {
        updatePayload.completed_at = new Date().toISOString()
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

      const { error } = await supabase
        .from('visits')
        .update(updatePayload)
        .eq('id', event.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] })
    },
  })

  // ── Delete a visit ──
  const deleteVisitMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const { error } = await supabase
        .from('visits')
        .delete()
        .eq('id', visitId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] })
    },
  })

  return {
    visits,
    isLoading,
    createVisit: (event: CalendarEvent) => createVisitMutation.mutateAsync(event),
    updateVisit: (event: CalendarEvent) => updateVisitMutation.mutateAsync(event),
    deleteVisit: (visitId: string) => deleteVisitMutation.mutateAsync(visitId),
    isCreating: createVisitMutation.isPending,
    isUpdating: updateVisitMutation.isPending,
  }
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

export function usePublicVisit(token: string | undefined) {
  return useQuery({
    queryKey: ['public-visit', token],
    queryFn: async (): Promise<PublicVisitData | null> => {
      if (!token) return null
      const { data, error } = await supabase
        .from('visits')
        .select('id, scheduled_at, status, buyer_name, buyer_email, manage_token, property:properties(title, address, city, photos)')
        .eq('manage_token', token)
        .single()
      if (error) return null
      const property = Array.isArray(data.property) ? data.property[0] : data.property
      return { ...data, property } as PublicVisitData
    },
    enabled: !!token,
  })
}

// ── Public visit reschedule/cancel ──────────────────────────────────────────

export function useRescheduleVisit() {
  return useMutation({
    mutationFn: async ({ token, newDate }: { token: string; newDate: string }) => {
      const { error } = await supabase
        .from('visits')
        .update({ scheduled_at: newDate, status: 'planned' })
        .eq('manage_token', token)
      if (error) throw error
    },
  })
}

export function useCancelVisit() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { error } = await supabase
        .from('visits')
        .update({ status: 'cancelled' })
        .eq('manage_token', token)
      if (error) throw error
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
      const { error } = await supabase
        .from('visits')
        .update({
          rating: input.rating,
          feedback_buyer: input.comment || null,
          ai_objections: {
            strengths: input.strengths,
            objections: input.objections,
            offer_interest: input.offerInterest,
          },
          status: 'done',
          completed_at: new Date().toISOString(),
          feedback_sent: true,
        })
        .eq('manage_token', input.token)
      if (error) throw error
    },
  })
}
