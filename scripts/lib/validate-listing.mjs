/**
 * Validation et scoring qualité des biens scrappés
 * Utilisé par scrape-paginated, scrape-delta, scrape-extra et recalculate-quality
 *
 * Score 0-100 :
 *   >= 80 : Excellent (données complètes, prix cohérent)
 *   60-79 : Bon (quelques données manquantes mais prix OK)
 *   50-59 : Acceptable (affiché mais avec réserves)
 *   < 50  : Suspect (masqué sur la page publique)
 */

// ─── Fourchettes prix/m² par canton (marché suisse 2026) ───────────────────

const PRICE_PER_M2_RANGES = {
  GE: { min: 6000, max: 30000 },
  VD: { min: 4000, max: 20000 },
  VS: { min: 2500, max: 18000 },
  TI: { min: 2000, max: 15000 },
  ZH: { min: 6000, max: 25000 },
  BE: { min: 2500, max: 15000 },
  BS: { min: 5000, max: 20000 },
  BL: { min: 3000, max: 12000 },
  LU: { min: 4000, max: 18000 },
  FR: { min: 2500, max: 12000 },
  AG: { min: 2500, max: 12000 },
  SG: { min: 2500, max: 12000 },
  SO: { min: 2500, max: 10000 },
  NE: { min: 2500, max: 10000 },
  JU: { min: 1500, max: 8000 },
  ZG: { min: 8000, max: 30000 },
  SZ: { min: 5000, max: 20000 },
  NW: { min: 5000, max: 18000 },
  OW: { min: 3000, max: 12000 },
  UR: { min: 2000, max: 10000 },
  GL: { min: 2000, max: 10000 },
  SH: { min: 3000, max: 10000 },
  TG: { min: 2500, max: 10000 },
  AR: { min: 2500, max: 10000 },
  AI: { min: 3000, max: 12000 },
  GR: { min: 3000, max: 20000 },  // Stations de ski → prix élevés possibles
}

const DEFAULT_RANGE = { min: 1500, max: 30000 }

// Prix min/max absolus par type de bien
const PRICE_RANGES_BY_TYPE = {
  apartment: { min: 30000, max: 20000000 },
  house:     { min: 80000, max: 30000000 },
  villa:     { min: 150000, max: 50000000 },
  commercial:{ min: 20000, max: 50000000 },
  land:      { min: 10000, max: 30000000 },
}

const DEFAULT_TYPE_RANGE = { min: 10000, max: 50000000 }

// Bounds géographiques de la Suisse
const SWISS_BOUNDS = {
  latMin: 45.8,
  latMax: 47.85,
  lngMin: 5.9,
  lngMax: 10.55,
}

// ─── Fonction principale ────────────────────────────────────────────────────

/**
 * Calcule le score qualité et les flags d'un listing
 * @param {Object} listing — objet avec les champs de market_listings
 * @returns {{ quality_score: number, quality_flags: string[] }}
 */
export function validateListing(listing) {
  const flags = []
  let score = 100

  const price = Number(listing.price) || 0
  const surface = Number(listing.surface_m2) || 0
  const rooms = Number(listing.rooms) || 0
  const canton = (listing.canton || '').toUpperCase()
  const type = listing.type || 'apartment'
  const lat = Number(listing.lat) || 0
  const lng = Number(listing.lng) || 0
  const photos = listing.photos || []
  const photosCount = Array.isArray(photos) ? photos.length : (Number(listing.photos_count) || 0)
  const title = (listing.title || '').trim()
  const pricePerm2Api = Number(listing.price_per_m2) || 0

  // ─── 1. Prix de base (20 points) ──────────────────────────────────

  if (price <= 0) {
    flags.push('no_price')
    score -= 20
  } else {
    const typeRange = PRICE_RANGES_BY_TYPE[type] || DEFAULT_TYPE_RANGE
    if (price < typeRange.min) {
      flags.push('price_too_low_for_type')
      score -= 15
    } else if (price > typeRange.max) {
      flags.push('price_too_high_for_type')
      score -= 10
    }
  }

  // ─── 2. Prix/m² cohérent (25 points) ─────────────────────────────

  if (price > 0 && surface > 0) {
    const computedPricePerM2 = price / surface
    const cantonRange = PRICE_PER_M2_RANGES[canton] || DEFAULT_RANGE

    if (computedPricePerM2 < cantonRange.min * 0.5) {
      // Prix/m² < 50% du minimum du canton → très suspect
      flags.push('price_per_m2_very_low')
      score -= 25
    } else if (computedPricePerM2 < cantonRange.min) {
      // Prix/m² sous le minimum mais pas aberrant
      flags.push('price_per_m2_low')
      score -= 10
    } else if (computedPricePerM2 > cantonRange.max * 1.5) {
      // Prix/m² > 150% du maximum du canton → suspect
      flags.push('price_per_m2_very_high')
      score -= 20
    } else if (computedPricePerM2 > cantonRange.max) {
      flags.push('price_per_m2_high')
      score -= 8
    }

    // Vérification cohérence avec le prix/m² fourni par l'API
    if (pricePerm2Api > 0) {
      const ecart = Math.abs(computedPricePerM2 - pricePerm2Api) / pricePerm2Api
      if (ecart > 0.5) {
        flags.push('price_per_m2_mismatch')
        score -= 10
      }
    }
  } else if (price > 0 && surface <= 0 && type !== 'land') {
    // Pas de surface pour un bien non-terrain
    flags.push('missing_surface')
    score -= 10
  }

  // ─── 3. Surface cohérente (10 points) ─────────────────────────────

  if (surface > 0) {
    if (surface < 8 && type === 'apartment') {
      flags.push('surface_too_small')
      score -= 10
    } else if (surface > 2000 && type === 'apartment') {
      flags.push('surface_too_large_apartment')
      score -= 10
    } else if (surface > 10000 && type !== 'land') {
      flags.push('surface_too_large')
      score -= 10
    }
  }

  // ─── 4. Pièces (5 points) ─────────────────────────────────────────

  if (rooms <= 0 && type !== 'land' && type !== 'commercial') {
    flags.push('missing_rooms')
    score -= 5
  } else if (rooms > 20) {
    flags.push('rooms_suspicious')
    score -= 5
  }

  // ─── 5. Photos (10 points) ────────────────────────────────────────

  if (photosCount === 0) {
    flags.push('no_photos')
    score -= 10
  } else if (photosCount === 1) {
    flags.push('few_photos')
    score -= 3
  }

  // ─── 6. Coordonnées géographiques (10 points) ─────────────────────

  if (lat === 0 || lng === 0) {
    flags.push('missing_coordinates')
    score -= 10
  } else if (
    lat < SWISS_BOUNDS.latMin || lat > SWISS_BOUNDS.latMax ||
    lng < SWISS_BOUNDS.lngMin || lng > SWISS_BOUNDS.lngMax
  ) {
    flags.push('coordinates_outside_switzerland')
    score -= 10
  }

  // ─── 7. Titre (5 points) ──────────────────────────────────────────

  if (!title || title.length < 5) {
    flags.push('missing_title')
    score -= 5
  }

  // ─── 8. Canton connu (5 points) ───────────────────────────────────

  if (!canton || canton.length !== 2) {
    flags.push('missing_canton')
    score -= 5
  }

  // ─── 9. Cohérence surface/pièces (5 points) ──────────────────────

  if (rooms > 0 && surface > 0 && type === 'apartment') {
    const m2PerRoom = surface / rooms
    if (m2PerRoom < 8) {
      flags.push('surface_per_room_too_low')
      score -= 5
    } else if (m2PerRoom > 150) {
      flags.push('surface_per_room_too_high')
      score -= 5
    }
  }

  // ─── 10. Prix cohérent pour petites surfaces ─────────────────────

  if (price > 0 && surface > 0 && surface < 20 && price > 2000000 && type === 'apartment') {
    flags.push('price_surface_mismatch')
    score -= 15
  }

  // Clamp score entre 0 et 100
  const finalScore = Math.max(0, Math.min(100, score))

  return {
    quality_score: finalScore,
    quality_flags: flags,
  }
}
