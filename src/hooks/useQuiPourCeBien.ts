/**
 * « Qui pour ce bien ? » sur une fiche (lot D1, conception §7) — les matchs DU bien, par une requête CIBLÉE
 * (`property_id` ou `market_listing_id`), jamais `useMatching()` : celui-ci chargeait tous les matchs de l'agence pour en
 * garder quelques-uns — 1 754 en production le 21.09.2026 —, et PostgREST les tronque à 1 000 sans rien dire.
 *
 * Les compatibles sont les matchs qu'un refus n'a pas écartés — à proposer (reportés compris), proposés, intéressés, en
 * visite —, les mêmes que compte « Ce qui a bougé » (`pige_acheteurs_compatibles`).
 * ⚠ La clé vit SOUS le préfixe du fil (`CLE_FIL`), comme celles d'« Aujourd'hui » (`useMatchingDuJour`,
 * `useAbsenceSignals`) : chaque geste du fil invalide `[CLE_FIL]`, « Réactiver » un ancien prospect aussi
 * (`useAnciensProspects`). Sous une clé à part, une fiche gardée vivante montrait un acheteur « À proposer » jusqu'à
 * 30 s après qu'on l'avait proposé dans le fil.
 * ⚠ `CLE_FIL` et `lire` viennent du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * `useAtelierMatching` : une fiche n'a pas à le charger.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CLE_FIL, lire } from '@/components/matching-fil/filModele'
import {
  STATUTS_COMPATIBLES, versCompatible, type Compatible, type LigneCompatible,
} from '@/components/matching-fil/filQuiPour'

/** Le segment des clés de requête des fiches, sous le préfixe du fil. */
const CLE_QUI_POUR = 'qui-pour'
/** Borne de la lecture (§7 de CLAUDE.md) : un bien n'a jamais autant d'acquéreurs, mais une requête se borne. */
const MAX_COMPATIBLES = 200

interface QuiPour { compatibles: Compatible[]; chargeLe: number }

/** Les acquéreurs compatibles d'un mandat ou d'une annonce du marché ; `null` : rien n'est lu. */
export function useQuiPourCeBien(cible: { genre: 'mandat' | 'annonce'; id: string } | null) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const genre = cible?.genre ?? null
  const id = cible?.id ?? null
  const q = useQuery<QuiPour>({
    queryKey: [CLE_FIL, CLE_QUI_POUR, agencyId, genre, id],
    enabled: Boolean(agencyId && genre && id),
    staleTime: 30_000,
    queryFn: async () => {
      const debut = Date.now()
      const colonne = genre === 'mandat' ? 'property_id' : 'market_listing_id'
      const lignes = await lire<LigneCompatible>(supabase.from('matches')
        .select('id, contact_id, score, status, snoozed_until, sent_at, response_at, reaction_motif, reaction_note, prix_propose')
        .eq('agency_id', agencyId!)
        .eq(colonne, id!)
        .in('status', STATUTS_COMPATIBLES)
        .order('score', { ascending: false })
        .order('id', { ascending: true })
        .limit(MAX_COMPATIBLES))
      const contactIds = [...new Set(lignes.map((l) => l.contact_id))]
      const contacts = contactIds.length
        ? await lire<{ id: string; first_name: string | null; last_name: string | null }>(
          supabase.from('contacts').select('id, first_name, last_name').in('id', contactIds))
        : []
      const parId = new Map(contacts.map((c) => [c.id, c]))
      const compatibles = lignes.flatMap((l) => {
        const c = versCompatible(l, parId.get(l.contact_id))
        return c ? [c] : []
      })
      return { compatibles, chargeLe: debut }
    },
  })
  return {
    compatibles: q.data?.compatibles ?? [], chargeLe: q.data?.chargeLe ?? 0,
    // ⚠ Une requête DÉSACTIVÉE n'est pas « en chargement » pour TanStack v5 : tant que l'agence n'est pas connue, la
    // fiche affirmait « Aucun acquéreur compatible », et le défilement `?qui=1` partait sur ce vide. Même garde que le
    // fil (`useMatchingFil`, `profile == null ||`). `cible` nulle : rien n'est lu, donc rien n'est attendu.
    isLoading: cible != null && (agencyId == null || q.isPending),
    isError: q.isError,
    // ⚠ Un rafraîchissement en ÉCHEC garde ses données (TanStack v5 : statut `error`, `data` conservée) — réveil d'un
    // portable, retour sur la fenêtre, invalidation par un geste du fil. L'appelant ne dit l'erreur qu'en leur absence,
    // plutôt que de jeter une liste valide (`aDesDonnees` du fil, même règle).
    aDesDonnees: q.data !== undefined,
    refetch: q.refetch,
  }
}
