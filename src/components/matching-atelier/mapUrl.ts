// Atelier Matching — helpers purs de la mini-carte (Mapbox Static Images).
// Séparés du composant pour être testables sans React ni env (token injecté).

/**
 * Coords exploitables pour une carte. Retourne `[lng, lat]` (ordre Mapbox) ou
 * `null` si inutilisable :
 *   - manquante (null/undefined),
 *   - non finie (NaN/Infinity),
 *   - « null island » (0,0) — défaut d'une colonne géo non remplie : on
 *     préfère le géocodage de l'adresse ou le placeholder à une carte du
 *     golfe de Guinée,
 *   - hors bornes géographiques.
 */
export function validCoords(lat: number | null | undefined, lng: number | null | undefined): [number, number] | null {
  if (lat == null || lng == null) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat === 0 && lng === 0) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lng, lat]
}

/**
 * URL Mapbox Static Images. Style `streets-v12` (couleur) dans les deux thèmes
 * — la carte est du contenu, comme les photos d'annonce qui restent en couleur
 * en mode sombre ; pin noir #0B0C0E (accent, lisible sur le fond clair de
 * streets). `token` injecté (pas de lecture d'env ici → testable).
 */
export function buildStaticMapUrl(lng: number, lat: number, token: string): string {
  // @2x pour la netteté ; 500x320 logique → 1000x640 réel (sous le plafond Mapbox)
  return (
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
    `pin-s+0b0c0e(${lng},${lat})/${lng},${lat},14,0/500x320@2x` +
    `?access_token=${token}&attribution=false&logo=false`
  )
}
