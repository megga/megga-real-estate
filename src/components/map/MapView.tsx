import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import MapGL, {
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
  FullscreenControl,
  type ViewStateChangeEvent,
  type MapRef,
  type MapMouseEvent,
} from 'react-map-gl/mapbox'
import Supercluster from 'supercluster'
import { LocateFixed, PenTool, X, Clock, MapPinPlus, Car, Footprints, Bike } from 'lucide-react'
import { useIsochrone } from '@/hooks/useIsochrone'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'
import type { MapPoint } from '@/hooks/useMarketListings'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

interface MapViewProps {
  listings: ListingCardData[]
  mapPoints?: MapPoint[]
  hoveredId?: string
  onHover?: (id: string | undefined) => void
  onZoneFilter?: (listingIds: string[] | null) => void
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

export default function MapView({ listings, mapPoints, hoveredId, onHover, onZoneFilter, className }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [viewState, setViewState] = useState({
    longitude: 6.1432,
    latitude: 46.2044,
    zoom: 11.5,
  })
  const [selectedListing, setSelectedListing] = useState<ListingCardData | null>(null)

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

  // Get clusters for current viewport
  const clusters = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs
    const bounds = mapRef.current?.getMap().getBounds()
    if (!bounds) {
      return supercluster.getClusters([5.5, 45.5, 7.0, 47.0], Math.floor(viewState.zoom))
    }
    return supercluster.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      Math.floor(viewState.zoom)
    )
  }, [supercluster, viewState.zoom])

  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState)
  }, [])

  function handleClusterClick(clusterId: number, lng: number, lat: number) {
    const zoom = supercluster.getClusterExpansionZoom(clusterId)
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 500 })
  }

  function handlePinClick(listing: ListingCardData) {
    setSelectedListing(listing)
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

  function handleMapMouseMove(e: MapMouseEvent) {
    if (!isDrawing || drawPoints.length === 0) return
    setCursorPos([e.lngLat.lng, e.lngLat.lat])
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

  // Change cursor when drawing or placing isochrone pin
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    if (isDrawing || isoMode) {
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.getCanvas().style.cursor = ''
    }
    return () => {
      map.getCanvas().style.cursor = ''
    }
  }, [isDrawing, isoMode])

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

  // Count listings in zone
  const zoneCount = useMemo(() => {
    if (!closedPolygon) return 0
    return listings.filter((l) => l.lat && l.lng && pointInPolygon([l.lng!, l.lat!], closedPolygon)).length
  }, [closedPolygon, listings])

  return (
    <div className={cn('relative w-full h-full [&_.mapboxgl-ctrl-logo]:hidden [&_.mapboxgl-ctrl-attrib]:hidden', className)}>
      <MapGL
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        onClick={handleMapClick}
        onDblClick={handleMapDoubleClick}
        onMouseMove={isDrawing ? handleMapMouseMove : undefined}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        doubleClickZoom={!isDrawing}
        dragPan={!isDrawing}
        reuseMaps
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <FullscreenControl position="bottom-right" />

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

        {/* Popup */}
        {selectedListing && selectedListing.lat && selectedListing.lng && !isDrawing && (
          <Popup
            longitude={selectedListing.lng}
            latitude={selectedListing.lat}
            anchor="bottom"
            onClose={() => setSelectedListing(null)}
            closeOnClick={false}
            offset={20}
            className="[&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:rounded-lg [&_.mapboxgl-popup-content]:overflow-hidden [&_.mapboxgl-popup-content]:shadow-dropdown [&_.mapboxgl-popup-close-button]:text-gray-400 [&_.mapboxgl-popup-close-button]:text-lg [&_.mapboxgl-popup-close-button]:right-2 [&_.mapboxgl-popup-close-button]:top-1 [&_.mapboxgl-popup-close-button]:hover:text-gray-700"
          >
            <Link to={`/listing/${selectedListing.id}`} className="block w-48">
              {selectedListing.photos[0] && (
                <img
                  src={selectedListing.photos[0]}
                  alt={selectedListing.title}
                  className="w-full h-28 object-cover"
                />
              )}
              <div className="p-2.5">
                <p className="text-sm font-bold text-gray-900">
                  {formatCHF(selectedListing.price)}
                  {selectedListing.context === 'rent' ? '/mois' : ''}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {selectedListing.address}, {selectedListing.city}
                </p>
                {selectedListing.rooms > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedListing.rooms} p. · {selectedListing.bedrooms} ch. · {formatSurface(selectedListing.surface_m2)}
                  </p>
                )}
                <p className="text-xs text-accent font-medium mt-1.5">
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
      </MapGL>

      {/* Top-left buttons */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
        <button
          onClick={fitToListings}
          className="bg-white text-gray-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <LocateFixed className="h-3.5 w-3.5" />
          Recentrer
        </button>

        {/* Draw zone — hidden when isochrone is active */}
        {!isDrawing && !closedPolygon && !isochrone && !isoMode && !isoLoading && (
          <button
            onClick={startDrawing}
            className="bg-white text-gray-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1.5"
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

        {/* Isochrone — button to start */}
        {!isoMode && !isochrone && !isoLoading && !isDrawing && !closedPolygon && (
          <button
            onClick={() => setIsoMode(true)}
            className="bg-white text-gray-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1.5"
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
    </div>
  )
}
