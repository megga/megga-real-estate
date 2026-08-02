/**
 * Nombre de dossiers KYB en attente de revue — alimente la pastille du rail de la console
 * super-admin (AdminShell).
 *
 * POURQUOI UNE LECTURE DÉDIÉE plutôt que admin_overview(). Cette RPC calcule déjà le même
 * signal (`signals[].kind === 'kyb_review'`), mais elle rend TOUT le tableau de bord — pouls,
 * KPI, journal de 40 lignes, activation — et aucun fichier de src/ ne l'appelle aujourd'hui.
 * La brancher ici la ferait tourner à chaque montage du rail, sur toutes les pages de la
 * console, pour en lire un entier. `get_admin_agency_review_queue(1, 0)` rend une ligne.
 *
 * Renvoie 0 (jamais undefined) tant que la lecture n'a pas abouti : une pastille absente est
 * la seule affirmation sûre en l'absence de réponse — annoncer un nombre faux dans un rail
 * permanent serait pire que ne rien annoncer.
 *
 * Client casté (`db`) : `get_admin_agency_review_queue` n'est pas encore dans les types
 * générés (src/types/database.ts — auto-généré, en retard sur cette migration). Même trou,
 * même remède que useAdminKybReview.ts (qui consomme les 6 RPC de la même migration) : client
 * non paramétré, réponse re-typée à la main juste après. À nettoyer à la prochaine
 * régénération (`supabase gen types typescript --local`).
 */
import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const db = supabase as unknown as SupabaseClient

/** Au-delà de 99, le chiffre exact ne change plus aucune décision et déborde du rail. */
const BADGE_CEILING = 99

/**
 * Compte -> texte de la pastille, ou null quand il n'y a rien à montrer. Pure et testée
 * directement (tests/unit/kyb-review-badge.spec.ts), même motif que resolveIdentityGateStatus.
 */
export function formatReviewBadge(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) return null
  return count > BADGE_CEILING ? `${BADGE_CEILING}+` : String(count)
}

interface ReviewQueueHead {
  /** `bigint` côté SQL : PostgREST peut le rendre en nombre ou en texte (même remarque que
   *  QueueRpcRow, useAdminKybReview.ts) — d'où le `Number()` plutôt qu'une confiance aveugle
   *  au type. */
  total_count: number | string
}

export function useKybReviewCount(): { count: number } {
  const { data } = useQuery({
    queryKey: ['kyb-review-count'],
    queryFn: async (): Promise<number> => {
      const { data, error } = (await db.rpc('get_admin_agency_review_queue', {
        p_limit: 1,
        p_offset: 0,
      })) as unknown as { data: ReviewQueueHead[] | null; error: { message: string } | null }
      if (error) throw new Error(error.message)
      const head = data?.[0]
      return head ? Number(head.total_count) : 0
    },
    // Une file de revue humaine ne bouge pas à la seconde ; 5 min évitent une requête à
    // chaque navigation dans la console, où le rail est monté en permanence.
    staleTime: 5 * 60_000,
  })

  return { count: data ?? 0 }
}
