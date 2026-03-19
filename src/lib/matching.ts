import { MOCK_LISTINGS, MOCK_CONTACTS, type MockListing, type MockContact } from './mockData'

export interface MatchResult {
  id: string
  contactId: string
  contactName: string
  propertyId: string
  listing: MockListing
  score: number
  reasons: MatchReasons
  status: 'suggested' | 'sent' | 'visit_planned' | 'interested' | 'rejected' | 'ignored'
  sentVia: 'email' | 'whatsapp' | 'both' | null
  sentAt: string | null
  createdAt: string
}

export interface MatchReasons {
  budget: { match: boolean; score: number; detail: string }
  zone: { match: boolean; score: number; detail: string }
  type: { match: boolean; score: number; detail: string }
  rooms: { match: boolean; score: number; detail: string }
  features: { match: boolean; score: number; detail: string }
}

// ── Scoring Engine ──────────────────────────────────────────────────────────

const PROPERTY_TYPE_MAP: Record<string, string> = {
  Appartement: 'apartment',
  Maison: 'house',
  Villa: 'villa',
  Commercial: 'commercial',
  Terrain: 'land',
}

function scoreBudget(price: number, budgetMin: number, budgetMax: number): { score: number; detail: string } {
  // Within range
  if (price >= budgetMin && price <= budgetMax) {
    return { score: 30, detail: `Dans le budget` }
  }
  // Slightly over budget (up to 15% above max)
  if (price > budgetMax) {
    const overRatio = price / budgetMax
    if (overRatio <= 1.15) {
      const proportional = Math.round(30 * (1 - (overRatio - 1) / 0.15))
      return { score: Math.max(proportional, 5), detail: `${Math.round((overRatio - 1) * 100)}% au-dessus` }
    }
    return { score: 0, detail: 'Hors budget (trop cher)' }
  }
  // Under budget
  const underRatio = price / budgetMin
  if (underRatio >= 0.7) {
    return { score: 20, detail: 'Sous le budget minimum' }
  }
  return { score: 0, detail: 'Hors budget (trop bas)' }
}

function scoreZone(city: string, canton: string, searchZones: string[], location: string): { score: number; detail: string } {
  const normalizedCity = city.toLowerCase()
  const normalizedCanton = canton.toLowerCase()

  // Check search_zones (enriched data)
  if (searchZones.length > 0) {
    const zoneMatch = searchZones.some((z) => z.toLowerCase() === normalizedCity)
    if (zoneMatch) return { score: 25, detail: `${city} correspond` }
    const cantonMatch = searchZones.some((z) => z.toLowerCase() === normalizedCanton)
    if (cantonMatch) return { score: 15, detail: `Canton ${canton} correspond` }
  }

  // Fallback to location string
  if (location) {
    const locationLower = location.toLowerCase()
    if (locationLower.includes(normalizedCity)) return { score: 25, detail: `${city} correspond` }
    if (locationLower.includes('genève') && normalizedCanton === 'ge') return { score: 20, detail: 'Région Genève' }
    if (locationLower.includes('lausanne') && normalizedCanton === 'vd') return { score: 20, detail: 'Région Lausanne' }
  }

  return { score: 0, detail: 'Zone non correspondante' }
}

function scoreType(listingType: string, searchType: string): { score: number; detail: string } {
  const mapped = PROPERTY_TYPE_MAP[searchType]
  if (mapped === listingType) return { score: 15, detail: 'Type correspondant' }
  // Partial: villa ≈ house
  if ((mapped === 'villa' && listingType === 'house') || (mapped === 'house' && listingType === 'villa')) {
    return { score: 10, detail: 'Type similaire' }
  }
  return { score: 0, detail: 'Type différent' }
}

function scoreRoomsSurface(
  rooms: number, surfaceM2: number,
  roomsMin: number, surfaceMin: number
): { score: number; detail: string } {
  let s = 0
  const details: string[] = []

  if (rooms >= roomsMin) {
    s += 8
    details.push(`${rooms} pièces`)
  } else if (rooms === roomsMin - 1) {
    s += 4
    details.push(`${rooms} pièces (−1)`)
  }

  if (surfaceM2 >= surfaceMin) {
    s += 7
    details.push(`${surfaceM2} m²`)
  } else if (surfaceM2 >= surfaceMin * 0.9) {
    s += 4
    details.push(`${surfaceM2} m² (proche)`)
  }

  return { score: s, detail: details.join(', ') || 'Critères non remplis' }
}

function scoreFeatures(listingFeatures: Record<string, string>): { score: number; detail: string } {
  // Score based on number of premium features
  const premiumKeys = ['Parking', 'Balcon', 'Terrasse', 'Vue', 'Ascenseur', 'Cave', 'Jardin', 'Piscine']
  const found = premiumKeys.filter((k) => listingFeatures[k])
  const s = Math.min(15, Math.round((found.length / 4) * 15))
  return { score: s, detail: found.length > 0 ? `${found.length} extras` : 'Aucun extra' }
}

export function calculateMatchScore(listing: MockListing, contact: MockContact): MatchResult | null {
  if (!contact.search_criteria) return null
  if (contact.type === 'seller') return null
  if (listing.status !== 'active') return null

  const sc = contact.search_criteria
  // Get enriched search zones from useContactDetail
  const searchZones: string[] = []

  const budget = scoreBudget(listing.price, sc.budget_min, sc.budget_max)
  const zone = scoreZone(listing.city, listing.canton, searchZones, sc.location)
  const type = scoreType(listing.type, sc.property_type)
  const rooms = scoreRoomsSurface(listing.rooms, listing.surface_m2, sc.rooms_min, sc.surface_min)
  const features = scoreFeatures(listing.features)

  const totalScore = budget.score + zone.score + type.score + rooms.score + features.score

  if (totalScore < 60) return null

  return {
    id: `match-${contact.id}-${listing.id}`,
    contactId: contact.id,
    contactName: `${contact.first_name} ${contact.last_name}`,
    propertyId: listing.id,
    listing,
    score: totalScore,
    reasons: {
      budget: { match: budget.score >= 20, score: budget.score, detail: budget.detail },
      zone: { match: zone.score >= 15, score: zone.score, detail: zone.detail },
      type: { match: type.score >= 10, score: type.score, detail: type.detail },
      rooms: { match: rooms.score >= 8, score: rooms.score, detail: rooms.detail },
      features: { match: features.score >= 8, score: features.score, detail: features.detail },
    },
    status: 'suggested',
    sentVia: null,
    sentAt: null,
    createdAt: new Date().toISOString(),
  }
}

// Run matching for a specific contact against all active listings
export function matchContactAgainstListings(contactId: string): MatchResult[] {
  const contact = MOCK_CONTACTS.find((c) => c.id === contactId)
  if (!contact) return []

  return MOCK_LISTINGS
    .map((listing) => calculateMatchScore(listing, contact))
    .filter((r): r is MatchResult => r !== null)
    .sort((a, b) => b.score - a.score)
}

// Run matching for all buyers against all listings
export function matchAllBuyers(): MatchResult[] {
  const buyers = MOCK_CONTACTS.filter((c) => c.type === 'buyer' || c.type === 'both')
  const results: MatchResult[] = []

  for (const contact of buyers) {
    const matches = MOCK_LISTINGS
      .map((listing) => calculateMatchScore(listing, contact))
      .filter((r): r is MatchResult => r !== null)

    results.push(...matches)
  }

  return results.sort((a, b) => b.score - a.score)
}
