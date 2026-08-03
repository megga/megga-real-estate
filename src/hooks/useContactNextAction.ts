// Prochaine action estimée d'un contact (NBA déterministe) — lecture seule via le
// RPC wrapper JWT `get_contact_next_action` (agence dérivée du token, zéro paramètre
// forgeable). Best-effort : toute erreur → null, la fiche contact ne casse JAMAIS
// pour une pastille. Même source que les deux agents IA (cerveau partagé).

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseContactNba, type ContactNba } from '@/lib/contactNba'

/** Prochaine action estimée (NBA) d'un contact via le RPC `get_contact_next_action` ; best-effort (erreur → null, jamais de throw). */
export function useContactNextAction(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-nba', contactId],
    enabled: !!contactId,
    staleTime: 60_000,
    queryFn: async (): Promise<ContactNba | null> => {
      // `enabled` empêche déjà l'appel sans contact ; la garde le dit au compilateur.
      if (!contactId) return null
      const { data, error } = await supabase.rpc('get_contact_next_action', { p_contact: contactId })
      if (error) return null
      return parseContactNba(data)
    },
  })
}
