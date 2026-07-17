// Boucle de match — dossiers transmis à un contact + état de sa réception.
//
// Alimente la fiche contact (CdToTraitInbox + CdFilDuDossier). Lit les `matches`
// transmis (status sent/interested/rejected/visit_planned) + les biens associés +
// l'état d'ouverture via `buyer_reception_links.viewed_at`. Réaction acheteur =
// live (record_buyer_reaction) → realtime rafraîchit la fiche.

import { useEffect, useId, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type LoopState = 'liked' | 'seen' | 'sent' | 'dismissed'

export interface LoopItem {
  matchId: string
  title: string
  addr: string
  price: number | null
  rooms: number | null
  area: number | null
  photo: string | null
  score: number | null
  state: LoopState
  motif: string | null
  sentAt: string | null
  respondedAt: string | null
}

export interface ContactLoop {
  items: LoopItem[]
  transmitted: number      // total dossiers transmis
  opened: number           // ouverts (état ≠ 'sent')
  pendingLikes: LoopItem[]  // likes non encore traités (inbox « À traiter »)
}

const num = (x: unknown): number | null => (x == null || Number.isNaN(Number(x)) ? null : Number(x))
/** Première URL de photo valide d'un bien, en préférant les dérivés Cloudflare (`photos_cf`) aux originaux. */
const firstPhoto = (row: Record<string, unknown> | null): string | null => {
  if (!row) return null
  const cf = Array.isArray(row.photos_cf) ? (row.photos_cf as unknown[]) : []
  const ph = Array.isArray(row.photos) ? (row.photos as unknown[]) : []
  const pick = (cf.length ? cf : ph).find((p) => typeof p === 'string' && p)
  return (pick as string) ?? null
}

interface MatchRow {
  id: string
  status: string
  score: number | null
  sent_at: string | null
  response_at: string | null
  reaction_motif: string | null
  property_id: string | null
  market_listing_id: string | null
  property: Record<string, unknown> | Record<string, unknown>[] | null
  market_listing: Record<string, unknown> | Record<string, unknown>[] | null
}

/**
 * Boucle de match d'un contact : dossiers transmis + état de réception
 * (sent/seen/liked/dismissed), rafraîchie en realtime sur les `matches` du contact.
 */
export function useContactSentMatches(contactId: string | undefined): ContactLoop & { isLoading: boolean } {
  const qc = useQueryClient()
  const channelId = useId()

  const query = useQuery<{ matches: MatchRow[]; openedIds: Set<string> }>({
    queryKey: ['contact-sent-matches', contactId],
    enabled: !!contactId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!contactId) return { matches: [] as MatchRow[], openedIds: new Set<string>() }
      const matchesRes = await supabase
        .from('matches')
        // reaction_motif est typé (régé des types post-migration 20260707120000). Le
        // recast MatchRow[] plus bas n'aplatit plus que la forme des jointures.
        .select(
          'id, status, score, sent_at, response_at, reaction_motif, property_id, market_listing_id,' +
          ' property:properties(title, address, city, postal_code, price, rooms, surface_m2, photos),' +
          ' market_listing:market_listings(title, address, city, postal_code, price, current_price, rooms, surface_m2, photos, photos_cf)',
        )
        .eq('contact_id', contactId)
        .in('status', ['sent', 'interested', 'rejected', 'visit_planned'])
        .order('sent_at', { ascending: false, nullsFirst: false })
      if (matchesRes.error) throw matchesRes.error

      // buyer_reception_links → biens « ouverts » (viewed_at renseigné). Typé depuis
      // la régé des types post-migration 20260707120000.
      const linksRes = await supabase
        .from('buyer_reception_links')
        .select('match_ids, viewed_at')
        .eq('contact_id', contactId)
        .not('viewed_at', 'is', null)
      const openedIds = new Set<string>()
      for (const l of linksRes.data ?? []) {
        for (const id of l.match_ids ?? []) openedIds.add(id)
      }
      return { matches: (matchesRes.data ?? []) as unknown as MatchRow[], openedIds }
    },
  })

  // Realtime : la réaction acheteur (portail) mute matches → rafraîchit la fiche.
  useEffect(() => {
    if (!contactId) return
    const channel = supabase
      .channel(`contact-loop-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `contact_id=eq.${contactId}` },
        () => qc.invalidateQueries({ queryKey: ['contact-sent-matches', contactId] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [contactId, channelId, qc])

  return useMemo<ContactLoop & { isLoading: boolean }>(() => {
    const matches = query.data?.matches ?? []
    const openedIds = query.data?.openedIds ?? new Set<string>()
    const items: LoopItem[] = matches.map((m) => {
      const b = (Array.isArray(m.property) ? m.property[0] : m.property)
        ?? (Array.isArray(m.market_listing) ? m.market_listing[0] : m.market_listing)
        ?? null
      const isMarket = !!m.market_listing_id
      const price = isMarket ? (num(b?.current_price) ?? num(b?.price)) : num(b?.price)
      const state: LoopState = m.status === 'interested' ? 'liked'
        : m.status === 'rejected' ? 'dismissed'
        : openedIds.has(m.id) ? 'seen' : 'sent'
      const addr = b
        ? [b.address, [b.postal_code, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || String(b.city ?? '')
        : ''
      return {
        matchId: m.id,
        title: String(b?.title ?? 'Bien'),
        addr,
        price,
        rooms: num(b?.rooms),
        area: num(b?.surface_m2),
        photo: firstPhoto(b),
        score: num(m.score),
        state,
        motif: m.reaction_motif,
        sentAt: m.sent_at,
        respondedAt: m.response_at,
      }
    })
    return {
      items,
      transmitted: items.length,
      opened: items.filter((i) => i.state !== 'sent').length,
      pendingLikes: items.filter((i) => i.state === 'liked'),
      isLoading: query.isLoading,
    }
  }, [query.data, query.isLoading])
}
