/**
 * La fiche d'affaire branchée sur le matching (étape 5b-1, conception `2026-09-30-fiche-affaire-matching-design.md`) —
 * ce que la fiche lit du matching de son acheteur : ses biens, par état (`biensDeLAffaire`), et les lignes que le
 * matching ajoute à l'historique de l'affaire (`journalMatchingDeLAffaire`).
 *
 * Trois lectures, sous la clé du fil (`CLE_FIL`) : un geste consigné dans le fil les invalide.
 *   · « Sa boucle » (`useContactSentMatches`), telle quelle — son abonnement realtime fait paraître la réponse qu'un
 *     collègue consigne ;
 *   · les meilleurs biens à proposer de l'acheteur, 20 au plus par score : `biensDeLAffaire` n'en garde que trois, une
 *     fois écartés ceux qui ne sont plus une occasion et les reportés ;
 *   · le journal du CONTACT, où les gestes du matching s'écrivent (proposé, intéressé, visite planifiée), 100 au plus.
 *     Il se relit au retour sur la fiche, pas en direct : la réponse d'un collègue paraît dans le bloc (« Sa boucle »)
 *     avant l'historique (conception §5.4).
 * ⛔ Rien ne part vers l'acheteur : la fiche MONTRE et ORIENTE, le fil agit.
 */
import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { COLONNES_BOUCLE, useContactSentMatches } from '@/hooks/useContactSentMatches'
import type { LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import {
  ACTIONS_JOURNAL_MATCHING, biensDeLAffaire, journalMatchingDeLAffaire, titresDesMatchs,
  type BiensAffaire, type EvenementMatching, type LigneJournalMatching,
} from '@/components/matching-fil/filAffaire'
import { CLE_FIL, lire, type FilMatch } from '@/components/matching-fil/filModele'

/** Les biens à proposer lus : de quoi en garder trois, une fois écartés les reportés et les biens qui ne se proposent plus. */
const A_PROPOSER_LUS = 20
/** Les événements du journal lus : un intérêt se relie à l'affaire par une proposition lue dans la même fenêtre. */
const JOURNAL_LU = 100

/** Ce que la fiche lit du matching de l'acheteur. */
export interface MatchingAffaire extends BiensAffaire {
  /** Les lignes que le matching ajoute à l'historique de l'affaire, du plus récent au plus ancien. */
  journal: LigneJournalMatching[]
  isLoading: boolean
  isError: boolean
  /** Des données sont déjà là : un rafraîchissement en échec ne doit pas les remplacer par l'erreur. */
  aDesDonnees: boolean
  /** Relit tout — le « Réessayer » du bloc. */
  refetch: () => Promise<unknown>
}

/** Le matching de l'acheteur d'une affaire : ses biens par état, et les lignes de l'historique ; rien sans acheteur. */
export function useMatchingAffaire(contactId: string | undefined, dealId: string | undefined): MatchingAffaire {
  const boucle = useContactSentMatches(contactId)
  const aProposer = useQuery({
    queryKey: [CLE_FIL, 'affaire-a-proposer', contactId],
    enabled: !!contactId,
    // Le `staleTime` de « Sa boucle », comme le journal : un retour sur l'onglet relit les trois ensemble.
    staleTime: 15_000,
    queryFn: async ({ signal }): Promise<LigneBoucleContact[]> => {
      // Sans acheteur, rien : `refetch` passe outre `enabled`.
      if (!contactId) return []
      // Un ORDRE TOTAL : sans l'id, la troncature garderait n'importe quels biens à score égal (la règle de « Sa boucle »).
      return lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES_BOUCLE)
        .eq('contact_id', contactId).eq('status', 'suggested')
        .order('score', { ascending: false }).order('id').limit(A_PROPOSER_LUS).abortSignal(signal))
    },
  })
  const journal = useQuery({
    queryKey: [CLE_FIL, 'affaire-journal', contactId],
    enabled: !!contactId,
    staleTime: 15_000,
    queryFn: async ({ signal }): Promise<EvenementMatching[]> => {
      // Sans acheteur, rien : `refetch` passe outre `enabled`.
      if (!contactId) return []
      // L'index `idx_activity_events_entity_created` couvre la lecture : un contact, du plus récent au plus ancien. L'id
      // départage deux gestes d'une même transaction, qui partagent leur `created_at` : la troncature reste un ORDRE TOTAL.
      return lire<EvenementMatching>(supabase.from('activity_events').select('action, created_at, metadata')
        .eq('entity_type', 'contact').eq('entity_id', contactId).in('action', [...ACTIONS_JOURNAL_MATCHING])
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(JOURNAL_LU).abortSignal(signal))
    },
  })
  // L'heure de la lecture : un report se juge contre elle, comme dans « Sa boucle » (`chargeLe`).
  const maintenant = Math.max(boucle.chargeLe, aProposer.dataUpdatedAt)
  const biens = useMemo((): BiensAffaire => {
    if (!contactId) return { lignes: [], total: 0 }
    // L'acheteur ne sert qu'à la place de ses biens dans le fil (`lienPlace`) : son id suffit.
    const acheteur: FilMatch['acheteur'] = { id: contactId, prenom: '', nom: '', telephone: null, email: null, kyc: 'none' }
    return biensDeLAffaire({ lignes: boucle.lignes, criteres: boucle.criteres }, aProposer.data ?? [], acheteur, maintenant)
  }, [contactId, boucle.lignes, boucle.criteres, aProposer.data, maintenant])
  const lignesJournal = useMemo(() => (dealId
    ? journalMatchingDeLAffaire(journal.data ?? [], dealId, titresDesMatchs(boucle.lignes, aProposer.data ?? []))
    : []), [dealId, journal.data, boucle.lignes, aProposer.data])
  const relireBoucle = boucle.refetch
  const relireAProposer = aProposer.refetch
  const relireJournal = journal.refetch
  // Une identité stable, comme le `refetch` d'une requête : un effet qui en dépendrait ne se rejouerait pas à chaque rendu.
  const refetch = useCallback(
    () => Promise.all([relireBoucle(), relireAProposer(), relireJournal()]), [relireBoucle, relireAProposer, relireJournal],
  )
  return {
    ...biens,
    journal: lignesJournal,
    isLoading: boucle.isLoading || aProposer.isLoading || journal.isLoading,
    isError: boucle.isError || aProposer.isError || journal.isError,
    aDesDonnees: boucle.chargeLe > 0 && aProposer.data !== undefined && journal.data !== undefined,
    refetch,
  }
}
