/**
 * Combien de messages WhatsApp MEGGA a envoyés ce mois pour l'agence : à l'équipe (MEGGA AI)
 * et aux clients. RPC `whatsapp_usage_month` — des volumes, jamais un contenu, jamais ce
 * que Meta facture (cf. `src/lib/whatsappUsage.ts`).
 *
 * ⚠ Sous un banc (`/dev/crm`), les volumes viennent des fixtures de l'écran Consommation.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { whatsappUsageFromJson, type WhatsAppUsage } from '@/lib/whatsappUsage'
import { fxWhatsAppUsage, useLabsFixtures } from '@/components/crm/labs/fixtures'

/** Le mois courant (UTC), ou `month` au format `YYYY-MM`. */
export function useWhatsAppUsage(month?: string) {
  const { profile } = useAuth()
  const fx = useLabsFixtures()
  const agencyId = profile?.agency_id ?? null
  return useQuery({
    queryKey: ['whatsapp-usage', fx ? `fx-${fx}` : agencyId, month ?? 'courant'],
    enabled: !!fx || !!agencyId,
    queryFn: async (): Promise<WhatsAppUsage> => {
      if (fx) return fxWhatsAppUsage(fx)
      const { data, error } = await supabase.rpc('whatsapp_usage_month', month ? { p_month: month } : {})
      if (error) throw error
      return whatsappUsageFromJson(data)
    },
    // Un compteur mensuel ne bouge pas à la seconde : une minute suffit, et l'écran est
    // souvent rouvert depuis le menu de compte.
    staleTime: 60_000,
  })
}
