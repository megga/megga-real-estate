import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
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
import { LocateFixed, PenTool, X, Clock, MapPinPlus, MapPin, Car, Footprints, Bike, Layers, Mountain, Satellite, Moon, Sun, Thermometer, Search, Ruler, RotateCcw, Pause, Play, Briefcase, Loader2, Maximize, Minimize, School, TrainFront, ShoppingBag, TreePine, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { useIsochrone } from '@/hooks/useIsochrone'
import NeighborhoodOverlay from './NeighborhoodOverlay'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
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
  startIsochrone: () => void
  enterImmersive: () => void
  exitImmersive: () => void
  /** Whether draw zone or isochrone is currently active */
  hasActiveZone: boolean
  isDrawing: boolean
  isIsoMode: boolean
  hasIsochrone: boolean
  hasPolygon: boolean
  isImmersive: boolean
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
  className?: string
}

function formatPricePin(price: number, context?: string): string {
  if (context === 'rent') {
    if (price >= 10000) return `${Math.round(price / 1000)}K/m`
    return `${price.toLocaleString('fr-CH').replace(/\s/g, "'")}/m`
  }
  if (price >= 1000000) {
    const m = price / 1000000
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`
  }
  return `${Math.round(price / 1000)}K`
}

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

const MAP_STYLES = [
  { id: 'standard', label: '3D', icon: Mountain, url: 'mapbox://styles/mapbox/standard' },
  { id: 'satellite', label: 'Satellite', icon: Satellite, url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'light', label: 'Clair', icon: Sun, url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'dark', label: 'Sombre', icon: Moon, url: 'mapbox://styles/mapbox/dark-v11' },
] as const

type MapStyleId = typeof MAP_STYLES[number]['id']

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ listings, mapPoints, hoveredId, onHover, onZoneFilter, onImmersiveChange, onQuickFilter, className }, ref) {
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

  // Directions (commute calculator)
  const [showCommute, setShowCommute] = useState(false)
  const [commuteAddress, setCommuteAddress] = useState('')
  const [commuteGeoResults, setCommuteGeoResults] = useState<Array<{ place_name: string; center: [number, number] }>>([])
  const [commuteProfile, setCommuteProfile] = useState<'driving' | 'walking' | 'cycling'>('driving')
  const [commuteRoute, setCommuteRoute] = useState<GeoJSON.FeatureCollection | null>(null)
  const [commuteDuration, setCommuteDuration] = useState<number | null>(null)
  const [commuteDistance, setCommuteDistance] = useState<number | null>(null)
  const [commuteLoading, setCommuteLoading] = useState(false)
  const [commuteOrigin, setCommuteOrigin] = useState<[number, number] | null>(null)
  const [commutePickMode, setCommutePickMode] = useState(false)

  const searchCommuteAddr = useCallback((q: string) => {
    setCommuteAddress(q)
    debouncedGeoFetch('commute', q, setCommuteGeoResults)
  }, [])

  const fetchCommuteRoute = useCallback(async (dest: [number, number]) => {
    if (!commuteOrigin) return
    setCommuteLoading(true)
    setCommuteGeoResults([])
    try {
      const resp = await fetch(`https://api.mapbox.com/directions/v5/mapbox/${commuteProfile}/${commuteOrigin[0]},${commuteOrigin[1]};${dest[0]},${dest[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`)
      const data = await resp.json()
      const route = data.routes?.[0]
      if (!route) throw new Error('No route')
      setCommuteDuration(Math.round(route.duration / 60))
      setCommuteDistance(Math.round(route.distance / 100) / 10)
      setCommuteRoute({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: route.geometry, properties: {} }] })
      const coords = route.geometry.coordinates as [number, number][]
      const lngs = coords.map(c => c[0])
      const lats = coords.map(c => c[1])
      mapRef.current?.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 80, duration: 1000, pitch: 30 })
    } catch { setCommuteRoute(null); setCommuteDuration(null) }
    finally { setCommuteLoading(false) }
  }, [commuteOrigin, commuteProfile])

  const clearCommute = useCallback(() => {
    setCommuteRoute(null); setCommuteDuration(null); setCommuteDistance(null)
    setCommuteAddress(''); setCommuteGeoResults([]); setCommuteOrigin(null)
    setCommutePickMode(false)
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

  // Isochrone (commute time)
  const { isochrone, isLoading: isoLoading, error: isoError, fetchIsochrone, clearIsochrone } = useIsochrone()
  const [isoMode, setIsoMode] = useState(false)
  const [isoMinutes, setIsoMinutes] = useState(30)
  const [isoProfile, setIsoProfile] = useState<'driving' | 'walking' | 'cycling'>('driving')
  const [isoPin, setIsoPin] = useState<[number, number] | null>(null)

  // Extract isochrone polygon coords for point-in-polygon filtering
  const isoPolygonCoords = useMemo<[number, number][] | null>(() => {
    if (!isochrone?.geojson?.features?.[0]?.geometry?.coordinates?.[0]) return null
    return isochrone.geojson.features[0].geometry.coordinates[0] as [number, number][]
  }, [isochrone])

  // Count biens inside isochrone — use mapPoints (stable, not filtered)
  const isoListingCount = useMemo(() => {
    if (!isoPolygonCoords || !mapPoints) return 0
    return mapPoints.filter(p => pointInPolygon([p.lng, p.lat], isoPolygonCoords)).length
  }, [isoPolygonCoords, mapPoints])

  // Filter listings when isochrone is active — use mapPoints (stable) to avoid infinite loop
  const prevIsoFilterRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isoPolygonCoords || !mapPoints) {
      if (prevIsoFilterRef.current !== null) {
        prevIsoFilterRef.current = null
        // Don't call onZoneFilter(null) here — let the clear button handle it
      }
      return
    }
    const insideIds = mapPoints
      .filter(p => pointInPolygon([p.lng, p.lat], isoPolygonCoords))
      .map(p => p.id)
    const key = insideIds.join(',')
    if (key !== prevIsoFilterRef.current) {
      prevIsoFilterRef.current = key
      onZoneFilter?.(insideIds)
    }
  }, [isoPolygonCoords, mapPoints, onZoneFilter])

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    fitToListings,
    startDrawing,
    startIsochrone: () => setIsoMode(true),
    enterImmersive,
    exitImmersive,
    get hasActiveZone() { return !!closedPolygon || !!isochrone },
    get isDrawing() { return isDrawing },
    get isIsoMode() { return isoMode },
    get hasIsochrone() { return !!isochrone },
    get hasPolygon() { return !!closedPolygon },
    get isImmersive() { return isImmersive },
  }))

  // Profile labels
  const PROFILE_LABELS = {
    driving: { label: 'en voiture', icon: Car },
    walking: { label: 'a pied', icon: Footprints },
    cycling: { label: 'a velo', icon: Bike },
  } as const

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

  // Build supercluster index
  const supercluster = useMemo(() => {
    const sc = new Supercluster<{ listing: ListingCardData }>({
      radius: 60,
      maxZoom: 16,
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
    setClusterBounds({
      zoom: map.getZoom(),
      bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    })
  }, [])

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
    // Commute: pick origin point on map
    if (commutePickMode) {
      setCommuteOrigin([e.lngLat.lng, e.lngLat.lat])
      setCommutePickMode(false)
      return
    }
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
    if (isDrawing || isoMode || neighborhoodPickMode) {
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.getCanvas().style.cursor = ''
    }
    return () => {
      map.getCanvas().style.cursor = ''
    }
  }, [isDrawing, isoMode, neighborhoodPickMode])

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

  return (
    <div ref={containerRef} className={cn(
      'relative w-full h-full [&_.mapboxgl-ctrl-logo]:hidden [&_.mapboxgl-ctrl-attrib]:hidden',
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
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        doubleClickZoom={!isDrawing}
        dragPan={!isDrawing}
        reuseMaps
        dragRotate
        touchPitch
        touchZoomRotate
        terrain={mapStyleId === 'standard' ? { source: 'mapbox-dem', exaggeration: 1.5 } : undefined}
        onMouseMove={(e) => {
          if (isDrawing && drawPoints.length > 0) {
            setCursorPos([e.lngLat.lng, e.lngLat.lat])
          }
        }}
        onLoad={(e) => {
          const map = e.target
          // Initialize cluster bounds
          updateClusterBounds()
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
                'fill-opacity': 0.08,
              }}
            />
            {/* Polygon outline */}
            <Layer
              id="draw-line"
              type="line"
              filter={['==', '$type', 'LineString']}
              paint={{
                'line-color': '#2563EB',
                'line-width': 2,
                'line-dasharray': closedPolygon ? [1] : [2, 2],
              }}
            />
            {/* Vertex points */}
            <Layer
              id="draw-points"
              type="circle"
              filter={['==', '$type', 'Point']}
              paint={{
                'circle-radius': 5,
                'circle-color': '#FFFFFF',
                'circle-stroke-color': '#2563EB',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {/* Render clusters and individual pins */}
        {clusters.map((cluster) => {
          const [lng, lat] = cluster.geometry.coordinates
          const props = cluster.properties as Record<string, unknown>
          const isCluster = props.cluster

          if (isCluster) {
            const pointCount = props.point_count as number
            return (
              <Marker key={`cluster-${cluster.id}`} longitude={lng} latitude={lat} anchor="center">
                <button
                  onClick={(e) => {
                    if (isDrawing) return
                    e.stopPropagation()
                    handleClusterClick(cluster.id as number, lng, lat)
                  }}
                  className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md border-2 border-white hover:scale-110 transition-transform cursor-pointer"
                >
                  {pointCount}
                </button>
              </Marker>
            )
          }

          // Individual pin
          const listing = cluster.properties.listing
          const isHovered = hoveredId === listing.id
          const isSelected = selectedListing?.id === listing.id
          const activePolygon = closedPolygon || isoPolygonCoords
          const isInZone = activePolygon
            ? listing.lat && listing.lng && pointInPolygon([listing.lng, listing.lat], activePolygon)
            : true

          return (
            <Marker
              key={`pin-${listing.id}`}
              longitude={lng}
              latitude={lat}
              anchor="center"
            >
              <button
                onClick={(e) => {
                  if (isDrawing) return
                  e.stopPropagation()
                  handlePinClick(listing)
                }}
                onMouseEnter={() => onHover?.(listing.id)}
                onMouseLeave={() => onHover?.(undefined)}
                className={cn(
                  'rounded-full text-[11px] font-bold px-2.5 py-1 border shadow-sm whitespace-nowrap transition-all duration-200 cursor-pointer',
                  isHovered || isSelected
                    ? 'bg-accent text-white border-accent shadow-md scale-110 z-10'
                    : isInZone
                      ? 'bg-white text-gray-900 border-gray-200 hover:scale-110 hover:shadow-md'
                      : 'bg-gray-100 text-gray-400 border-gray-200 opacity-50'
                )}
              >
                {formatPricePin(listing.price, listing.context)}
              </button>
            </Marker>
          )
        })}

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
            className="[&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:rounded-xl [&_.mapboxgl-popup-content]:overflow-hidden [&_.mapboxgl-popup-content]:shadow-xl [&_.mapboxgl-popup-close-button]:text-gray-400 [&_.mapboxgl-popup-close-button]:text-lg [&_.mapboxgl-popup-close-button]:right-2 [&_.mapboxgl-popup-close-button]:top-1 [&_.mapboxgl-popup-close-button]:hover:text-gray-700 [&_.mapboxgl-popup-close-button]:z-10"
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
                    <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {selectedListing.photos.length} photos
                    </span>
                  )}
                </div>
              ) : (
                <div className={cn('w-full flex items-center justify-center bg-gray-100', isImmersive ? 'h-44' : 'h-28')}>
                  <Building2 className="h-8 w-8 text-gray-300" />
                </div>
              )}
              <div className={cn(isImmersive ? 'p-4' : 'p-2.5')}>
                <p className={cn('font-bold text-gray-900', isImmersive ? 'text-lg' : 'text-sm')}>
                  {formatCHF(selectedListing.price)}
                  {selectedListing.context === 'rent' ? '/mois' : ''}
                </p>
                <p className={cn('text-gray-500 mt-0.5 truncate', isImmersive ? 'text-sm' : 'text-xs')}>
                  {selectedListing.address}{selectedListing.city ? `, ${selectedListing.city}` : ''}
                </p>
                {selectedListing.rooms > 0 && (
                  <div className={cn('flex items-center gap-2 mt-1', isImmersive ? 'text-sm text-gray-600' : 'text-xs text-gray-400')}>
                    <span>{selectedListing.rooms} pièces</span>
                    {selectedListing.bedrooms > 0 && <><span>·</span><span>{selectedListing.bedrooms} ch.</span></>}
                    {selectedListing.surface_m2 > 0 && <><span>·</span><span>{formatSurface(selectedListing.surface_m2)}</span></>}
                  </div>
                )}
                {isImmersive && selectedListing.surface_m2 > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
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

        {/* Isochrone layer */}
        {isochrone && isochrone.geojson && (
          <Source
            id="isochrone"
            type="geojson"
            data={isochrone.geojson as GeoJSON.FeatureCollection}
          >
            <Layer
              id="isochrone-fill"
              type="fill"
              paint={{ 'fill-color': '#2563EB', 'fill-opacity': 0.15 }}
            />
            <Layer
              id="isochrone-line"
              type="line"
              paint={{ 'line-color': '#2563EB', 'line-width': 2.5 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>
        )}

        {/* Isochrone pin */}
        {isoPin && (
          <Marker longitude={isoPin[0]} latitude={isoPin[1]} anchor="center" style={{ zIndex: 100 }}>
            <div className="relative flex items-center justify-center">
              <div className="absolute h-11 w-11 rounded-full border-2 border-accent/40 animate-pulse" />
              <div className="relative h-8 w-8 bg-accent rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                {(() => {
                  const ProfileIcon = PROFILE_LABELS[isoProfile].icon
                  return <ProfileIcon className="h-3.5 w-3.5 text-white" />
                })()}
              </div>
            </div>
          </Marker>
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

        {/* Commute route line */}
        {commuteRoute && (
          <Source id="commute-route" type="geojson" data={commuteRoute}>
            <Layer id="commute-line-bg" type="line" paint={{ 'line-color': '#2563EB', 'line-width': 6, 'line-opacity': 0.3 }} />
            <Layer id="commute-line" type="line" paint={{ 'line-color': '#2563EB', 'line-width': 3, 'line-opacity': 0.9 }} />
          </Source>
        )}

        {/* Commute origin marker */}
        {commuteOrigin && (
          <Marker latitude={commuteOrigin[1]} longitude={commuteOrigin[0]} anchor="bottom">
            <div className="h-6 w-6 bg-accent rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <Briefcase className="h-3 w-3 text-white" />
            </div>
          </Marker>
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
                paint={{ 'fill-color': '#2563EB', 'fill-opacity': 0.08 }}
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

      {/* Top-left buttons */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
        <button
          onClick={fitToListings}
          className={cn(
            'text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5',
            isImmersive
              ? 'bg-gray-900/80 backdrop-blur-md text-white/80 hover:text-white hover:bg-gray-900/90 border border-white/10'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          )}
        >
          <LocateFixed className="h-3.5 w-3.5" />
          Recentrer
        </button>

        {/* Draw zone — hidden when isochrone is active */}
        {!isDrawing && !closedPolygon && !isochrone && !isoMode && !isoLoading && (
          <button
            onClick={startDrawing}
            className={cn(
              'text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5',
              isImmersive
                ? 'bg-gray-900/80 backdrop-blur-md text-white/80 hover:text-white hover:bg-gray-900/90 border border-white/10'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            )}
          >
            <PenTool className="h-3.5 w-3.5" />
            Dessiner une zone
          </button>
        )}

        {closedPolygon && (
          <button
            onClick={clearZone}
            className="bg-accent text-white text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm hover:bg-accent/90 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            {zoneCount} bien{zoneCount !== 1 ? 's' : ''} dans la zone
          </button>
        )}

        {/* Isochrone — button to start (hidden in immersive — available in toolbar) */}
        {!isoMode && !isochrone && !isoLoading && !isDrawing && !closedPolygon && !isImmersive && (
          <button
            onClick={() => setIsoMode(true)}
            className={cn(
              'text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5',
              isImmersive
                ? 'bg-gray-900/80 backdrop-blur-md text-white/80 hover:text-white hover:bg-gray-900/90 border border-white/10'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            Temps de trajet
          </button>
        )}

        {/* Isochrone — loading */}
        {isoLoading && (
          <div className="bg-white text-gray-500 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-1.5 animate-pulse">
            <Clock className="h-3.5 w-3.5" />
            Calcul en cours...
          </div>
        )}

        {/* Isochrone — error */}
        {isoError && !isochrone && !isoLoading && (
          <div className="flex items-center gap-1.5">
            <div className="bg-red-50 text-red-600 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm border border-red-200">
              Erreur — reessayez
            </div>
            <button
              onClick={() => { clearIsochrone(); setIsoPin(null); onZoneFilter?.(null) }}
              className="h-7 w-7 bg-white rounded-lg border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 cursor-pointer"
            >
              <X className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
        )}

        {/* Isochrone — active controls */}
        {isochrone && (
          <div className="flex items-center gap-1.5">
            {/* Badge with count */}
            <div className="bg-accent text-white text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5">
              {(() => { const Icon = PROFILE_LABELS[isoProfile].icon; return <Icon className="h-3.5 w-3.5" /> })()}
              {isochrone.minutes} min {PROFILE_LABELS[isoProfile].label}
              {isoListingCount > 0 && (
                <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
                  {isoListingCount} bien{isoListingCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Duration pills */}
            <div className="flex bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    setIsoMinutes(mins)
                    if (isoPin) fetchIsochrone(isoPin[0], isoPin[1], mins, isoProfile)
                  }}
                  className={cn(
                    'px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                    isoMinutes === mins ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {mins}′
                </button>
              ))}
            </div>

            {/* Transport mode pills */}
            <div className="flex bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {(['driving', 'walking', 'cycling'] as const).map((profile) => {
                const { icon: Icon } = PROFILE_LABELS[profile]
                return (
                  <button
                    key={profile}
                    onClick={() => {
                      setIsoProfile(profile)
                      if (isoPin) fetchIsochrone(isoPin[0], isoPin[1], isoMinutes, profile)
                    }}
                    className={cn(
                      'p-1.5 transition-colors cursor-pointer',
                      isoProfile === profile ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                )
              })}
            </div>

            {/* Close */}
            <button
              onClick={() => { clearIsochrone(); setIsoPin(null); onZoneFilter?.(null) }}
              className="h-7 w-7 bg-white rounded-lg border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 cursor-pointer"
            >
              <X className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
        )}
      </div>

      {/* Isochrone placement overlay — captures all clicks above markers */}
      {isoMode && (
        <>
          <div
            className="absolute inset-0 z-[5] cursor-crosshair"
            onClick={(e) => {
              const map = mapRef.current?.getMap()
              if (!map) return
              const rect = (e.target as HTMLElement).getBoundingClientRect()
              const x = e.clientX - rect.left
              const y = e.clientY - rect.top
              const lngLat = map.unproject([x, y])
              const pin: [number, number] = [lngLat.lng, lngLat.lat]
              setIsoPin(pin)
              setIsoMode(false)
              fetchIsochrone(pin[0], pin[1], isoMinutes, isoProfile)
            }}
          />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[6] bg-gray-900/90 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <MapPinPlus className="h-3.5 w-3.5" />
            Cliquez pour placer votre point de depart
            <button
              onClick={(e) => { e.stopPropagation(); setIsoMode(false) }}
              className="ml-2 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
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
            <span className="text-[10px] text-white/40 px-1.5">Filtres</span>
            <div className="w-px h-4 bg-white/15" />
            {[
              { label: 'Appart.', active: quickFilters.type === 'apartment', onClick: () => updateQuickFilter({ type: quickFilters.type === 'apartment' ? '' : 'apartment' }) },
              { label: 'Maison', active: quickFilters.type === 'house', onClick: () => updateQuickFilter({ type: quickFilters.type === 'house' ? '' : 'house' }) },
            ].map(f => (
              <button
                key={f.label}
                onClick={f.onClick}
                className={cn(
                  'h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer',
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
                  'h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer',
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
                  'h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer',
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
              <span className="text-[9px] text-white/30 px-1 uppercase tracking-wider shrink-0">Vue</span>
              {/* Style picker */}
              <div className="relative">
                <button
                  onClick={() => setShowStylePicker(v => !v)}
                  className="h-7 px-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
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
                        'h-7 w-7 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center shrink-0',
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
              <span className="text-[9px] text-white/30 px-1 uppercase tracking-wider shrink-0">Donnees</span>
              <button
                onClick={() => setShowHeatmap(v => !v)}
                className={cn(
                  'h-7 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                  showHeatmap ? 'text-white bg-white/15' : 'text-white/40 hover:text-white hover:bg-white/10'
                )}
                title="Heatmap prix/m²"
              >
                <Thermometer className="h-3 w-3" />
              </button>
              <button
                onClick={isOrbiting ? stopOrbit : startOrbit}
                className={cn(
                  'h-7 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
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
                      'h-7 w-7 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center shrink-0',
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
              <span className="text-[9px] text-white/30 px-1 uppercase tracking-wider shrink-0">Explorer</span>
              <button
                onClick={isTourActive ? stopTour : startTour}
                className={cn(
                  'h-7 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                  isTourActive ? 'text-white bg-accent/60' : 'text-white/40 hover:text-white hover:bg-white/10'
                )}
                title="Survol des biens"
              >
                <Play className="h-3 w-3" />
              </button>
              <button
                onClick={() => setShowGeoSearch(v => !v)}
                className={cn(
                  'h-7 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                  showGeoSearch ? 'text-white bg-white/15' : 'text-white/40 hover:text-white hover:bg-white/10'
                )}
                title="Rechercher un lieu"
              >
                <Search className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (showCommute) { setShowCommute(false); clearCommute() }
                  else { setShowCommute(true); setCommutePickMode(true) }
                }}
                className={cn(
                  'h-7 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
                  showCommute ? 'text-white bg-accent/60' : 'text-white/40 hover:text-white hover:bg-white/10'
                )}
                title="Mon trajet"
              >
                <Briefcase className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (neighborhoodPoint) { setNeighborhoodPoint(null) }
                  else { setNeighborhoodPickMode(true) }
                }}
                className={cn(
                  'h-7 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0',
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
            {/* Tools toggle */}
            <button
              onClick={() => setShowTools(v => !v)}
              className={cn(
                'h-9 px-3 rounded-xl shadow-sm border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                showTools
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
              aria-label="Outils avancés"
            >
              <Mountain className="h-3.5 w-3.5" />
              Outils
            </button>

            {/* Immersive mode button */}
            <button
              onClick={enterImmersive}
              className="h-9 px-3 rounded-xl bg-white shadow-sm border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1.5"
              aria-label="Mode immersif"
            >
              <Maximize className="h-3.5 w-3.5" />
              Immersif
            </button>

            <div className="relative">
              <button
                onClick={() => setShowStylePicker(v => !v)}
                className="h-9 px-3 rounded-xl bg-white shadow-sm border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1.5"
                aria-label="Changer le style de carte"
              >
                <Layers className="h-3.5 w-3.5" />
                {currentStyle.label}
              </button>

              {showStylePicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-w-[140px]">
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
                            ? 'bg-accent/10 text-accent'
                            : 'text-gray-700 hover:bg-gray-50'
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
      </div>

      {/* ── Immersive controls (tools panel — NOT shown in immersive mode, those are in the bottom toolbar) ── */}
      {(isFullscreen || showTools) && !isImmersive && (
        <>
          {/* Top-right: Light presets + Heatmap + Geocoding */}
          <div className="absolute top-3 right-3 z-[5] flex flex-col gap-2">
            {/* Light presets (Standard 3D only) */}
            {mapStyleId === 'standard' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Lumière</div>
                {(['day', 'dawn', 'dusk', 'night'] as const).map(preset => (
                  <button
                    key={preset}
                    onClick={() => setLightPreset(preset)}
                    className={cn(
                      'w-full px-3 py-1.5 text-xs font-medium text-left transition-colors cursor-pointer',
                      lightPreset === preset ? 'bg-accent/10 text-accent' : 'text-gray-700 hover:bg-gray-50'
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
                'h-9 px-3 rounded-xl shadow-sm border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                showHeatmap
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              <Thermometer className="h-3.5 w-3.5" />
              Prix/m²
            </button>

            {/* Orbit 3D */}
            <button
              onClick={isOrbiting ? stopOrbit : startOrbit}
              className={cn(
                'h-9 px-3 rounded-xl shadow-sm border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                isOrbiting
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              {isOrbiting ? <Pause className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {isOrbiting ? 'Arrêter' : 'Orbit 3D'}
            </button>

            {/* Commute calculator */}
            <button
              onClick={() => {
                if (showCommute) { setShowCommute(false); clearCommute() }
                else { setShowCommute(true); setCommutePickMode(true) }
              }}
              className={cn(
                'h-9 px-3 rounded-xl shadow-sm border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                showCommute
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Mon trajet
            </button>

            {/* Geocoding search */}
            <div className="relative">
              <button
                onClick={() => setShowGeoSearch(v => !v)}
                className="h-9 px-3 rounded-xl bg-white shadow-sm border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Search className="h-3.5 w-3.5" />
                Rechercher un lieu
              </button>

              {showGeoSearch && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
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
                      className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      autoFocus
                    />
                  </div>
                  {geoResults.length > 0 && (
                    <div className="border-t border-gray-100 max-h-48 overflow-y-auto">
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
                          className="w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left cursor-pointer truncate"
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
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[5] bg-white/95 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 px-4 py-2 flex items-center gap-2">
              <Ruler className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-700">
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

          {/* Commute pick mode instruction */}
          {commutePickMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[6] bg-gray-900/90 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5" />
              Cliquez sur la carte pour placer votre point de départ
              <button onClick={() => { setCommutePickMode(false); setShowCommute(false) }} className="ml-2 text-white/60 hover:text-white transition-colors cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Commute panel (after origin is placed) */}
          {showCommute && commuteOrigin && !commutePickMode && (
            <div className="absolute top-3 left-3 z-[5] w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-900">Temps de trajet</span>
                  <button onClick={() => { setShowCommute(false); clearCommute() }} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-1 mb-2">
                  {(['driving', 'walking', 'cycling'] as const).map(p => {
                    const icons = { driving: Car, walking: Footprints, cycling: Bike }
                    const labels = { driving: 'Voiture', walking: 'À pied', cycling: 'Vélo' }
                    const Icon = icons[p]
                    return (
                      <button key={p} onClick={() => setCommuteProfile(p)} className={cn('flex-1 h-7 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer', commuteProfile === p ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:bg-gray-50')}>
                        <Icon className="h-3 w-3" />
                        {labels[p]}
                      </button>
                    )
                  })}
                </div>
                <input
                  type="text"
                  value={commuteAddress}
                  onChange={(e) => searchCommuteAddr(e.target.value)}
                  placeholder="Destination (adresse, lieu)..."
                  className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  autoFocus
                />
              </div>
              {commuteGeoResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto border-b border-gray-100">
                  {commuteGeoResults.map((r, i) => (
                    <button key={i} onClick={() => fetchCommuteRoute(r.center)} className="w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left cursor-pointer truncate">
                      {r.place_name}
                    </button>
                  ))}
                </div>
              )}
              {commuteLoading && (
                <div className="p-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Calcul...
                </div>
              )}
              {commuteDuration !== null && !commuteLoading && (
                <div className="p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">{commuteDuration}</span>
                    <span className="text-xs text-gray-500">min</span>
                    <span className="text-xs text-gray-400">· {commuteDistance} km</span>
                  </div>
                  <button onClick={clearCommute} className="mt-2 w-full h-7 rounded-lg text-[10px] text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                    Effacer
                  </button>
                </div>
              )}
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
                    <span className="text-[10px] text-white/50">Rayon</span>
                    <input
                      type="range"
                      min={250}
                      max={5000}
                      step={250}
                      value={geoRadius}
                      onChange={(e) => updateGeoRadius(Number(e.target.value))}
                      className="flex-1 h-1 accent-accent"
                    />
                    <span className="text-[10px] text-white/70 min-w-[40px] text-right">
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

          {/* Commute panel (immersive) */}
          {showCommute && commuteOrigin && !commutePickMode && (
            <div className="absolute top-4 left-4 z-[6] w-72 bg-gray-900/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden">
              <div className="p-3 border-b border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white/80">Temps de trajet</span>
                  <button onClick={() => { setShowCommute(false); clearCommute() }} className="text-white/40 hover:text-white cursor-pointer">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-1 mb-2">
                  {(['driving', 'walking', 'cycling'] as const).map(p => {
                    const icons = { driving: Car, walking: Footprints, cycling: Bike }
                    const labels = { driving: 'Voiture', walking: 'A pied', cycling: 'Velo' }
                    const Icon = icons[p]
                    return (
                      <button key={p} onClick={() => setCommuteProfile(p)} className={cn('flex-1 h-7 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer', commuteProfile === p ? 'bg-accent/30 text-accent' : 'text-white/50 hover:bg-white/10')}>
                        <Icon className="h-3 w-3" />
                        {labels[p]}
                      </button>
                    )
                  })}
                </div>
                <input
                  type="text"
                  value={commuteAddress}
                  onChange={(e) => searchCommuteAddr(e.target.value)}
                  placeholder="Destination (adresse, lieu)..."
                  className="w-full h-8 px-3 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                  autoFocus
                />
              </div>
              {commuteGeoResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto border-b border-white/10">
                  {commuteGeoResults.map((r, i) => (
                    <button key={i} onClick={() => fetchCommuteRoute(r.center)} className="w-full px-3 py-2 text-xs text-white/70 hover:bg-white/10 text-left cursor-pointer truncate">
                      {r.place_name}
                    </button>
                  ))}
                </div>
              )}
              {commuteLoading && (
                <div className="p-3 flex items-center justify-center gap-2 text-xs text-white/50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Calcul...
                </div>
              )}
              {commuteDuration !== null && !commuteLoading && (
                <div className="p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white">{commuteDuration}</span>
                    <span className="text-xs text-white/50">min</span>
                    <span className="text-xs text-white/40">· {commuteDistance} km</span>
                  </div>
                  <button onClick={clearCommute} className="mt-2 w-full h-7 rounded-lg text-[10px] text-white/50 hover:text-white bg-white/10 hover:bg-white/15 transition-colors cursor-pointer">
                    Effacer
                  </button>
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

export default MapView
