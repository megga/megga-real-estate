import type { ListingCardData } from '@/components/listings/ListingCard'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SavedSearchFilters {
  context?: 'buy' | 'rent'
  types?: string[]
  minPrice?: string
  maxPrice?: string
  rooms?: string
  city?: string
  canton?: string
}

export interface UserPreferences {
  favoriteIds: string[]
  viewedIds: string[]
  savedSearchFilters: SavedSearchFilters[]
}

// ─── Score computation ──────────────────────────────────────────────────────

function priceCompetitivenessScore(listing: ListingCardData, medianPricePerM2: number): number {
  if (!listing.price_per_m2 || !medianPricePerM2 || medianPricePerM2 === 0) return 15
  const ratio = listing.price_per_m2 / medianPricePerM2
  if (ratio < 0.80) return 30
  if (ratio < 0.90) return 25
  if (ratio < 0.95) return 20
  if (ratio < 1.05) return 15
  if (ratio < 1.10) return 10
  return 5
}

function freshnessScore(listing: ListingCardData): number {
  const dom = listing.days_on_market ?? 999
  if (dom <= 3) return 20
  if (dom <= 7) return 18
  if (dom <= 14) return 15
  if (dom <= 30) return 10
  if (dom <= 60) return 5
  return 2
}

function preferenceMatchScore(listing: ListingCardData, prefs: UserPreferences): number {
  if (prefs.savedSearchFilters.length === 0 && prefs.favoriteIds.length === 0) return 15

  let bestScore = 0

  // Match against saved search filters
  for (const f of prefs.savedSearchFilters) {
    let score = 0
    let criteria = 0

    if (f.city) {
      criteria++
      if (listing.city && listing.city.toLowerCase().includes(f.city.toLowerCase())) score++
    }
    if (f.canton && listing.canton) {
      criteria++
      if (listing.canton === f.canton) score++
    }
    if (f.types && f.types.length > 0) {
      criteria++
      if (listing.type && f.types.includes(listing.type)) score++
    }
    if (f.maxPrice) {
      criteria++
      if (listing.price <= Number(f.maxPrice)) score++
    }
    if (f.minPrice) {
      criteria++
      if (listing.price >= Number(f.minPrice)) score++
    }
    if (f.rooms) {
      criteria++
      const minRooms = f.rooms.endsWith('+') ? Number(f.rooms.replace('+', '')) : Number(f.rooms)
      if (listing.rooms >= minRooms) score++
    }

    if (criteria > 0) {
      const matchRatio = score / criteria
      bestScore = Math.max(bestScore, matchRatio * 30)
    }
  }

  // Bonus if user favorited similar listings (same city/type)
  if (prefs.favoriteIds.includes(listing.id)) {
    bestScore = Math.max(bestScore, 30)
  }

  return Math.round(bestScore)
}

function opportunityScore(listing: ListingCardData): number {
  let score = 0
  if (listing.price_drop_pct && listing.price_drop_pct >= 3) score += 10
  if (listing.is_hot) score += 5
  if (listing.is_exclusive) score += 5
  return Math.min(score, 20)
}

export function computeRecommendationScore(
  listing: ListingCardData,
  prefs: UserPreferences,
  medianPricePerM2: number
): number {
  return (
    priceCompetitivenessScore(listing, medianPricePerM2) +
    freshnessScore(listing) +
    preferenceMatchScore(listing, prefs) +
    opportunityScore(listing)
  )
}

export function sortByRecommendation(
  listings: ListingCardData[],
  prefs: UserPreferences,
  medianPricePerM2: number
): ListingCardData[] {
  const scored = listings.map((l) => ({
    listing: l,
    score: computeRecommendationScore(l, prefs, medianPricePerM2),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.listing)
}
