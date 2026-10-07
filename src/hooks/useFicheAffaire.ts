/**
 * Ce que la fiche d'affaire (proposition du 27.09.2026) lit EN PLUS de la fiche deal d'avant :
 * les faits de l'affaire (historique) et ses visites.
 *
 * ⚠ Les biens de l'acheteur ne sont plus lus ici depuis l'étape 5b-1 : le bloc « Matching » les lit
 * par état, sous la clé du fil (`useMatchingAffaire`) — la lecture d'ici, trois matchs par score montrés
 * sans leur état, ne se rafraîchissait pas après un geste du fil et rendait un mandat supprimé sans titre.
 *
 * ⚠ L'historique lit les faits par `entity_id` = l'affaire : ceux que la base écrit
 * (`stage_change`, `status_change`, trigger `trg_transaction_lifecycle`) et ceux que l'écran écrit
 * (`Étape changée`). Les offres n'y sont pas lues : la chaîne d'offres les porte déjà, datées.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface FaitAffaire {
  id: string
  action: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface VisiteAffaire {
  id: string
  scheduled_at: string
  status: string
  bien: string | null
}

interface LigneVisite {
  id: string
  scheduled_at: string
  status: string
  property: { title?: string | null } | null
}

/** Les faits et les visites d'une affaire — chaque lecture reste bornée. */
export function useFicheAffaire(dealId: string | undefined, contactId: string | undefined) {
  const faits = useQuery({
    queryKey: ['fiche-affaire', 'faits', dealId],
    enabled: !!dealId,
    queryFn: async (): Promise<FaitAffaire[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, metadata, created_at')
        .eq('entity_id', dealId!)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as FaitAffaire[]
    },
  })

  const visites = useQuery({
    queryKey: ['fiche-affaire', 'visites', contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<VisiteAffaire[]> => {
      const { data, error } = await supabase
        .from('visits')
        .select('id, scheduled_at, status, property:properties(title)')
        .eq('contact_id', contactId!)
        .order('scheduled_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return ((data ?? []) as unknown as LigneVisite[]).map((v) => ({
        id: v.id, scheduled_at: v.scheduled_at, status: v.status, bien: v.property?.title ?? null,
      }))
    },
  })

  return {
    faits: faits.data ?? [],
    visites: visites.data ?? [],
  }
}
