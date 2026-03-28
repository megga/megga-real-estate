import PriceHistoryChart from '@/components/listings/PriceHistoryChart'
import MarketTemperatureBadge from '@/components/listings/MarketTemperatureBadge'
import NaturalHazardBadge from '@/components/listings/NaturalHazardBadge'
import { useMarketTemperature } from '@/hooks/useMarketInsights'

interface ListingMarketSectionProps {
  isMarket: boolean
  rawId?: string
  canton?: string
  city?: string
  lat?: number
  lng?: number
}

export default function ListingMarketSection({ isMarket, rawId, canton, city, lat, lng }: ListingMarketSectionProps) {
  const { data: marketTemp } = useMarketTemperature(canton, city)

  const hasAnyData = isMarket || lat || lng || marketTemp

  if (!hasAnyData) return null

  return (
    <div id="marche" className="scroll-mt-28">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Analyse du marché</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Market temperature */}
        {marketTemp && (
          <MarketTemperatureBadge temperature={marketTemp} />
        )}

        {/* Price history */}
        {isMarket && rawId && (
          <PriceHistoryChart marketListingId={rawId} />
        )}

        {/* Natural hazards */}
        <NaturalHazardBadge lat={lat} lng={lng} />
      </div>
    </div>
  )
}
