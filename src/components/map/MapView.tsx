import { useState, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import MapGL, {
  Marker,
  Popup,
  NavigationControl,
  FullscreenControl,
  type ViewStateChangeEvent,
  type MapRef,
} from 'react-map-gl'
import Supercluster from 'supercluster'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

interface MapViewProps {
  listings: ListingCardData[]
  hoveredId?: string
  onHover?: (id: string | undefined) => void
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

type ListingPoint = Supercluster.PointFeature<{ listing: ListingCardData }>

export default function MapView({ listings, hoveredId, onHover, className }: MapViewProps) {
  const mapRef = useRef<MapRef>(null)
  const [viewState, setViewState] = useState({
    longitude: 6.1432,
    latitude: 46.2044,
    zoom: 11.5,
  })
  const [selectedListing, setSelectedListing] = useState<ListingCardData | null>(null)

  // Build GeoJSON points from listings
  const points: ListingPoint[] = useMemo(
    () =>
      listings
        .filter((l) => l.lat && l.lng)
        .map((l) => ({
          type: 'Feature' as const,
          properties: { listing: l },
          geometry: {
            type: 'Point' as const,
            coordinates: [l.lng!, l.lat!],
          },
        })),
    [listings]
  )

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
    const bounds = mapRef.current?.getMap().getBounds()
    if (!bounds) {
      // Fallback: use wide bounds around Geneva
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

  return (
    <div className={cn('relative w-full h-full [&_.mapboxgl-ctrl-logo]:hidden [&_.mapboxgl-ctrl-attrib]:hidden', className)}>
      <MapGL
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        reuseMaps
      >
        <NavigationControl position="bottom-right" showCompass={false} />
        <FullscreenControl position="bottom-right" />

        {/* Render clusters and individual pins */}
        {clusters.map((cluster) => {
          const [lng, lat] = cluster.geometry.coordinates
          const isCluster = cluster.properties.cluster

          if (isCluster) {
            const pointCount = cluster.properties.point_count
            return (
              <Marker key={`cluster-${cluster.id}`} longitude={lng} latitude={lat} anchor="center">
                <button
                  onClick={() => handleClusterClick(cluster.id as number, lng, lat)}
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

          return (
            <Marker
              key={`pin-${listing.id}`}
              longitude={lng}
              latitude={lat}
              anchor="center"
            >
              <button
                onClick={() => handlePinClick(listing)}
                onMouseEnter={() => onHover?.(listing.id)}
                onMouseLeave={() => onHover?.(undefined)}
                className={cn(
                  'rounded-full text-[11px] font-bold px-2.5 py-1 border shadow-sm whitespace-nowrap transition-all duration-200 cursor-pointer',
                  isHovered || isSelected
                    ? 'bg-accent text-white border-accent shadow-md scale-110 z-10'
                    : 'bg-white text-gray-900 border-gray-200 hover:scale-110 hover:shadow-md'
                )}
              >
                {formatPricePin(listing.price, listing.context)}
              </button>
            </Marker>
          )
        })}

        {/* Popup */}
        {selectedListing && selectedListing.lat && selectedListing.lng && (
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
      </MapGL>

      {/* Recenter button */}
      <button
        onClick={fitToListings}
        className="absolute top-3 left-3 bg-white text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        Recentrer
      </button>
    </div>
  )
}
