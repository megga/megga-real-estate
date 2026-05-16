// MEGGA Marketplace — Carte interactive Property X.
//
// Direction esthétique : « Cartographie Suisse minimaliste éditoriale ».
// 100% monochrome (PX.neutral*), aucune couleur d'accent. Les markers SONT
// le prix (price-pill, pas de pin générique). Les clusters sont des cercles
// noirs avec compte en blanc. Inversion en blanc bordé noir au hover/selected.
//
// Performance : 33K points clusterisés client-side via Supercluster.js.
// L'utilisateur ne voit jamais plus de ~30-80 markers à l'écran à un zoom
// donné. Source des points : `useMapPoints` (RPC `get_market_map_points`,
// session-cached pour rendu instantané).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapGL, {
  Marker,
  NavigationControl,
  type MapRef,
} from 'react-map-gl/mapbox'
import Supercluster, { type ClusterFeature, type PointFeature } from 'supercluster'
import 'mapbox-gl/dist/mapbox-gl.css'

import { PX } from '../tokens'
import { useMapPoints } from '@/hooks/useMarketListings'
import { useMarketFilters } from '@/hooks/useMarketFilters'
import { formatCHF, formatRent } from '@/lib/utils'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// Centre de la Suisse, zoom national. L'utilisateur ré-cadre via filtres.
const INITIAL_VIEW = {
  longitude: 8.2275,
  latitude: 46.8182,
  zoom: 7,
} as const

interface PxListingsMapProps {
  context: 'buy' | 'rent'
}

// ─── Types Supercluster ──────────────────────────────────────────────────────

interface PointProps {
  id: string
  price: number
  context: 'buy' | 'rent'
}

type ClusterPoint =
  | (PointFeature<PointProps & { cluster?: false }> & { id?: number })
  | (ClusterFeature<{ point_count: number; point_count_abbreviated: number | string }> & {
      id: number
    })

// ─── Sous-composants markers ─────────────────────────────────────────────────

function PriceMarker({
  price,
  context,
  selected,
}: {
  price: number
  context: 'buy' | 'rent'
  selected?: boolean
}) {
  // Format compact : "1.5M" / "750k" pour buy, "3'150" pour rent (sans /mois,
  // gain de place sur la map).
  const label =
    context === 'rent'
      ? formatRent(price).replace('/mois', '').replace('CHF ', '')
      : price >= 1_000_000
        ? `${(price / 1_000_000).toFixed(price >= 10_000_000 ? 0 : 1)} M`
        : price >= 1_000
          ? `${Math.round(price / 1_000)} k`
          : formatCHF(price).replace('CHF ', '')

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        background: selected ? PX.neutral100 : PX.neutral700,
        color: selected ? PX.neutral700 : PX.neutral100,
        borderRadius: PX.radius.pill,
        fontFamily: PX.font.display,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '-0.39px',
        lineHeight: 1.25,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        boxShadow: selected
          ? `0 4px 12px rgba(20,22,28,0.22)`
          : `0 2px 6px rgba(20,22,28,0.18)`,
        border: `1.5px solid ${selected ? PX.neutral700 : PX.neutral100}`,
        transform: selected ? 'scale(1.1)' : 'scale(1)',
        transformOrigin: 'center bottom',
        transition: `transform ${PX.duration.fast} ${PX.ease}, background ${PX.duration.fast} ${PX.ease}, box-shadow ${PX.duration.fast} ${PX.ease}`,
      }}
    >
      {label}
    </div>
  )
}

function ClusterMarker({ count, size }: { count: number; size: number }) {
  const display = count > 999 ? `${(count / 1000).toFixed(1)}k` : String(count)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: PX.neutral700,
        color: PX.neutral100,
        display: 'grid',
        placeItems: 'center',
        fontFamily: PX.font.display,
        fontSize: size > 50 ? 16 : 14,
        fontWeight: 600,
        letterSpacing: '-0.42px',
        cursor: 'pointer',
        boxShadow: `0 6px 16px rgba(20,22,28,0.28)`,
        border: `2px solid ${PX.neutral100}`,
        transition: `transform ${PX.duration.fast} ${PX.ease}`,
      }}
    >
      {display}
    </div>
  )
}

// ─── Viewport bounds ─────────────────────────────────────────────────────────

interface Bounds {
  west: number
  south: number
  east: number
  north: number
  zoom: number
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function PxListingsMap({ context }: PxListingsMapProps) {
  const { filters } = useMarketFilters(context)
  const { data: points = [], isLoading } = useMapPoints(filters)
  const mapRef = useRef<MapRef>(null)

  // Viewport state minimal — on re-cluster sur chaque mouvement.
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const updateBounds = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const b = map.getBounds()
    if (!b) return
    setBounds({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
      zoom: Math.floor(map.getZoom()),
    })
  }, [])

  // Supercluster instance — rebuild quand les points changent (changement de
  // filtre). Performance ok jusqu'à ~50K points en théorie.
  const cluster = useMemo(() => {
    const sc = new Supercluster<PointProps>({
      radius: 60,
      maxZoom: 14,
      minPoints: 2,
    })
    sc.load(
      points
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map(p => ({
          type: 'Feature' as const,
          properties: { id: p.id, price: p.price, context: p.context },
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        })),
    )
    return sc
  }, [points])

  // Compute visible clusters/points for current viewport
  const visible: ClusterPoint[] = useMemo(() => {
    if (!bounds || !mapLoaded) return []
    return cluster.getClusters(
      [bounds.west, bounds.south, bounds.east, bounds.north],
      bounds.zoom,
    ) as ClusterPoint[]
  }, [cluster, bounds, mapLoaded])

  const onClusterClick = useCallback(
    (clusterId: number, lng: number, lat: number) => {
      const expansionZoom = Math.min(cluster.getClusterExpansionZoom(clusterId), 16)
      mapRef.current?.flyTo({
        center: [lng, lat],
        zoom: expansionZoom,
        duration: 600,
      })
    },
    [cluster],
  )

  // Quand les points changent (filtre user), re-cadre la carte sur leur bbox
  // si possible. Ça évite que l'user reste sur la Suisse entière alors qu'il
  // cherche à Genève.
  useEffect(() => {
    if (points.length === 0 || !mapRef.current || !mapLoaded) return
    if (!filters.canton && !filters.city) return // pas de re-cadrage sans intent localisé

    const lngs = points.map(p => p.lng).filter(Number.isFinite)
    const lats = points.map(p => p.lat).filter(Number.isFinite)
    if (lngs.length === 0) return

    const west = Math.min(...lngs)
    const east = Math.max(...lngs)
    const south = Math.min(...lats)
    const north = Math.max(...lats)
    // Padding 80px pour ne pas coller les markers aux bords
    mapRef.current.getMap().fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 80, duration: 800, maxZoom: 13 },
    )
  }, [points, filters.canton, filters.city, mapLoaded])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: PX.neutral200,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        border: `1px solid ${PX.neutral300}`,
      }}
    >
      <MapGL
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={INITIAL_VIEW}
        onMove={updateBounds}
        onMoveEnd={updateBounds}
        onLoad={() => {
          setMapLoaded(true)
          updateBounds()
        }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        // Verrouille la carte à la Suisse (élargi pour laisser scroll horizontal léger)
        maxBounds={[
          [3.5, 44.5],
          [12.5, 49],
        ]}
        minZoom={6}
        maxZoom={18}
      >
        {visible.map(item => {
          const [lng, lat] = item.geometry.coordinates
          const props = item.properties as unknown as Record<string, unknown>
          const isClusterPoint = 'cluster' in props && props.cluster === true

          if (isClusterPoint) {
            const count = props.point_count as number
            const size = Math.min(28 + Math.log10(count + 1) * 16, 64)
            return (
              <Marker
                key={`cluster-${item.id}`}
                longitude={lng}
                latitude={lat}
                anchor="center"
                onClick={e => {
                  e.originalEvent.stopPropagation()
                  onClusterClick(item.id as number, lng, lat)
                }}
              >
                <ClusterMarker count={count} size={size} />
              </Marker>
            )
          }

          const id = props.id as string
          const price = props.price as number
          return (
            <Marker
              key={id}
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={e => {
                e.originalEvent.stopPropagation()
                // Navigation programmatique via window.location pour conserver
                // l'attribution Mapbox (Link react-router ne se déclenche pas
                // dans le onClick natif Marker).
                window.location.href = `/propriete/${id}`
              }}
            >
              <PriceMarker price={price} context={context} />
            </Marker>
          )
        })}

        <NavigationControl position="top-right" showCompass={false} />
      </MapGL>

      {/* Loader overlay subtil pendant l'init Mapbox */}
      {(!mapLoaded || isLoading) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: PX.neutral200,
            pointerEvents: 'none',
            opacity: mapLoaded ? 0 : 1,
            transition: `opacity ${PX.duration.slow} ${PX.ease}`,
          }}
        >
          <span
            style={{
              fontFamily: PX.font.display,
              fontSize: 14,
              color: PX.neutral500,
              letterSpacing: '-0.42px',
            }}
          >
            Carte
          </span>
        </div>
      )}

      {/* Attribution mapbox custom — coin bas droite, discrète */}
      <a
        href="https://www.mapbox.com/about/maps/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute',
          bottom: 6,
          right: 6,
          padding: '2px 6px',
          background: 'rgba(255,255,255,0.7)',
          borderRadius: PX.radius.tiny,
          fontFamily: PX.font.display,
          fontSize: 9,
          color: PX.neutral500,
          textDecoration: 'none',
          letterSpacing: '0.2px',
        }}
      >
        © Mapbox © OpenStreetMap
      </a>
    </div>
  )
}

// Re-export pour usage interne dans PxListingsViewModeToggle (évite import cyclique)
export { PriceMarker as _PxPriceMarker }
