// MEGGA Marketplace — URL ↔ MarketFilters sync.
//
// L'URL est la source de vérité pour les filtres de la marketplace publique.
// Permet le deep-linking (/acheter?canton=GE&type=apartment&minPrice=500000)
// et la synchronisation entre Hero search, FilterBar et SortSelector.
//
// Convention :
// - L'UI manipule un type single `type` (string), l'API utilise `types[]`.
// - Les valeurs invalides ou hors-whitelist sont silencieusement ignorées.

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MarketFilters } from './useMarketListings'

export const SWISS_CANTONS = [
  'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU', 'BS', 'BL', 'AG', 'SO', 'ZH', 'LU', 'ZG',
  'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG', 'AR', 'AI', 'SG', 'GR', 'TI',
] as const

export const CANTON_LABELS: Record<string, string> = {
  GE: 'Genève', VD: 'Vaud', VS: 'Valais', NE: 'Neuchâtel', FR: 'Fribourg',
  BE: 'Berne', JU: 'Jura', BS: 'Bâle-Ville', BL: 'Bâle-Campagne', AG: 'Argovie',
  SO: 'Soleure', ZH: 'Zurich', LU: 'Lucerne', ZG: 'Zoug', SZ: 'Schwytz',
  NW: 'Nidwald', OW: 'Obwald', UR: 'Uri', GL: 'Glaris', SH: 'Schaffhouse',
  TG: 'Thurgovie', AR: 'Appenzell R.-E.', AI: 'Appenzell R.-I.', SG: 'Saint-Gall',
  GR: 'Grisons', TI: 'Tessin',
}

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'villa', label: 'Villa' },
  { value: 'commercial', label: 'Commerce' },
  { value: 'office', label: 'Bureau' },
  { value: 'parking', label: 'Parking' },
  { value: 'storage', label: 'Stockage' },
  { value: 'land', label: 'Terrain' },
] as const

type PropertyTypeValue = (typeof PROPERTY_TYPES)[number]['value']

export type SortValue = NonNullable<MarketFilters['sort']>

export const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: 'newest', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'surface_desc', label: 'Plus grande surface' },
  { value: 'best_deals', label: 'Meilleur prix au m²' },
  { value: 'recommended', label: 'Recommandés' },
]

const VALID_SORTS = SORT_OPTIONS.map(o => o.value)
const VALID_TYPES = PROPERTY_TYPES.map(t => t.value) as readonly string[]
const VALID_CANTONS = SWISS_CANTONS as readonly string[]

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined
  const n = parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function parseSort(value: string | null): SortValue | undefined {
  if (!value) return undefined
  return VALID_SORTS.includes(value as SortValue) ? (value as SortValue) : undefined
}

function parseType(value: string | null): PropertyTypeValue | undefined {
  if (!value) return undefined
  return VALID_TYPES.includes(value) ? (value as PropertyTypeValue) : undefined
}

function parseCanton(value: string | null): string | undefined {
  if (!value) return undefined
  return VALID_CANTONS.includes(value) ? value : undefined
}

// Patch type pour le setter. `null` = effacer la clé de l'URL.
export interface UrlFilterPatch {
  canton?: string | null
  type?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  minRooms?: number | null
  minSurface?: number | null
  sort?: SortValue | null
  q?: string | null
}

export interface UrlMarketFilters {
  filters: MarketFilters
  // Valeur UI single du type (pour les dropdowns) — l'API utilise types[].
  selectedType: PropertyTypeValue | undefined
  update: (patch: UrlFilterPatch) => void
  reset: () => void
  isEmpty: boolean
}

/**
 * Lit les filtres depuis l'URL et expose un setter qui écrit dans l'URL.
 * Le `context` (buy/rent) est passé en argument car il vient du routeur
 * (`/acheter` vs `/louer`), pas de l'URL search params.
 */
export function useMarketFilters(context: 'buy' | 'rent'): UrlMarketFilters {
  const [params, setParams] = useSearchParams()

  const selectedType = useMemo(() => parseType(params.get('type')), [params])

  const filters: MarketFilters = useMemo(() => ({
    context,
    canton: parseCanton(params.get('canton')),
    types: selectedType ? [selectedType] : undefined,
    minPrice: parsePositiveInt(params.get('minPrice')),
    maxPrice: parsePositiveInt(params.get('maxPrice')),
    minRooms: parsePositiveInt(params.get('minRooms')),
    minSurface: parsePositiveInt(params.get('minSurface')),
    sort: parseSort(params.get('sort')) ?? 'newest',
    q: params.get('q')?.trim() || undefined,
  }), [context, params, selectedType])

  const update = useCallback((patch: UrlFilterPatch) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v))) {
        next.delete(k)
      } else {
        next.set(k, String(v))
      }
    }
    setParams(next, { replace: false })
  }, [params, setParams])

  const reset = useCallback(() => {
    setParams(new URLSearchParams(), { replace: false })
  }, [setParams])

  const isEmpty =
    !filters.canton &&
    !filters.types?.length &&
    !filters.minPrice &&
    !filters.maxPrice &&
    !filters.minRooms &&
    !filters.minSurface &&
    !filters.q &&
    (filters.sort === 'newest' || !filters.sort)

  return { filters, selectedType, update, reset, isEmpty }
}
