import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── PRICE HISTORY ──────────────────────────────────────────────────────────

export interface PriceHistoryPoint {
  date: string
  price: number
  changePct: number | null
}

/**
 * Fetch price history for a market listing.
 * Returns initial price + all changes in chronological order.
 */
export function usePriceHistory(marketListingId: string | undefined) {
  return useQuery({
    queryKey: ['price-history', marketListingId],
    queryFn: async (): Promise<PriceHistoryPoint[]> => {
      if (!marketListingId) return []

      // Get the listing itself for initial price + first_seen_at
      const { data: listing } = await supabase
        .from('market_listings')
        .select('price, price_at_first_seen, current_price, first_seen_at, created_at')
        .eq('id', marketListingId)
        .single()

      if (!listing) return []

      // Get all price changes
      const { data: changes } = await supabase
        .from('market_price_history')
        .select('old_price, new_price, change_pct, detected_at')
        .eq('market_listing_id', marketListingId)
        .order('detected_at', { ascending: true })

      const points: PriceHistoryPoint[] = []

      // First point: initial listing price
      const initialPrice = Number(listing.price_at_first_seen || listing.price)
      const initialDate = listing.first_seen_at || listing.created_at
      points.push({ date: initialDate, price: initialPrice, changePct: null })

      // Add each price change
      if (changes) {
        for (const c of changes) {
          points.push({
            date: c.detected_at,
            price: Number(c.new_price),
            changePct: c.change_pct ? Number(c.change_pct) : null,
          })
        }
      }

      // If current price differs from last point, add it
      const currentPrice = Number(listing.current_price ?? listing.price)
      if (points.length > 0 && currentPrice !== points[points.length - 1].price) {
        const pct = points[points.length - 1].price > 0
          ? ((currentPrice - points[points.length - 1].price) / points[points.length - 1].price) * 100
          : null
        points.push({ date: new Date().toISOString(), price: currentPrice, changePct: pct })
      }

      return points
    },
    enabled: !!marketListingId,
    staleTime: 30 * 60 * 1000,
  })
}

// ─── MARKET TEMPERATURE ─────────────────────────────────────────────────────

export interface MarketTemperature {
  score: number // 0-100 (0 = buyer's market, 100 = seller's market)
  label: 'acheteur' | 'equilibre' | 'vendeur'
  avgDaysOnMarket: number
  priceDropPct: number // % of listings with price drops
  medianPricePerM2: number
  listingCount: number
}

/**
 * Calculate market temperature for a given canton/city.
 * Based on: avg days on market, % price drops, listing volume.
 */
export function useMarketTemperature(canton?: string, city?: string) {
  return useQuery({
    queryKey: ['market-temperature', canton, city],
    queryFn: async (): Promise<MarketTemperature | null> => {
      let query = supabase
        .from('market_listings')
        .select('days_on_market, price_per_m2, status')
        .in('status', ['active', 'price_reduced'])
        .gte('quality_score', 50)
        .gt('price', 0)
        .eq('transaction_type', 'buy')

      if (city) query = query.ilike('city', `%${city}%`)
      else if (canton) query = query.eq('canton', canton)
      else return null

      const { data } = await query.limit(2000)
      if (!data || data.length < 10) return null

      const total = data.length
      const withDom = data.filter(d => d.days_on_market != null && d.days_on_market > 0)
      const avgDom = withDom.length > 0
        ? withDom.reduce((sum, d) => sum + (d.days_on_market || 0), 0) / withDom.length
        : 0

      const priceDrops = data.filter(d => d.status === 'price_reduced').length
      const priceDropPct = (priceDrops / total) * 100

      const withPpm2 = data.filter(d => d.price_per_m2 != null && d.price_per_m2 > 0).map(d => d.price_per_m2 as number)
      withPpm2.sort((a, b) => a - b)
      const medianPricePerM2 = withPpm2.length > 0 ? withPpm2[Math.floor(withPpm2.length / 2)] : 0

      // Score: 0 = buyer's market, 100 = seller's market
      // Factors: low DOM = hot (seller), high price drops = cold (buyer), high volume = cold
      let score = 50
      if (avgDom < 20) score += 20
      else if (avgDom < 40) score += 10
      else if (avgDom > 80) score -= 20
      else if (avgDom > 60) score -= 10

      if (priceDropPct < 5) score += 15
      else if (priceDropPct < 15) score += 5
      else if (priceDropPct > 30) score -= 15
      else if (priceDropPct > 20) score -= 10

      score = Math.max(0, Math.min(100, score))

      const label: MarketTemperature['label'] =
        score >= 60 ? 'vendeur' : score <= 40 ? 'acheteur' : 'equilibre'

      return {
        score,
        label,
        avgDaysOnMarket: Math.round(avgDom),
        priceDropPct: Math.round(priceDropPct),
        medianPricePerM2: Math.round(medianPricePerM2),
        listingCount: total,
      }
    },
    enabled: !!(canton || city),
    staleTime: 30 * 60 * 1000,
  })
}

// ─── HOT SCORE (FORTE DEMANDE) ──────────────────────────────────────────────

/**
 * Calculate a "hot score" for a listing based on available data.
 * Returns 0-100 where 100 = very hot (likely to sell fast).
 */
export function calculateHotScore(listing: {
  price_per_m2?: number
  days_on_market?: number
  price_drop_pct?: number
  photos?: string[]
}, medianPricePerM2: number): { score: number; isHot: boolean; reasons: string[] } {
  let score = 50
  const reasons: string[] = []

  // Price/m2 below median = attractive
  if (listing.price_per_m2 && medianPricePerM2 > 0) {
    const ratio = listing.price_per_m2 / medianPricePerM2
    if (ratio < 0.85) { score += 20; reasons.push('Prix attractif') }
    else if (ratio < 0.95) { score += 10; reasons.push('Bon rapport qualite-prix') }
    else if (ratio > 1.15) { score -= 10 }
  }

  // Fresh listing = hot
  if (listing.days_on_market !== undefined) {
    if (listing.days_on_market <= 3) { score += 15; reasons.push('Tout juste publie') }
    else if (listing.days_on_market <= 7) { score += 10; reasons.push('Publie recemment') }
    else if (listing.days_on_market > 90) { score -= 15 }
    else if (listing.days_on_market > 60) { score -= 10 }
  }

  // Recent price drop = opportunity
  if (listing.price_drop_pct && listing.price_drop_pct >= 3) {
    score += 10
    reasons.push('Prix recemment baisse')
  }

  // Good photos = well-marketed
  if (listing.photos && listing.photos.length >= 8) {
    score += 5
  }

  score = Math.max(0, Math.min(100, score))
  return { score, isHot: score >= 70, reasons }
}
