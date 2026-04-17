import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Search,
  ChevronDown,
  X,
  Map,
  SlidersHorizontal,
  GitCompareArrows,
  Check,
  Bookmark,
  LocateFixed,
  PenTool,
  Mountain,
  Satellite,
  Sun as SunIcon,
  Moon,
  Thermometer,
  Maximize as MaximizeIcon,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import BuyerSidebar from '@/components/search/BuyerSidebar'
import PriceRangeDropdown from '@/components/search/PriceRangeDropdown'
import { FilterPill, FilterOption } from '@/components/search/FilterPill'
import FavoritesPanel from '@/components/search/FavoritesPanel'
import SavedSearchesPanel from '@/components/search/SavedSearchesPanel'
import AlertsPanel from '@/components/search/AlertsPanel'
import AccessibilityPanel from '@/components/search/AccessibilityPanel'
import ContactPanel from '@/components/search/ContactPanel'
// Lazy-load MapView — Mapbox GL is ~470KB gzip, don't block initial list render
const MapView = lazy(() => import('@/components/map/MapView'))
import type { MapViewHandle } from '@/components/map/MapView'
import CompareDrawer from '@/components/listings/CompareDrawer'
import ListingPreviewPanel from '@/components/listing/ListingPreviewPanel'
import SaveSearchDialog from '@/components/search/SaveSearchDialog'
import SavedSearchesList from '@/components/search/SavedSearchesList'
import { useMarketListings, useMapPoints, useMarketStats } from '@/hooks/useMarketListings'
import { usePageMeta } from '@/hooks/usePageMeta'
import { sortByRecommendation } from '@/lib/recommendationScore'
import { useFavorites } from '@/hooks/useFavorites'
import { cn } from '@/lib/utils'
import { PROPERTY_TYPE_LABELS } from '@/lib/constants'
import { useMarketTemperature } from '@/hooks/useMarketInsights'
import { useVirtualizer } from '@tanstack/react-virtual'
import SearchListingCard from '@/components/search/SearchListingCard'
import type { ListingCardData } from '@/components/listings/ListingCard'
import {
  type Filters,
  SORT_OPTIONS, ROOM_OPTIONS, BEDROOM_OPTIONS, BATHROOM_OPTIONS,
  LIFESTYLE_TAGS, ENERGY_OPTIONS, CANTON_LABELS,
  parseNaturalLanguageQuery,
  parseFiltersFromParams, filtersToParams, toServerFilters,
} from '@/lib/searchFilters'

// SearchListingCard extracted to @/components/search/SearchListingCard.tsx

// ─── MAIN SEARCH PAGE ───────────────────────────────────────────────────────

interface SearchPageProps {
  context?: 'buy' | 'rent'
}

export default function SearchPage({ context }: SearchPageProps = {}) {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => {
    const parsed = parseFiltersFromParams(searchParams)
    return context ? { ...parsed, context } : parsed
  })

  // Keep filters.context in sync if the prop changes (e.g. route switch)
  useEffect(() => {
    if (context && filters.context !== context) {
      setFilters((prev) => ({
        ...prev,
        context,
        // Reset 'recommended' sort when switching to rent (not relevant)
        sort: context === 'rent' && prev.sort === 'recommended' ? 'relevance' : prev.sort,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context])

  // Page meta (SEO) — adapts to context
  usePageMeta({
    title: filters.context === 'rent'
      ? t('rental.seoTitle', 'Biens à louer en Suisse')
      : t('search.seoTitle', 'Biens à vendre en Suisse'),
    description: filters.context === 'rent'
      ? t('rental.seoDescription', 'Découvrez les appartements, maisons et villas à louer en Suisse. Filtrez par canton, loyer, pièces, meublé et disponibilité.')
      : t('search.seoDescription', 'Parcourez les biens à vendre en Suisse. Filtrez par canton, prix, pièces, surface et caractéristiques.'),
  })
  const [hoveredListing, setHoveredListing] = useState<string>()
  const [showMobileMap, setShowMobileMap] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [searchInput, setSearchInput] = useState(filters.q)
  const [zoneFilterIds, setZoneFilterIds] = useState<string[] | null>(null)
  const [plusOpen, setPlusOpen] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>(() => {
    // Restore from URL params first, then localStorage
    const urlCompare = searchParams.get('compare')
    if (urlCompare) return urlCompare.split(',').filter(Boolean).slice(0, 3)
    try {
      const stored = localStorage.getItem('megga-compare')
      return stored ? JSON.parse(stored).slice(0, 3) : []
    } catch { return [] }
  })
  const [showCompare, setShowCompare] = useState(false)
  const [compareToast, setCompareToast] = useState<string | null>(null)
  const [savedSearchToast] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savedListOpen, setSavedListOpen] = useState(false)
  const { isFavorite, toggleFavorite, favoriteIds } = useFavorites()
  const [previewId, setPreviewId] = useState<string | null>(() => searchParams.get('listing'))
  const mapViewRef = useRef<MapViewHandle>(null)
  const [sidebarView, setSidebarView] = useState('search')
  const [mapImmersive, setMapImmersive] = useState(false)
  const [mapToolsOpen, setMapToolsOpen] = useState(false)
  const [mapState, setMapState] = useState({ isDrawing: false, hasPolygon: false, showTools: false, showHeatmap: false, mapStyleId: 'standard' as string })
  const syncMapState = useCallback(() => {
    const m = mapViewRef.current
    if (m) {
      setMapState({
        isDrawing: !!m.isDrawing,
        hasPolygon: !!m.hasPolygon,
        showTools: !!m.showTools,
        showHeatmap: !!m.showHeatmap,
        mapStyleId: m.mapStyleId ?? 'standard',
      })
    }
  }, [])
  const mapToolsRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewedIds, setViewedIds] = useState<string[]>([])
  const listScrollRef = useRef<HTMLDivElement>(null)
  // Track columns for virtualization (1 on mobile, 2 on sm+)
  const [gridCols, setGridCols] = useState(() => (typeof window !== 'undefined' && window.innerWidth >= 640) ? 2 : 1)

  // Track grid columns for virtualization (responsive)
  useLayoutEffect(() => {
    const onResize = () => setGridCols(window.innerWidth >= 640 ? 2 : 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Persist split ratio + resize map
  // Close map tools dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (mapToolsRef.current && !mapToolsRef.current.contains(e.target as Node)) setMapToolsOpen(false)
    }
    if (mapToolsOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [mapToolsOpen])

  // Market temperature for current location filter
  const { data: marketTemp } = useMarketTemperature(filters.canton || undefined, filters.city || undefined)
  const medianPricePerM2 = marketTemp?.medianPricePerM2 || 0

  // Canton stats for mobile filter
  const { data: marketStats } = useMarketStats(filters.context)

  // Convertir filtres UI → filtres serveur (memoized to avoid new object ref every render)
  const serverFilters = useMemo(() => toServerFilters(filters), [filters])

  // Fetch listings paginées depuis Supabase (filtrage côté serveur)
  const {
    data: listingsData,
    isLoading: isLoadingListings,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMarketListings(serverFilters)

  // Fetch points carte (légers, tous les biens avec lat/lng)
  const { data: mapPoints } = useMapPoints(serverFilters)

  // Aplatir les pages en une seule liste
  const allListings = useMemo(() => listingsData?.pages.flatMap((p) => p.listings) ?? [], [listingsData])
  const totalCount = listingsData?.pages[0]?.totalCount ?? 0

  // Memoize price array for PriceRangeDropdown to avoid recalc every render
  const priceArray = useMemo(
    () => allListings.map(l => l.price).filter((p): p is number => typeof p === 'number' && p > 0),
    [allListings]
  )

  // Sync filters to URL
  useEffect(() => {
    const params = filtersToParams(filters)
    setSearchParams(params, { replace: true })
  }, [filters, setSearchParams])

  const openPreview = useCallback((id: string) => {
    setPreviewId(id)
    setViewedIds(prev => prev.includes(id) ? prev : [...prev, id])
    const params = new URLSearchParams(window.location.search)
    params.set('listing', id)
    window.history.replaceState(null, '', `?${params.toString()}`)
  }, [])
  const closePreview = useCallback(() => {
    setPreviewId(null)
    const params = new URLSearchParams(window.location.search)
    params.delete('listing')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [])

  const updateFilter = useCallback(
    (patch: Partial<Filters>) => {
      setFilters((prev) => ({ ...prev, ...patch }))
    },
    []
  )

  // Stable callback for MapView quick filters (avoids new ref every render)
  const handleQuickFilter = useCallback((qf: { type?: string; maxPrice?: number; minRooms?: number }) => {
    updateFilter({
      types: qf.type ? [qf.type] : [],
      maxPrice: qf.maxPrice ? String(qf.maxPrice) : '',
      rooms: qf.minRooms ? String(qf.minRooms) : '',
    })
  }, [updateFilter])

  // Zone filter (polygon drawn on map) + viewport filter ("search as I move")
  const filtered = useMemo(() => {
    let result = allListings
    if (zoneFilterIds) {
      result = result.filter((l) => zoneFilterIds.includes(l.id))
    }
    return result
  }, [allListings, zoneFilterIds])

  // Recommendation sorting (client-side)
  const visible = filters.sort === 'recommended'
    ? sortByRecommendation(filtered, {
        favoriteIds,
        viewedIds,
        savedSearchFilters: [],
      }, medianPricePerM2)
    : filtered
  const hasMore = hasNextPage ?? false

  // Group visible listings into rows for virtualization
  const rows = useMemo(() => {
    const result: ListingCardData[][] = []
    for (let i = 0; i < visible.length; i += gridCols) {
      result.push(visible.slice(i, i + gridCols))
    }
    return result
  }, [visible, gridCols])

  // Virtual row virtualizer — each row is ~400px (aspect-[4/3] image + info)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 400,
    overscan: 3,
  })

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.minPrice !== '' ||
    filters.maxPrice !== '' ||
    filters.rooms !== '' ||
    filters.bedrooms !== '' ||
    filters.minSurface !== '' ||
    filters.city !== '' ||
    filters.canton !== '' ||
    filters.lifestyleTags.length > 0 ||
    filters.energyLabel !== ''

  const activeFilterCount = [
    filters.types.length > 0,
    filters.minPrice || filters.maxPrice,
    filters.rooms,
    filters.bedrooms,
    filters.minSurface,
    filters.city || filters.canton,
    filters.lifestyleTags.length > 0,
    filters.energyLabel,
  ].filter(Boolean).length

  function clearAllFilters() {
    updateFilter({
      types: [],
      minPrice: '',
      maxPrice: '',
      rooms: '',
      bedrooms: '',
      bathrooms: '',
      minSurface: '',
      city: '',
      canton: '',
      lifestyleTags: [],
      energyLabel: '',
      q: '',
    })
    setSearchInput('')
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchInput.trim()) {
      updateFilter({ q: '' })
      return
    }

    // Parse natural language query
    const parsed = parseNaturalLanguageQuery(searchInput)

    if (parsed.understood.length > 0) {
      const resetFilters: Partial<Filters> = {
        types: [],
        minPrice: '',
        maxPrice: '',
        rooms: '',
        minSurface: '',
        bedrooms: '',
        city: '',
        canton: '',
        lifestyleTags: [],
        q: '',
      }
      updateFilter({ ...resetFilters, ...parsed.filters })
    } else {
      updateFilter({ q: searchInput })
    }
  }


  // Compare helpers — persist to localStorage + URL
  useEffect(() => {
    try { localStorage.setItem('megga-compare', JSON.stringify(compareIds)) } catch { /* ignore storage errors */ }
    // Update URL param
    const sp = new URLSearchParams(searchParams)
    if (compareIds.length > 0) sp.set('compare', compareIds.join(','))
    else sp.delete('compare')
    setSearchParams(sp, { replace: true })
  }, [compareIds]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) {
        setCompareToast('Maximum 3 biens en comparaison')
        setTimeout(() => setCompareToast(null), 2500)
        return prev
      }
      return [...prev, id]
    })
  }
  const compareListings = allListings.filter((l) => compareIds.includes(l.id))

  // Price pill label
  const pricePillLabel = (() => {
    if (filters.minPrice && filters.maxPrice) {
      return filters.context === 'rent'
        ? `CHF ${Number(filters.minPrice).toLocaleString('fr-CH').replace(/\s/g, "'")} – ${Number(filters.maxPrice).toLocaleString('fr-CH').replace(/\s/g, "'")}/m`
        : `CHF ${Number(filters.minPrice).toLocaleString('fr-CH').replace(/\s/g, "'")} – ${Number(filters.maxPrice).toLocaleString('fr-CH').replace(/\s/g, "'")}`
    }
    if (filters.minPrice) return `Dès CHF ${Number(filters.minPrice).toLocaleString('fr-CH').replace(/\s/g, "'")}`
    if (filters.maxPrice) return `Max CHF ${Number(filters.maxPrice).toLocaleString('fr-CH').replace(/\s/g, "'")}`
    return t('search.price')
  })()

  return (
    <div className="h-screen flex bg-white">
      {/* ─── WCAG 1.3.1 — h1 caché visuellement pour screen readers ─── */}
      <h1 className="sr-only">
        {filters.context === 'rent' ? 'Biens à louer en Suisse' : 'Biens à vendre en Suisse'}
      </h1>

      {/* ─── LEFT SIDEBAR (Zillow-style) ─── */}
      {!mapImmersive && <BuyerSidebar activeView={sidebarView} onViewChange={setSidebarView} context={filters.context} />}

      {/* ─── RIGHT CONTENT ─── */}
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
      {!mapImmersive && <Navbar />}

      {/* ─── UNIFIED STICKY BAR: Search + Filters ─── */}
      <div className={cn('sticky top-14 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100', (mapImmersive || sidebarView !== 'search') && 'hidden')}>
        <div className="px-4 md:px-6 py-4">

          {/* Desktop: single unified row — constrained to left panel width */}
          <div className="hidden md:flex items-center gap-2.5" style={{ maxWidth: '45%' }}>
            {/* Search input — flexible width */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 h-9 flex-[2] min-w-[312px] transition-all focus-within:bg-white focus-within:ring-1 focus-within:ring-gray-300">
              <Search className="h-3.5 w-3.5 text-gray-500 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ville, quartier, canton..."
                className="flex-1 text-sm bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); clearAllFilters() }} className="text-gray-500 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </form>

            {/* Type */}
            <FilterPill
              label={filters.types.length ? filters.types.map((tp) => PROPERTY_TYPE_LABELS[tp as keyof typeof PROPERTY_TYPE_LABELS] || tp).join(', ') : t('search.type')}
              active={filters.types.length > 0}
              dark
            >
              {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                <FilterOption key={value} selected={filters.types.includes(value)} onClick={() => {
                  const next = filters.types.includes(value) ? filters.types.filter((t) => t !== value) : [...filters.types, value]
                  updateFilter({ types: next })
                }}>{label}</FilterOption>
              ))}
            </FilterPill>

            {/* Prix — Zillow-style dropdown */}
            <PriceRangeDropdown
              label={pricePillLabel}
              active={!!filters.minPrice || !!filters.maxPrice}
              minPrice={filters.minPrice}
              maxPrice={filters.maxPrice}
              context={filters.context}
              prices={priceArray}
              onChange={(min, max) => updateFilter({ minPrice: min, maxPrice: max })}
            />

            {/* Pièces */}
            <FilterPill label={filters.rooms ? t('search.nRooms', { count: filters.rooms }) : t('search.roomsFilter')} active={!!filters.rooms} dark>
              {ROOM_OPTIONS.map((r) => (
                <FilterOption key={r} selected={filters.rooms === r} onClick={() => updateFilter({ rooms: filters.rooms === r ? '' : r })}>{r} pièces</FilterOption>
              ))}
            </FilterPill>

            {/* Rental-only filters: Meublé + Disponible immédiatement */}
            {filters.context === 'rent' && (
              <>
                <button
                  type="button"
                  onClick={() => updateFilter({ isFurnished: !filters.isFurnished })}
                  className={cn(
                    'flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer',
                    filters.isFurnished ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  aria-pressed={filters.isFurnished}
                >
                  Meublé
                </button>
                <button
                  type="button"
                  onClick={() => updateFilter({ availableNow: !filters.availableNow })}
                  className={cn(
                    'flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer',
                    filters.availableNow ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  aria-pressed={filters.availableNow}
                >
                  Dispo immédiate
                </button>
              </>
            )}

            {/* "Plus" filter — wide panel with grid layout */}
            {(() => {
              const plusCount = [filters.minSurface, filters.bedrooms, filters.bathrooms, filters.lifestyleTags.length > 0, filters.energyLabel].filter(Boolean).length
              const plusActive = !!(filters.minSurface || filters.bedrooms || filters.bathrooms || filters.lifestyleTags.length || filters.energyLabel)
              return (
                <div className="relative" ref={(el) => {
                  // Close on outside click — reuse FilterPill pattern inline
                  if (!el) return
                  const handler = (e: MouseEvent) => {
                    if (!el.contains(e.target as Node)) setPlusOpen(false)
                  }
                  if (plusOpen) document.addEventListener('mousedown', handler)
                  return () => document.removeEventListener('mousedown', handler)
                }}>
                  <button
                    type="button"
                    onClick={() => setPlusOpen(!plusOpen)}
                    className={cn(
                      'flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer',
                      plusActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {plusCount > 0 ? t('search.moreWithCount', { count: plusCount }) : t('search.more')}
                    <ChevronDown className={cn('w-3 h-3 transition-transform', plusActive ? 'text-white/60' : 'text-gray-500', plusOpen && 'rotate-180')} />
                  </button>
                  {plusOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-[620px] bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-6 animate-[fadeIn_0.15s_ease-out]">
                      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                      <div className="grid grid-cols-3 gap-8">

                        {/* Column 1 — Surface & Énergie */}
                        <div className="space-y-6">
                          <div>
                            <p className="text-xs font-semibold text-gray-900 mb-3">Surface min.</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {['30', '50', '80', '100', '150', '200'].map((s) => (
                                <button key={s} type="button" onClick={() => updateFilter({ minSurface: filters.minSurface === s ? '' : s })} className={cn('h-9 text-xs font-medium rounded-lg transition-all cursor-pointer', filters.minSurface === s ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}>
                                  {s} m²
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="h-px bg-gray-100" />

                          <div>
                            <p className="text-xs font-semibold text-gray-900 mb-3">Énergie</p>
                            <div className="space-y-1.5">
                              {ENERGY_OPTIONS.map((e) => (
                                <button key={e.value} type="button" onClick={() => updateFilter({ energyLabel: filters.energyLabel === e.value ? '' : e.value })} className={cn('w-full h-8 px-3 text-xs font-medium rounded-lg text-left transition-all cursor-pointer', filters.energyLabel === e.value ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}>
                                  {e.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Column 2 — Chambres, Salles de bain, Étage */}
                        <div className="space-y-6">
                          <div>
                            <p className="text-xs font-semibold text-gray-900 mb-3">Chambres</p>
                            <div className="flex gap-1.5">
                              {BEDROOM_OPTIONS.map((b) => (
                                <button key={`bed-${b}`} type="button" onClick={() => updateFilter({ bedrooms: filters.bedrooms === b ? '' : b })} className={cn('flex-1 h-9 text-xs font-medium rounded-lg transition-all cursor-pointer', filters.bedrooms === b ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}>
                                  {b}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-gray-900 mb-3">Salles de bain</p>
                            <div className="flex gap-1.5">
                              {BATHROOM_OPTIONS.map((b) => (
                                <button key={`bath-${b}`} type="button" onClick={() => updateFilter({ bathrooms: filters.bathrooms === b ? '' : b })} className={cn('flex-1 h-9 text-xs font-medium rounded-lg transition-all cursor-pointer', filters.bathrooms === b ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}>
                                  {b}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="h-px bg-gray-100" />

                          <div>
                            <p className="text-xs font-semibold text-gray-900 mb-3">Équipements</p>
                            <div className="space-y-1.5">
                              {LIFESTYLE_TAGS.filter(t => ['terrasse', 'balcon', 'jardin', 'parking', 'piscine', 'ascenseur', 'meuble', 'dernier_etage'].includes(t.value)).map((tag) => (
                                <button key={tag.value} type="button" onClick={() => {
                                  const next = filters.lifestyleTags.includes(tag.value) ? filters.lifestyleTags.filter((t) => t !== tag.value) : [...filters.lifestyleTags, tag.value]
                                  updateFilter({ lifestyleTags: next })
                                }} className={cn('w-full h-8 px-3 text-xs font-medium rounded-lg text-left transition-all cursor-pointer flex items-center justify-between', filters.lifestyleTags.includes(tag.value) ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}>
                                  {tag.label}
                                  {filters.lifestyleTags.includes(tag.value) && <span className="text-xs">✓</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Column 3 — Environnement */}
                        <div className="space-y-6">
                          <div>
                            <p className="text-xs font-semibold text-gray-900 mb-3">Environnement</p>
                            <div className="space-y-1.5">
                              {LIFESTYLE_TAGS.filter(t => ['vue_lac', 'vue_montagne', 'lumineux', 'quartier_calme', 'proche_transports', 'proche_ecoles', 'centre_ville'].includes(t.value)).map((tag) => (
                                <button key={tag.value} type="button" onClick={() => {
                                  const next = filters.lifestyleTags.includes(tag.value) ? filters.lifestyleTags.filter((t) => t !== tag.value) : [...filters.lifestyleTags, tag.value]
                                  updateFilter({ lifestyleTags: next })
                                }} className={cn('w-full h-8 px-3 text-xs font-medium rounded-lg text-left transition-all cursor-pointer flex items-center justify-between', filters.lifestyleTags.includes(tag.value) ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}>
                                  {tag.label}
                                  {filters.lifestyleTags.includes(tag.value) && <span className="text-xs">✓</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer — reset */}
                      {plusActive && (
                        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => updateFilter({ minSurface: '', bedrooms: '', bathrooms: '', energyLabel: '', lifestyleTags: [] })}
                            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            Réinitialiser les filtres
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Clear filters + Save search */}
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="h-7 w-7 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0" title={t('search.clearFilters')}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {hasActiveFilters && (
              <button
                onClick={() => setSaveDialogOpen(true)}
                className="h-8 w-8 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                title={t('search.saveSearch')}
              >
                <Bookmark className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Sort pill — "recommended" hidden in rent context */}
            <FilterPill
              label={SORT_OPTIONS.find(o => o.value === filters.sort)?.label || t('search.relevance')}
              active={filters.sort !== 'relevance'}
              dark
            >
              {SORT_OPTIONS.filter((opt) => filters.context !== 'rent' || opt.value !== 'recommended').map((opt) => (
                <FilterOption key={opt.value} selected={filters.sort === opt.value} onClick={() => updateFilter({ sort: opt.value })}>{opt.label}</FilterOption>
              ))}
            </FilterPill>

            {/* Map tools — Recentrer + Zone + Outils */}
            <div className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => mapViewRef.current?.fitToListings()}
                className="h-7 px-2.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-600 transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                title={t('search.recenterMap')}
              >
                <LocateFixed className="h-3 w-3" />
                Recentrer
              </button>
              {!mapState.isDrawing && !mapState.hasPolygon && (
                <button
                  onClick={() => { mapViewRef.current?.startDrawing(); syncMapState() }}
                  className="h-7 px-2.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-600 transition-colors cursor-pointer whitespace-nowrap"
                  title={t('search.drawZone')}
                >
                  Zone
                </button>
              )}
              <div className="relative" ref={mapToolsRef}>
                <button
                  onClick={() => { syncMapState(); setMapToolsOpen(v => !v) }}
                  className={cn(
                    'h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap',
                    mapToolsOpen || mapState.showTools || mapState.showHeatmap
                      ? 'bg-accent/10 text-accent'
                      : 'text-gray-500 hover:text-gray-600'
                  )}
                >
                  <Mountain className="h-3 w-3" />
                  Outils
                  <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', mapToolsOpen && 'rotate-180')} />
                </button>

                {mapToolsOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    {/* Map styles */}
                    <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-gray-500 capitalize">Style de carte</p>
                    {([
                      { id: 'standard', label: '3D', icon: Mountain },
                      { id: 'satellite', label: t('search.mapStyleSatellite'), icon: Satellite },
                      { id: 'light', label: t('search.mapStyleLight'), icon: SunIcon },
                      { id: 'dark', label: t('search.mapStyleDark'), icon: Moon },
                    ] as const).map(style => {
                      const Icon = style.icon
                      const isActive = mapState.mapStyleId === style.id
                      return (
                        <button
                          key={style.id}
                          onClick={() => { mapViewRef.current?.setMapStyle(style.id); syncMapState() }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                            isActive ? 'text-accent bg-accent/5' : 'text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {style.label}
                        </button>
                      )
                    })}

                    <div className="h-px bg-gray-100 my-1" />

                    {/* Heatmap */}
                    <button
                      onClick={() => { mapViewRef.current?.toggleHeatmap(); syncMapState() }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                        mapState.showHeatmap ? 'text-accent bg-accent/5' : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <Thermometer className="h-3.5 w-3.5" />
                      Heatmap prix/m²
                    </button>

                    {/* Advanced tools toggle */}
                    <button
                      onClick={() => { mapViewRef.current?.toggleTools(); syncMapState() }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                        mapState.showTools ? 'text-accent bg-accent/5' : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <Mountain className="h-3.5 w-3.5" />
                      Outils avancés
                    </button>

                    <div className="h-px bg-gray-100 my-1" />

                    {/* Immersive */}
                    <button
                      onClick={() => { mapViewRef.current?.enterImmersive(); setMapToolsOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <MaximizeIcon className="h-3.5 w-3.5" />
                      Mode immersif
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Mobile: search + filter button */}
          <div className="md:hidden flex items-center gap-2 h-12">
            <form onSubmit={handleSearch} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 h-9 flex-1">
              <Search className="h-3.5 w-3.5 text-gray-500 shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher..."
                className="flex-1 text-sm bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-400 min-w-0"
              />
            </form>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={cn(
                'flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-lg transition-colors cursor-pointer',
                hasActiveFilters ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtres
              {activeFilterCount > 0 && (
                <span className="h-4 w-4 bg-white text-gray-900 text-xs rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Left panel: filters + results — hidden in immersive mode */}
        <div
          className={cn(
            'flex flex-col overflow-hidden',
            mapImmersive && 'hidden',
            !mapImmersive && 'w-full lg:shrink-0',
          )}
          style={!mapImmersive ? { width: '45%' } : undefined}
        >

          {/* Old ZONE 2 + mobile filter button removed — merged into unified bar above */}

          {/* Mobile filters drawer */}
          {showMobileFilters && (
            <div className="md:hidden px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2 flex-wrap">
                <FilterPill
                  label={filters.types.length ? t('search.typeConfirmed') : t('search.type')}
                  active={filters.types.length > 0}
                >
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                    <FilterOption
                      key={value}
                      selected={filters.types.includes(value)}
                      onClick={() => {
                        const next = filters.types.includes(value)
                          ? filters.types.filter((t) => t !== value)
                          : [...filters.types, value]
                        updateFilter({ types: next })
                      }}
                    >
                      {label}
                    </FilterOption>
                  ))}
                </FilterPill>
                <FilterPill label={filters.rooms ? t('search.nRoomsShort', { count: filters.rooms }) : t('search.roomsFilter')} active={!!filters.rooms}>
                  {ROOM_OPTIONS.map((r) => (
                    <FilterOption key={r} selected={filters.rooms === r} onClick={() => updateFilter({ rooms: filters.rooms === r ? '' : r })}>
                      {r} pièces
                    </FilterOption>
                  ))}
                </FilterPill>
                <FilterPill label={filters.canton ? (CANTON_LABELS[filters.canton] || filters.canton) : t('search.canton')} active={!!filters.canton}>
                  {(marketStats?.cantonCounts || []).slice(0, 10).map(({ canton: c, count: cnt }) => (
                    <FilterOption key={c} selected={filters.canton === c} onClick={() => updateFilter({ canton: filters.canton === c ? '' : c, city: '' })}>
                      {CANTON_LABELS[c] || c} ({cnt})
                    </FilterOption>
                  ))}
                </FilterPill>
                {hasActiveFilters && (
                  <button onClick={clearAllFilters} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">
                    Effacer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Old ZONE 3 results bar removed — sort/view/count merged into unified bar */}

          {/* ─── ZONE 4: Listing cards OR Sidebar panels ─── */}
          {sidebarView === 'favorites' ? (
            <FavoritesPanel
              listings={allListings}
              favoriteIds={favoriteIds}
              onBack={() => setSidebarView('search')}
              onPreview={openPreview}
            />
          ) : sidebarView === 'saved' ? (
            <SavedSearchesPanel
              onBack={() => setSidebarView('search')}
              onApplyFilters={(f) => {
                setFilters(prev => ({ ...prev, ...f }))
                setSidebarView('search')
              }}
            />
          ) : sidebarView === 'alerts' ? (
            <AlertsPanel
              onBack={() => setSidebarView('search')}
              onApplyFilters={(f) => {
                setFilters(prev => ({ ...prev, ...f }))
                setSidebarView('search')
              }}
            />
          ) : sidebarView === 'calculator' ? (
            <AccessibilityPanel
              onBack={() => setSidebarView('search')}
              onApplyMaxPrice={(maxPrice) => {
                updateFilter({ maxPrice })
                setSidebarView('search')
              }}
            />
          ) : sidebarView === 'contact' ? (
            <ContactPanel
              onBack={() => setSidebarView('search')}
              selectedListing={previewId ? allListings.find(l => l.id === previewId) ?? null : null}
            />
          ) : (
          <div ref={listScrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 md:px-6 pt-8 pb-4">
            {/* Results header — Zillow style */}
            {!isLoadingListings && filtered.length > 0 && (
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {filters.types.length > 0
                      ? filters.types.map(t => PROPERTY_TYPE_LABELS[t as keyof typeof PROPERTY_TYPE_LABELS] || t).join(', ')
                      : t('search.realEstate')
                    }
                    {filters.context === 'rent' ? ' à louer' : ' à vendre'}
                    {filters.city && ` à ${filters.city}`}
                    {!filters.city && filters.canton && ` à ${CANTON_LABELS[filters.canton] || filters.canton}`}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {filtered.length.toLocaleString('fr-CH')} résultat{filtered.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}

            {isLoadingListings ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                    <div className="aspect-[4/3] bg-gray-100 animate-pulse" />
                    <div className="p-4 space-y-3">
                      <div className="h-5 bg-gray-100 rounded animate-pulse w-2/3" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-4/5" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <img src="/illustrations/maggy/Search.svg" alt="" className="w-52 h-40 mx-auto mb-4" loading="lazy" decoding="async" />
                <p className="text-lg font-medium text-gray-700 mb-1">Aucun bien trouvé</p>
                <p className="text-sm text-gray-500 mb-4">
                  Essayez de modifier vos critères de recherche
                </p>
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-accent font-medium hover:underline cursor-pointer"
                >
                  Effacer tous les filtres
                </button>
              </div>
            ) : (
              <div
                style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index]
                  return (
                    <div
                      key={virtualRow.key}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      className="grid gap-4 grid-cols-1 sm:grid-cols-2 pb-4"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.map((listing) => (
                        <SearchListingCard
                          key={listing.id}
                          listing={listing}
                          onHover={setHoveredListing}
                          isHovered={hoveredListing === listing.id}
                          eager={virtualRow.index < 2}
                          isFavorite={isFavorite(listing.id)}
                          onToggleFavorite={() => toggleFavorite(listing.id)}
                          isCompared={compareIds.includes(listing.id)}
                          onToggleCompare={() => toggleCompare(listing.id)}
                          medianPricePerM2={medianPricePerM2}
                          onPreview={openPreview}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-8">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-6 py-2.5 text-sm font-medium text-accent border border-accent rounded-full hover:bg-accent hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isFetchingNextPage ? t('actions.loading') : t('search.loadMore')}
                </button>
              </div>
            )}

          </div>
          )}
        </div>

        {/* ─── ZONE 5: Map (desktop) ─── */}
        <div
          className={cn(
            'border-l border-gray-200 overflow-hidden',
            mapImmersive
              ? 'block flex-1 border-l-0 h-screen'
              : 'sticky top-[124px] h-[calc(100vh-124px)] hidden lg:block lg:flex-1'
          )}
          style={!mapImmersive ? { width: '55%' } : undefined}
        >
          <Suspense fallback={<div className="w-full h-full bg-gray-50 animate-pulse" />}>
            <MapView
              ref={mapViewRef}
              listings={allListings}
              mapPoints={mapPoints}
              hoveredId={hoveredListing}
              onHover={setHoveredListing}
              onZoneFilter={setZoneFilterIds}
              onImmersiveChange={setMapImmersive}
              onSelectListing={openPreview}
              hideTopControls
              onQuickFilter={handleQuickFilter}
            />
          </Suspense>
        </div>
      </div>

      {/* Mobile: Map FAB */}
      <button
        onClick={() => setShowMobileMap(true)}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 h-10 px-4 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer"
      >
        <Map className="h-4 w-4" />
        Voir la carte
      </button>

      {/* Mobile: Map overlay */}
      {showMobileMap && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <Suspense fallback={<div className="w-full h-full bg-gray-50 animate-pulse" />}>
            <MapView
              listings={allListings}
              mapPoints={mapPoints}
              hoveredId={hoveredListing}
              onHover={setHoveredListing}
              onZoneFilter={setZoneFilterIds}
              onSelectListing={openPreview}
            />
          </Suspense>
          <button
            onClick={() => setShowMobileMap(false)}
            className="absolute top-4 right-4 h-10 w-10 bg-white rounded-full shadow-lg flex items-center justify-center cursor-pointer z-10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}


      {/* ─── Compare floating bar ─── */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 h-12 px-5 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg">
          <GitCompareArrows className="h-4 w-4" />
          <span>{compareIds.length} bien{compareIds.length > 1 ? 's' : ''} selectionne{compareIds.length > 1 ? 's' : ''}</span>
          <button
            onClick={() => setShowCompare(true)}
            className="h-8 px-3 bg-accent rounded-full text-xs font-medium hover:bg-accent/90 transition-colors"
          >
            Comparer
          </button>
          <button
            onClick={() => setCompareIds([])}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Compare drawer */}
      <CompareDrawer
        listings={compareListings}
        open={showCompare}
        onClose={() => setShowCompare(false)}
        onRemove={(id) => {
          setCompareIds((prev) => prev.filter((x) => x !== id))
          if (compareIds.length <= 1) setShowCompare(false)
        }}
      />

      {/* ─── Save search toast ─── */}
      {savedSearchToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 h-10 px-4 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg animate-in slide-in-from-top duration-200">
          <Check className="h-4 w-4 text-emerald-400" />
          Recherche sauvegardee
        </div>
      )}

      {/* Compare limit toast */}
      {compareToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 h-10 px-4 bg-gray-900 text-white text-sm font-medium rounded-full shadow-lg animate-in slide-in-from-top duration-200">
          <GitCompareArrows className="h-4 w-4 text-amber-400" />
          {compareToast}
        </div>
      )}


      {/* ─── Listing preview panel (Zillow-style overlay) ─── */}
      <ListingPreviewPanel
        listingId={previewId}
        onClose={closePreview}
        isCompared={previewId ? compareIds.includes(previewId) : false}
        onToggleCompare={previewId ? () => toggleCompare(previewId) : undefined}
      />

      {/* ─── Save search dialog ─── */}
      <SaveSearchDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        filters={filters}
        resultsCount={totalCount}
      />

      {/* ─── Saved searches list ─── */}
      <SavedSearchesList
        open={savedListOpen}
        onClose={() => setSavedListOpen(false)}
        onApplyFilters={(savedFilters) => {
          setFilters(prev => ({
            ...prev,
            ...savedFilters,
            sort: prev.sort,
          }))
        }}
      />

    </main>
    </div>
  )
}
