import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface SmartParsedFilters {
  canton?: string
  city?: string
  types?: string[]
  minPrice?: number
  maxPrice?: number
  minRooms?: number
  maxRooms?: number
  minSurface?: number
  maxSurface?: number
  features?: string[]
  confidence: 'high' | 'medium' | 'low'
}

interface ParseResponse {
  filters: SmartParsedFilters
  usage: {
    input_tokens: number
    output_tokens: number
    cost_usd: number
    provider: string
  }
}

// Heuristic — runs client-side, no API call. Decides whether a query looks
// like natural language (worth sending to DeepSeek) vs a plain city name
// (current behaviour, instant, zero cost).
export function isLikelyNaturalLanguage(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return false
  const wordCount = trimmed.split(/\s+/).length
  const hasNumbers = /\d/.test(trimmed)
  const hasPriceKeyword = /\b(max|sous|moins|entre|chf|k|mio|mo|mois|million|millions)\b/i.test(trimmed)
  const hasFeatureKeyword = /\b(balcon|piscine|pool|vue|view|garage|meubl|furnished|animaux|pets|terrasse|minergie|cheminée|fireplace)\b/i.test(trimmed)
  return wordCount >= 3 || hasNumbers || hasPriceKeyword || hasFeatureKeyword
}

// Detect the UI language from html.lang or navigator — passed to the
// edge function so the system prompt is tuned to the user.
function detectLang(): 'fr' | 'de' | 'en' | 'it' {
  const raw = (document.documentElement.lang || navigator.language || 'fr').slice(0, 2).toLowerCase()
  if (raw === 'de' || raw === 'en' || raw === 'it') return raw
  return 'fr'
}

interface ParseArgs {
  query: string
  context: 'buy' | 'rent'
}

// Adapter — LLM output (numbers, code arrays) → page-level Filters state
// (strings, because the form inputs are controlled strings). Fields absent
// from the parsed result are left unset so the caller can merge with a
// reset patch.
export function smartFiltersToPartialFilters(f: SmartParsedFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (f.canton) out.canton = f.canton
  if (f.city) out.city = f.city
  if (f.types && f.types.length) out.types = f.types
  if (f.minPrice != null) out.minPrice = String(f.minPrice)
  if (f.maxPrice != null) out.maxPrice = String(f.maxPrice)
  if (f.minRooms != null) {
    out.rooms = f.minRooms >= 5 ? '5+' : String(Math.floor(f.minRooms))
  }
  if (f.minSurface != null) out.minSurface = String(f.minSurface)
  if (f.features && f.features.length) out.features = f.features
  return out
}

// Human-readable labels. Keep keys in sync with the whitelists in
// supabase/functions/parse-search-query/index.ts.
const TYPE_LABELS_FR: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  villa: 'Villa',
  commercial: 'Commerce',
  office: 'Bureau',
  parking: 'Parking',
  storage: 'Cave',
  land: 'Terrain',
  loft: 'Loft',
  attic: 'Attique',
  studio: 'Studio',
}

const FEATURE_LABELS_FR: Record<string, string> = {
  balcony: 'Balcon',
  pool: 'Piscine',
  view: 'Vue',
  garage: 'Garage',
  parking: 'Parking',
  elevator: 'Ascenseur',
  furnished: 'Meublé',
  pets_allowed: 'Animaux OK',
  fireplace: 'Cheminée',
  new_building: 'Neuf',
  minergie: 'Minergie',
}

// Human-readable chip labels (i18n done at render site — keep raw tokens here).
export function buildSmartChipLabels(f: SmartParsedFilters): string[] {
  const labels: string[] = []
  if (f.types?.length) {
    for (const t of f.types) labels.push(TYPE_LABELS_FR[t] ?? t.charAt(0).toUpperCase() + t.slice(1))
  }
  if (f.city) labels.push(f.city)
  else if (f.canton) labels.push(f.canton)
  if (f.minRooms != null) labels.push(`${f.minRooms}+ pièces`)
  if (f.maxPrice != null) {
    const p = f.maxPrice
    const compact = p >= 1_000_000 ? `${(p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1)}M`
      : p >= 1000 ? `${(p / 1000).toFixed(p % 1000 === 0 ? 0 : 1)}K`
      : String(p)
    labels.push(`< ${compact}`)
  }
  if (f.minSurface != null) labels.push(`${f.minSurface}+ m²`)
  if (f.features?.length) {
    for (const code of f.features) {
      labels.push(FEATURE_LABELS_FR[code] ?? code)
    }
  }
  return labels
}

export function useSmartSearchParser() {
  return useMutation<ParseResponse, Error, ParseArgs>({
    mutationFn: async ({ query, context }) => {
      const { data, error } = await supabase.functions.invoke<ParseResponse>(
        'parse-search-query',
        {
          body: {
            query: query.trim().slice(0, 300),
            context,
            lang: detectLang(),
          },
        },
      )
      if (error) throw error
      if (!data || !data.filters) throw new Error('invalid_response')
      return data
    },
  })
}
