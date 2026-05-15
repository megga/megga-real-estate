// Hook pour récupérer des biens similaires au bien actuellement affiché.
// Utilisé par PxSinglePropertyRelated sous la page détail.
//
// Critères : même canton + même context (buy/rent) + même type. Exclut
// le bien courant. Limite 2 résultats (le layout Figma affiche 2 cards).

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { transformToCardData } from '@/hooks/useMarketListings'
import type { ListingCardData } from '@/components/listings/ListingCard'
import type { Lang } from '@/lib/listingTitle'

function normalizeLang(input: string | undefined): Lang {
  const short = (input ?? 'fr').slice(0, 2).toLowerCase()
  return short === 'de' || short === 'en' || short === 'it' ? short : 'fr'
}

interface RelatedFilters {
  canton?: string
  context?: 'buy' | 'rent'
  type?: string
  excludeId?: string // raw id, sans préfixe market-/internal-
}

export function useRelatedListings(filters: RelatedFilters) {
  const { i18n } = useTranslation()
  const lang = normalizeLang(i18n.language)
  const { canton, context, type, excludeId } = filters

  return useQuery<ListingCardData[]>({
    queryKey: ['related-listings', canton, context, type, excludeId, lang],
    queryFn: async () => {
      if (!canton || !context) return []

      let query = supabase
        .from('market_listings')
        .select('id, title, price, current_price, address, city, canton, postal_code, rooms, bedrooms, bathrooms, surface_m2, photos, type, transaction_type, source_portal, source_url, agency_name, status, quality_score, created_at')
        .eq('transaction_type', context)
        .eq('status', 'active')
        .eq('canton', canton)
        .gte('quality_score', 50)

      if (type) {
        query = query.eq('type', type)
      }
      if (excludeId) {
        query = query.neq('id', excludeId)
      }

      query = query.order('created_at', { ascending: false }).limit(6)

      const { data, error } = await query
      if (error) throw error

      return (data ?? [])
        .slice(0, 2)
        .map(row => transformToCardData(row as Record<string, unknown>, 'market', lang))
    },
    enabled: !!canton && !!context,
    staleTime: 10 * 60 * 1000,
  })
}
