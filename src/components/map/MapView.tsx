import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle, memo } from 'react'
import MapGL, {
  Marker,
  Popup,
  Source,
  Layer,
  type MapRef,
  type MapMouseEvent,
} from 'react-map-gl/mapbox'
import { X, MapPin, Layers, Mountain, Satellite, Moon, Sun, Thermometer, Search, Ruler, Pause, Play, Maximize, Minimize, ChevronLeft, ChevronRight, ChevronDown, Building2, Heart, MoreHorizontal, SlidersHorizontal, Plus, Minus, PenLine, Home, Landmark, Map as MapIcon, Hash, Trees } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'
import NeighborhoodOverlay from './NeighborhoodOverlay'
import { cn, formatCHF, formatSurface, formatPricePin } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'
import type { MapPoint } from '@/hooks/useMarketListings'
import { usePriceHexagons } from '@/hooks/usePriceHexagons'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// Debounced geocoding fetch
const geoDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {}
export type GeoPlaceType = 'country' | 'region' | 'postcode' | 'district' | 'place' | 'locality' | 'neighborhood' | 'address' | 'poi'
export interface GeoResult {
  text: string            // main label (e.g. "Carouge")
  context: string         // secondary label (e.g. "Genève, Suisse")
  place_type: GeoPlaceType
  center: [number, number]
}
function debouncedGeoFetch(
  key: string,
  query: string,
  onResults: (results: GeoResult[]) => void,
  delay = 350,
) {
  clearTimeout(geoDebounceTimers[key])
  if (query.length < 3) { onResults([]); return }
  geoDebounceTimers[key] = setTimeout(async () => {
    try {
      const resp = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=ch&language=fr&limit=5&access_token=${MAPBOX_TOKEN}`
      )
      const data = await resp.json()
      const features = (data.features as Array<Record<string, unknown>> | undefined) ?? []
      onResults(features.map(f => {
        const placeName = (f.place_name as string) || ''
        const text = (f.text as string) || placeName
        // place_name is "text, canton, country" — strip the leading text to get the context tail
        const context = placeName.startsWith(text) ? placeName.slice(text.length).replace(/^,\s*/, '') : placeName
        const types = (f.place_type as string[] | undefined) ?? []
        return {
          text,
          context,
          place_type: (types[0] as GeoPlaceType) || 'address',
          center: f.center as [number, number],
        }
      }))
    } catch { onResults([]) }
  }, delay)
}

function iconForPlaceType(t: GeoPlaceType) {
  switch (t) {
    case 'address': return Home
    case 'poi': return Landmark
    case 'neighborhood':
    case 'locality': return Building2
    case 'place':
    case 'district': return MapIcon
    case 'postcode': return Hash
    case 'region':
    case 'country': return Trees
    default: return MapPin
  }
}

export interface MapViewHandle {
  fitToListings: () => void
  startDrawing: () => void
  enterImmersive: () => void
  exitImmersive: () => void
  toggleTools: () => void
  setMapStyle: (id: string) => void
  toggleHeatmap: () => void
  resize: () => void
  /** Whether draw zone is currently active */
  hasActiveZone: boolean
  isDrawing: boolean
  hasPolygon: boolean
  isImmersive: boolean
  showTools: boolean
  mapStyleId: string
  showHeatmap: boolean
}

interface QuickFilters {
  type?: 'apartment' | 'house' | ''
  maxPrice?: number
  minRooms?: number
  minSurface?: number
}

interface MapViewProps {
  listings: ListingCardData[]
  mapPoints?: MapPoint[]
  hoveredId?: string
  onHover?: (id: string | undefined) => void
  onZoneFilter?: (listingIds: string[] | null) => void
  onImmersiveChange?: (isImmersive: boolean) => void
  onQuickFilter?: (filters: QuickFilters) => void
  onSelectListing?: (id: string) => void
  onViewportChange?: (bounds: { west: number; south: number; east: number; north: number }) => void
  /** Hide top-left Recentrer/Dessiner buttons (shown in parent filter bar instead) */
  hideTopControls?: boolean
  /** Transaction context — swaps immersive price pills to rent-appropriate thresholds. */
  transactionContext?: 'buy' | 'rent'
  className?: string
}

// formatPricePin imported from @/lib/utils (shared helper)

// Point-in-polygon (ray casting algorithm)
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}


const LISTING_LAYERS = ['unclustered-dot', 'unclustered-label'] as const

const MAP_STYLES = [
  { id: 'light', label: 'Clair', icon: Sun, url: 'mapbox://styles/mapbox/navigation-day-v1' },
  { id: 'satellite', label: 'Satellite', icon: Satellite, url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'dark', label: 'Sombre', icon: Moon, url: 'mapbox://styles/mapbox/navigation-night-v1' },
] as const

type MapStyleId = typeof MAP_STYLES[number]['id']

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ listings, mapPoints, hoveredId, onHover, onZoneFilter, onImmersiveChange, onQuickFilter, onViewportChange, hideTopControls, transactionContext = 'buy', className }, ref) {
  const mapRef = useRef<MapRef>(null)
  const [mapStyleId, setMapStyleIdInternal] = useState<MapStyleId>('light')
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [isStyleSwitching, setIsStyleSwitching] = useState(false)
  const currentStyle = MAP_STYLES.find(s => s.id === mapStyleId) || MAP_STYLES[0]
  // Immersive overlays (filter pill + tools bar) follow the map tone.
  // Clair/Satellite → frosted white surface. Sombre → frosted dark surface.
  const isMapDark = mapStyleId === 'dark'
  const ui = isMapDark
    ? {
        surface: 'bg-gray-900/75 border-white/10',
        chipActive: 'bg-white text-gray-900',
        chipInactive: 'text-white/65 hover:text-white',
        iconIdle: 'text-white/80 hover:text-white hover:bg-white/10',
        iconActive: 'bg-white text-gray-900',
        separator: 'bg-white/10',
        dropdown: 'bg-gray-900/95 border-white/10',
        dropdownItemIdle: 'text-white/70 hover:text-white hover:bg-white/10',
        dropdownItemActive: 'text-accent',
      }
    : {
        surface: 'bg-white/85 border-gray-200/70',
        chipActive: 'bg-gray-900 text-white',
        chipInactive: 'text-gray-600 hover:text-gray-900',
        iconIdle: 'text-gray-700 hover:text-gray-900 hover:bg-gray-900/5',
        iconActive: 'bg-gray-900 text-white',
        separator: 'bg-gray-300/70',
        dropdown: 'bg-white/95 border-gray-200',
        dropdownItemIdle: 'text-gray-700 hover:text-gray-900 hover:bg-gray-100',
        dropdownItemActive: 'text-accent bg-accent/5',
      }
  // Wrap the style setter with a fade transition. Fires a fade-out, swaps
  // the tileset, then fades back in once mapbox's `styledata` event signals
  // the new style is fully loaded.
  const setMapStyleId = useCallback((id: MapStyleId) => {
    setMapStyleIdInternal(prev => {
      if (prev === id) return prev
      setIsStyleSwitching(true)
      return id
    })
  }, [])
  const initialViewState = useMemo(() => ({
    longitude: 6.1432,
    latitude: 46.2044,
    zoom: 11.5,
    pitch: 0,
    bearing: 0,
  }), [])
  const [selectedListing, setSelectedListing] = useState<ListingCardData | null>(null)
  const [hoveredPin, setHoveredPin] = useState<ListingCardData | null>(null)
  const [viewportCount, setViewportCount] = useState(0)
  const [photoIdx, setPhotoIdx] = useState(0)
  const { isFavorite, toggleFavorite } = useFavorites()

  // Reset photo carousel when the selected listing changes
  useEffect(() => { setPhotoIdx(0) }, [selectedListing?.id])

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── Immersive mode ───
  const [isImmersive, setIsImmersive] = useState(false)
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false)
  const [immersiveFiltersOpen, setImmersiveFiltersOpen] = useState(false)
  const toolsMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!toolsMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setToolsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [toolsMenuOpen])

  // Fullscreen detection — sync with immersive mode
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    function handleFs() {
      const fsEl = document.fullscreenElement
      const nowFs = !!fsEl && (containerRef.current?.contains(fsEl) || fsEl.contains(containerRef.current!))
      setIsFullscreen(nowFs)
      // If user exits fullscreen via Escape (browser native), also exit immersive
      if (!nowFs && isImmersive) {
        setIsImmersive(false)
        onImmersiveChange?.(false)
      }
    }
    document.addEventListener('fullscreenchange', handleFs)
    return () => document.removeEventListener('fullscreenchange', handleFs)
  }, [isImmersive, onImmersiveChange])

  // ─── Quick filters (immersive) ───
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({})

  // Propagate quick filter changes to parent via effect (avoids setState-during-render)
  const quickFiltersRef = useRef(quickFilters)
  useEffect(() => {
    if (quickFiltersRef.current !== quickFilters) {
      quickFiltersRef.current = quickFilters
      onQuickFilter?.(quickFilters)
    }
  }, [quickFilters, onQuickFilter])

  const updateQuickFilter = useCallback((patch: Partial<QuickFilters>) => {
    setQuickFilters(prev => ({ ...prev, ...patch }))
  }, [])

  const enterImmersive = useCallback(() => {
    setIsImmersive(true)
    setShowTools(true)
    onImmersiveChange?.(true)
    // Enter browser fullscreen
    containerRef.current?.requestFullscreen?.()
    // Flat 2D entry — no pitch animation
  }, [onImmersiveChange])

  const exitImmersive = useCallback(() => {
    setIsImmersive(false)
    onImmersiveChange?.(false)
    if (document.fullscreenElement) document.exitFullscreen?.()
  }, [onImmersiveChange])



  // ─── FlyTo tour ───
  const [tourIndex, setTourIndex] = useState(-1)
  const [isTourActive, setIsTourActive] = useState(false)
  const [tourAutoPlay, setTourAutoPlay] = useState(true)
  const tourTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get listings with coords for the tour — use mapPoints if listings have no coords
  const tourListings = useMemo(() => {
    const fromListings = listings.filter(l => l.lat && l.lng)
    if (fromListings.length >= 5) return fromListings.slice(0, 50)
    // Fall back to mapPoints converted to ListingCardData
    if (mapPoints && mapPoints.length > 0) {
      const fromPoints: ListingCardData[] = mapPoints.slice(0, 50).map(mp => ({
        id: mp.id, title: '', price: mp.price, address: '', city: '',
        rooms: mp.rooms, bedrooms: 0, surface_m2: 0, photos: [],
        type: mp.type, context: mp.context, lat: mp.lat, lng: mp.lng,
      }))
      return [...fromListings, ...fromPoints].slice(0, 50)
    }
    return fromListings.slice(0, 50)
  }, [listings, mapPoints])

  // Stable ref so tour callbacks don't invalidate when data refetches
  const tourListingsRef = useRef(tourListings)
  useEffect(() => { tourListingsRef.current = tourListings }, [tourListings])

  const flyToListing = useCallback((index: number) => {
    const listing = tourListingsRef.current[index]
    if (!listing?.lat || !listing?.lng) return
    setTourIndex(index)
    setSelectedListing(listing)
    mapRef.current?.flyTo({
      center: [listing.lng, listing.lat],
      zoom: 17,
      pitch: 0,
      bearing: 0,
      duration: 2500,
      essential: true,
    })
  }, [])

  // Auto-play: advance to next listing after 5s
  useEffect(() => {
    if (!isTourActive || !tourAutoPlay || tourIndex < 0) return
    tourTimerRef.current = setTimeout(() => {
      const len = tourListingsRef.current.length
      if (len === 0) return
      flyToListing((tourIndex + 1) % len)
    }, 5000)
    return () => { if (tourTimerRef.current) clearTimeout(tourTimerRef.current) }
  }, [isTourActive, tourAutoPlay, tourIndex, flyToListing])


  const nextTourStop = useCallback(() => {
    const len = tourListingsRef.current.length
    if (len === 0) return
    flyToListing((tourIndex + 1) % len)
  }, [tourIndex, flyToListing])

  const prevTourStop = useCallback(() => {
    const len = tourListingsRef.current.length
    if (len === 0) return
    flyToListing(tourIndex <= 0 ? len - 1 : tourIndex - 1)
  }, [tourIndex, flyToListing])

  const stopTour = useCallback(() => {
    setIsTourActive(false)
    setTourIndex(-1)
    setTourAutoPlay(false)
    if (tourTimerRef.current) clearTimeout(tourTimerRef.current)
  }, [])

  // ─── Neighborhood score ───
  const [neighborhoodPoint, setNeighborhoodPoint] = useState<[number, number] | null>(null)
  const [neighborhoodPickMode, setNeighborhoodPickMode] = useState(false)

  // Geocoding search marker + radius
  const [geoMarker, setGeoMarker] = useState<[number, number] | null>(null)
  const [geoRadius, setGeoRadius] = useState(1000) // meters (visual)
  const [geoRadiusDebounced, setGeoRadiusDebounced] = useState(1000) // (for filtering)
  const geoRadiusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateGeoRadius = useCallback((val: number) => {
    setGeoRadius(val)
    if (geoRadiusTimerRef.current) clearTimeout(geoRadiusTimerRef.current)
    geoRadiusTimerRef.current = setTimeout(() => setGeoRadiusDebounced(val), 200)
  }, [])

  // Filter listings within geocoding radius
  const prevGeoFilterRef = useRef<string | null>(null)
  useEffect(() => {
    if (!geoMarker || !mapPoints) {
      if (prevGeoFilterRef.current !== null) {
        prevGeoFilterRef.current = null
        onZoneFilter?.(null)
      }
      return
    }
    const [mLng, mLat] = geoMarker
    const radiusKm = geoRadiusDebounced / 1000
    const insideIds = mapPoints.filter(p => {
      const dLat = (p.lat - mLat) * 111.32
      const dLng = (p.lng - mLng) * 111.32 * Math.cos(mLat * Math.PI / 180)
      return Math.sqrt(dLat * dLat + dLng * dLng) <= radiusKm
    }).map(p => p.id)
    const key = insideIds.join(',')
    if (key !== prevGeoFilterRef.current) {
      prevGeoFilterRef.current = key
      onZoneFilter?.(insideIds)
    }
  }, [geoMarker, geoRadiusDebounced, mapPoints, onZoneFilter])

  // Show immersive tools panel (always visible via toggle, expanded in fullscreen)
  const [showTools, setShowTools] = useState(false)

  // Immersive features (fullscreen only)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showGeoSearch, setShowGeoSearch] = useState(false)
  const [geoSearchQuery, setGeoSearchQuery] = useState('')
  const [geoResults, setGeoResults] = useState<GeoResult[]>([])

  // Light preset only applies to Standard 3D — disabled in 2D mode

  // Draw zone state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([])
  const [closedPolygon, setClosedPolygon] = useState<[number, number][] | null>(null)
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null)
  const isCapturingRef = useRef(false)
  const captureBufferRef = useRef<[number, number][]>([])

  // ─── Native Mapbox GL data ───
  // Flattened GeoJSON for native Mapbox clustering + symbol/circle layers
  const listingsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: (mapPoints && mapPoints.length > 0
      ? mapPoints.map(mp => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [mp.lng, mp.lat] },
          properties: {
            id: mp.id,
            price: mp.price,
            priceLabel: formatPricePin(mp.price, 'buy'),
            rooms: mp.rooms,
            type: mp.type || '',
            context: mp.context || 'buy',
          },
        }))
      : listings.filter(l => l.lat && l.lng).map(l => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [l.lng!, l.lat!] },
          properties: {
            id: l.id,
            price: l.price,
            priceLabel: formatPricePin(l.price, 'buy'),
            rooms: l.rooms,
            type: l.type || '',
            context: l.context || 'buy',
          },
        }))
    ),
  }), [mapPoints, listings])

  // O(1) lookup for full listing data (popup needs photos, address, etc.)
  const listingsMap = useMemo(() => {
    const m = new Map<string, ListingCardData>()
    for (const l of listings) m.set(l.id, l)
    if (mapPoints) {
      for (const mp of mapPoints) {
        if (!m.has(mp.id)) {
          m.set(mp.id, {
            id: mp.id, title: '', price: mp.price, address: '', city: '',
            rooms: mp.rooms, bedrooms: 0, surface_m2: 0, photos: [],
            type: mp.type, context: mp.context, lat: mp.lat, lng: mp.lng,
          })
        }
      }
    }
    return m
  }, [listings, mapPoints])

  // Combined mouse move: draw cursor trail + listing layer hover
  const cursorThrottleRef = useRef<number>(0)
  const hoverThrottleRef = useRef<number>(0)
  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    // Draw mode: freehand capture — append points while mouse is down
    if (isDrawing) {
      if (isCapturingRef.current) {
        const now = performance.now()
        if (now - cursorThrottleRef.current < 16) return
        cursorThrottleRef.current = now
        const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
        captureBufferRef.current.push(pt)
        setDrawPoints([...captureBufferRef.current])
      } else {
        setCursorPos([e.lngLat.lng, e.lngLat.lat])
      }
      return
    }

    // Listing layer hover — throttled to 80ms (queryRenderedFeatures is expensive)
    const now = performance.now()
    if (now - hoverThrottleRef.current < 80) return
    hoverThrottleRef.current = now

    const map = mapRef.current?.getMap()
    if (!map) return
    const features = map.queryRenderedFeatures(e.point, {
      layers: LISTING_LAYERS as unknown as string[],
    })
    if (features.length > 0) {
      map.getCanvas().style.cursor = 'pointer'
      const props = features[0].properties
      if (props?.id) {
        onHover?.(props.id as string)
        const listing = listingsMap.get(props.id as string)
        if (listing) setHoveredPin(listing)
      }
    } else {
      map.getCanvas().style.cursor = ''
      if (hoveredPin) {
        onHover?.(undefined)
        setHoveredPin(null)
      }
    }
  }, [isDrawing, onHover, hoveredPin, listingsMap])

  // Freehand drawing: mouse down starts capture, mouse up closes polygon
  const handleMouseDown = useCallback((e: MapMouseEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    isCapturingRef.current = true
    captureBufferRef.current = [[e.lngLat.lng, e.lngLat.lat]]
    setDrawPoints([[e.lngLat.lng, e.lngLat.lat]])
    setCursorPos(null)
  }, [isDrawing])

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !isCapturingRef.current) return
    isCapturingRef.current = false
    const pts = captureBufferRef.current
    captureBufferRef.current = []
    if (pts.length >= 3) {
      closePolygon(pts)
    } else {
      setDrawPoints([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawing])

  // Sync hoveredId prop → Mapbox feature-state for native layer highlight
  const prevHoveredRef = useRef<string | null>(null)
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    try {
      if (prevHoveredRef.current) {
        map.setFeatureState({ source: 'listings', id: prevHoveredRef.current }, { hover: false })
      }
      if (hoveredId) {
        map.setFeatureState({ source: 'listings', id: hoveredId }, { hover: true })
      }
    } catch { /* source may not be loaded yet */ }
    prevHoveredRef.current = hoveredId ?? null
  }, [hoveredId])

  // Zone-filter polygon converted to GeoJSON for Mapbox `within` expression.
  // This replaces an O(n) setFeatureState loop — GPU-backed point-in-polygon test.
  const dimPolygon = useMemo<GeoJSON.Polygon | null>(() => {
    if (!closedPolygon || closedPolygon.length < 3) return null
    const ring = [...closedPolygon]
    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first)
    return { type: 'Polygon', coordinates: [ring] }
  }, [closedPolygon])

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    fitToListings,
    startDrawing,
    enterImmersive,
    exitImmersive,
    toggleTools: () => setShowTools(v => !v),
    setMapStyle: (id: string) => {
      setMapStyleId(id as MapStyleId)
    },
    toggleHeatmap: () => setShowHeatmap(v => !v),
    resize: () => mapRef.current?.resize(),
    get hasActiveZone() { return !!closedPolygon },
    get isDrawing() { return isDrawing },
    get hasPolygon() { return !!closedPolygon },
    get isImmersive() { return isImmersive },
    get showTools() { return showTools },
    get mapStyleId() { return mapStyleId },
    get showHeatmap() { return showHeatmap },
  }))

  // Viewport count + bbox/zoom tracking (bbox feeds the price-hexagon RPC)
  const [mapBbox, setMapBbox] = useState<[number, number, number, number] | null>(null)
  const [mapZoom, setMapZoom] = useState<number>(initialViewState.zoom)
  const updateViewportCount = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const b = map.getBounds()
    if (!b) return
    const w = b.getWest(), s = b.getSouth(), e = b.getEast(), n = b.getNorth()
    const pts = mapPoints || listings.filter(l => l.lat && l.lng)
    const count = pts.filter((p: { lat?: number; lng?: number }) =>
      p.lng != null && p.lat != null && p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n
    ).length
    setViewportCount(count)
    setMapBbox([w, s, e, n])
    setMapZoom(map.getZoom())
    onViewportChange?.({ west: w, south: s, east: e, north: n })
  }, [mapPoints, listings, onViewportChange])

  // Price-per-m² choropleth (replaces biased Mapbox heatmap density × price).
  // Only fetch when the layer is toggled on.
  const priceHexagons = usePriceHexagons({
    bbox: mapBbox,
    zoom: mapZoom,
    transactionType: transactionContext,
    enabled: showHeatmap,
  })
  const hexData = priceHexagons.data ?? { type: 'FeatureCollection' as const, features: [] }

  // Color scale: rent CHF/m²/month vs. sale CHF/m²
  const priceColorExpr = useMemo(() => {
    if (transactionContext === 'rent') {
      return [
        'interpolate', ['linear'], ['get', 'median_price_m2'],
        15, '#1e7a3e',
        22, '#84cc16',
        28, '#eab308',
        35, '#f97316',
        45, '#dc2626',
      ] as const
    }
    return [
      'interpolate', ['linear'], ['get', 'median_price_m2'],
      4000, '#1e7a3e',
      7000, '#84cc16',
      10000, '#eab308',
      14000, '#f97316',
      20000, '#dc2626',
    ] as const
  }, [transactionContext])


  function handlePinClick(listing: ListingCardData) {
    setSelectedListing(listing)
    // FlyTo animation to center on selected listing
    if (listing.lat && listing.lng) {
      mapRef.current?.flyTo({
        center: [listing.lng, listing.lat],
        zoom: Math.max(mapRef.current?.getZoom() ?? 11.5, 14),
        duration: 800,
      })
    }
  }

  // Fit bounds to all listings
  function fitToListings() {
    if (!listings.length || !mapRef.current) return
    const validListings = listings.filter((l) => l.lat && l.lng)
    if (!validListings.length) return

    const lngs = validListings.map((l) => l.lng!)
    const lats = validListings.map((l) => l.lat!)
    mapRef.current.fitBounds(
      [
        [Math.min(...lngs) - 0.02, Math.min(...lats) - 0.02],
        [Math.max(...lngs) + 0.02, Math.max(...lats) + 0.02],
      ],
      { duration: 600, padding: 50 }
    )
  }

  // ─── Draw zone handlers ───
  function startDrawing() {
    setIsDrawing(true)
    setDrawPoints([])
    setClosedPolygon(null)
    setCursorPos(null)
    onZoneFilter?.(null)
  }

  function clearZone() {
    setIsDrawing(false)
    setDrawPoints([])
    setClosedPolygon(null)
    setCursorPos(null)
    onZoneFilter?.(null)
  }

  function handleMapClick(e: MapMouseEvent) {
    // Neighborhood score: pick point on map
    if (neighborhoodPickMode) {
      setNeighborhoodPoint([e.lngLat.lng, e.lngLat.lat])
      setNeighborhoodPickMode(false)
      return
    }
    if (isDrawing) return

    const map = mapRef.current?.getMap()
    if (map) {
      const features = map.queryRenderedFeatures(e.point, {
        layers: LISTING_LAYERS as unknown as string[],
      })
      if (features.length > 0 && features[0].properties?.id) {
        const listing = listingsMap.get(features[0].properties.id as string)
        if (listing) handlePinClick(listing)
      }
    }
  }

  function closePolygon(pts: [number, number][]) {
    setClosedPolygon(pts)
    setIsDrawing(false)
    setCursorPos(null)

    // Filter listings inside polygon
    const insideIds = listings
      .filter((l) => l.lat && l.lng && pointInPolygon([l.lng!, l.lat!], pts))
      .map((l) => l.id)

    onZoneFilter?.(insideIds)
  }

  // Change cursor when drawing or placing pins
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    if (isDrawing || neighborhoodPickMode) {
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.getCanvas().style.cursor = ''
    }
    return () => {
      map.getCanvas().style.cursor = ''
    }
  }, [isDrawing, neighborhoodPickMode])

  // ─── GeoJSON for draw polygon ───
  const drawGeoJSON = useMemo(() => {
    const coords = closedPolygon || drawPoints
    if (coords.length === 0) return null

    // For the line/polygon shape
    const lineCoords = [...coords]
    if (cursorPos && !closedPolygon) lineCoords.push(cursorPos)
    if (closedPolygon) lineCoords.push(closedPolygon[0]) // close ring

    return {
      type: 'FeatureCollection' as const,
      features: [
        // Fill (only when closed)
        ...(closedPolygon
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'Polygon' as const,
                  coordinates: [[...closedPolygon, closedPolygon[0]]],
                },
              },
            ]
          : []),
        // Line
        ...(lineCoords.length >= 2
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: lineCoords,
                },
              },
            ]
          : []),
        // Points
        ...coords.map((c, i) => ({
          type: 'Feature' as const,
          properties: { index: i },
          geometry: {
            type: 'Point' as const,
            coordinates: c,
          },
        })),
      ],
    }
  }, [drawPoints, closedPolygon, cursorPos])

  // Polygon area label — memoized so the spherical sum doesn't run every render
  const polygonAreaLabel = useMemo(() => {
    if (!closedPolygon) return null
    const coords = closedPolygon
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    let area = 0
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length
      area += toRad(coords[j][0] - coords[i][0]) *
        (2 + Math.sin(toRad(coords[i][1])) + Math.sin(toRad(coords[j][1])))
    }
    area = Math.abs((area * R * R) / 2)
    if (area > 1_000_000) return `${(area / 1_000_000).toFixed(1)} km²`
    if (area > 10_000) return `${(area / 10_000).toFixed(1)} ha`
    return `${Math.round(area).toLocaleString('fr-CH')} m²`
  }, [closedPolygon])

  // Graceful fallback when VITE_MAPBOX_TOKEN is missing — without this guard,
  // mapbox-gl crashes deep inside its initialization (`Cannot read properties
  // of undefined (reading '0')` on pointRayInte…), which previously broke
  // /rent and /buy in any env without the token (audit bug B3). We render
  // a lightweight placeholder so the page itself stays usable; consumers
  // (SearchPage, etc.) continue to render their list view alongside.
  if (!MAPBOX_TOKEN) {
    return (
      <div className={cn(
        'relative w-full h-full flex items-center justify-center bg-gray-100 text-gray-500',
        className
      )}>
        <div className="text-center px-6 max-w-sm">
          <MapPin className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-gray-700">Carte indisponible</p>
          <p className="text-xs text-gray-500 mt-1">
            La configuration de la carte est manquante. Les biens restent consultables dans la liste.
          </p>
        </div>

        {/* Even without Mapbox, show the design's UX elements (proto megga-search-map.jsx) */}
        <div
          className="absolute bottom-10 right-6 z-[5] px-3 py-1.5 rounded-full bg-white text-[#0E1410] text-xs font-bold pointer-events-none"
          style={{
            fontFamily: '"Manrope", system-ui, sans-serif',
            boxShadow: '0 4px 12px rgba(14,20,16,0.12)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {listings.length.toLocaleString('fr-CH')} {listings.length > 1 ? 'biens visibles' : 'bien visible'}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn(
      'relative w-full h-full [&_.mapboxgl-ctrl-logo]:hidden [&_.mapboxgl-ctrl-attrib]:hidden [&_.mapboxgl-canvas-container]:bg-[#e8e0d8]',
      isImmersive && '[&_.mapboxgl-ctrl-group]:bg-gray-900/70 [&_.mapboxgl-ctrl-group]:backdrop-blur-xl [&_.mapboxgl-ctrl-group]:border-white/10 [&_.mapboxgl-ctrl-group_button]:!text-white/70 [&_.mapboxgl-ctrl-group_button:hover]:!bg-white/10 [&_.mapboxgl-ctrl-group_.mapboxgl-ctrl-icon]:!filter [&_.mapboxgl-ctrl-group_.mapboxgl-ctrl-icon]:!invert',
      className
    )}>
      <MapGL
        ref={mapRef}
        initialViewState={initialViewState}
        onMoveEnd={updateViewportCount}
        onClick={handleMapClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onStyleData={() => {
          // Small tail so tiles have time to rasterize before fading back in.
          if (isStyleSwitching) setTimeout(() => setIsStyleSwitching(false), 200)
        }}
        onIdle={() => {
          // Safety net — if onStyleData is missed, `idle` fires when the
          // map has finished rendering. Prevents the fade from getting stuck.
          if (isStyleSwitching) setIsStyleSwitching(false)
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={currentStyle.url}
        style={{
          width: '100%',
          height: '100%',
          transition: 'opacity 450ms cubic-bezier(0.22, 1, 0.36, 1), transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
          opacity: isStyleSwitching ? 0.35 : 1,
          transform: isStyleSwitching ? 'scale(1.015)' : 'scale(1)',
          transformOrigin: 'center',
        }}
        attributionControl={false}
        doubleClickZoom={!isDrawing}
        dragPan={!isDrawing}
        reuseMaps
        dragRotate={false}
        touchPitch={false}
        touchZoomRotate={false}
        maxPitch={0}
        terrain={undefined}
        onMouseMove={handleMouseMove}
        onLoad={(e) => {
          updateViewportCount()
          const map = e.target
          // Lazy-register the price pill sprite via `styleimagemissing` so it
          // works even if the layer renders before our addImage call.
          // Pill colors — port 1:1 du proto megga-search-map.jsx PricePin.
          // Default : fond blanc + border ink, texte ink. Hover : fond ink,
          // texte blanc. Une transition entre les deux suffit visuellement.
          // Le 'dim' state n'est plus utilisé mais conservé pour compat éventuelle.
          const PILL_COLORS: Record<string, { fill: string; stroke: string }> = {
            'price-pill': { fill: '#FFFFFF', stroke: '#0E1410' },           // proto default
            'price-pill-hover': { fill: '#0E1410', stroke: '#0E1410' },     // proto active
            'price-pill-dim': { fill: '#FFFFFF', stroke: '#DDE2EA' },       // dim/grise (rarely used)
          }
          const addPill = (id: string) => {
            const c = PILL_COLORS[id]
            if (!c || map.hasImage(id)) return
            // Fixed-size canvas sprite — all pills render identical size.
            // Simpler than icon-text-fit, guarantees clean pointer/text alignment.
            const W = 112, H = 48 // renders 56×24 logical at pixelRatio 2
            const canvas = document.createElement('canvas')
            canvas.width = W; canvas.height = H
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            // Pill body — wide, flat
            const px = 2, py = 2, pw = W - 4, ph = 32, pr = 16
            ctx.fillStyle = c.fill
            ctx.strokeStyle = c.stroke
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.moveTo(px + pr, py)
            ctx.arcTo(px + pw, py, px + pw, py + ph, pr)
            ctx.arcTo(px + pw, py + ph, px, py + ph, pr)
            ctx.arcTo(px, py + ph, px, py, pr)
            ctx.arcTo(px, py, px + pw, py, pr)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
            // Pointer at bottom center
            const cx = W / 2, pyTop = py + ph
            ctx.beginPath()
            ctx.moveTo(cx - 6, pyTop)
            ctx.lineTo(cx, pyTop + 10)
            ctx.lineTo(cx + 6, pyTop)
            ctx.closePath()
            ctx.fillStyle = c.fill
            ctx.fill()
            ctx.strokeStyle = c.stroke
            ctx.lineJoin = 'round'
            ctx.stroke()
            // Hide the seam where the triangle meets the pill
            ctx.fillStyle = c.fill
            ctx.fillRect(cx - 6, pyTop - 1, 12, 3)
            try {
              const data = ctx.getImageData(0, 0, W, H)
              map.addImage(id, { width: W, height: H, data: new Uint8Array(data.data.buffer) }, {
                pixelRatio: 2,
              })
            } catch { /* ignore */ }
          }
          // Register up-front
          addPill('price-pill')
          addPill('price-pill-hover')
          addPill('price-pill-dim')
          // Safety net: if Mapbox ever reports the image missing, create it on demand
          map.on('styleimagemissing', (ev: { id: string }) => addPill(ev.id))
        }}
      >
        {/* Draw polygon overlay */}
        {drawGeoJSON && (
          <Source id="draw-zone" type="geojson" data={drawGeoJSON}>
            {/* Polygon fill */}
            <Layer
              id="draw-fill"
              type="fill"
              filter={['==', '$type', 'Polygon']}
              paint={{
                'fill-color': '#2563EB',
                'fill-opacity': 0.15,
              }}
            />
            {/* Polygon outline — clean thin blue line */}
            <Layer
              id="draw-line"
              type="line"
              filter={['==', '$type', 'LineString']}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': '#2563EB',
                'line-width': 2.5,
              }}
            />
          </Source>
        )}

        {/* ─── 1 pin per listing, no clustering. Dot at low zoom → price pill at mid zoom ─── */}
        <Source
          id="listings"
          type="geojson"
          data={listingsGeoJSON}
          promoteId="id"
        >
          {/* Dots — far zoom : port 1:1 du proto megga-search-map.jsx PricePin
              dot mode. Default = green MEGGA (#0041D9), hover = ink. */}
          <Layer
            id="unclustered-dot"
            type="circle"
            paint={{
              'circle-color': (dimPolygon
                ? ['case',
                    ['boolean', ['feature-state', 'hover'], false], '#0E1410',
                    ['!', ['within', dimPolygon]], '#9CA3AF',
                    '#0041D9']
                : ['case',
                    ['boolean', ['feature-state', 'hover'], false], '#0E1410',
                    '#0041D9']) as unknown as string,
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, 3,
                11, 5,
                12.9, 6,
              ],
              'circle-opacity': ['step', ['zoom'], 1, 13, 0],
              'circle-stroke-opacity': ['step', ['zoom'], 1, 13, 0],
              'circle-stroke-color': 'rgba(255,255,255,0.95)',
              'circle-stroke-width': 1.5,
            }}
          />

          {/* Price pills — red bubble sprite with pointer tail, stretched to fit the price */}
          <Layer
            id="unclustered-label"
            type="symbol"
            layout={{
              'icon-image': 'price-pill',
              'icon-allow-overlap': false,
              'icon-ignore-placement': false,
              'icon-padding': 2,
              'icon-anchor': 'bottom',
              'icon-offset': [0, 0],
              'text-field': ['get', 'priceLabel'],
              'text-size': 11,
              'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
              'text-allow-overlap': false,
              'text-ignore-placement': false,
              'text-padding': 2,
              'text-anchor': 'bottom',
              'text-offset': [0, -0.75],
            }}
            paint={{
              // Proto-fidèle : texte ink sur pill blanche (default state)
              'text-color': '#0E1410',
              'icon-opacity': ['step', ['zoom'], 0, 13, 1],
              'text-opacity': ['step', ['zoom'], 0, 13, 1],
            }}
          />

          {/* Hover pill — proto: fond ink, texte blanc */}
          <Layer
            id="unclustered-label-hover"
            type="symbol"
            filter={['==', ['get', 'id'], (hoveredPin?.id ?? hoveredId ?? '')]}
            layout={{
              'icon-image': 'price-pill-hover',
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'bottom',
              'icon-offset': [0, 0],
              'text-field': ['get', 'priceLabel'],
              'text-size': 11,
              'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
              'text-anchor': 'bottom',
              'text-offset': [0, -0.75],
            }}
            paint={{
              // Proto-fidèle : texte blanc sur pill ink (hover state)
              'text-color': '#FFFFFF',
              'icon-opacity': ['step', ['zoom'], 0, 13, 1],
              'text-opacity': ['step', ['zoom'], 0, 13, 1],
            }}
          />
        </Source>

        {/* Hover preview card — port proto megga-search-map.jsx PinPreview.
             Shows a compact card when the user hovers a pin (no click). */}
        {hoveredPin && !selectedListing && hoveredPin.lat && hoveredPin.lng && !isDrawing && (() => {
          const photo = hoveredPin.photos?.[0]
          const isRent = hoveredPin.context === 'rent'
          return (
            <Popup
              longitude={hoveredPin.lng}
              latitude={hoveredPin.lat}
              anchor="bottom"
              closeButton={false}
              closeOnClick={false}
              offset={22}
              maxWidth="280px"
              className="[&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:rounded-xl [&_.mapboxgl-popup-content]:overflow-hidden [&_.mapboxgl-popup-content]:shadow-xl [&_.mapboxgl-popup-tip]:hidden pointer-events-none"
            >
              <div
                className="w-[260px] bg-white rounded-xl overflow-hidden border"
                style={{
                  fontFamily: '"Manrope", system-ui, sans-serif',
                  borderColor: '#E6E8EC',
                  boxShadow: '0 14px 36px rgba(14,20,16,0.22)',
                }}
              >
                <div
                  className="h-[72px] bg-cover bg-center"
                  style={{
                    backgroundImage: photo ? `url(${photo})` : undefined,
                    background: photo ? `url(${photo}) center/cover` : '#F2F4F8',
                  }}
                />
                <div className="px-3 pt-2 pb-2.5">
                  <div className="text-[13px] font-bold text-[#0E1410] truncate leading-tight">
                    {hoveredPin.title}
                  </div>
                  <div className="text-[11px] text-[#7A8079] mb-1 truncate">
                    {hoveredPin.address || hoveredPin.city}
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[13px] font-extrabold text-[#0E1410] tabular-nums">
                      {formatCHF(hoveredPin.price)}{isRent ? '/mo' : ''}
                    </span>
                    <span className="text-[10px] text-[#7A8079]">
                      {hoveredPin.surface_m2 || '—'} m² · {hoveredPin.rooms || '—'} p
                    </span>
                  </div>
                </div>
              </div>
            </Popup>
          )
        })()}

        {/* Popup — Zillow-style card on pin click */}
        {selectedListing && selectedListing.lat && selectedListing.lng && !isDrawing && (() => {
          const photos = selectedListing.photos?.length ? selectedListing.photos : []
          const hasPhotos = photos.length > 0
          const currentPhoto = photos[photoIdx] || photos[0]
          const daysAgo = selectedListing.published_at
            ? Math.max(0, Math.floor((Date.now() - new Date(selectedListing.published_at).getTime()) / 86400000))
            : (selectedListing.days_on_market ?? null)
          const listingTypeLabel = {
            apartment: 'Appartement', house: 'Maison', villa: 'Villa',
            commercial: 'Commercial', office: 'Bureau', parking: 'Parking',
            storage: 'Cave', land: 'Terrain',
          }[selectedListing.type || 'apartment'] || 'Bien'
          const fav = isFavorite(selectedListing.id)
          return (
          <Popup
            longitude={selectedListing.lng}
            latitude={selectedListing.lat}
            anchor="bottom"
            onClose={() => { setSelectedListing(null); if (isTourActive) stopTour() }}
            closeOnClick={false}
            closeButton={false}
            offset={22}
            maxWidth="320px"
            className="[&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:rounded-xl [&_.mapboxgl-popup-content]:overflow-hidden [&_.mapboxgl-popup-content]:shadow-xl [&_.mapboxgl-popup-tip]:hidden"
          >
            <div className="w-[300px] bg-theme-card rounded-xl overflow-hidden">
              {/* Photo with overlays */}
              <div className="relative">
                {hasPhotos ? (
                  <img
                    src={currentPhoto}
                    alt={selectedListing.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-[180px] object-cover"
                  />
                ) : (
                  <div className="w-full h-[180px] flex items-center justify-center bg-theme-hover">
                    <Building2 className="h-10 w-10 text-theme-muted" />
                  </div>
                )}

                {/* Top-left : "il y a X jours" */}
                {daysAgo !== null && daysAgo >= 0 && (
                  <span className="absolute top-2.5 left-2.5 bg-black/75 text-white text-xs font-medium px-2.5 py-1 rounded-lg backdrop-blur-sm">
                    {daysAgo === 0 ? "aujourd'hui" : daysAgo === 1 ? 'hier' : `il y a ${daysAgo} jours`}
                  </span>
                )}

                {/* Top-right : heart favorite + close */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(selectedListing.id) }}
                    className="h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors cursor-pointer"
                    title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Heart className={cn('h-4 w-4', fav ? 'fill-white text-white' : 'text-white')} />
                  </button>
                  <button
                    onClick={() => { setSelectedListing(null); if (isTourActive) stopTour() }}
                    className="h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors cursor-pointer"
                    title="Fermer"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>

                {/* Carousel dots */}
                {photos.length > 1 && (
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    {photos.slice(0, 5).map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setPhotoIdx(i) }}
                        className={cn(
                          'h-1.5 rounded-full transition-all cursor-pointer',
                          i === photoIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                        )}
                        aria-label={`Photo ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Text content */}
              <div className="block px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-theme-primary leading-tight">
                      {formatCHF(selectedListing.price)}
                      <span className="text-sm font-medium text-theme-secondary ml-1">
                        {selectedListing.context === 'rent' ? '/mois' : ''}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                    className="shrink-0 h-7 w-7 rounded-full hover:bg-theme-active flex items-center justify-center text-theme-muted hover:text-theme-secondary transition-colors cursor-pointer"
                    title="Plus d'options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>

                {/* Details row : rooms | bedrooms | surface | type */}
                <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-1.5 text-sm text-theme-secondary">
                  {selectedListing.rooms > 0 && (<><span className="font-semibold text-theme-primary">{selectedListing.rooms}</span><span>p.</span></>)}
                  {selectedListing.bedrooms > 0 && (<><span className="text-theme-muted">|</span><span className="font-semibold text-theme-primary">{selectedListing.bedrooms}</span><span>ch.</span></>)}
                  {selectedListing.surface_m2 > 0 && (<><span className="text-theme-muted">|</span><span className="font-semibold text-theme-primary">{formatSurface(selectedListing.surface_m2)}</span></>)}
                  <span className="text-theme-muted">|</span>
                  <span>{listingTypeLabel}</span>
                </div>

                {/* Address */}
                <p className="text-sm text-theme-tertiary mt-1.5 truncate">
                  {selectedListing.address}{selectedListing.city ? `, ${selectedListing.city}` : ''}
                </p>
              </div>
            </div>
          </Popup>
          )
        })()}

        {/* Price-per-m² choropleth (hex aggregation from Supabase RPC) */}
        {showHeatmap && hexData.features.length > 0 && (
          <Source id="price-hexagons" type="geojson" data={hexData}>
            <Layer
              id="price-hex-fill"
              type="fill"
              paint={{
                'fill-color': priceColorExpr as unknown as string,
                'fill-opacity': 0.5,
              }}
            />
            <Layer
              id="price-hex-line"
              type="line"
              paint={{
                'line-color': '#ffffff',
                'line-opacity': 0.3,
                'line-width': 0.5,
              }}
            />
          </Source>
        )}

        {/* Neighborhood score marker — emerald to distinguish from blue clusters */}
        {neighborhoodPoint && (
          <Marker longitude={neighborhoodPoint[0]} latitude={neighborhoodPoint[1]} anchor="center">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-11 w-11 rounded-full border-2 border-emerald-400/40 animate-pulse" />
              <div className="h-8 w-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <MapPin className="h-4 w-4 text-white" />
              </div>
            </div>
          </Marker>
        )}

        {/* Geocoding search marker + radius circle */}
        {geoMarker && (
          <>
            <Marker longitude={geoMarker[0]} latitude={geoMarker[1]} anchor="bottom">
              <div className="relative">
                <div className="h-8 w-8 bg-accent rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <Search className="h-4 w-4 text-white" />
                </div>
              </div>
            </Marker>
            <Source
              id="search-radius"
              type="geojson"
              data={{
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    Array.from({ length: 64 }, (_, i) => {
                      const angle = (i / 64) * 2 * Math.PI
                      const km = geoRadius / 1000
                      const lat = geoMarker[1] + (km / 111.32) * Math.cos(angle)
                      const lng = geoMarker[0] + (km / (111.32 * Math.cos(geoMarker[1] * Math.PI / 180))) * Math.sin(angle)
                      return [lng, lat]
                    }),
                  ],
                },
                properties: {},
              }}
            >
              <Layer
                id="search-radius-fill"
                type="fill"
                paint={{ 'fill-color': '#2563EB', 'fill-opacity': 0.15 }}
              />
              {/* White glow for visibility on dark backgrounds */}
              <Layer
                id="search-radius-line-glow"
                type="line"
                paint={{ 'line-color': '#FFFFFF', 'line-width': 5, 'line-opacity': 0.4 }}
              />
              <Layer
                id="search-radius-line"
                type="line"
                paint={{ 'line-color': '#2563EB', 'line-width': 2, 'line-dasharray': [4, 2] }}
              />
            </Source>
          </>
        )}
      </MapGL>

      {/* Style-switch "dip" overlay — tinted to match the target style for a smooth Apple-like transition */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[3] transition-opacity duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          opacity: isStyleSwitching ? 0.45 : 0,
          backgroundColor:
            mapStyleId === 'dark' ? '#0b0f19'
              : mapStyleId === 'satellite' ? '#1a1f2e'
              : '#f4f5f7',
        }}
      />

      {/* Draw zone — always shown on the map top-right */}
      {!isDrawing && !closedPolygon && (
        <div className="absolute top-3 right-3 z-[6]">
          <button
            onClick={startDrawing}
            className={cn(
              'text-sm font-medium px-3.5 py-2 rounded-full backdrop-blur-xl border shadow-xl transition-colors cursor-pointer flex items-center gap-1.5',
              ui.surface,
              isMapDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-900/5'
            )}
          >
            <PenLine className="h-3.5 w-3.5" />
            Dessiner
          </button>
        </div>
      )}

      {/* Tools menu — bottom-right (split/non-immersive view) */}
      {!isImmersive && (
        <div ref={toolsMenuRef} className="absolute bottom-10 right-20 z-[6]">
          <button
            onClick={() => setToolsMenuOpen(v => !v)}
            className={cn(
              'text-sm font-medium px-3.5 py-2 rounded-full backdrop-blur-xl border shadow-xl transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none focus-visible:outline-none',
              ui.surface,
              (toolsMenuOpen || showTools || showHeatmap)
                ? 'text-accent'
                : (isMapDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-900/5')
            )}
          >
            Outils
            <ChevronDown className={cn('h-3 w-3 transition-transform', toolsMenuOpen && 'rotate-180')} />
          </button>
          {toolsMenuOpen && (
            <div className={cn(
              'absolute bottom-full right-0 mb-2 w-52 backdrop-blur-xl rounded-xl shadow-2xl border overflow-hidden py-1',
              ui.dropdown
            )}>
              <p className={cn('px-3 pt-1.5 pb-1 text-xs font-semibold', isMapDark ? 'text-white/60' : 'text-gray-500')}>Style de carte</p>
              {([
                { id: 'satellite', label: 'Satellite', icon: Satellite },
                { id: 'light', label: 'Clair', icon: Sun },
                { id: 'dark', label: 'Sombre', icon: Moon },
              ] as const).map(style => {
                const Icon = style.icon
                const isActive = mapStyleId === style.id
                return (
                  <button
                    key={style.id}
                    onClick={() => setMapStyleId(style.id as MapStyleId)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                      isActive ? ui.dropdownItemActive : ui.dropdownItemIdle
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {style.label}
                  </button>
                )
              })}
              <div className={cn('h-px my-1', isMapDark ? 'bg-white/10' : 'bg-gray-100')} />
              <button
                onClick={() => { enterImmersive(); setToolsMenuOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  ui.dropdownItemIdle
                )}
              >
                <Maximize className="h-3.5 w-3.5" />
                Mode immersif
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clear zone — always shown on the map when a polygon is active */}
      {closedPolygon && (
        <div className="absolute top-3 right-3 z-[6]">
          <button
            onClick={clearZone}
            className={cn(
              'text-sm font-medium px-3.5 py-2 rounded-full backdrop-blur-xl border shadow-xl transition-colors cursor-pointer flex items-center gap-1.5',
              ui.surface,
              isMapDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-900/5'
            )}
          >
            Enlever la zone
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Drawing instructions — full-width top bar, adapts to map theme */}
      {isDrawing && (
        <div className={cn(
          'absolute top-0 left-0 right-0 z-[10] backdrop-blur-md px-6 py-3 flex items-center justify-between border-b',
          isMapDark
            ? 'bg-gray-900/85 border-white/10'
            : 'bg-white/85 border-gray-200/70'
        )}>
          <p className={cn('text-sm', isMapDark ? 'text-white' : 'text-gray-900')}>
            <span className="font-semibold">Dessinez une forme</span>
            <span className={isMapDark ? 'text-white/70' : 'text-gray-600'}> autour des régions où vous souhaitez vivre</span>
          </p>
          <button
            onClick={clearZone}
            className={cn(
              'text-sm font-medium transition-colors cursor-pointer',
              isMapDark ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            Annuler
          </button>
        </div>
      )}

      {/* Zoom controls — custom, theme-adaptive, aligned with bottom tools bar */}
      <div className={cn(
        'absolute z-[6] flex flex-col',
        isImmersive ? 'bottom-6 right-6' : 'bottom-10 right-3'
      )}>
        <div className={cn(
          'flex flex-col backdrop-blur-xl border shadow-xl rounded-full p-1 gap-1',
          ui.surface
        )}>
          <button
            onClick={() => mapRef.current?.getMap()?.zoomIn()}
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center transition-colors cursor-pointer',
              ui.iconIdle
            )}
            aria-label="Zoom avant"
            title="Zoom avant"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => mapRef.current?.getMap()?.zoomOut()}
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center transition-colors cursor-pointer',
              ui.iconIdle
            )}
            aria-label="Zoom arrière"
            title="Zoom arrière"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Immersive filters pill — sits directly above the tools bar (which is anchored at bottom-6, height ~44px) */}
      {isImmersive && (
        <div className="absolute bottom-[76px] left-6 z-[5]">
          {/* ── Filter bar — collapsible pill → expanded horizontally on click ── */}
          <div
            className={cn(
              'flex items-center backdrop-blur-xl border overflow-hidden transition-all shadow-xl',
              ui.surface,
              immersiveFiltersOpen
                ? 'rounded-2xl gap-1 px-2 py-1 max-w-[min(92vw,900px)] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
                : 'rounded-full gap-0 px-0 py-0 max-w-[44px] duration-300 ease-out'
            )}
          >
            {/* Toggle button — always visible */}
            <button
              onClick={() => setImmersiveFiltersOpen(v => !v)}
              className={cn(
                'h-9 w-11 flex items-center justify-center transition-colors cursor-pointer shrink-0',
                ui.iconIdle,
                immersiveFiltersOpen ? 'rounded-xl' : 'rounded-full'
              )}
              aria-expanded={immersiveFiltersOpen}
              aria-label={immersiveFiltersOpen ? 'Fermer les filtres' : 'Ouvrir les filtres'}
              title="Filtres"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            {/* Collapsible content */}
            <div
              className={cn(
                'flex items-center gap-1 transition-all overflow-hidden whitespace-nowrap',
                immersiveFiltersOpen
                  ? 'opacity-100 translate-x-0 duration-[400ms] delay-75 ease-[cubic-bezier(0.22,1,0.36,1)]'
                  : 'opacity-0 -translate-x-2 duration-150 ease-out pointer-events-none w-0'
              )}
            >
            {[
              { label: 'Appart.', active: quickFilters.type === 'apartment', onClick: () => updateQuickFilter({ type: quickFilters.type === 'apartment' ? '' : 'apartment' }) },
              { label: 'Maison', active: quickFilters.type === 'house', onClick: () => updateQuickFilter({ type: quickFilters.type === 'house' ? '' : 'house' }) },
            ].map(f => (
              <button
                key={f.label}
                onClick={f.onClick}
                className={cn(
                  'h-7 px-3 rounded-full text-xs font-medium transition-all cursor-pointer',
                  f.active ? ui.chipActive : ui.chipInactive
                )}
              >
                {f.label}
              </button>
            ))}
            <div className={cn('w-px h-4 mx-1', ui.separator)} />
            {(transactionContext === 'rent'
              ? [
                  { label: '< 1.5K', active: quickFilters.maxPrice === 1500, onClick: () => updateQuickFilter({ maxPrice: quickFilters.maxPrice === 1500 ? undefined : 1500 }) },
                  { label: '< 2.5K', active: quickFilters.maxPrice === 2500, onClick: () => updateQuickFilter({ maxPrice: quickFilters.maxPrice === 2500 ? undefined : 2500 }) },
                  { label: '< 4K', active: quickFilters.maxPrice === 4000, onClick: () => updateQuickFilter({ maxPrice: quickFilters.maxPrice === 4000 ? undefined : 4000 }) },
                ]
              : [
                  { label: '< 500K', active: quickFilters.maxPrice === 500000, onClick: () => updateQuickFilter({ maxPrice: quickFilters.maxPrice === 500000 ? undefined : 500000 }) },
                  { label: '< 1M', active: quickFilters.maxPrice === 1000000, onClick: () => updateQuickFilter({ maxPrice: quickFilters.maxPrice === 1000000 ? undefined : 1000000 }) },
                  { label: '< 2M', active: quickFilters.maxPrice === 2000000, onClick: () => updateQuickFilter({ maxPrice: quickFilters.maxPrice === 2000000 ? undefined : 2000000 }) },
                ]
            ).map(f => (
              <button
                key={f.label}
                onClick={f.onClick}
                className={cn(
                  'h-7 px-3 rounded-full text-xs font-medium transition-all cursor-pointer',
                  f.active ? ui.chipActive : ui.chipInactive
                )}
              >
                {f.label}
              </button>
            ))}
            <div className={cn('w-px h-4 mx-1', ui.separator)} />
            {[
              { label: '3+ p.', active: quickFilters.minRooms === 3, onClick: () => updateQuickFilter({ minRooms: quickFilters.minRooms === 3 ? undefined : 3 }) },
              { label: '4+ p.', active: quickFilters.minRooms === 4, onClick: () => updateQuickFilter({ minRooms: quickFilters.minRooms === 4 ? undefined : 4 }) },
              { label: '5+ p.', active: quickFilters.minRooms === 5, onClick: () => updateQuickFilter({ minRooms: quickFilters.minRooms === 5 ? undefined : 5 }) },
            ].map(f => (
              <button
                key={f.label}
                onClick={f.onClick}
                className={cn(
                  'h-7 px-3 rounded-full text-xs font-medium transition-all cursor-pointer',
                  f.active ? ui.chipActive : ui.chipInactive
                )}
              >
                {f.label}
              </button>
            ))}
            <div className={cn('w-px h-4 mx-1', ui.separator)} />
            {[
              { label: '50+ m²', active: quickFilters.minSurface === 50, onClick: () => updateQuickFilter({ minSurface: quickFilters.minSurface === 50 ? undefined : 50 }) },
              { label: '80+ m²', active: quickFilters.minSurface === 80, onClick: () => updateQuickFilter({ minSurface: quickFilters.minSurface === 80 ? undefined : 80 }) },
              { label: '100+ m²', active: quickFilters.minSurface === 100, onClick: () => updateQuickFilter({ minSurface: quickFilters.minSurface === 100 ? undefined : 100 }) },
            ].map(f => (
              <button
                key={f.label}
                onClick={f.onClick}
                className={cn(
                  'h-7 px-3 rounded-full text-xs font-medium transition-all cursor-pointer',
                  f.active ? ui.chipActive : ui.chipInactive
                )}
              >
                {f.label}
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* Immersive tools bar + non-immersive controls — bottom-left. Higher
          z-index than the filters pill above so the Vue dropup (which opens
          upward, over the filters pill position) stays above it. */}
      <div className={cn(
        'absolute',
        isImmersive ? 'bottom-6 left-6 z-[10]' : 'bottom-10 left-3 flex gap-2 z-[5]'
      )}>
        {isImmersive ? (
          <>
          {/* ── Tools bar — minimal icon-only cluster (Apple Photos style) ── */}
          <div className={cn(
            'flex items-center gap-1 backdrop-blur-xl shadow-xl border rounded-full p-1',
            ui.surface
          )}>
            {/* Style picker */}
            <div className="relative">
              <button
                onClick={() => setShowStylePicker(v => !v)}
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:outline-none',
                  showStylePicker ? ui.iconActive : ui.iconIdle
                )}
                aria-label="Style de carte"
                title={`Style : ${currentStyle.label}`}
              >
                <Layers className="h-4 w-4" />
              </button>
              {showStylePicker && (
                <div className={cn(
                  'absolute bottom-full left-0 mb-3 z-[60] backdrop-blur-xl rounded-xl shadow-2xl border overflow-hidden min-w-[140px]',
                  ui.dropdown
                )}>
                  {MAP_STYLES.map(s => {
                    const Icon = s.icon
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setMapStyleId(s.id); setShowStylePicker(false) }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
                          mapStyleId === s.id ? ui.dropdownItemActive : ui.dropdownItemIdle
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Heatmap */}
            <button
              onClick={() => setShowHeatmap(v => !v)}
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:outline-none',
                showHeatmap ? ui.iconActive : ui.iconIdle
              )}
              aria-label="Heatmap prix/m²"
              title="Heatmap prix/m²"
            >
              <Thermometer className="h-4 w-4" />
            </button>

            {/* Geo search */}
            <div className="relative">
              <button
                onClick={() => setShowGeoSearch(v => !v)}
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:outline-none',
                  showGeoSearch ? ui.iconActive : ui.iconIdle
                )}
                aria-label="Rechercher un lieu"
                title="Rechercher un lieu"
              >
                <Search className="h-4 w-4" />
              </button>
              {showGeoSearch && (
                <div className={cn(
                  'absolute bottom-0 left-full ml-3 z-[60] w-80 backdrop-blur-xl rounded-xl shadow-2xl border overflow-hidden',
                  ui.dropdown
                )}>
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('text-xs font-semibold', isMapDark ? 'text-white/80' : 'text-gray-700')}>Rechercher un lieu</span>
                      <button
                        onClick={() => { setShowGeoSearch(false); setGeoMarker(null) }}
                        className={cn('cursor-pointer transition-colors', isMapDark ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-900')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={geoSearchQuery}
                      onChange={(e) => {
                        const q = e.target.value
                        setGeoSearchQuery(q)
                        debouncedGeoFetch('immersive-geo', q, setGeoResults)
                      }}
                      placeholder="Adresse, ville, quartier..."
                      className={cn(
                        'w-full h-9 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent',
                        isMapDark
                          ? 'bg-white/10 border-white/20 text-white placeholder:text-white/40'
                          : 'bg-gray-900/5 border-gray-200 text-gray-900 placeholder:text-gray-400'
                      )}
                      autoFocus
                    />
                    {geoMarker && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className={cn('text-xs', isMapDark ? 'text-white/50' : 'text-gray-500')}>Rayon</span>
                        <input
                          type="range"
                          min={250}
                          max={5000}
                          step={250}
                          value={geoRadius}
                          onChange={(e) => updateGeoRadius(Number(e.target.value))}
                          className="flex-1 h-1 accent-accent"
                        />
                        <span className={cn('text-xs min-w-[40px] text-right', isMapDark ? 'text-white/70' : 'text-gray-700')}>
                          {geoRadius >= 1000 ? `${(geoRadius / 1000).toFixed(1)} km` : `${geoRadius} m`}
                        </span>
                      </div>
                    )}
                  </div>
                  {geoResults.length > 0 && (
                    <div className={cn('border-t max-h-60 overflow-y-auto py-1', isMapDark ? 'border-white/10' : 'border-gray-200/70')}>
                      {geoResults.map((r, i) => {
                        const Icon = iconForPlaceType(r.place_type)
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              mapRef.current?.flyTo({ center: r.center, zoom: 14, duration: 1200, pitch: 0 })
                              setGeoMarker(r.center)
                              setShowGeoSearch(false)
                              setGeoSearchQuery('')
                              setGeoResults([])
                            }}
                            style={{ animationDelay: `${i * 30}ms` }}
                            className={cn(
                              'w-full px-3 py-2 flex items-center gap-3 text-left cursor-pointer transition-colors animate-in fade-in slide-in-from-top-1 duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
                              isMapDark ? 'hover:bg-white/10' : 'hover:bg-gray-900/5'
                            )}
                          >
                            <span className={cn(
                              'h-8 w-8 shrink-0 rounded-full flex items-center justify-center',
                              isMapDark ? 'bg-white/5 text-white/70' : 'bg-gray-900/5 text-gray-600'
                            )}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-sm font-medium truncate', isMapDark ? 'text-white' : 'text-gray-900')}>{r.text}</p>
                              {r.context && (
                                <p className={cn('text-xs truncate', isMapDark ? 'text-white/50' : 'text-gray-500')}>{r.context}</p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Neighborhood score */}
            <button
              onClick={() => {
                if (neighborhoodPoint) { setNeighborhoodPoint(null) }
                else { setNeighborhoodPickMode(true) }
              }}
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:outline-none',
                neighborhoodPoint || neighborhoodPickMode ? ui.iconActive : ui.iconIdle
              )}
              aria-label="Score quartier"
              title="Score quartier"
            >
              <MapPin className="h-4 w-4" />
            </button>

            {/* Separator */}
            <span className={cn('w-px h-5 mx-0.5', ui.separator)} aria-hidden />

            {/* Exit immersive */}
            <button
              onClick={exitImmersive}
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:outline-none',
                ui.iconIdle
              )}
              aria-label="Quitter le mode immersif"
              title="Quitter (Esc)"
            >
              <Minimize className="h-4 w-4" />
            </button>
          </div>
          </>
        ) : (
          <>
            {/* Tools toggle — hidden when controls are in parent filter bar */}
            {!hideTopControls && (
              <button
                onClick={() => setShowTools(v => !v)}
                className={cn(
                  'h-9 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                  showTools
                    ? 'bg-theme-active text-theme-primary border-theme-active'
                    : 'bg-theme-card text-theme-secondary border-theme-border hover:bg-theme-hover'
                )}
                aria-label="Outils avancés"
              >
                <Mountain className="h-3.5 w-3.5" />
                Outils
              </button>
            )}

            {/* Immersive + Style picker — hidden when controls are in parent filter bar */}
            {!hideTopControls && (
              <>
                <button
                  onClick={enterImmersive}
                  className="h-9 px-3 rounded-xl bg-theme-card border border-theme-border text-theme-secondary text-xs font-medium hover:bg-theme-hover transition-colors cursor-pointer flex items-center gap-1.5"
                  aria-label="Mode immersif"
                >
                  <Maximize className="h-3.5 w-3.5" />
                  Immersif
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowStylePicker(v => !v)}
                    className="h-9 px-3 rounded-xl bg-theme-card border border-theme-border text-theme-secondary text-xs font-medium hover:bg-theme-hover transition-colors cursor-pointer flex items-center gap-1.5"
                    aria-label="Changer le style de carte"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    {currentStyle.label}
                  </button>

                  {showStylePicker && (
                    <div className="absolute bottom-full left-0 mb-2 bg-theme-card rounded-xl shadow-lg border border-theme-border overflow-hidden min-w-[140px]">
                      {MAP_STYLES.map(s => {
                        const Icon = s.icon
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              setMapStyleId(s.id)
                              setShowStylePicker(false)
                                                    }}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
                              mapStyleId === s.id
                                ? 'bg-theme-active text-accent'
                                : 'text-theme-secondary hover:bg-theme-hover'
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Viewport counter */}
        {!isImmersive && viewportCount > 0 && (
          <span className={cn(
            'h-9 px-3.5 rounded-full backdrop-blur-xl border shadow-xl text-xs font-semibold flex items-center tabular-nums',
            ui.surface,
            isMapDark ? 'text-white' : 'text-gray-900'
          )}>
            {viewportCount.toLocaleString('fr-CH')} biens
          </span>
        )}
      </div>

      {/* Price/m² choropleth legend */}
      {showHeatmap && (
        <div className="absolute bottom-4 left-4 z-[5] rounded-xl bg-theme-card border border-theme-border px-3 py-2 shadow-sm">
          <div className="text-[10px] uppercase tracking-wide text-theme-tertiary mb-1.5">
            {transactionContext === 'rent' ? 'CHF/m²/mois (médian)' : 'CHF/m² (médian)'}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-32 rounded-sm" style={{
              background: 'linear-gradient(to right, #1e7a3e, #84cc16, #eab308, #f97316, #dc2626)'
            }} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-theme-tertiary tabular-nums">
            <span>{transactionContext === 'rent' ? '15' : "4'000"}</span>
            <span>{transactionContext === 'rent' ? '30' : "10'000"}</span>
            <span>{transactionContext === 'rent' ? '45+' : "20'000+"}</span>
          </div>
          {priceHexagons.isFetching && (
            <div className="text-[10px] text-theme-tertiary mt-1">Chargement…</div>
          )}
          {!priceHexagons.isFetching && hexData.features.length === 0 && (
            <div className="text-[10px] text-theme-tertiary mt-1">Pas assez de biens dans cette zone</div>
          )}
        </div>
      )}

      {/* ── Immersive controls (tools panel — NOT shown in immersive mode, those are in the bottom toolbar) ── */}
      {(isFullscreen || showTools) && !isImmersive && (
        <>
          {/* Prix/m² + Rechercher un lieu pills removed — they overlapped the Dessiner
              button at top-right. Both actions remain accessible via the immersive
              bottom toolbar (Thermometer + Search icons). */}

          {/* Bottom-center: Zone area measurement */}
          {closedPolygon && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[5] bg-theme-card/95 backdrop-blur-sm rounded-xl border border-theme-border px-4 py-2 flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-theme-tertiary" />
              <span className="text-xs font-medium text-theme-secondary">
                Surface : {polygonAreaLabel}
              </span>
            </div>
          )}

        </>
      )}

      {/* ── Immersive-only panels ── */}
      {isImmersive && (
        <>
          {/* Listing counter — top-left, avoids overlap with the Dessiner button */}
          <div className={cn(
            'absolute top-4 left-4 z-[5] backdrop-blur-xl text-xs font-semibold px-3.5 py-2 rounded-full border shadow-xl',
            ui.surface,
            isMapDark ? 'text-white' : 'text-gray-900'
          )}>
            {(mapPoints?.length || listings.length).toLocaleString('fr-CH')} biens
          </div>

          {/* Neighborhood pick mode instruction — Apple-style pill, theme-aware */}
          {neighborhoodPickMode && (
            <div
              className={cn(
                'absolute top-4 left-1/2 -translate-x-1/2 z-[6] backdrop-blur-xl border shadow-xl rounded-full pl-2 pr-1.5 py-1.5 flex items-center gap-2',
                'animate-in fade-in slide-in-from-top-2 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                ui.surface
              )}
            >
              {/* Pulsing dot to signal "active picker" */}
              <span className="relative flex items-center justify-center h-6 w-6 shrink-0">
                <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping', isMapDark ? 'bg-white/40' : 'bg-gray-900/30')} />
                <span className={cn('relative h-2 w-2 rounded-full', isMapDark ? 'bg-white' : 'bg-gray-900')} />
              </span>
              <span className={cn(
                'text-sm font-medium pr-1',
                isMapDark ? 'text-white' : 'text-gray-900'
              )}>
                Cliquez pour analyser un quartier
              </span>
              <button
                onClick={() => setNeighborhoodPickMode(false)}
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:outline-none',
                  ui.iconIdle
                )}
                aria-label="Annuler la sélection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Neighborhood score overlay */}
          {neighborhoodPoint && (
            <NeighborhoodOverlay
              lat={neighborhoodPoint[1]}
              lng={neighborhoodPoint[0]}
              isMapDark={isMapDark}
              onClose={() => setNeighborhoodPoint(null)}
            />
          )}

          {/* Tour navigation */}
          {isTourActive && tourListings.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[6] flex items-center gap-2 bg-gray-900/80 backdrop-blur-xl rounded-2xl px-3 py-1.5 shadow-2xl border border-white/10">
              <button onClick={prevTourStop} className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer" title="Précédent">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-white text-xs font-medium min-w-[60px] text-center">
                {tourIndex + 1} / {tourListings.length}
              </span>
              <button onClick={nextTourStop} className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer" title="Suivant">
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-white/20" />
              <button
                onClick={() => setTourAutoPlay(v => !v)}
                className={cn(
                  'h-8 px-2.5 rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer',
                  tourAutoPlay ? 'text-white bg-accent/60' : 'text-white/60 hover:text-white hover:bg-white/10'
                )}
                title={tourAutoPlay ? 'Mettre en pause' : 'Lecture automatique'}
              >
                {tourAutoPlay ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {tourAutoPlay ? 'Auto' : 'Auto'}
              </button>
              <div className="w-px h-5 bg-white/20" />
              <button onClick={stopTour} className="text-white/60 hover:text-white text-xs transition-colors cursor-pointer" title="Arrêter le tour">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Geo marker clear button */}
          {geoMarker && !showGeoSearch && (
            <div className="absolute top-4 right-4 z-[5]">
              <button
                onClick={() => setGeoMarker(null)}
                className="h-8 px-3 rounded-xl bg-gray-900/80 backdrop-blur-xl text-white/70 hover:text-white text-xs font-medium border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Effacer le marqueur
              </button>
            </div>
          )}

          {/* "Rechercher dans cette zone" pill — proto megga-search-map.jsx (bottom center) */}
          {!isImmersive && !isDrawing && onViewportChange && (
            <button
              onClick={() => {
                const map = mapRef.current?.getMap()
                if (!map) return
                const b = map.getBounds()
                if (!b) return
                onViewportChange({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() })
              }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[6] flex items-center gap-2 h-10 px-5 rounded-full text-white text-sm font-semibold cursor-pointer transition-all"
              style={{
                background: '#0E1410',
                fontFamily: '"Manrope", system-ui, sans-serif',
                boxShadow: '0 10px 26px rgba(14,20,16,0.25)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#000' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#0E1410' }}
              title="Re-rechercher dans la zone visible"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="4" />
                <path d="M9.5 9.5l3 3" />
              </svg>
              Rechercher dans cette zone
            </button>
          )}

          {/* "X biens visibles" count badge — proto megga-search-map.jsx (bottom right) */}
          {!isImmersive && (
            <div
              className="absolute bottom-10 right-16 z-[5] px-3 py-1.5 rounded-full bg-white text-[#0E1410] text-xs font-bold pointer-events-none"
              style={{
                fontFamily: '"Manrope", system-ui, sans-serif',
                boxShadow: '0 4px 12px rgba(14,20,16,0.12)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {listings.length.toLocaleString('fr-CH')} {listings.length > 1 ? 'biens visibles' : 'bien visible'}
            </div>
          )}
        </>
      )}
    </div>
  )
})

export default memo(MapView)
