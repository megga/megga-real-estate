/**
 * Hook timeline d'un contact : les 50 derniers FAITS (`activity_events`) dont
 * `entity_id` = contactId, datés par `occurred_at` — la date du fait, qui pour un
 * courrier est celle du courrier (`metadata.sent_at`) et non celle de l'enregistrement.
 * Nom de l'acteur joint depuis `profiles`. Repli sans la jointure acteur si la RLS
 * `profiles` la bloque, et [] en dernier recours plutôt que de casser la fiche.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ACTIONS_DATEES_PAR_LE_COURRIER, LISTE_COURRIER, fusionnerTimeline, occurredAt } from '@/lib/contactTimeline'

export interface TimelineEvent {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  /** L'enregistrement au journal. */
  created_at: string
  /** La date du fait — celle qu'on affiche et qu'on trie. */
  occurred_at: string
  actor_name: string | null
}

const LIMITE = 50

interface Ligne {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: unknown
  created_at: string
  actor?: unknown
}

function versEvenement(row: Ligne): TimelineEvent {
  const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor
  const metadata = row.metadata as Record<string, unknown> | null
  return {
    id: row.id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id ?? '',
    metadata,
    created_at: row.created_at,
    occurred_at: occurredAt({ action: row.action, metadata, created_at: row.created_at }),
    actor_name: (actor as { full_name?: string } | null | undefined)?.full_name ?? null,
  }
}

/** Charge les 50 derniers faits rattachés au contact (repli si la jointure acteur est bloquée par la RLS). */
export function useContactTimeline(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-timeline', contactId],
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!contactId) return []

      // ⛔ `entity_id`, ET RIEN D'AUTRE. Ce commentaire annonçait « OR metadata
      // contains contact_id » — jamais implémenté, et corrigé le 05.09.2026 en
      // branchant la Messagerie, dont c'est le contrat : un e-mail apparaît dans
      // la fiche d'un contact SI ET SEULEMENT SI l'événement a été écrit avec
      // `entity_id = contact_id` (`_shared/mail/ingest.ts`, `mail-attachment`).
      //
      // Un commentaire qui décrit une requête plus large que la vraie est pire
      // qu'aucun : il fait chercher la panne du côté de l'écriture. Élargir le
      // filtre est possible — mais c'est une décision qui change ce que TOUS les
      // producteurs doivent garantir, pas un détail d'implémentation.
      // Gardé par `tests/unit/messagerie-timeline.spec.ts`.
      //
      // ⚠ DEUX lectures, pas une (13.09.2026) : après la passe initiale d'une boîte, les 50
      // lignes les plus récemment ENREGISTRÉES sont les 50 courriers les plus VIEUX. Les
      // non-courriers se trient par `created_at`, les courriers par la date du courrier
      // (`metadata->>sent_at`, forme `Z` canonique : le tri porte sur le texte) — la réunion
      // des deux tops contient le vrai top par date du fait (`fusionnerTimeline`).
      const [autres, courriers] = await Promise.all([
        supabase
          .from('activity_events')
          .select('id, action, entity_type, entity_id, metadata, created_at, actor:profiles!actor_id(full_name)')
          .eq('entity_id', contactId)
          .not('action', 'in', LISTE_COURRIER)
          .order('created_at', { ascending: false })
          .limit(LIMITE),
        supabase
          .from('activity_events')
          .select('id, action, entity_type, entity_id, metadata, created_at, actor:profiles!actor_id(full_name)')
          .eq('entity_id', contactId)
          .in('action', [...ACTIONS_DATEES_PAR_LE_COURRIER])
          .order('metadata->>sent_at', { ascending: false, nullsFirst: false })
          .limit(LIMITE),
      ])

      if (autres.error || courriers.error) {
        // Fallback: query without the actor join (in case profiles RLS blocks it)
        const [a, c] = await Promise.all([
          supabase
            .from('activity_events')
            .select('id, action, entity_type, entity_id, metadata, created_at')
            .eq('entity_id', contactId)
            .not('action', 'in', LISTE_COURRIER)
            .order('created_at', { ascending: false })
            .limit(LIMITE),
          supabase
            .from('activity_events')
            .select('id, action, entity_type, entity_id, metadata, created_at')
            .eq('entity_id', contactId)
            .in('action', [...ACTIONS_DATEES_PAR_LE_COURRIER])
            .order('metadata->>sent_at', { ascending: false, nullsFirst: false })
            .limit(LIMITE),
        ])
        if (a.error || c.error) return []
        return fusionnerTimeline((a.data ?? []).map(versEvenement), (c.data ?? []).map(versEvenement), LIMITE)
      }

      return fusionnerTimeline((autres.data ?? []).map(versEvenement), (courriers.data ?? []).map(versEvenement), LIMITE)
    },
    enabled: !!contactId,
    staleTime: 30_000,
  })
}
