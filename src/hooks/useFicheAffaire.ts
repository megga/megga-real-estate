/**
 * Ce que la fiche d'affaire (proposition du 27.09.2026) lit EN PLUS de la fiche deal d'avant :
 * les faits de l'affaire (historique), les biens que le moteur propose à son client, ses visites.
 *
 * ⛔ LES BIENS À PROPOSER VIENNENT DU MOTEUR (`matches`), plus d'un calcul local. La fiche d'avant
 * recalculait un « score de proximité » dans le navigateur : il ne filtrait ni les pièces ni la
 * surface, et proposait à une acheteuse de quatre pièces deux studios notés 89 % (mesuré sur le
 * banc). Le moteur, lui, est celui du fil de matchs — une seule vérité pour les deux écrans.
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

export interface MatchAffaire {
  id: string
  score: number
  status: string
  bien: { id: string | null; titre: string; prix: number | null; interne: boolean }
}

export interface VisiteAffaire {
  id: string
  scheduled_at: string
  status: string
  bien: string | null
}

interface LigneMatch {
  id: string
  score: number
  status: string
  property_id: string | null
  property: { title?: string | null; price?: number | null } | null
  market_listing: { title?: string | null; price?: number | null } | null
}

interface LigneVisite {
  id: string
  scheduled_at: string
  status: string
  property: { title?: string | null } | null
}

/** Les faits, les biens proposés et les visites d'une affaire — chaque lecture reste bornée. */
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

  const matchs = useQuery({
    queryKey: ['fiche-affaire', 'matchs', contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<MatchAffaire[]> => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, score, status, property_id, property:properties(title, price), market_listing:market_listings(title, price)')
        .eq('contact_id', contactId!)
        .in('status', ['suggested', 'sent', 'interested'])
        .order('score', { ascending: false })
        .limit(3)
      if (error) throw error
      return ((data ?? []) as unknown as LigneMatch[]).map((m) => ({
        id: m.id,
        score: m.score,
        status: m.status,
        bien: {
          id: m.property_id,
          titre: m.property?.title ?? m.market_listing?.title ?? '',
          prix: m.property?.price ?? m.market_listing?.price ?? null,
          interne: !!m.property_id,
        },
      }))
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
    matchs: matchs.data ?? [],
    visites: visites.data ?? [],
  }
}
