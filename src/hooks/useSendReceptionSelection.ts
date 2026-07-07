// Matching · Recherche — envoi d'une SÉLECTION de biens marché à un acheteur.
// Ferme la boucle recherche → réception : l'agent sélectionne N biens pour un
// acheteur et les transmet en UN lien de réception (partagé WhatsApp / copié).
//
// Étapes (toutes autorisées côté agent — RLS agency-scopée) :
//   1. insert_market_matches (RPC, SECURITY INVOKER, idempotent ON CONFLICT) crée
//      les matches marché manquants (contact × market_listing) pour cette agence ;
//   2. on relit TOUS les match ids de la sélection (nouveaux + déjà existants —
//      le DO NOTHING ne renvoie pas les existants) ;
//   3. on récupère le téléphone du contact (pour l'option WhatsApp) ;
//   4. buyer-reception-create (edge, revalide l'appartenance agence+contact) mint
//      le lien privé. Zéro email. L'acheteur réagit ♥/✕ → remonte dans sa fiche.

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export interface SendSelectionItem {
  /** id du market_listing sélectionné */
  marketListingId: string
  /** score de pertinence 0-100 (heuristique affichée) */
  score: number
  /** clés de raison (recherche.reason.*) — optionnel */
  reasons?: string[]
}

export interface SendSelectionInput {
  contactId: string
  agencyId: string
  clientSearchId?: string | null
  items: SendSelectionItem[]
}

export interface SendSelectionResult {
  url: string
  token: string
  phone: string | null
  firstName: string | null
  count: number
}

export function useSendReceptionSelection() {
  return useMutation({
    mutationFn: async ({ contactId, agencyId, clientSearchId, items }: SendSelectionInput): Promise<SendSelectionResult> => {
      if (!items.length) throw new Error('no_selection')

      // 1. Créer les matches marché manquants (idempotent, RLS = agency de l'agent).
      const rows = items.map((it) => ({
        agency_id: agencyId,
        contact_id: contactId,
        market_listing_id: it.marketListingId,
        client_search_id: clientSearchId ?? null,
        score: Math.max(0, Math.min(100, Math.round(it.score))),
        reasons: it.reasons?.length ? { keys: it.reasons } : {},
        status: 'suggested',
      }))
      const { error: insErr } = await supabase.rpc('insert_market_matches', { p_rows: rows as unknown as Json })
      if (insErr) throw insErr

      // 2. Relire TOUS les match ids de la sélection (le DO NOTHING ne renvoie pas
      //    les matches déjà existants → on requête par contact × listings).
      const listingIds = items.map((it) => it.marketListingId)
      const { data: matchRows, error: mErr } = await supabase
        .from('matches')
        .select('id')
        .eq('contact_id', contactId)
        .in('market_listing_id', listingIds)
      if (mErr) throw mErr
      const matchIds = (matchRows ?? []).map((m) => m.id)
      if (!matchIds.length) throw new Error('no_matches')

      // 3. Téléphone du contact (option WhatsApp) + prénom.
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone, first_name')
        .eq('id', contactId)
        .maybeSingle()

      // 4. Mint du lien de réception (edge fn : revalide agence + contact, marque sent).
      const { data, error } = await supabase.functions.invoke('buyer-reception-create', {
        body: { contact_id: contactId, match_ids: matchIds, channel: 'link' },
      })
      if (error) throw error
      const d = data as { ok?: boolean; token?: string; error?: string }
      if (!d?.ok || !d.token) throw new Error(d?.error || 'reception_create_failed')

      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      return {
        url: `${origin}/reception/${d.token}`,
        token: d.token,
        phone: contact?.phone ?? null,
        firstName: contact?.first_name ?? null,
        count: matchIds.length,
      }
    },
  })
}
