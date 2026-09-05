/**
 * Recherche de destinataires parmi les contacts de l'agence, par la RPC
 * `mail_search_contacts`.
 *
 * ⚠ Une RPC et non un filtre PostgREST (D11) : l'index utile est
 * `btree (agency_id, lower(email))` — une EXPRESSION — qu'un `.ilike()` client
 * ne sait pas emprunter, et la comparaison y respecterait la casse.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface MailContactHit { id: string; first_name: string; last_name: string; email: string; phone: string | null }

/** Les dix contacts qui répondent à la saisie ; muette sous deux caractères. */
export function useMailContactSearch(q: string) {
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
  })
}

/** « a@b.ch, Nom <c@d.ch> » → adresses ; les entrées sans @ sont ignorées. */
export function parseRecipients(s: string): { name: string | null; email: string }[] {
  return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^(.*?)<([^>]+)>$/)
    const email = (m ? m[2] : x).trim().toLowerCase()
    return email.includes('@') ? { name: m ? (m[1].trim().replace(/^"|"$/g, '') || null) : null, email } : null
  }).filter((a): a is { name: string | null; email: string } => !!a)
}
