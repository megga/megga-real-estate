/**
 * « Ce qui a bougé » (lot D1, conception §7bis) — les acheteurs compatibles de chaque annonce du flux, un lot par page
 * (`lotsParPage`, 30 au plus : la borne de `pige_acheteurs_compatibles`). `pige_mouvements` ne change pas : sa
 * pagination par clé reste intacte.
 *
 * ⚠ Le hook prend des LOTS, pas des identifiants : leur découpe fait leur clé de requête, et c'est la page qui la tient
 * stable (`lotsParPage`) — une page de plus ajoute une lecture sans relancer les autres.
 * ⚠ La clé vit SOUS le préfixe du fil (`CLE_FIL`), comme celles d'« Aujourd'hui » (`useMatchingDuJour`,
 * `useAbsenceSignals`) et des fiches (`useQuiPourCeBien`) : ce qui l'invalide rafraîchit les comptes. Aujourd'hui, c'est
 * l'ajout à la sélection d'un acheteur depuis cette Recherche même (`useAjouterSelection`), et chaque geste du FIL,
 * la page voisine de cette Recherche dans le pager de Matching.
 * ⚠ `CLE_FIL` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * le module des gestes (`matchingGestes`) : la Recherche n'a pas à le charger pour une chaîne.
 */
import { useQueries } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CLE_FIL } from '@/components/matching-fil/filModele'

type LigneAcheteurs = { market_listing_id: string; acheteurs: number | string }

/** Fusionne les lots : une fonction de MODULE, pour que `useQueries` ne la recrée pas à chaque rendu. */
const enCarte = (resultats: { data?: LigneAcheteurs[] }[]): ReadonlyMap<string, number> =>
  new Map(resultats.flatMap((r) => (r.data ?? []).map((l): [string, number] => [l.market_listing_id, Number(l.acheteurs)])))

/**
 * Annonce → acheteurs compatibles, pour les lots donnés (`lotsParPage`) ; une annonce sans acheteur n'y est pas — la
 * RPC ne la rend pas.
 */
export function usePigeAcheteurs(lots: readonly string[][], actif: boolean): ReadonlyMap<string, number> {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  return useQueries({
    queries: lots.map((lot) => ({
      queryKey: [CLE_FIL, 'pige-acheteurs', agencyId, lot],
      enabled: actif && !!agencyId,
      staleTime: 60_000,
      queryFn: async (): Promise<LigneAcheteurs[]> => {
        const { data, error } = await supabase.rpc('pige_acheteurs_compatibles', { p_annonces: lot })
        if (error) throw error
        return (data ?? []) as LigneAcheteurs[]
      },
    })),
    combine: enCarte,
  })
}
