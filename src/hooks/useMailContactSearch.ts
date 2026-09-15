/**
 * Recherche de destinataires parmi les contacts de l'agence, par la RPC
 * `mail_search_contacts`.
 *
 * ⚠ Une RPC et non un filtre PostgREST (D11) : l'index utile est
 * `btree (agency_id, lower(email))` — une EXPRESSION — qu'un `.ilike()` client
 * ne sait pas emprunter, et la comparaison y respecterait la casse.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface MailContactHit { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }

/**
 * Les dix contacts qui répondent à la saisie ; muette sous deux caractères.
 *
 * `pendantLaFrappe` garde les résultats précédents le temps que les suivants arrivent :
 * chaque lettre est une clé neuve, et la liste de suggestions du composeur clignotait à
 * chaque frappe, vidée puis remplie.
 */
export function useMailContactSearch(q: string, opts: { pendantLaFrappe?: boolean } = {}) {
  const needle = q.trim()
  return useQuery({
    queryKey: ['mail', 'contact-search', needle],
    enabled: needle.length >= 2,
    queryFn: async (): Promise<MailContactHit[]> => {
      const { data, error } = await supabase.rpc('mail_search_contacts', { p_q: needle })
      if (error) throw error
      return (data ?? []) as MailContactHit[]
    },
    staleTime: 30_000,
    placeholderData: opts.pendantLaFrappe ? keepPreviousData : undefined,
  })
}
