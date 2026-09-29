/**
 * « Aujourd'hui » — le segment Matching (lot D1, conception §5.2) : `matching_actions_du_jour()`, des actions déjà
 * classées et coupées côté serveur. La page ne lit jamais les matchs de l'agence.
 *
 * ⚠ La clé vit sous le préfixe du fil (`CLE_FIL`), comme les sélections du marché : chaque geste du fil invalide
 * `[CLE_FIL]`. Sous une clé à part, une action consignée restait affichée jusqu'à 60 s (`staleTime`), et son bouton
 * menait à une place du fil déjà vide.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CLE_FIL } from '@/components/matching-fil/filModele'
import { MAX_ACTIONS, versAction, type ActionMatching, type LigneAction } from './matchingDuJour'

interface MatchingDuJour {
  actions: ActionMatching[]
  /** Toutes sortes confondues, avant la coupe : ce que « Voir tout » promet. */
  total: number
  isLoading: boolean
  isError: boolean
}

/** Les actions de matching du jour, écrites (`versAction`). */
export function useMatchingDuJour(): MatchingDuJour {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const q = useQuery({
    queryKey: [CLE_FIL, 'du-jour', agencyId],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<LigneAction[]> => {
      const { data, error } = await supabase.rpc('matching_actions_du_jour', { p_limite: MAX_ACTIONS })
      if (error) throw error
      return data ?? []
    },
  })
  const actions = useMemo(() => (q.data ?? []).flatMap((l) => {
    const a = versAction(l)
    return a ? [a] : []
  }), [q.data])
  // ⚠ Une requête DÉSACTIVÉE n'est pas « en chargement » pour TanStack v5 (`isLoading` faux) : sans la garde sur le
  // profil, le segment dirait « Aucune action » et « 0 action » le temps que la session arrive (même garde que
  // `useMatchingFil`).
  return {
    actions,
    total: Number(q.data?.[0]?.total ?? 0),
    isLoading: profile == null || q.isLoading,
    isError: q.isError,
  }
}
