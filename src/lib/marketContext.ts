import { supabase } from '@/lib/supabase'
import { formatCHF } from '@/lib/utils'

/**
 * Fetch comparable market listings for a property or search criteria.
 * Returns structured text for the AI copilot to analyze.
 */
export async function fetchMarketComparables(params: {
  city?: string
  canton?: string
  type?: string
  rooms?: number
  surfaceM2?: number
  price?: number
}): Promise<{ context: string; count: number }> {
  const { city, canton, type, rooms, price } = params

  let query = supabase
    .from('market_listings')
    .select('title, city, canton, price, rooms, surface_m2, type, address, created_at, price_per_m2')
    .in('status', ['active', 'price_reduced'])
    .gte('quality_score', 50)
    .gt('price', 0)

  // Filter by location
  if (city) query = query.ilike('city', `%${city}%`)
  else if (canton) query = query.eq('canton', canton)

  // Filter by type
  if (type) query = query.eq('type', type)

  // Filter by rooms (±1)
  if (rooms) {
    query = query.gte('rooms', Math.max(1, rooms - 1)).lte('rooms', rooms + 1)
  }

  // Filter by price range (±30%)
  if (price) {
    query = query.gte('price', Math.round(price * 0.7)).lte('price', Math.round(price * 1.3))
  }

  const { data: listings } = await query
    .order('created_at', { ascending: false })
    .limit(20)

  if (!listings || listings.length === 0) {
    return { context: 'Aucun bien comparable trouvé dans la base de données marché.', count: 0 }
  }

  // Calculate stats
  const prices = listings.map(l => l.price).filter(Boolean) as number[]
  const pricesPerM2 = listings.map(l => l.price_per_m2).filter(Boolean) as number[]
  const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
  const medianPrice = prices.length > 0 ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : 0
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0
  const avgPricePerM2 = pricesPerM2.length > 0 ? Math.round(pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length) : 0

  // Build context
  const lines: string[] = []

  lines.push(`**Analyse marché : ${listings.length} biens comparables trouvés**`)
  lines.push(`Zone : ${city || canton || 'Suisse'}${type ? ` | Type : ${type}` : ''}${rooms ? ` | ${rooms} pièces ±1` : ''}`)
  lines.push('')
  lines.push('**Statistiques prix :**')
  lines.push(`- Prix moyen : ${formatCHF(avgPrice)}`)
  lines.push(`- Prix médian : ${formatCHF(medianPrice)}`)
  lines.push(`- Fourchette : ${formatCHF(minPrice)} – ${formatCHF(maxPrice)}`)
  if (avgPricePerM2 > 0) lines.push(`- Prix moyen/m² : ${formatCHF(avgPricePerM2)}/m²`)

  if (price) {
    const diff = ((price - avgPrice) / avgPrice) * 100
    const position = diff > 5 ? 'AU-DESSUS' : diff < -5 ? 'EN-DESSOUS' : 'DANS LA MOYENNE'
    lines.push(`- **Positionnement du bien (${formatCHF(price)}) : ${position} du marché (${diff > 0 ? '+' : ''}${diff.toFixed(1)}%)**`)
  }

  lines.push('')
  lines.push('**Biens comparables (top 10) :**')

  for (const l of listings.slice(0, 10)) {
    const surface = l.surface_m2 ? `${l.surface_m2} m²` : ''
    const ppm2 = l.price_per_m2 ? ` (${formatCHF(l.price_per_m2)}/m²)` : ''
    lines.push(`- ${l.title || l.address || 'Bien'}, ${l.city} — ${formatCHF(l.price)}${ppm2} | ${l.rooms ?? '?'}p ${surface}`)
  }

  return { context: lines.join('\n'), count: listings.length }
}
