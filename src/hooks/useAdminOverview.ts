/**
 * Hook super-admin — la Vue d'ensemble en UN appel (`admin_overview()`).
 *
 * La RPC assemble sept sources côté serveur plutôt que de les recopier ; l'écran
 * n'a donc qu'un objet à lire. Ne PAS lui adjoindre un second fetch « pour
 * récupérer un chiffre en plus » : c'est le contrat de la page.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readAdminOverview, type AdminOverview } from '@/lib/adminOverview'

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    staleTime: 60_000,
    queryFn: async (): Promise<AdminOverview> => {
      // ⚠ La garde de la RPC LÈVE (42501) au lieu de rendre une enveloppe : le refus
      // arrive donc dans `error`, jamais dans `data.code`. Aucune couche de mapping
      // n'existe côté client, on laisse remonter le message tel quel.
      const { data, error } = await supabase.rpc('admin_overview')
      if (error) throw error
      return readAdminOverview(data)
    },
  })
}
