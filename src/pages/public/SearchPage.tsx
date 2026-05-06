import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
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
} from 'lucide-react'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import MarketAccountRail from '@/components/search/MarketAccountRail'
import PriceRangeDropdown from '@/components/search/PriceRangeDropdown'
import { FilterPill, FilterOption } from '@/components/search/FilterPill'
import MarketRechercheFiltersBar from '@/components/search/MarketRechercheFiltersBar'
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
import {
  useSmartSearchParser,
  isLikelyNaturalLanguage,
  smartFiltersToPartialFilters,
  buildSmartChipLabels,
} from '@/hooks/useSmartSearchParser'
import AiSparkle from '@/components/icons/AiSparkle'
import { usePageMeta } from '@/hooks/usePageMeta'
import { sortByRecommendation } from '@/lib/recommendationScore'
import { useFavorites } from '@/hooks/useFavorites'
import { useHiddenListings } from '@/hooks/useHiddenListings'
import { cn } from '@/lib/utils'
import { PROPERTY_TYPE_LABELS } from '@/lib/constants'
import { useMarketTemperature } from '@/hooks/useMarketInsights'
import { useVirtualizer } from '@tanstack/react-virtual'
import SearchListingCard from '@/components/search/MarketSearchCard'
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

  // Smart input state — chip summarising what the LLM understood, plus a
  // transient error toast message for low-confidence parses.
  const smartParser = useSmartSearchParser()
  const [smartChip, setSmartChip] = useState<{ labels: string[]; query: string } | null>(null)
  const [smartError, setSmartError] = useState<string | null>(null)
  // Input looks like NL while typing → dynamic sparkle icon. Purely visual,
  // submission still runs through the routeSearch heuristic.
  const isNLP = isLikelyNaturalLanguage(searchInput)
  // Feature flag — disable via VITE_SMART_SEARCH_ENABLED=false. Default on.
  const smartEnabled = (import.meta.env.VITE_SMART_SEARCH_ENABLED ?? 'true') !== 'false'
  // One-time onboarding tooltip. Dismiss persisted in localStorage.
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return smartEnabled && !localStorage.getItem('megga-smart-search-onboarded') }
    catch { return false }
  })
  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false)
    try { localStorage.setItem('megga-smart-search-onboarded', '1') } catch { /* ignore */ }
  }, [])
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
  const { hiddenIds } = useHiddenListings()
  const [previewId, setPreviewId] = useState<string | null>(() => searchParams.get('listing'))
  const mapViewRef = useRef<MapViewHandle>(null)
  const [sidebarView, setSidebarView] = useState('search')
  const [mapImmersive, setMapImmersive] = useState(false)
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
    isError: isListingsError,
    error: listingsError,
    refetch: refetchListings,
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
  const handleQuickFilter = useCallback((qf: { type?: string; maxPrice?: number; minRooms?: number; minSurface?: number }) => {
    updateFilter({
      types: qf.type ? [qf.type] : [],
      maxPrice: qf.maxPrice ? String(qf.maxPrice) : '',
      rooms: qf.minRooms ? String(qf.minRooms) : '',
      minSurface: qf.minSurface ? String(qf.minSurface) : '',
    })
  }, [updateFilter])

  // Zone filter (polygon drawn on map) + viewport filter ("search as I move")
  const filtered = useMemo(() => {
    let result = allListings
    if (zoneFilterIds) {
      result = result.filter((l) => zoneFilterIds.includes(l.id))
    }
    // Filter out listings the user has explicitly hidden
    if (hiddenIds.length > 0) {
      const hiddenSet = new Set(hiddenIds)
      result = result.filter((l) => !hiddenSet.has(l.id))
    }
    return result
  }, [allListings, zoneFilterIds, hiddenIds])

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
    filters.energyLabel !== '' ||
    filters.features.length > 0

  const activeFilterCount = [
    filters.types.length > 0,
    filters.minPrice || filters.maxPrice,
    filters.rooms,
    filters.bedrooms,
    filters.minSurface,
    filters.city || filters.canton,
    filters.lifestyleTags.length > 0,
    filters.energyLabel,
    filters.features.length > 0,
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
      features: [],
      q: '',
    })
    setSearchInput('')
    setSmartChip(null)
    setSmartError(null)
  }

  const resetFilterPatch: Partial<Filters> = {
    types: [],
    minPrice: '',
    maxPrice: '',
    rooms: '',
    minSurface: '',
    bedrooms: '',
    city: '',
    canton: '',
    lifestyleTags: [],
    features: [],
    q: '',
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const query = searchInput.trim()
    setSmartError(null)

    if (!query) {
      setSmartChip(null)
      updateFilter({ q: '' })
      return
    }

    // NLP mode — ship to DeepSeek edge function. Falls through to local
    // regex parser if the edge function errors, so a provider outage never
    // leaves the user with a broken search box. Gated behind the feature
    // flag so we can disable the LLM call without a redeploy.
    if (smartEnabled && isLikelyNaturalLanguage(query)) {
      try {
        const result = await smartParser.mutateAsync({
          query,
          context: filters.context,
        })
        if (result.filters.confidence === 'low') {
          setSmartChip(null)
          setSmartError(t('search.smart.lowConfidence'))
          return
        }
        const patch = smartFiltersToPartialFilters(result.filters)
        updateFilter({ ...resetFilterPatch, ...patch } as Partial<Filters>)
        setSmartChip({ labels: buildSmartChipLabels(result.filters), query })
        return
      } catch {
        // Silent fallback to local regex parser below
      }
    }

    // City / simple keyword mode — existing regex heuristic.
    const parsed = parseNaturalLanguageQuery(query)
    if (parsed.understood.length > 0) {
      updateFilter({ ...resetFilterPatch, ...parsed.filters })
      setSmartChip(null)
    } else {
      updateFilter({ q: query })
      setSmartChip(null)
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
    <div
      className="h-screen flex flex-col"
      style={{ fontFamily: "'Manrope', system-ui, -apple-system, sans-serif", backgroundColor: '#FAFBFD', paddingTop: 64 }}
    >
      {/* ─── WCAG 1.3.1 — h1 caché visuellement pour screen readers ─── */}
      <h1 className="sr-only">
        {filters.context === 'rent' ? 'Biens à louer en Suisse' : 'Biens à vendre en Suisse'}
      </h1>

      {/* ─── HEADER (position: fixed, no flow space) ─── */}
      {!mapImmersive && <HomeStickyHeader alwaysShow />}

      {/* ─── DESKTOP STICKY BAR (design proto — full width, traverses sidebar) ─── */}
      {!mapImmersive && sidebarView === 'search' && (
        <div className="hidden md:block">
          <MarketRechercheFiltersBar
            filters={filters}
            updateFilter={updateFilter}
            onOpenMore={() => setPlusOpen(true)}
            morePlusActiveCount={[filters.minSurface, filters.bedrooms, filters.bathrooms, filters.lifestyleTags.length > 0, filters.energyLabel].filter(Boolean).length}
            onSaveSearch={() => setSaveDialogOpen(true)}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      )}

      {/* ─── BODY: Sidebar + Main content ─── */}
      <div className="flex flex-1 overflow-hidden">
      {/* ─── LEFT SIDEBAR (design proto MEGGA Recherche.html · AccountRail) ─── */}
      {!mapImmersive && (
        <MarketAccountRail
          activeView={sidebarView}
          onViewChange={setSidebarView}
          stickyTop={0}
        />
      )}

      {/* ─── RIGHT CONTENT (cards + map) ─── */}
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden">

      {/* ─── MOBILE STICKY BAR ─── */}
      <div className={cn('md:hidden sticky top-14 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100', (mapImmersive || sidebarView !== 'search') && 'hidden')}>
        <div className="px-4 py-4">

          {/* Hidden desktop bar (kept for plus dropdown anchor + filter state) */}
          <div className="hidden" style={{ maxWidth: '45%' }}>
            {/* Search input — smart: city lookup OR natural-language parser */}
            <form onSubmit={handleSearch} className="relative flex items-center gap-2.5 bg-gray-50 border border-transparent rounded-full px-4 h-10 flex-[2] min-w-[312px] transition-colors focus-within:bg-white focus-within:border-gray-900 [&_*]:outline-none">
              {/* First-visit onboarding popover — dismisses on focus or × */}
              {showOnboarding && smartEnabled && (
                <div
                  className="absolute top-full left-0 mt-2.5 w-[340px] z-50 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  {/* Pointer arrow pointing up to the input */}
                  <div
                    aria-hidden
                    className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 bg-white border-l border-t"
                    style={{ borderColor: 'rgba(0,23,81,0.10)' }}
                  />
                  <div
                    className="relative bg-white rounded-2xl shadow-[0_8px_28px_-8px_rgba(0,23,81,0.18)] border overflow-hidden"
                    style={{ borderColor: 'rgba(0,23,81,0.10)' }}
                  >
                    {/* Subtle gradient header */}
                    <div
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-16 pointer-events-none"
                      style={{ background: 'linear-gradient(180deg, rgba(0,23,81,0.05) 0%, rgba(0,23,81,0) 100%)' }}
                    />
                    <button
                      type="button"
                      onClick={dismissOnboarding}
                      className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full text-[#001751]/50 hover:text-[#001751] hover:bg-[#001751]/10 flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#001751]/30"
                      aria-label={t('search.smart.onboardingDismiss')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="relative p-4">
                      <div className="flex items-start gap-2.5">
                        <div
                          className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(0,23,81,0.08)' }}
                        >
                          <AiSparkle className="h-4 w-4 text-[#001751]" />
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[13px] font-semibold text-[#001751] leading-tight">
                              {t('search.smart.onboardingTitle')}
                            </span>
                            <span
                              className="text-[9px] font-semibold tracking-wide uppercase rounded-full px-1.5 py-0.5 leading-none"
                              style={{ color: '#001751', background: 'rgba(0,23,81,0.10)' }}
                            >
                              {t('search.smart.onboardingBadge')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {t('search.smart.onboardingBody')}
                          </p>
                        </div>
                      </div>
                      <div
                        className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] text-[#001751]/80"
                        style={{ background: 'rgba(0,23,81,0.05)' }}
                      >
                        <span className="text-[#001751]/50">▸</span>
                        <span className="font-medium">{t('search.smart.onboardingExample')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {smartParser.isPending ? (
                <div className="h-4 w-4 shrink-0 border-2 border-gray-200 border-t-[#001751] rounded-full animate-spin" />
              ) : isNLP ? (
                <AiSparkle className="h-4 w-4 text-[#001751] shrink-0 transition-colors" />
              ) : (
                <Search className="h-4 w-4 text-gray-400 shrink-0 transition-colors" strokeWidth={2} />
              )}
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={smartEnabled ? t('search.smart.placeholder') : t('search.searchCity', 'Ville, quartier, canton...')}
                onFocus={dismissOnboarding}
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                className="appearance-none flex-1 text-sm bg-transparent border-0 outline-none ring-0 text-gray-900 placeholder:text-gray-400 min-w-0 focus:outline-none focus:ring-0 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); setSmartChip(null); setSmartError(null); clearAllFilters() }} className="text-gray-500 hover:text-gray-600">
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
                    'flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-full border transition-colors duration-150 whitespace-nowrap cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300',
                    filters.isFurnished ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  )}
                  aria-pressed={filters.isFurnished}
                >
                  Meublé
                </button>
                <button
                  type="button"
                  onClick={() => updateFilter({ availableNow: !filters.availableNow })}
                  className={cn(
                    'flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-full border transition-colors duration-150 whitespace-nowrap cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300',
                    filters.availableNow ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
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
                      'flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-full border transition-colors duration-150 whitespace-nowrap cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300',
                      plusActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    )}
                  >
                    {plusCount > 0 ? t('search.moreWithCount', { count: plusCount }) : t('search.more')}
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', plusActive ? 'text-white/70' : 'text-gray-500', plusOpen && 'rotate-180')} />
                  </button>
                  {plusOpen && (() => {
                    const chipBase = 'h-8 px-3.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300'
                    const chipIdle = 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent'
                    const chipActive = 'bg-gray-900 text-white border border-gray-900'
                    const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2.5'
                    const toggleTag = (v: string) => {
                      const next = filters.lifestyleTags.includes(v)
                        ? filters.lifestyleTags.filter((t) => t !== v)
                        : [...filters.lifestyleTags, v]
                      updateFilter({ lifestyleTags: next })
                    }
                    const equipTags = LIFESTYLE_TAGS.filter(t => ['terrasse', 'balcon', 'jardin', 'parking', 'piscine', 'ascenseur', 'meuble', 'dernier_etage'].includes(t.value))
                    const envTags = LIFESTYLE_TAGS.filter(t => ['vue_lac', 'vue_montagne', 'lumineux', 'quartier_calme', 'proche_transports', 'proche_ecoles', 'centre_ville'].includes(t.value))
                    const onBackdropClick = (e: React.MouseEvent) => {
                      if (e.target === e.currentTarget) setPlusOpen(false)
                    }
                    const modalNode = (
                      <div
                        className="fixed inset-0 z-[200] flex items-start justify-center pt-32 px-4"
                        style={{ background: 'rgba(14,20,16,0.45)', backdropFilter: 'blur(6px)' }}
                        onClick={onBackdropClick}
                      >
                      <div
                        className="w-full max-w-[640px] bg-white rounded-2xl border border-gray-100 origin-top animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col max-h-[min(72vh,680px)]"
                        style={{ boxShadow: '0 24px 64px -20px rgba(15, 23, 42, 0.22), 0 6px 16px -6px rgba(15, 23, 42, 0.08)' }}
                      >
                        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
                          <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: '"Manrope", system-ui, sans-serif' }}>Plus de filtres</h2>
                          <button onClick={() => setPlusOpen(false)} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center cursor-pointer text-gray-700">×</button>
                        </div>
                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide p-5">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Surface */}
                            <div>
                              <p className={sectionLabel}>Surface min.</p>
                              <div className="flex flex-wrap gap-1.5">
                                {['30', '50', '80', '100', '150', '200'].map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => updateFilter({ minSurface: filters.minSurface === s ? '' : s })}
                                    className={cn(chipBase, filters.minSurface === s ? chipActive : chipIdle)}
                                  >
                                    {s} m²
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Chambres */}
                            <div>
                              <p className={sectionLabel}>Chambres</p>
                              <div className="flex flex-wrap gap-1.5">
                                {BEDROOM_OPTIONS.map((b) => (
                                  <button
                                    key={`bed-${b}`}
                                    type="button"
                                    onClick={() => updateFilter({ bedrooms: filters.bedrooms === b ? '' : b })}
                                    className={cn(chipBase, 'min-w-[44px]', filters.bedrooms === b ? chipActive : chipIdle)}
                                  >
                                    {b}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Énergie */}
                            <div>
                              <p className={sectionLabel}>Énergie</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ENERGY_OPTIONS.map((e) => (
                                  <button
                                    key={e.value}
                                    type="button"
                                    onClick={() => updateFilter({ energyLabel: filters.energyLabel === e.value ? '' : e.value })}
                                    className={cn(chipBase, filters.energyLabel === e.value ? chipActive : chipIdle)}
                                  >
                                    {e.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Salles de bain */}
                            <div>
                              <p className={sectionLabel}>Salles de bain</p>
                              <div className="flex flex-wrap gap-1.5">
                                {BATHROOM_OPTIONS.map((b) => (
                                  <button
                                    key={`bath-${b}`}
                                    type="button"
                                    onClick={() => updateFilter({ bathrooms: filters.bathrooms === b ? '' : b })}
                                    className={cn(chipBase, 'min-w-[44px]', filters.bathrooms === b ? chipActive : chipIdle)}
                                  >
                                    {b}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Équipements — full width */}
                          <div className="mt-5 pt-5 border-t border-gray-100">
                            <p className={sectionLabel}>Équipements</p>
                            <div className="flex flex-wrap gap-1.5">
                              {equipTags.map((tag) => (
                                <button
                                  key={tag.value}
                                  type="button"
                                  onClick={() => toggleTag(tag.value)}
                                  className={cn(chipBase, filters.lifestyleTags.includes(tag.value) ? chipActive : chipIdle)}
                                >
                                  {tag.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Environnement — full width */}
                          <div className="mt-5 pt-5 border-t border-gray-100">
                            <p className={sectionLabel}>Environnement</p>
                            <div className="flex flex-wrap gap-1.5">
                              {envTags.map((tag) => (
                                <button
                                  key={tag.value}
                                  type="button"
                                  onClick={() => toggleTag(tag.value)}
                                  className={cn(chipBase, filters.lifestyleTags.includes(tag.value) ? chipActive : chipIdle)}
                                >
                                  {tag.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Sticky footer */}
                        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-3 bg-white rounded-b-2xl">
                          <button
                            type="button"
                            onClick={() => updateFilter({ minSurface: '', bedrooms: '', bathrooms: '', energyLabel: '', lifestyleTags: [] })}
                            disabled={!plusActive}
                            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Tout effacer
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlusOpen(false)}
                            className="h-9 px-5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer tabular-nums"
                          >
                            Voir {visible.length.toLocaleString('fr-CH')} {visible.length > 1 ? 'biens' : 'bien'}
                          </button>
                        </div>
                      </div>
                      </div>
                    )
                    return createPortal(modalNode, document.body)
                  })()}
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

          </div>

          {/* Mobile: search + filter button */}
          <div className="md:hidden flex items-center gap-2 h-12">
            <form onSubmit={handleSearch} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 h-9 flex-1">
              {smartParser.isPending ? (
                <div className="h-3.5 w-3.5 shrink-0 border-2 border-gray-300 border-t-accent rounded-full animate-spin" />
              ) : isNLP ? (
                <AiSparkle className="h-3.5 w-3.5 text-[#001751] shrink-0" />
              ) : (
                <Search className="h-3.5 w-3.5 text-gray-500 shrink-0" />
              )}
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={smartEnabled ? t('search.smart.placeholderMobile') : t('search.searchCity', 'Rechercher...')}
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                className="appearance-none flex-1 text-sm bg-transparent border-0 outline-none ring-0 text-gray-900 placeholder:text-gray-400 min-w-0 focus:outline-none focus:ring-0 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
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

      {/* ─── Smart-input feedback: chip "Compris" or low-confidence error ─── */}
      {(smartChip || smartError) && (
        <div className="px-4 pt-2 pb-0 flex items-center gap-2">
          {smartChip && (
            <div
              className="inline-flex items-center gap-1.5 rounded-full bg-[#001751]/[0.06] border border-[#001751]/10 text-[#001751] text-xs font-medium pl-2 pr-1 py-1 max-w-full transition-colors hover:bg-[#001751]/10"
              title={smartChip.labels.join(' · ')}
            >
              <AiSparkle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{smartChip.labels.join(' · ')}</span>
              <button
                type="button"
                onClick={() => { setSmartChip(null); setSearchInput(''); clearAllFilters() }}
                className="shrink-0 ml-0.5 h-4 w-4 rounded-full text-[#001751]/60 hover:text-[#001751] hover:bg-[#001751]/15 flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#001751]/30"
                aria-label="Réinitialiser"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
          {smartError && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/15 text-red-600 text-xs font-medium pl-3 pr-1 py-1">
              <span>{smartError}</span>
              <button
                type="button"
                onClick={() => setSmartError(null)}
                className="shrink-0 ml-0.5 h-4 w-4 rounded-full hover:bg-red-500/20 flex items-center justify-center cursor-pointer"
                aria-label="Fermer"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Left panel: filters + results — hidden in immersive mode */}
        <div
          className={cn(
            'flex flex-col overflow-hidden',
            mapImmersive && 'hidden',
            !mapImmersive && 'w-full lg:shrink-0',
          )}
          style={!mapImmersive ? { flex: '1 1 0%', minWidth: 0 } : undefined}
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
              onCreateSearch={() => { setSidebarView('search'); setSaveDialogOpen(true) }}
            />
          ) : sidebarView === 'alerts' ? (
            <AlertsPanel
              onBack={() => setSidebarView('search')}
              onApplyFilters={(f) => {
                setFilters(prev => ({ ...prev, ...f }))
                setSidebarView('search')
              }}
              onGoToSaved={() => setSidebarView('saved')}
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
            {/* Results header — design proto megga-search-results.jsx ResultsColumn */}
            {!isLoadingListings && filtered.length > 0 && (
              <div className="flex items-start justify-between mb-5" style={{ minHeight: 52, fontFamily: '"Manrope", system-ui, sans-serif' }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#0E1410', letterSpacing: -0.5, lineHeight: 1.15 }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{filtered.length.toLocaleString('fr-CH')}</span>{' '}
                    {filtered.length > 1 ? 'biens' : 'bien'}{' '}
                    <span style={{ fontWeight: 500, color: '#3F4640' }}>
                      {filters.context === 'rent' ? 'à louer' : 'à vendre'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#7A8079', marginTop: 6, fontWeight: 500 }}>
                    {filters.city || (filters.canton ? CANTON_LABELS[filters.canton] || filters.canton : 'Toute la Suisse')}
                    {' · '}
                    {filters.types.length > 0
                      ? filters.types.map(t => PROPERTY_TYPE_LABELS[t as keyof typeof PROPERTY_TYPE_LABELS] || t).join(', ')
                      : 'tous types'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#7A8079', fontWeight: 600, fontFamily: '"Manrope", system-ui, sans-serif' }}>Trier par</span>
                  <select
                    value={filters.sort}
                    onChange={(e) => updateFilter({ sort: e.target.value as Filters['sort'] })}
                    style={{
                      height: 36,
                      padding: '0 30px 0 12px',
                      borderRadius: 8,
                      border: '1px solid #E6E8EC',
                      background: '#fff',
                      fontFamily: '"Manrope", system-ui, sans-serif',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#0E1410',
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10' fill='%237A8079'><path d='M2 4l3 3 3-3z'/></svg>\")",
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 10px center',
                    }}
                  >
                    {SORT_OPTIONS.filter((opt) => filters.context !== 'rent' || opt.value !== 'recommended').map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
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
            ) : isListingsError ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-lg font-medium text-gray-700 mb-1">Impossible de charger les biens</p>
                <p className="text-sm text-gray-500 mb-4 max-w-md">
                  {(listingsError as Error | null)?.message || 'Une erreur réseau est survenue.'}
                </p>
                <button
                  onClick={() => refetchListings()}
                  className="text-sm text-accent font-medium hover:underline cursor-pointer"
                >
                  Réessayer
                </button>
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
          style={!mapImmersive ? { flex: '1 1 0%', minWidth: 0 } : undefined}
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
              transactionContext={filters.context as 'buy' | 'rent'}
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
    </div>
  )
}
