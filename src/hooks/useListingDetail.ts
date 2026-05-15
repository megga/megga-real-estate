// Hook unifié pour récupérer un bien à partir d'un id avec préfixe.
//
// Format des ids dans la marketplace :
//   - `market-<uuid>`   → market_listings (sync Flatfox)
//   - `internal-<uuid>` → properties (annonces internes CRM)
//
// Utilisé par PropertyXSinglePropertyPage pour afficher /propriete/:id.

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

export function useListingDetail(prefixedId: string | undefined) {
  const { i18n } = useTranslation()
  const lang = normalizeLang(i18n.language)

  return useQuery<ListingCardData | null>({
    queryKey: ['listing-detail', prefixedId, lang],
    queryFn: async () => {
      if (!prefixedId) return null

      const isMarket = prefixedId.startsWith('market-')
      const isInternal = prefixedId.startsWith('internal-')
      const rawId = prefixedId.replace(/^(market-|internal-)/, '')

      // Fallback : pas de préfixe → on tente market_listings en premier
      const table = isInternal ? 'properties' : 'market_listings'
      const source: 'market' | 'internal' = isInternal ? 'internal' : 'market'

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', rawId)
        .single()

      if (error) {
        // Pas trouvé sur la première table tentée — si on n'avait pas de
        // préfixe explicite et qu'on a essayé market_listings, on retente
        // sur properties.
        if (!isMarket && !isInternal) {
          const { data: internalData, error: internalError } = await supabase
            .from('properties')
            .select('*')
            .eq('id', rawId)
            .single()
          if (internalError) throw new Error('Bien introuvable')
          return transformToCardData(internalData, 'internal', lang)
        }
        throw new Error('Bien introuvable')
      }

      return transformToCardData(data, source, lang)
    },
    enabled: !!prefixedId,
    staleTime: 10 * 60 * 1000,
  })
}
