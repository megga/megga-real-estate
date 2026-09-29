/**
 * « Sa boucle » (fiche contact) — les matchs d'un contact que la boucle porte, et les critères de leurs recherches. Le
 * modèle de vue est pur : `construireSaBoucle` (`contacts-pager/saBoucle.ts`).
 *
 * ⚠ DEUX LECTURES PARALLÈLES, pas un `or(…)` (conception de D1, §6) : les statuts de la boucle d'un côté, les biens
 * REVENUS de l'autre (`suggested` avec un prix de proposition : un bien revenu a forcément été proposé). Toutes deux
 * passent par des opérateurs que le banc sait appliquer ; `or` y reste en attente, et le dit en console.
 * ⚠ `lire` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * le module des gestes (`matchingGestes`) : la fiche n'a pas à le charger.
 * ⛔ Rien ne part vers l'acheteur (21.09.2026) : la réponse est consignée par l'agent — ou par un collègue,
 * l'abonnement realtime la fait apparaître sans recharger la fiche.
 */
import { useEffect, useId } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { CLE_FIL, lire } from '@/components/matching-fil/filModele'
import type { SearchCriteria } from '@/types/contact'
import type { LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'

const STATUTS_BOUCLE = ['sent', 'interested', 'rejected', 'visit_planned']
/**
 * Le match et son bien, colonnes légères (§7 de CLAUDE.md) ; le `status` d'un bien dit s'il est encore une occasion —
 * une annonce retirée, un mandat qui n'est plus en vente (lot E1) —, et `deleted_at` qu'un mandat est supprimé, ce que
 * seul un super-administrateur lit encore (`saBoucle`). Les deux lectures partagent ces colonnes.
 */
const COLONNES = 'id, status, score, sent_at, response_at, reaction_motif, reaction_note, prix_propose, apprentissage_at,'
  + ' client_search_id, snoozed_until, property_id, market_listing_id,'
  + ' property:properties(title, address, city, canton, price, rooms, surface_m2, photos, type, transaction_type, features, status, deleted_at),'
  + ' market_listing:market_listings(title, address, city, canton, price, current_price, rooms, surface_m2, photos, photos_cf, type, transaction_type, features, status)'

interface BoucleContact {
  lignes: LigneBoucleContact[]
  criteres: ReadonlyMap<string, SearchCriteria | null>
}
const VIDE: BoucleContact = { lignes: [], criteres: new Map() }

/** Ce que rend la lecture de « Sa boucle ». */
interface LectureBoucle extends BoucleContact {
  isLoading: boolean
  isError: boolean
  /**
   * L'heure de la lecture (`dataUpdatedAt`, posée à l'arrivée des lignes) ; 0 sans données. C'est le `maintenant` de
   * `construireSaBoucle` : un report s'y juge à l'heure où les lignes ont été lues, comme le fil juge les siens à son
   * `chargeLe`.
   */
  chargeLe: number
  /** Relit la boucle — le « Réessayer » de la fiche quand la lecture a échoué. */
  refetch: () => Promise<unknown>
}

/** Les lignes de « Sa boucle » d'un contact, rafraîchies en realtime sur ses `matches`. */
export function useContactSentMatches(contactId: string | undefined): LectureBoucle {
  const qc = useQueryClient()
  const channelId = useId()

  const query = useQuery<BoucleContact>({
    // Sous le préfixe du fil (`CLE_FIL`), comme les autres vues dérivées des matchs : un geste consigné dans le fil
    // rafraîchit aussi une fiche rouverte dans les 15 s de `staleTime`, pas seulement une fiche montée (Realtime).
    queryKey: [CLE_FIL, 'sa-boucle', contactId],
    enabled: !!contactId,
    staleTime: 15_000,
    // `signal` : une lecture qu'une invalidation annule s'arrête vraiment, au lieu de finir pour rien.
    queryFn: async ({ signal }) => {
      if (!contactId) return VIDE
      // Un ORDRE TOTAL, la proposition la plus récente d'abord : sans lui, une troncature (`max_rows`) garderait
      // n'importe quelles lignes, et pas les mêmes d'une lecture à l'autre (la règle de `useMatchingFil`).
      const [boucle, revenus] = await Promise.all([
        lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES)
          .eq('contact_id', contactId).in('status', STATUTS_BOUCLE)
          .order('sent_at', { ascending: false, nullsFirst: false }).order('id').abortSignal(signal)),
        lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES)
          .eq('contact_id', contactId).eq('status', 'suggested').gt('prix_propose', 0)
          .order('sent_at', { ascending: false, nullsFirst: false }).order('id').abortSignal(signal)),
      ])
      // La lecture de la boucle d'abord : un match rendu par les deux (son statut a changé entre elles) garde celui de
      // la boucle — `construireSaBoucle` retient la première ligne d'un id.
      const lignes = [...boucle, ...revenus]
      const ids = [...new Set(lignes.map((l) => l.client_search_id).filter((id): id is string => id != null))]
      const recherches = ids.length
        ? await lire<{ id: string; criteria: SearchCriteria | null }>(
          supabase.from('client_searches').select('id, criteria').in('id', ids).abortSignal(signal))
        : []
      return { lignes, criteres: new Map(recherches.map((r) => [r.id, r.criteria])) }
    },
  })

  // Realtime : une réponse consignée (par cet agent ou un collègue) mute matches → rafraîchit la fiche.
  // ⚠ Les UPDATE seulement : un match naît `suggested` et jamais proposé (`insert_*_matches`), donc aucun INSERT n'entre
  // dans la boucle — et le moteur, relancé quand on enregistre les critères d'un acheteur, en insère jusqu'à 400 par
  // recherche (`p_limit`), qui relançaient chacun les trois lectures.
  // ⚠ Le contact est dans le nom du canal : si l'écran change de contact sans se remonter, realtime-js rendrait le canal
  // en cours de fermeture sous le même nom, et le nouvel abonnement resterait muet.
  useEffect(() => {
    if (!contactId) return
    const channel = supabase
      .channel(`contact-loop-${channelId}-${contactId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `contact_id=eq.${contactId}` },
        () => qc.invalidateQueries({ queryKey: [CLE_FIL, 'sa-boucle', contactId] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [contactId, channelId, qc])

  return {
    ...(query.data ?? VIDE), isLoading: query.isLoading, isError: query.isError, chargeLe: query.dataUpdatedAt,
    refetch: query.refetch,
  }
}
