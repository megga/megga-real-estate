import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle, memo } from 'react'
import { Link } from 'react-router-dom'
import MapGL, {
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
  type ViewStateChangeEvent,
  type MapRef,
  type MapMouseEvent,
} from 'react-map-gl/mapbox'
import Supercluster from 'supercluster'
import { LocateFixed, PenTool, X, MapPin, Layers, Mountain, Satellite, Moon, Sun, Thermometer, Search, Ruler, RotateCcw, Pause, Play, Maximize, Minimize, School, TrainFront, ShoppingBag, TreePine, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import NeighborhoodOverlay from './NeighborhoodOverlay'
import { cn, formatCHF, formatSurface, formatPricePin } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'
import type { MapPoint } from '@/hooks/useMarketListings'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// Debounced geocoding fetch
const geoDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {}
function debouncedGeoFetch(
  key: string,
  query: string,
  onResults: (results: Array<{ place_name: string; center: [number, number] }>) => void,
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
      onResults(data.features?.map((f: Record<string, unknown>) => ({
        place_name: f.place_name as string,
        center: f.center as [number, number],
      })) || [])
    } catch { onResults([]) }
  }, delay)
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

type ListingPoint = Supercluster.PointFeature<{ listing: ListingCardData }>

const MAP_GL_STYLE = { width: '100%', height: '100%' } as const

const MAP_STYLES = [
  { id: 'standard', label: '3D', icon: Mountain, url: 'mapbox://styles/mapbox/standard' },
  { id: 'satellite', label: 'Satellite', icon: Satellite, url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'light', label: 'Clair', icon: Sun, url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'dark', label: 'Sombre', icon: Moon, url: 'mapbox://styles/mapbox/dark-v11' },
] as const

type MapStyleId = typeof MAP_STYLES[number]['id']

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ listings, mapPoints, hoveredId, onHover, onZoneFilter, onImmersiveChange, onQuickFilter, onSelectListing, onViewportChange, hideTopControls, className }, ref) {
  const mapRef = useRef<MapRef>(null)
  const [mapStyleId, setMapStyleId] = useState<MapStyleId>('standard')
  const [showStylePicker, setShowStylePicker] = useState(false)
  const currentStyle = MAP_STYLES.find(s => s.id === mapStyleId) || MAP_STYLES[0]
  const [viewState, setViewState] = useState({
    longitude: 6.1432,
    latitude: 46.2044,
    zoom: 11.5,
    pitch: mapStyleId === 'standard' ? 45 : 0,
    bearing: 0,
  })
  const [selectedListing, setSelectedListing] = useState<ListingCardData | null>(null)
  const [hoveredPin, setHoveredPin] = useState<ListingCardData | null>(null)
  const [viewportCount, setViewportCount] = useState(0)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── Immersive mode ───
  const [isImmersive, setIsImmersive] = useState(false)

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
    // Cinematic entry — gentle pitch increase, keep current zoom to avoid tile loading gaps
    const map = mapRef.current?.getMap()
    if (map) {
      map.easeTo({ pitch: 45, duration: 800 })
    }
  }, [onImmersiveChange])

  const exitImmersive = useCallback(() => {
    setIsImmersive(false)
    onImmersiveChange?.(false)
    if (document.fullscreenElement) document.exitFullscreen?.()
  }, [onImmersiveChange])


  // ─── POI layers ───
  const [showPOIs, setShowPOIs] = useState<Record<string, boolean>>({ schools: false, transport: false, shops: false, parks: false })

  const togglePOI = useCallback((key: string) => {
    setShowPOIs(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Apply POI layer visibility on the Standard style
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || mapStyleId !== 'standard') return
    // Control visibility of the Standard style's built-in POI layers
    try {
      const anyPoiOn = showPOIs.schools || showPOIs.shops
      map.setLayoutProperty('poi-label', 'visibility', anyPoiOn ? 'visible' : 'none')
    } catch { /* layer not yet ready */ }
    // Transit labels
    try {
      map.setLayoutProperty('transit-label', 'visibility', showPOIs.transport ? 'visible' : 'none')
    } catch { /* */ }
    // Natural labels
    try {
      map.setLayoutProperty('natural-label', 'visibility', showPOIs.parks ? 'visible' : 'none')
    } catch { /* */ }
  }, [showPOIs, mapStyleId])

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

  const flyToListing = useCallback((index: number) => {
    const listing = tourListings[index]
    if (!listing?.lat || !listing?.lng) return
    setTourIndex(index)
    setSelectedListing(listing)
    mapRef.current?.flyTo({
      center: [listing.lng, listing.lat],
      zoom: 17,
      pitch: 65,
      bearing: (index * 45) % 360,
      duration: 2500,
      essential: true,
    })
  }, [tourListings])

  // Auto-play: advance to next listing after 5s
  useEffect(() => {
    if (!isTourActive || !tourAutoPlay || tourIndex < 0) return
    tourTimerRef.current = setTimeout(() => {
      const next = (tourIndex + 1) % tourListings.length
      flyToListing(next)
    }, 5000)
    return () => { if (tourTimerRef.current) clearTimeout(tourTimerRef.current) }
  }, [isTourActive, tourAutoPlay, tourIndex, tourListings.length, flyToListing])

  const startTour = useCallback(() => {
    if (tourListings.length === 0) return
    setIsTourActive(true)
    setTourAutoPlay(true)
    flyToListing(0)
  }, [tourListings, flyToListing])

  const nextTourStop = useCallback(() => {
    const next = (tourIndex + 1) % tourListings.length
    flyToListing(next)
  }, [tourIndex, tourListings, flyToListing])

  const prevTourStop = useCallback(() => {
    const prev = tourIndex <= 0 ? tourListings.length - 1 : tourIndex - 1
    flyToListing(prev)
  }, [tourIndex, tourListings, flyToListing])

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
  const [lightPreset, setLightPreset] = useState<'day' | 'dusk' | 'dawn' | 'night'>('day')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showGeoSearch, setShowGeoSearch] = useState(false)
  const [geoSearchQuery, setGeoSearchQuery] = useState('')
  const [geoResults, setGeoResults] = useState<Array<{ place_name: string; center: [number, number] }>>([])

  // Orbit 3D
  const [isOrbiting, setIsOrbiting] = useState(false)
  const orbitAnimRef = useRef<number | null>(null)
  const orbitBearingRef = useRef(0)

  const startOrbit = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    setIsOrbiting(true)
    // Zoom in with cinematic pitch
    const center = map.getCenter()
    map.flyTo({ center, zoom: Math.max(map.getZoom(), 15), pitch: 65, duration: 1500 })
    setTimeout(() => {
      function animate() {
        orbitBearingRef.current = (orbitBearingRef.current + 0.3) % 360
        map?.rotateTo(orbitBearingRef.current, { duration: 0 })
        orbitAnimRef.current = requestAnimationFrame(animate)
      }
      orbitAnimRef.current = requestAnimationFrame(animate)
    }, 1700)
  }, [])

  const stopOrbit = useCallback(() => {
    setIsOrbiting(false)
    if (orbitAnimRef.current) {
      cancelAnimationFrame(orbitAnimRef.current)
      orbitAnimRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => { if (orbitAnimRef.current) cancelAnimationFrame(orbitAnimRef.current) }
  }, [])

  // Apply light preset to Standard style
  useEffect(() => {
    if (mapStyleId !== 'standard') return
    const map = mapRef.current?.getMap()
    if (!map) return
    try {
      map.setConfigProperty('basemap', 'lightPreset', lightPreset)
    } catch { /* style not loaded yet */ }
  }, [lightPreset, mapStyleId])

  // Draw zone state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([])
  const [closedPolygon, setClosedPolygon] = useState<[number, number][] | null>(null)
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null)

  // Throttled cursor position update during draw mode (~30fps is plenty for cursor trail)
  const cursorThrottleRef = useRef<number>(0)
  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    if (!isDrawing || drawPoints.length === 0) return
    const now = performance.now()
    if (now - cursorThrottleRef.current < 32) return
    cursorThrottleRef.current = now
    setCursorPos([e.lngLat.lng, e.lngLat.lat])
  }, [isDrawing, drawPoints.length])

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    fitToListings,
    startDrawing,
    enterImmersive,
    exitImmersive,
    toggleTools: () => setShowTools(v => !v),
    setMapStyle: (id: string) => {
      setMapStyleId(id as MapStyleId)
      setViewState(v => ({ ...v, pitch: id === 'standard' ? 45 : 0, bearing: id === 'standard' ? v.bearing : 0 }))
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

  // Stable terrain config to avoid Mapbox re-applying terrain on every render
  const terrainConfig = useMemo(
    () => mapStyleId === 'standard' ? { source: 'mapbox-dem', exaggeration: 1.5 } : undefined,
    [mapStyleId]
  )

  // Build GeoJSON points — use mapPoints (lightweight, all 38K) if available, otherwise listings
  const points: ListingPoint[] = useMemo(() => {
    if (mapPoints && mapPoints.length > 0) {
      return mapPoints.map((mp) => ({
        type: 'Feature' as const,
        properties: {
          listing: {
            id: mp.id,
            title: '',
            price: mp.price,
            address: '',
            city: '',
            rooms: mp.rooms,
            bedrooms: 0,
            surface_m2: 0,
            photos: [],
            type: mp.type,
            context: mp.context,
            lat: mp.lat,
            lng: mp.lng,
          } as ListingCardData,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [mp.lng, mp.lat],
        },
      }))
    }
    return listings
      .filter((l) => l.lat && l.lng)
      .map((l) => ({
        type: 'Feature' as const,
        properties: { listing: l },
        geometry: {
          type: 'Point' as const,
          coordinates: [l.lng!, l.lat!],
        },
      }))
  }, [mapPoints, listings])

  // Build supercluster index — light clustering at low zoom, individual prices at high zoom
  const supercluster = useMemo(() => {
    const sc = new Supercluster<{ listing: ListingCardData }, { minPrice: number; context: 'buy' | 'rent' }>({
      radius: 35,
      maxZoom: 14,
      map: (props) => ({ minPrice: props.listing.price, context: (props.listing.context as 'buy' | 'rent') || 'buy' }),
      reduce: (acc, props) => {
        acc.minPrice = Math.min(acc.minPrice, props.minPrice)
        // Context: all pins in a view share the same context, keep first encountered
        if (acc.context !== props.context) acc.context = props.context
      },
    })
    sc.load(points)
    return sc
  }, [points])

  // Cluster recalc — throttled via onMoveEnd to avoid 60x/sec recalc during pan
  const [clusterBounds, setClusterBounds] = useState<{ zoom: number; bounds: [number, number, number, number] }>({
    zoom: 11, bounds: [5.5, 45.5, 7.0, 47.0],
  })

  const clusters = useMemo(() => {
    return supercluster.getClusters(clusterBounds.bounds, Math.floor(clusterBounds.zoom))
  }, [supercluster, clusterBounds])

  const updateClusterBounds = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const b = map.getBounds()
    if (!b) return
    const bounds: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    setClusterBounds({ zoom: map.getZoom(), bounds })
    // Count points in viewport
    const allInView = supercluster.getClusters(bounds, 20) // zoom 20 = no clustering = individual count
    setViewportCount(allInView.length)
    // Notify parent of viewport bounds
    onViewportChange?.({ west: bounds[0], south: bounds[1], east: bounds[2], north: bounds[3] })
  }, [supercluster, onViewportChange])

  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState)
    if (isOrbiting) stopOrbit()
  }, [isOrbiting, stopOrbit])

  function handleClusterClick(clusterId: number, lng: number, lat: number) {
    const zoom = supercluster.getClusterExpansionZoom(clusterId)
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 500 })
  }

  function handlePinClick(listing: ListingCardData) {
    setSelectedListing(listing)
    // Open preview panel if callback provided — prefix with market- for ListingPreviewPanel
    onSelectListing?.(`market-${listing.id}`)
    // FlyTo animation to center on selected listing
    if (listing.lat && listing.lng) {
      mapRef.current?.flyTo({
        center: [listing.lng, listing.lat],
        zoom: Math.max(viewState.zoom, 14),
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
    if (!isDrawing) return

    const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat]

    // Check if clicking near first point to close polygon
    if (drawPoints.length >= 3) {
      const first = drawPoints[0]
      const map = mapRef.current?.getMap()
      if (map) {
        const firstScreen = map.project(first)
        const clickScreen = map.project([newPoint[0], newPoint[1]])
        const dist = Math.sqrt(
          (firstScreen.x - clickScreen.x) ** 2 + (firstScreen.y - clickScreen.y) ** 2
        )
        if (dist < 20) {
          // Close the polygon
          closePolygon([...drawPoints])
          return
        }
      }
    }

    setDrawPoints((prev) => [...prev, newPoint])
  }

  function handleMapDoubleClick(e: MapMouseEvent) {
    if (!isDrawing || drawPoints.length < 3) return
    e.preventDefault()
    closePolygon(drawPoints)
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

  // Memoize heatmap GeoJSON to avoid 38K feature rebuild every render
  const heatmapData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: points.map(p => ({
      type: 'Feature' as const,
      geometry: p.geometry,
      properties: { price: p.properties.listing.price },
    })),
  }), [points])

  // Count listings in zone
  const zoneCount = useMemo(() => {
    if (!closedPolygon) return 0
    return listings.filter((l) => l.lat && l.lng && pointInPolygon([l.lng!, l.lat!], closedPolygon)).length
  }, [closedPolygon, listings])

  // Graceful fallback when VITE_MAPBOX_TOKEN is missing — without this guard,
  // mapbox-gl crashes deep inside its initialization (`Cannot read properties
  // of undefined (reading '0')` on pointRayInte…), which previously broke
  // /louer and /acheter in any env without the token (audit bug B3). We render
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
        {...viewState}
        onMove={handleMove}
        onMoveEnd={updateClusterBounds}
        onClick={handleMapClick}
        onDblClick={handleMapDoubleClick}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={currentStyle.url}
        style={MAP_GL_STYLE}
        attributionControl={false}
        doubleClickZoom={!isDrawing}
        dragPan={!isDrawing}
        reuseMaps
        dragRotate
        touchPitch
        touchZoomRotate
        terrain={terrainConfig}
        onMouseMove={handleMouseMove}
        onLoad={(e) => {
          const map = e.target
          // Initialize cluster bounds
          updateClusterBounds()
          // Force light preset on load (Standard auto-detects local time which makes the map dark at night)
          if (mapStyleId === 'standard') {
            const applyLight = () => {
              try { map.setConfigProperty('basemap', 'lightPreset', lightPreset) } catch { /* not ready */ }
            }
            applyLight()
            // Also retry after style is fully loaded (config properties may not be ready on first load)
            map.once('style.load', applyLight)
          }
          // Add terrain DEM source for 3D terrain (Standard style)
          if (mapStyleId === 'standard' && !map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', {
              type: 'raster-dem',
              url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
              tileSize: 512,
              maxzoom: 14,
            })
          }
        }}
      >
        <NavigationControl position="bottom-right" showCompass visualizePitch />

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
            {/* Polygon outline — white glow for visibility on dark backgrounds */}
            <Layer
              id="draw-line-glow"
              type="line"
              filter={['==', '$type', 'LineString']}
              paint={{
                'line-color': '#FFFFFF',
                'line-width': 5,
                'line-opacity': 0.5,
              }}
            />
            {/* Polygon outline — accent line on top */}
            <Layer
              id="draw-line"
              type="line"
              filter={['==', '$type', 'LineString']}
              paint={{
                'line-color': '#2563EB',
                'line-width': 2.5,
                'line-dasharray': closedPolygon ? [1] : [2, 2],
              }}
            />
            {/* Vertex points */}
            <Layer
              id="draw-points"
              type="circle"
              filter={['==', '$type', 'Point']}
              paint={{
                'circle-radius': 6,
                'circle-color': '#FFFFFF',
                'circle-stroke-color': '#2563EB',
                'circle-stroke-width': 2.5,
              }}
            />
          </Source>
        )}

        {/* Render price pins — Zillow-style: clusters show "from X" price, individuals show exact price */}
        {clusters.slice(0, 500).map((cluster) => {
          const [lng, lat] = cluster.geometry.coordinates
          const props = cluster.properties as Record<string, unknown>
          const isCluster = props.cluster

          if (isCluster) {
            const pointCount = props.point_count as number
            const minPrice = props.minPrice as number
            const clusterContext = (props.context as 'buy' | 'rent') || 'buy'
            return (
              <Marker key={`cluster-${cluster.id}`} longitude={lng} latitude={lat} anchor="center">
                <button
                  onClick={(e) => {
                    if (isDrawing) return
                    e.stopPropagation()
                    handleClusterClick(cluster.id as number, lng, lat)
                  }}
                  className="rounded-full text-xs font-bold px-2.5 py-1 shadow-lg whitespace-nowrap transition-all duration-200 cursor-pointer border-2 bg-gray-900 text-white border-white/80 hover:scale-110 hover:bg-gray-800 flex items-center gap-1"
                >
                  {formatPricePin(minPrice, clusterContext)}
                  <span className="text-xs font-normal text-white/60">+{pointCount}</span>
                </button>
              </Marker>
            )
          }

          // Individual pin — dark pill with price (Zillow-style)
          const listing = (cluster.properties as { listing: ListingCardData }).listing
          const isHovered = hoveredId === listing.id
          const isSelected = selectedListing?.id === listing.id
          const activePolygon = closedPolygon
          const isInZone = activePolygon
            ? listing.lat && listing.lng && pointInPolygon([listing.lng, listing.lat], activePolygon)
            : true

          return (
            <Marker
              key={`pin-${listing.id}`}
              longitude={lng}
              latitude={lat}
              anchor="center"
              style={{ zIndex: isHovered || isSelected ? 50 : 1 }}
            >
              <div className="relative">
                {/* Pulse ring when hovered from list */}
                {isHovered && !isSelected && (
                  <span className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-40 pointer-events-none" />
                )}
                <button
                  onClick={(e) => {
                    if (isDrawing) return
                    e.stopPropagation()
                    handlePinClick(listing)
                  }}
                  onMouseEnter={() => { onHover?.(listing.id); setHoveredPin(listing) }}
                  onMouseLeave={() => { onHover?.(undefined); setHoveredPin(null) }}
                  className={cn(
                    'relative rounded-full text-xs font-bold px-2.5 py-1 shadow-lg whitespace-nowrap transition-all duration-200 cursor-pointer border-2',
                    isHovered || isSelected
                      ? 'bg-accent text-white border-white shadow-xl scale-110'
                      : isInZone
                        ? 'bg-gray-900 text-white border-white/80 hover:scale-110 hover:bg-gray-800'
                        : 'bg-gray-400 text-white/70 border-white/50 opacity-60'
                  )}
                >
                  {formatPricePin(listing.price, listing.context)}
                </button>
              </div>
            </Marker>
          )
        })}

        {/* Hover tooltip — mini preview on pin hover (without clicking) */}
        {hoveredPin && hoveredPin.lat && hoveredPin.lng && !selectedListing && !isDrawing && (
          <Popup
            longitude={hoveredPin.lng}
            latitude={hoveredPin.lat}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={16}
            maxWidth="180px"
            className="[&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:rounded-lg [&_.mapboxgl-popup-content]:overflow-hidden [&_.mapboxgl-popup-content]:shadow-lg pointer-events-none"
          >
            <div className="w-[170px]">
              {hoveredPin.photos?.[0] ? (
                <img src={hoveredPin.photos[0]} alt="" className="w-full h-20 object-cover" />
              ) : (
                <div className="w-full h-20 bg-theme-hover flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-theme-muted" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-bold text-theme-primary">{formatCHF(hoveredPin.price)}</p>
                <p className="text-xs text-theme-tertiary truncate mt-0.5">{hoveredPin.address}, {hoveredPin.city}</p>
                {hoveredPin.rooms > 0 && (
                  <p className="text-xs text-theme-muted mt-0.5">
                    {hoveredPin.rooms}p. · {hoveredPin.surface_m2 > 0 ? formatSurface(hoveredPin.surface_m2) : ''}
                  </p>
                )}
              </div>
            </div>
          </Popup>
        )}

        {/* Popup — Rich card in immersive mode, compact otherwise */}
        {selectedListing && selectedListing.lat && selectedListing.lng && !isDrawing && (
          <Popup
            longitude={selectedListing.lng}
            latitude={selectedListing.lat}
            anchor="bottom"
            onClose={() => { setSelectedListing(null); if (isTourActive) stopTour() }}
            closeOnClick={false}
            offset={20}
            maxWidth={isImmersive ? '320px' : '200px'}
            className="[&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:rounded-xl [&_.mapboxgl-popup-content]:overflow-hidden [&_.mapboxgl-popup-content]:shadow-xl [&_.mapboxgl-popup-close-button]:text-theme-muted [&_.mapboxgl-popup-close-button]:text-lg [&_.mapboxgl-popup-close-button]:right-2 [&_.mapboxgl-popup-close-button]:top-1 [&_.mapboxgl-popup-close-button]:hover:text-theme-secondary [&_.mapboxgl-popup-close-button]:z-10"
          >
            <Link to={`/listing/${selectedListing.id}`} className={cn('block', isImmersive ? 'w-[300px]' : 'w-48')}>
              {selectedListing.photos[0] ? (
                <div className="relative">
                  <img
                    src={selectedListing.photos[0]}
                    alt={selectedListing.title}
                    className={cn('w-full object-cover', isImmersive ? 'h-44' : 'h-28')}
                  />
                  {isImmersive && selectedListing.photos.length > 1 && (
                    <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {selectedListing.photos.length} photos
                    </span>
                  )}
                </div>
              ) : (
                <div className={cn('w-full flex items-center justify-center bg-theme-hover', isImmersive ? 'h-44' : 'h-28')}>
                  <Building2 className="h-8 w-8 text-theme-muted" />
                </div>
              )}
              <div className={cn(isImmersive ? 'p-4' : 'p-2.5')}>
                <p className={cn('font-bold text-theme-primary', isImmersive ? 'text-lg' : 'text-sm')}>
                  {formatCHF(selectedListing.price)}
                  {selectedListing.context === 'rent' ? '/mois' : ''}
                </p>
                <p className={cn('text-theme-tertiary mt-0.5 truncate', isImmersive ? 'text-sm' : 'text-xs')}>
                  {selectedListing.address}{selectedListing.city ? `, ${selectedListing.city}` : ''}
                </p>
                {selectedListing.rooms > 0 && (
                  <div className={cn('flex items-center gap-2 mt-1', isImmersive ? 'text-sm text-theme-secondary' : 'text-xs text-theme-muted')}>
                    <span>{selectedListing.rooms} pièces</span>
                    {selectedListing.bedrooms > 0 && <><span>·</span><span>{selectedListing.bedrooms} ch.</span></>}
                    {selectedListing.surface_m2 > 0 && <><span>·</span><span>{formatSurface(selectedListing.surface_m2)}</span></>}
                  </div>
                )}
                {isImmersive && selectedListing.surface_m2 > 0 && (
                  <p className="text-xs text-theme-muted mt-1">
                    {formatCHF(Math.round(selectedListing.price / selectedListing.surface_m2))}/m²
                  </p>
                )}
                <p className={cn('text-accent font-medium', isImmersive ? 'text-sm mt-3' : 'text-xs mt-1.5')}>
                  Voir le bien →
                </p>
              </div>
            </Link>
          </Popup>
        )}

        {/* Price heatmap layer (fullscreen only) */}
        {showHeatmap && (isFullscreen || showTools) && points.length > 0 && (
          <Source
            id="price-heatmap"
            type="geojson"
            data={heatmapData}
          >
            <Layer
              id="heatmap-layer"
              type="heatmap"
              paint={{
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'price'], 200000, 0, 5000000, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 1, 15, 3],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(0,0,255,0)',
                  0.2, 'rgb(0,150,255)',
                  0.4, 'rgb(0,200,150)',
                  0.6, 'rgb(255,220,0)',
                  0.8, 'rgb(255,140,0)',
                  1, 'rgb(255,40,40)',
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 15, 15, 25],
                'heatmap-opacity': 0.6,
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

      {/* Top-left buttons — hidden when controls are in parent filter bar (non-immersive) */}
      {(!hideTopControls || isImmersive) && (
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
          <button
            onClick={fitToListings}
            className={cn(
              'text-xs font-medium px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5',
              isImmersive
                ? 'bg-gray-900/80 backdrop-blur-md text-white/80 hover:text-white hover:bg-gray-900/90 border border-white/10'
                : 'bg-theme-card text-theme-secondary border border-theme-border hover:bg-theme-hover'
            )}
          >
            <LocateFixed className="h-3.5 w-3.5" />
            Recentrer
          </button>

          {/* Draw zone */}
          {!isDrawing && !closedPolygon && (
            <button
              onClick={startDrawing}
              className={cn(
                'text-xs font-medium px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5',
                isImmersive
                  ? 'bg-gray-900/80 backdrop-blur-md text-white/80 hover:text-white hover:bg-gray-900/90 border border-white/10'
                  : 'bg-theme-card text-theme-secondary border border-theme-border hover:bg-theme-hover'
              )}
            >
              <PenTool className="h-3.5 w-3.5" />
              Dessiner une zone
            </button>
          )}

          {closedPolygon && (
            <button
              onClick={clearZone}
              className="text-xs font-medium px-3 py-1.5 rounded-xl border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              {zoneCount} bien{zoneCount !== 1 ? 's' : ''} dans la zone
            </button>
          )}
        </div>
      )}

      {/* Drawing instructions */}
      {isDrawing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <PenTool className="h-3.5 w-3.5" />
          {drawPoints.length === 0
            ? 'Cliquez pour commencer à dessiner'
            : drawPoints.length < 3
              ? 'Continuez à cliquer pour tracer la zone'
              : 'Cliquez sur le premier point ou double-cliquez pour fermer'}
          <button
            onClick={clearZone}
            className="ml-2 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Style switcher + Tools toggle + Immersive — bottom-left */}
      <div className={cn(
        'absolute z-[5]',
        isImmersive ? 'bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2' : 'bottom-4 left-3 flex gap-2'
      )}>
        {/* Immersive floating toolbar */}
        {isImmersive ? (
          <>
          {/* ── Filter bar (top) ── */}
          <div className="flex items-center gap-1 bg-gray-900/70 backdrop-blur-xl rounded-xl px-2 py-1 border border-white/10 max-w-[95vw] overflow-x-auto scrollbar-hide">
            <span className="text-xs text-white/40 px-1.5">Filtres</span>
            <div className="w-px h-4 bg-white/15" />
            {[
              { label: 'Appart.', active: quickFilters.type === 'apartment', onClick: () => updateQuickFilter({ type: quickFilters.type === 'apartment' ? '' : 'apartment' }) },
              { label: 'Maison', active: quickFilters.type === 'house', onClick: () => updateQuickFilter({ type: quickFilters.type === 'house' ? '' : 'house' }) },
            ].map(f => (
              <button
                key={f.label}
                onClick={f.onClick}
                className={cn(
                  'h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                  f.active ? 'text-white bg-white/20' : 'text-white/50 hover:text-white hover:bg-white/10'
                )}
              >
                {f.label}
              </button>
            ))}
            <div className="w-px h-4 bg-white/15" />
            {[
              { label: '< 500K', active: quickFilters.maxPrice === 500000, onClick: () => updateQuickFilter({ maxPrice: quickFilters.maxPrice === 500000 ? undefined : 500000 }) },
              { label: '< 1M', active: quickFilters.maxPrice === 1000000, onClick: () => updateQuickFilter({ maxPrice: quickFilters.maxPrice === 1000000 ? undefined : 1000000 }) },
              { label: '< 2M', active: quickFilters.maxPrice === 2000000, onClick: () => updateQuickFilter({ maxPrice: quickFilters.maxPrice === 2000000 ? undefined : 2000000 }) },
            ].map(f => (
              <button
                key={f.label}
                onClick={f.onClick}
                className={cn(
                  'h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                  f.active ? 'text-white bg-white/20' : 'text-white/50 hover:text-white hover:bg-white/10'
                )}
              >
                {f.label}
              </button>
            ))}
            <div className="w-px h-4 bg-white/15" />
            {[
              { label: '3+ p.', active: quickFilters.minRooms === 3, onClick: () => updateQuickFilter({ minRooms: quickFilters.minRooms === 3 ? undefined : 3 }) },
              { label: '4+ p.', active: quickFilters.minRooms === 4, onClick: () => updateQuickFilter({ minRooms: quickFilters.minRooms === 4 ? undefined : 4 }) },
              { label: '5+ p.', active: quickFilters.minRooms === 5, onClick: () => updateQuickFilter({ minRooms: quickFilters.minRooms === 5 ? undefined : 5 }) },
            ].map(f => (
              <button
                key={f.label}
                onClick={f.onClick}
                className={cn(
                  'h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                  f.active ? 'text-white bg-white/20' : 'text-white/50 hover:text-white hover:bg-white/10'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* ── Tools bar (bottom) ── */}
          <div className="flex items-center bg-gray-900/80 backdrop-blur-xl rounded-2xl px-1.5 py-1.5 shadow-2xl border border-white/10 max-w-[95vw] overflow-x-auto scrollbar-hide">
            {/* Exit */}
            <button
              onClick={exitImmersive}
              className="h-8 px-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              aria-label="Quitter le mode immersif"
              title="Quitter (Esc)"
            >
              <Minimize className="h-3.5 w-3.5" />
            </button>

            <div className="w-px h-5 bg-white/15 mx-1 shrink-0" />

            {/* ─ Group: Vue ─ */}
            <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg px-1 py-0.5 shrink-0">
              <span className="text-xs text-white/30 px-1 uppercase tracking-wider shrink-0">Vue</span>
              {/* Style picker */}
              <div className="relative">
                <button
                  onClick={() => setShowStylePicker(v => !v)}
                  className="h-7 px-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Style de carte"
                >
                  <Layers className="h-3 w-3" />
                  {currentStyle.label}
                </button>
                {showStylePicker && (
                  <div className="absolute bottom-full left-0 mb-2 z-10 bg-gray-900/90 backdrop-blur-xl rounded-xl shadow-lg border border-white/10 overflow-hidden min-w-[140px]">
                    {MAP_STYLES.map(s => {
                      const Icon = s.icon
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setMapStyleId(s.id)
                            setShowStylePicker(false)
                            setViewState(v => ({ ...v, pitch: s.id === 'standard' ? 45 : 0, bearing: s.id === 'standard' ? v.bearing : 0 }))
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
                            mapStyleId === s.id ? 'text-accent' : 'text-white/70 hover:text-white hover:bg-white/10'
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
              {/* Light presets (Standard only) */}
              {mapStyleId === 'standard' && (
                <>
                  {(['day', 'dawn', 'dusk', 'night'] as const).map(preset => (
                    <button
                      key={preset}
                      onClick={() => setLightPreset(preset)}
                      className={cn(
                        'h-7 w-7 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center shrink-0',
                        lightPreset === preset ? 'text-white bg-white/15' : 'text-white/40 hover:text-white hover:bg-white/10'
                      )}
                      title={{ day: 'Jour', dawn: 'Aube', dusk: 'Crépuscule', night: 'Nuit' }[preset]}
                    >
                      {({ day: <Sun className="h-3 w-3" />, dawn: <Sun className="h-3 w-3" />, dusk: <Moon className="h-3 w-3" />, night: <Moon className="h-3 w-3" /> } as Record<string, React.ReactNode>)[preset]}
                    </button>
                  ))}
                </>
              )}
              {/* Compass reset */}
              <button
                onClick={() => mapRef.current?.flyTo({ bearing: 0, pitch: 0, duration: 800 })}
                className="h-7 w-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                title="Vue Nord (reset)"
              >
                <LocateFixed className="h-3 w-3" />
              </button>
            </div>

            <div className="w-px h-5 bg-white/15 mx-1 shrink-0" />

            {/* ─ Group: Données ─ */}
            <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg px-1 py-0.5 shrink-0">
              <span className="text-xs text-white/30 px-1 uppercase tracking-wider shrink-0">Donnees</span>
              <button
                onClick={() => setShowHeatmap(v => !v)}
                className={cn(
                  'h-7 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                  showHeatmap ? 'text-white bg-white/15' : 'text-white/40 hover:text-white hover:bg-white/10'
                )}
                title="Heatmap prix/m²"
              >
                <Thermometer className="h-3 w-3" />
              </button>
              <button
                onClick={isOrbiting ? stopOrbit : startOrbit}
                className={cn(
                  'h-7 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                  isOrbiting ? 'text-white bg-accent/60' : 'text-white/40 hover:text-white hover:bg-white/10'
                )}
                title={isOrbiting ? 'Arreter' : 'Orbit 3D'}
              >
                {isOrbiting ? <Pause className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
              </button>
              {/* POI toggles */}
              {[
                { key: 'schools', icon: School, label: 'Ecoles' },
                { key: 'transport', icon: TrainFront, label: 'Transports' },
                { key: 'shops', icon: ShoppingBag, label: 'Commerces' },
                { key: 'parks', icon: TreePine, label: 'Parcs' },
              ].map(poi => {
                const Icon = poi.icon
                return (
                  <button
                    key={poi.key}
                    onClick={() => togglePOI(poi.key)}
                    className={cn(
                      'h-7 w-7 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center shrink-0',
                      showPOIs[poi.key] ? 'text-white bg-white/15' : 'text-white/40 hover:text-white hover:bg-white/10'
                    )}
                    title={poi.label}
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                )
              })}
            </div>

            <div className="w-px h-5 bg-white/15 mx-1 shrink-0" />

            {/* ─ Group: Explorer ─ */}
            <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg px-1 py-0.5 shrink-0">
              <span className="text-xs text-white/30 px-1 uppercase tracking-wider shrink-0">Explorer</span>
              <button
                onClick={isTourActive ? stopTour : startTour}
                className={cn(
                  'h-7 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                  isTourActive ? 'text-white bg-accent/60' : 'text-white/40 hover:text-white hover:bg-white/10'
                )}
                title="Survol des biens"
              >
                <Play className="h-3 w-3" />
              </button>
              <button
                onClick={() => setShowGeoSearch(v => !v)}
                className={cn(
                  'h-7 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                  showGeoSearch ? 'text-white bg-white/15' : 'text-white/40 hover:text-white hover:bg-white/10'
                )}
                title="Rechercher un lieu"
              >
                <Search className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (neighborhoodPoint) { setNeighborhoodPoint(null) }
                  else { setNeighborhoodPickMode(true) }
                }}
                className={cn(
                  'h-7 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                  neighborhoodPoint || neighborhoodPickMode ? 'text-white bg-white/15' : 'text-white/40 hover:text-white hover:bg-white/10'
                )}
                title="Score quartier"
              >
                <MapPin className="h-3 w-3" />
              </button>
            </div>
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
                              setViewState(v => ({
                                ...v,
                                pitch: s.id === 'standard' ? 45 : 0,
                                bearing: s.id === 'standard' ? v.bearing : 0,
                              }))
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
          <span className="h-9 px-3 rounded-xl bg-theme-card border border-theme-border text-theme-tertiary text-xs font-medium flex items-center tabular-nums">
            {viewportCount.toLocaleString('fr-CH')} biens
          </span>
        )}
      </div>

      {/* ── Immersive controls (tools panel — NOT shown in immersive mode, those are in the bottom toolbar) ── */}
      {(isFullscreen || showTools) && !isImmersive && (
        <>
          {/* Top-right: Light presets + Heatmap + Geocoding */}
          <div className="absolute top-3 right-3 z-[5] flex flex-col gap-2">
            {/* Light presets (Standard 3D only) */}
            {mapStyleId === 'standard' && (
              <div className="bg-theme-card rounded-xl shadow-lg border border-theme-border overflow-hidden">
                <div className="px-2.5 py-1.5 text-xs font-semibold text-theme-muted uppercase tracking-wider">Lumière</div>
                {(['day', 'dawn', 'dusk', 'night'] as const).map(preset => (
                  <button
                    key={preset}
                    onClick={() => setLightPreset(preset)}
                    className={cn(
                      'w-full px-3 py-1.5 text-xs font-medium text-left transition-colors cursor-pointer',
                      lightPreset === preset ? 'bg-theme-active text-accent' : 'text-theme-secondary hover:bg-theme-hover'
                    )}
                  >
                    {{ day: 'Jour', dawn: 'Aube', dusk: 'Crépuscule', night: 'Nuit' }[preset]}
                  </button>
                ))}
              </div>
            )}

            {/* Heatmap toggle */}
            <button
              onClick={() => setShowHeatmap(v => !v)}
              className={cn(
                'h-9 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                showHeatmap
                  ? 'bg-theme-active text-theme-primary border-theme-active'
                  : 'bg-theme-card text-theme-secondary border-theme-border hover:bg-theme-hover'
              )}
            >
              <Thermometer className="h-3.5 w-3.5" />
              Prix/m²
            </button>

            {/* Orbit 3D */}
            <button
              onClick={isOrbiting ? stopOrbit : startOrbit}
              className={cn(
                'h-9 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                isOrbiting
                  ? 'bg-theme-active text-theme-primary border-theme-active'
                  : 'bg-theme-card text-theme-secondary border-theme-border hover:bg-theme-hover'
              )}
            >
              {isOrbiting ? <Pause className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {isOrbiting ? 'Arrêter' : 'Orbit 3D'}
            </button>

            {/* Geocoding search */}
            <div className="relative">
              <button
                onClick={() => setShowGeoSearch(v => !v)}
                className="h-9 px-3 rounded-xl bg-theme-card border border-theme-border text-theme-secondary text-xs font-medium hover:bg-theme-hover transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Search className="h-3.5 w-3.5" />
                Rechercher un lieu
              </button>

              {showGeoSearch && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-theme-card rounded-xl shadow-lg border border-theme-border overflow-hidden">
                  <div className="p-2">
                    <input
                      type="text"
                      value={geoSearchQuery}
                      onChange={(e) => {
                        const q = e.target.value
                        setGeoSearchQuery(q)
                        debouncedGeoFetch('tools-geo', q, setGeoResults)
                      }}
                      placeholder="Adresse, ville, quartier..."
                      className="w-full h-8 px-3 text-xs bg-theme-section border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      autoFocus
                    />
                  </div>
                  {geoResults.length > 0 && (
                    <div className="border-t border-theme-border-subtle max-h-48 overflow-y-auto">
                      {geoResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            mapRef.current?.flyTo({ center: r.center, zoom: 14, duration: 1200, pitch: isImmersive ? 60 : viewState.pitch })
                            setGeoMarker(r.center)
                            setShowGeoSearch(false)
                            setGeoSearchQuery('')
                            setGeoResults([])
                          }}
                          className="w-full px-3 py-2 text-xs text-theme-secondary hover:bg-theme-hover text-left cursor-pointer truncate"
                        >
                          {r.place_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom-center: Zone area measurement */}
          {closedPolygon && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[5] bg-theme-card/95 backdrop-blur-sm rounded-xl border border-theme-border px-4 py-2 flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-theme-tertiary" />
              <span className="text-xs font-medium text-theme-secondary">
                Surface : {(() => {
                  const coords = closedPolygon
                  const R = 6371000
                  const toRad = (d: number) => d * Math.PI / 180
                  let area = 0
                  for (let i = 0; i < coords.length; i++) {
                    const j = (i + 1) % coords.length
                    area += toRad(coords[j][0] - coords[i][0]) *
                      (2 + Math.sin(toRad(coords[i][1])) + Math.sin(toRad(coords[j][1])))
                  }
                  area = Math.abs(area * R * R / 2)
                  if (area > 1000000) return `${(area / 1000000).toFixed(1)} km²`
                  if (area > 10000) return `${(area / 10000).toFixed(1)} ha`
                  return `${Math.round(area).toLocaleString('fr-CH')} m²`
                })()}
              </span>
            </div>
          )}

          {/* Orbit active indicator */}
          {isOrbiting && !isImmersive && (
            <div className="absolute bottom-4 right-4 z-[5] bg-accent text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse">
              <Play className="h-3 w-3 fill-white" />
              Vue orbitale
            </div>
          )}

        </>
      )}

      {/* ── Immersive-only panels ── */}
      {isImmersive && (
        <>
          {/* Listing counter — shows visible count in viewport */}
          <div className="absolute top-3 right-3 z-[5] bg-gray-900/70 backdrop-blur-xl text-white/80 text-xs font-medium px-3 py-1.5 rounded-xl border border-white/10">
            {(() => {
              const visibleCount = clusters.reduce((sum, c) => {
                const props = c.properties as Record<string, unknown>
                return sum + (props.cluster ? (props.point_count as number) : 1)
              }, 0)
              const total = mapPoints?.length || listings.length
              return `${visibleCount.toLocaleString('fr-CH')} / ${total.toLocaleString('fr-CH')} biens`
            })()}
          </div>

          {/* Neighborhood pick mode instruction */}
          {neighborhoodPickMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[6] bg-gray-900/90 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-accent" />
              Cliquez pour analyser un quartier
              <button onClick={() => setNeighborhoodPickMode(false)} className="ml-2 text-white/60 hover:text-white transition-colors cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Neighborhood score overlay */}
          {neighborhoodPoint && (
            <NeighborhoodOverlay
              lat={neighborhoodPoint[1]}
              lng={neighborhoodPoint[0]}
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

          {/* Geocoding search panel (immersive) */}
          {showGeoSearch && (
            <div className="absolute top-4 right-4 z-[6] w-80 bg-gray-900/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden">
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white/80">Rechercher un lieu</span>
                  <button onClick={() => { setShowGeoSearch(false); setGeoMarker(null) }} className="text-white/40 hover:text-white cursor-pointer">
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
                  className="w-full h-9 px-3 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                  autoFocus
                />
                {/* Search radius slider */}
                {geoMarker && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-white/50">Rayon</span>
                    <input
                      type="range"
                      min={250}
                      max={5000}
                      step={250}
                      value={geoRadius}
                      onChange={(e) => updateGeoRadius(Number(e.target.value))}
                      className="flex-1 h-1 accent-accent"
                    />
                    <span className="text-xs text-white/70 min-w-[40px] text-right">
                      {geoRadius >= 1000 ? `${(geoRadius / 1000).toFixed(1)} km` : `${geoRadius} m`}
                    </span>
                  </div>
                )}
              </div>
              {geoResults.length > 0 && (
                <div className="border-t border-white/10 max-h-48 overflow-y-auto">
                  {geoResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        mapRef.current?.flyTo({ center: r.center, zoom: 14, duration: 1200, pitch: 60 })
                        setGeoMarker(r.center)
                        setShowGeoSearch(false)
                        setGeoSearchQuery('')
                        setGeoResults([])
                      }}
                      className="w-full px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 text-left cursor-pointer truncate"
                    >
                      {r.place_name}
                    </button>
                  ))}
                </div>
              )}
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
        </>
      )}
    </div>
  )
})

export default memo(MapView)
