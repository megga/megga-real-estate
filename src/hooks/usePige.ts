/**
 * Pige lisible — accès données : le flux « Ce qui a bougé » (RPC `pige_mouvements`) et l'historique du
 * prix d'une annonce (`market_price_history`). La mise en forme vit dans `pige.ts`, pure et testée.
 *
 * ⚠ AUCUN COMPTAGE (CLAUDE.md §7) : le flux se pagine par clé (`detected_at`, `id`), 30 par page, et
 * l'écran dit « d'autres suivent » au lieu d'un total.
 * ⚠ La RPC ne rend que l'événement et l'id de l'annonce ; les colonnes de carte passent par
 * `chargerCartes`, le chemin de la grille.
 * ⚠ La borne de la période se calcule à la PREMIÈRE page et voyage avec les suivantes : recalculée à
 * chaque page, elle glisserait pendant qu'on pagine.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { chargerCartes, type SearchTx } from '@/hooks/useMatchingRecherche'
import {
  curseurSuivant, depuisFenetre, versMouvement, versPointPrix,
  type CurseurPige, type FenetrePige, type GenreMouvement, type LigneHistorique,
  type LigneMouvement, type MouvementPige, type PointPrix,
} from '@/components/matching-recherche/pige'

/** Mouvements par page : de quoi remplir l'écran, assez peu pour que la page reste instantanée. */
const PAGE = 30
/** Événements lus pour UNE annonce, les plus récents d'abord (index `(market_listing_id, detected_at)`). */
const HISTORIQUE_MAX = 200

/** Les filtres du flux — ceux de la grille, plus le genre et la période. */
export interface PigeParams {
  genre: GenreMouvement
  fenetre: FenetrePige
  transaction: SearchTx
  cantons: string[]
  types: string[]
  city: string | null
  budgetMin: number | null
  budgetMax: number | null
}

interface ParamPage { depuis: string; curseur: CurseurPige }
interface PagePige { mouvements: MouvementPige[]; depuis: string; suivant: CurseurPige | null }

async function chargerPage(p: PigeParams, param: ParamPage | null): Promise<PagePige> {
  const depuis = param?.depuis ?? depuisFenetre(p.fenetre, Date.now())
  const { data, error } = await supabase.rpc('pige_mouvements', {
    p_kind: p.genre,
    p_since: depuis,
    p_tx: p.transaction ?? undefined,
    p_cantons: p.cantons.length ? p.cantons : undefined,
    p_types: p.types.length ? p.types : undefined,
    p_city: p.city?.trim() ? p.city.trim() : undefined,
    p_budget_min: p.budgetMin ?? undefined,
    p_budget_max: p.budgetMax ?? undefined,
    // Même marge et même plancher de qualité que la grille : le flux décrit la population qu'elle montre.
    p_margin: 0.15,
    p_min_quality: 50,
    p_before_at: param?.curseur.at,
    p_before_id: param?.curseur.id,
    p_limit: PAGE,
  })
  if (error) throw error
  const lignes: LigneMouvement[] = data ?? []
  const cartes = await chargerCartes([...new Set(lignes.map((l) => l.market_listing_id))])
  const parId = new Map(cartes.map((b) => [b.id, b]))
  const mouvements = lignes.flatMap((l) => {
    const bien = parId.get(l.market_listing_id)
    const m = bien ? versMouvement(l, bien) : null
    return m ? [m] : []
  })
  return { mouvements, depuis, suivant: curseurSuivant(lignes, PAGE) }
}

/**
 * Le flux « Ce qui a bougé », page par page. `actif` faux (vue « Tout le marché », ou banc) : aucune
 * requête ne part, et `blocked` ne se lève pas — rien n'a été demandé.
 */
export function usePigeMouvements(p: PigeParams, actif: boolean) {
  const { user } = useAuth()
  const query = useInfiniteQuery({
    queryKey: ['pige-mouvements', p],
    enabled: actif && !!user,
    staleTime: 60_000,
    initialPageParam: null as ParamPage | null,
    queryFn: ({ pageParam }) => chargerPage(p, pageParam),
    getNextPageParam: (derniere: PagePige): ParamPage | null =>
      derniere.suivant ? { depuis: derniere.depuis, curseur: derniere.suivant } : null,
  })
  return { ...query, blocked: actif && !user }
}

/** Historique du prix d'UNE annonce, du plus ancien au plus récent. `annonceId` nul (banc) : aucune requête. */
export function useHistoriquePrix(annonceId: string | null) {
  const { user } = useAuth()
  return useQuery<{ points: PointPrix[]; tronque: boolean }>({
    queryKey: ['pige-historique', annonceId],
    enabled: !!user && !!annonceId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_price_history')
        .select('id, kind, detected_at, old_price, new_price, change_pct, old_status, new_status')
        .eq('market_listing_id', annonceId as string)
        .order('detected_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(HISTORIQUE_MAX)
      if (error) throw error
      const lignes: LigneHistorique[] = data ?? []
      return { points: lignes.map(versPointPrix).reverse(), tronque: lignes.length === HISTORIQUE_MAX }
    },
  })
}
