// Helpers Mapbox partagés (Static Images + géocodage). Le token est TOUJOURS injecté
// en paramètre (jamais lu de l'env ici) → les helpers d'URL restent purs/testables, et
// les composants décident d'où vient le token (import.meta.env.VITE_MAPBOX_TOKEN côté app).
//
// Choix d'archi (cf. PropertyStaticMap / SgaMiniMap) : on rend des IMAGES STATIQUES
// (une <img>, zéro instance WebGL) → la carte se charge sur CHAQUE annonce / match sans
// saturer le navigateur (pas de limite de contextes GL). Coords stockées d'abord, le
// géocodage n'est qu'un fallback rare (et dédupé) pour les biens sans lat/lng.

/**
 * Coords exploitables pour une carte. Retourne `[lng, lat]` (ordre Mapbox) ou `null` :
 * manquante, non finie (NaN/Infinity), « null island » (0,0 = colonne géo vide), ou hors bornes.
 */
export function validCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
): [number, number] | null {
  if (lat == null || lng == null) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat === 0 && lng === 0) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lng, lat]
}

/**
 * URL Mapbox Static Images. Style `streets-v12` (la carte est du contenu, comme une
 * photo — reste en couleur en dark) ; pin accent `#0B0C0E`. `@2x` pour la netteté
 * (500×320 logique → 1000×640 réel, sous le plafond Mapbox). Token injecté.
 */
export function buildStaticMapUrl(lng: number, lat: number, token: string): string {
  return (
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
    `pin-s+0b0c0e(${lng},${lat})/${lng},${lat},14,0/500x320@2x` +
    `?access_token=${token}&attribution=false&logo=false`
  )
}

// Dédup process-wide des géocodages (clé = adresse). null = échec mémorisé (les erreurs
// transitoires ne re-tentent pas avant rechargement — compromis assumé pour une carte de fond).
const geocodeCache = new Map<string, [number, number] | null>()

/**
 * Géocode une adresse suisse → `[lng, lat]` (ou `null`). Fallback quand le bien n'a pas
 * de coords stockées. Dédupé/caché ; respecte l'AbortSignal (pas de pollution du cache sur abort).
 */
export async function geocodeAddress(
  address: string,
  token: string,
  signal: AbortSignal,
): Promise<[number, number] | null> {
  if (!address || !token) return null
  if (geocodeCache.has(address)) return geocodeCache.get(address)!
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json` +
      `?access_token=${token}&country=ch&limit=1&language=fr`
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`geocode ${res.status}`)
    const json = (await res.json()) as { features?: Array<{ center?: [number, number] }> }
    const c = json.features?.[0]?.center // [lng, lat]
    const coords = c ? validCoords(c[1], c[0]) : null
    geocodeCache.set(address, coords)
    return coords
  } catch (e) {
    if ((e as Error).name === 'AbortError') return null
    geocodeCache.set(address, null)
    return null
  }
}
