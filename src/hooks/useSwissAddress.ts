/**
 * Autocomplétion d'adresses suisses via l'API geo.admin.ch (SearchServer).
 *
 * Recherche débounced (300ms, min 3 caractères), résultats parsés en champs
 * structurés (rue/NPA/ville/canton + WGS84) et mis en cache mémoire par requête.
 * Aucune clé API : service public fédéral.
 */
import { useState, useEffect, useRef, useCallback } from 'react'

export interface SwissAddressSuggestion {
  id: number
  label: string        // Display label (HTML stripped)
  labelHtml: string    // Original label with <b> tags
  street: string       // Street name + number
  streetName: string   // Street name only
  streetNumber: string // Street number only
  city: string         // City name (capitalized)
  canton: string       // Canton code (2 letters uppercase)
  postalCode: string   // NPA (4 digits)
  lat: number          // WGS84 latitude
  lng: number          // WGS84 longitude
}

interface GeoAdminResult {
  id: number
  weight: number
  attrs: {
    detail: string
    label: string
    num?: number
    lat: number
    lon: number
    x: number
    y: number
    origin: string
    rank: number
    zoomlevel: number
    featureId: string
    geom_st_box2d: string
  }
}

interface GeoAdminResponse {
  results: GeoAdminResult[]
}

const API_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer'
const DEBOUNCE_MS = 300
const MIN_CHARS = 3
const MAX_RESULTS = 8

// Canton code mapping (lowercase to uppercase)
const CANTON_MAP: Record<string, string> = {
  ge: 'GE', vd: 'VD', vs: 'VS', ne: 'NE', fr: 'FR', be: 'BE', ju: 'JU',
  bs: 'BS', bl: 'BL', ag: 'AG', so: 'SO', zh: 'ZH', lu: 'LU', zg: 'ZG',
  sz: 'SZ', nw: 'NW', ow: 'OW', ur: 'UR', gl: 'GL', sh: 'SH', tg: 'TG',
  ar: 'AR', ai: 'AI', sg: 'SG', gr: 'GR', ti: 'TI',
}

/** Retire les balises HTML (l'API renvoie le libellé avec des `<b>` de surlignage). */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/** Met en casse titre en gérant les mots composés (Vufflens-la-Ville). */
function capitalize(str: string): string {
  return str
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .split('-')
    .map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join('-')
}

/**
 * Parse the "detail" field from geo.admin.ch
 * Format: "rue du rhone 1 1204 geneve 6621 geneve ch ge"
 *          ^street+num    ^NPA ^city   ^id   ^commune ^country ^canton
 *
 * Strategy: find the 4-digit NPA, everything before is street, everything after is city/canton
 */
function parseDetail(detail: string, attrs: GeoAdminResult['attrs']): Omit<SwissAddressSuggestion, 'id' | 'label' | 'labelHtml'> {
  const parts = detail.trim().toLowerCase().split(/\s+/)

  // Find the NPA (4-digit number)
  let npaIndex = -1
  for (let i = 0; i < parts.length; i++) {
    if (/^\d{4}$/.test(parts[i]) && parseInt(parts[i]) >= 1000 && parseInt(parts[i]) <= 9999) {
      npaIndex = i
      break
    }
  }

  if (npaIndex === -1) {
    // Fallback: return raw data
    return {
      street: stripHtml(attrs.label),
      streetName: stripHtml(attrs.label),
      streetNumber: '',
      city: '',
      canton: '',
      postalCode: '',
      lat: attrs.lat,
      lng: attrs.lon,
    }
  }

  const postalCode = parts[npaIndex]

  // Street = everything before NPA
  const streetParts = parts.slice(0, npaIndex)

  // Check if last part of street is a number (street number)
  let streetNumber = ''
  let streetNameParts = [...streetParts]
  if (streetParts.length > 1) {
    const lastPart = streetParts[streetParts.length - 1]
    if (/^\d+[a-z]?$/.test(lastPart)) {
      streetNumber = lastPart
      streetNameParts = streetParts.slice(0, -1)
    }
  }

  const streetName = capitalize(streetNameParts.join(' '))
  const street = streetNumber ? `${streetName} ${streetNumber}` : streetName

  // City = first word after NPA
  const city = npaIndex + 1 < parts.length ? capitalize(parts[npaIndex + 1]) : ''

  // Canton = last 2-letter code
  const lastPart = parts[parts.length - 1]
  const canton = CANTON_MAP[lastPart] || lastPart.toUpperCase()

  return {
    street,
    streetName,
    streetNumber,
    city,
    canton,
    postalCode,
    lat: attrs.lat,
    lng: attrs.lon,
  }
}

/** Assemble une suggestion complète (id + libellés) à partir d'un résultat brut de l'API. */
function parseSuggestion(result: GeoAdminResult): SwissAddressSuggestion {
  const parsed = parseDetail(result.attrs.detail, result.attrs)
  return {
    id: result.id,
    label: stripHtml(result.attrs.label),
    labelHtml: result.attrs.label,
    ...parsed,
  }
}

// Simple in-memory cache
const cache = new Map<string, SwissAddressSuggestion[]>()

/** Hook d'autocomplétion : `query`/`setQuery` pilotent une recherche débounced, `suggestions` en sort. */
export function useSwissAddress(initialValue = '') {
  const [query, setQuery] = useState(initialValue)
  const [suggestions, setSuggestions] = useState<SwissAddressSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (searchText: string) => {
    const trimmed = searchText.trim()

    if (trimmed.length < MIN_CHARS) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    // Check cache
    const cacheKey = trimmed.toLowerCase()
    if (cache.has(cacheKey)) {
      setSuggestions(cache.get(cacheKey)!)
      setIsLoading(false)
      return
    }

    // Abort previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        searchText: trimmed,
        type: 'locations',
        origins: 'address',
        limit: String(MAX_RESULTS),
        sr: '4326',
      })

      const res = await fetch(`${API_URL}?${params}`, {
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const data: GeoAdminResponse = await res.json()
      const parsed = data.results.map(parseSuggestion)

      // Cache the result
      cache.set(cacheKey, parsed)

      setSuggestions(parsed)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (query.trim().length < MIN_CHARS) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    timerRef.current = setTimeout(() => {
      search(query)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, search])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const clear = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setError(null)
  }, [])

  return {
    query,
    setQuery,
    suggestions,
    isLoading,
    error,
    clear,
  }
}
