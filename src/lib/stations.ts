/**
 * Top 60 Swiss railway stations with coordinates.
 * Used for calculating nearest station distance on listing cards.
 * Source: SBB/CFF open data
 */

interface Station {
  name: string
  lat: number
  lng: number
}

export const SWISS_STATIONS: Station[] = [
  // Genève
  { name: 'Genève-Cornavin', lat: 46.2100, lng: 6.1425 },
  { name: 'Genève-Eaux-Vives', lat: 46.1983, lng: 6.1586 },
  { name: 'Genève-Sécheron', lat: 46.2207, lng: 6.1443 },
  { name: 'Lancy-Pont-Rouge', lat: 46.1886, lng: 6.1278 },
  { name: 'Carouge-Bachet', lat: 46.1784, lng: 6.1389 },
  { name: 'Champel-Hôpital', lat: 46.1916, lng: 6.1491 },
  { name: 'Chêne-Bourg', lat: 46.1982, lng: 6.1888 },
  { name: 'Vernier', lat: 46.2109, lng: 6.0789 },
  // Vaud
  { name: 'Lausanne', lat: 46.5167, lng: 6.6292 },
  { name: 'Nyon', lat: 46.3833, lng: 6.2392 },
  { name: 'Morges', lat: 46.5119, lng: 6.4975 },
  { name: 'Vevey', lat: 46.4603, lng: 6.8425 },
  { name: 'Montreux', lat: 46.4378, lng: 6.9108 },
  { name: 'Renens', lat: 46.5389, lng: 6.5789 },
  { name: 'Yverdon-les-Bains', lat: 46.7787, lng: 6.6411 },
  // Zurich
  { name: 'Zürich HB', lat: 47.3782, lng: 8.5402 },
  { name: 'Zürich Stadelhofen', lat: 47.3660, lng: 8.5483 },
  { name: 'Zürich Oerlikon', lat: 47.4108, lng: 8.5440 },
  { name: 'Zürich Altstetten', lat: 47.3912, lng: 8.4886 },
  { name: 'Winterthur', lat: 47.5000, lng: 8.7236 },
  // Berne
  { name: 'Bern', lat: 46.9490, lng: 7.4395 },
  { name: 'Bern Wankdorf', lat: 46.9630, lng: 7.4660 },
  { name: 'Thun', lat: 46.7544, lng: 7.6292 },
  { name: 'Biel/Bienne', lat: 47.1325, lng: 7.2439 },
  // Bâle
  { name: 'Basel SBB', lat: 47.5475, lng: 7.5895 },
  { name: 'Basel Badischer Bahnhof', lat: 47.5681, lng: 7.6075 },
  // Autres
  { name: 'Lugano', lat: 46.0052, lng: 8.9469 },
  { name: 'Locarno', lat: 46.1710, lng: 8.7956 },
  { name: 'Bellinzona', lat: 46.1956, lng: 9.0264 },
  { name: 'Luzern', lat: 47.0503, lng: 8.3103 },
  { name: 'St. Gallen', lat: 47.4236, lng: 9.3697 },
  { name: 'Sion', lat: 46.2311, lng: 7.3589 },
  { name: 'Fribourg/Freiburg', lat: 46.8033, lng: 7.1511 },
  { name: 'Neuchâtel', lat: 46.9942, lng: 6.8683 },
  { name: 'La Chaux-de-Fonds', lat: 47.1039, lng: 6.8328 },
  { name: 'Delémont', lat: 47.3650, lng: 7.3453 },
  { name: 'Aarau', lat: 47.3906, lng: 8.0494 },
  { name: 'Olten', lat: 47.3519, lng: 7.9076 },
  { name: 'Solothurn', lat: 47.2081, lng: 7.5389 },
  { name: 'Baden', lat: 47.4764, lng: 8.3061 },
  { name: 'Zug', lat: 47.1742, lng: 8.5172 },
  { name: 'Chur', lat: 46.8536, lng: 9.5286 },
  { name: 'Schaffhausen', lat: 47.6961, lng: 8.6360 },
  { name: 'Rapperswil', lat: 47.2267, lng: 8.8185 },
  // Genève - tram stops (Léman Express)
  { name: 'Annemasse', lat: 46.1928, lng: 6.2358 },
  { name: 'Coppet', lat: 46.3136, lng: 6.1919 },
  { name: 'Versoix', lat: 46.2833, lng: 6.1625 },
  { name: 'Meyrin', lat: 46.2336, lng: 6.0764 },
]

/**
 * Calculate distance between two points using Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Find nearest station to a given coordinate.
 * Returns station name and distance in meters, or null if no coordinates.
 */
export function findNearestStation(lat?: number, lng?: number): { name: string; distanceM: number; lat: number; lng: number } | null {
  if (!lat || !lng) return null

  let nearest: Station | null = null
  let minDist = Infinity

  for (const station of SWISS_STATIONS) {
    const dist = haversineDistance(lat, lng, station.lat, station.lng)
    if (dist < minDist) {
      minDist = dist
      nearest = station
    }
  }

  if (!nearest || minDist > 5000) return null // Max 5km
  return { name: nearest.name, distanceM: Math.round(minDist), lat: nearest.lat, lng: nearest.lng }
}

/**
 * Format distance for display.
 * < 1000m → "X min à pied" (assuming 80m/min walking speed)
 * >= 1000m → "X.X km"
 */
export function formatStationDistance(distanceM: number): string {
  if (distanceM < 1200) {
    const walkMinutes = Math.round(distanceM / 80)
    return `${walkMinutes} min à pied`
  }
  return `${(distanceM / 1000).toFixed(1)} km`
}
