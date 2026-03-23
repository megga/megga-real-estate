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
