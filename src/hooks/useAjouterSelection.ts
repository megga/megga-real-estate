/**
 * Matching · Recherche — « Ajouter à la sélection de … » : les biens du marché choisis entrent
 * dans les matchs à proposer de l'acheteur (`suggested`), où l'atelier et le fil les montrent.
 *
 * ⛔ Rien ne part vers l'acheteur (décision du 21.09.2026). C'est l'agent qui proposera ces biens,
 * par ses propres moyens, puis le consignera (« Je l'ai proposé »).
 *
 * `insert_market_matches` (SECURITY INVOKER, RLS de l'agence) est idempotent : un bien déjà
 * dans les matchs de l'acheteur n'est pas dupliqué (`ON CONFLICT DO NOTHING`), et la RPC ne RENVOIE
 * que les lignes réellement créées (`RETURNING *`, migration 20260614130100). Le compte des ajouts
 * se lit donc dans sa réponse, jamais dans la sélection soumise : un bien déjà présent annoncé
 * « ajouté » laisserait l'agent le chercher en vain dans la file.
 *
 * ⛔ UN BIEN DÉJÀ PRÉSENT GARDE SON STATUT. S'il est écarté (`ignored`), refusé par l'acheteur
 * (`rejected`) ou reporté (`snoozed_until` à venir), il n'est PAS dans la file de l'atelier ni du
 * fil : le réactiver en silence déferait une décision prise. On le compte à part, et la Recherche
 * le dit.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { CLE_FIL } from '@/hooks/useMatchingFil'
import { isSnoozed } from '@/hooks/useAtelierMatching'
import type { Json } from '@/types/database'

export interface AjoutSelectionItem {
  /** id du market_listing sélectionné */
  marketListingId: string
  /** score de pertinence 0-100 (heuristique de la Recherche) */
  score: number
  /** clés de raison (recherche.reason.*) — optionnel */
  reasons?: string[]
}

export interface AjoutSelectionInput {
  contactId: string
  agencyId: string
  clientSearchId?: string | null
  items: AjoutSelectionItem[]
}

/** Le bilan d'un ajout : ce qui est entré dans la file, et ce qui y était déjà. */
export interface BilanAjout {
  /** matchs créés par la RPC, donc nouveaux dans la file de l'acheteur */
  ajoutes: number
  /** biens déjà dans les matchs de l'acheteur, laissés tels quels */
  dejaPresents: number
  /** parmi eux, écartés, refusés ou reportés : hors de la file, et qui y restent */
  horsFile: number
}

/** Ajoute les biens choisis aux matchs à proposer de l'acheteur ; rend le bilan (cf. `BilanAjout`). */
export function useAjouterSelection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ contactId, agencyId, clientSearchId, items }: AjoutSelectionInput): Promise<BilanAjout> => {
      if (!items.length) throw new Error('no_selection')
      const rows = items.map((it) => ({
        agency_id: agencyId,
        contact_id: contactId,
        market_listing_id: it.marketListingId,
        client_search_id: clientSearchId ?? null,
        score: Math.max(0, Math.min(100, Math.round(it.score))),
        reasons: it.reasons?.length ? { keys: it.reasons } : {},
        status: 'suggested',
      }))
      const { data: crees, error } = await supabase.rpc('insert_market_matches', { p_rows: rows as unknown as Json })
      if (error) throw error
      const nouveaux = new Set((crees ?? []).map((m) => m.market_listing_id))
      const deja = [...new Set(items.map((it) => it.marketListingId))].filter((id) => !nouveaux.has(id))
      if (deja.length === 0) return { ajoutes: nouveaux.size, dejaPresents: 0, horsFile: 0 }

      // Les biens déjà présents : lus pour dire lesquels sont hors de la file. Une lecture en échec
      // ne défait pas l'ajout, qui a eu lieu : le bilan tait alors ce détail plutôt que d'échouer.
      const { data: presents, error: lErr } = await supabase
        .from('matches')
        .select('status, snoozed_until')
        .eq('contact_id', contactId)
        .in('market_listing_id', deja)
      const horsFile = lErr ? 0 : (presents ?? []).filter(
        (m) => m.status === 'ignored' || m.status === 'rejected' || isSnoozed(m.snoozed_until),
      ).length
      return { ajoutes: nouveaux.size, dejaPresents: deja.length, horsFile }
    },
    // Les biens ajoutés doivent apparaître là où l'agent les proposera : l'atelier
    // (`atelier-matches`), le fil et sa sélection du marché (préfixe `CLE_FIL`), le mobile (`matches`).
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['atelier-matches'] })
      void client.invalidateQueries({ queryKey: [CLE_FIL] })
      void client.invalidateQueries({ queryKey: ['matches'] })
    },
  })
}
