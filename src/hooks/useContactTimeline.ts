/**
 * Hook timeline d'un contact : 50 derniers `activity_events` (audit trail) dont
 * `entity_id` = contactId, avec le nom de l'acteur joint depuis `profiles`.
 * Repli sans la jointure acteur si la RLS `profiles` la bloque, et [] en dernier
 * recours plutôt que de casser la fiche.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface TimelineEvent {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string
  actor_name: string | null
}

/** Charge les 50 derniers événements d'audit rattachés au contact (repli si la jointure acteur est bloquée par la RLS). */
export function useContactTimeline(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-timeline', contactId],
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!contactId) return []

      // Query activity_events where entity_id matches, OR metadata contains contact_id
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at, actor:profiles!actor_id(full_name)')
        .eq('entity_id', contactId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        // Fallback: query without the actor join (in case profiles RLS blocks it)
        const { data: fallback, error: fallbackErr } = await supabase
          .from('activity_events')
          .select('id, action, entity_type, entity_id, metadata, created_at')
          .eq('entity_id', contactId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (fallbackErr) return []

        return (fallback || []).map((row) => ({
          id: row.id,
          action: row.action,
          entity_type: row.entity_type,
          entity_id: row.entity_id ?? '',
          metadata: row.metadata as Record<string, unknown> | null,
          created_at: row.created_at,
          actor_name: null,
        }))
      }

      return (data || []).map((row) => {
        const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor
        return {
          id: row.id,
          action: row.action,
          entity_type: row.entity_type,
          entity_id: row.entity_id ?? '',
          metadata: row.metadata as Record<string, unknown> | null,
          created_at: row.created_at,
          actor_name: (actor as { full_name?: string } | null)?.full_name ?? null,
        }
      })
    },
    enabled: !!contactId,
    staleTime: 30_000,
  })
}
