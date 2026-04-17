import { useState, useRef, useCallback } from 'react'
import MapGL, { Marker, NavigationControl, Source, Layer, type MapRef } from 'react-map-gl/mapbox'
import { MapPin, Briefcase, X, Car, Footprints, Bike, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

interface ListingMapProps {
  lat?: number
  lng?: number
  address: string
  city: string
  postal_code?: string
}

export default function ListingMap({ lat, lng, address, city, postal_code }: ListingMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [viewState, setViewState] = useState({
    latitude: lat || 46.2044,
    longitude: lng || 6.1432,
    zoom: 16,
    pitch: 0,
    bearing: 0,
  })

  const handleMove = useCallback((evt: { viewState: typeof viewState }) => {
    setViewState(evt.viewState)
  }, [])

  // ── Directions (commute calculator) ──
  const [showCommute, setShowCommute] = useState(false)
  const [commuteAddress, setCommuteAddress] = useState('')
  const [commuteResults, setCommuteResults] = useState<Array<{ place_name: string; center: [number, number] }>>([])
  const [commuteProfile, setCommuteProfile] = useState<'driving' | 'walking' | 'cycling'>('driving')
  const [commuteRoute, setCommuteRoute] = useState<GeoJSON.FeatureCollection | null>(null)
  const [commuteDuration, setCommuteDuration] = useState<number | null>(null)
  const [commuteDistance, setCommuteDistance] = useState<number | null>(null)
  const [commuteLoading, setCommuteLoading] = useState(false)

  const searchCommuteAddress = useCallback(async (q: string) => {
    setCommuteAddress(q)
    if (q.length < 3) { setCommuteResults([]); return }
    try {
      const resp = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=ch&language=fr&limit=5&access_token=${MAPBOX_TOKEN}`
      )
      const data = await resp.json()
      setCommuteResults(data.features?.map((f: Record<string, unknown>) => ({
        place_name: f.place_name as string,
        center: f.center as [number, number],
      })) || [])
    } catch { setCommuteResults([]) }
  }, [])

  const fetchRoute = useCallback(async (dest: [number, number]) => {
    if (!lat || !lng) return
    setCommuteLoading(true)
    setCommuteResults([])

    try {
      const resp = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${commuteProfile}/${lng},${lat};${dest[0]},${dest[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
      )
      const data = await resp.json()
      const route = data.routes?.[0]
      if (!route) throw new Error('Aucun itinéraire trouvé')

      setCommuteDuration(Math.round(route.duration / 60))
      setCommuteDistance(Math.round(route.distance / 100) / 10)
      setCommuteRoute({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: route.geometry,
          properties: {},
        }],
      })

      // Fit to route bounds
      const coords = route.geometry.coordinates as [number, number][]
      const lngs = coords.map(c => c[0])
      const lats = coords.map(c => c[1])
      mapRef.current?.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 60, duration: 1000 }
      )
    } catch {
      setCommuteRoute(null)
      setCommuteDuration(null)
    } finally {
      setCommuteLoading(false)
    }
  }, [lat, lng, commuteProfile])

  const clearCommute = useCallback(() => {
    setCommuteRoute(null)
    setCommuteDuration(null)
    setCommuteDistance(null)
    setCommuteAddress('')
    setCommuteResults([])
    if (lat && lng) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 1000 })
    }
  }, [lat, lng])

  if (!lat || !lng || !MAPBOX_TOKEN) {
    return (
      <div id="localisation" className="scroll-mt-28 w-full h-[350px] md:h-[400px] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-8 w-8 text-gray-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500">{address}</p>
          <p className="text-xs text-gray-500">{postal_code} {city}</p>
        </div>
      </div>
    )
  }

  const PROFILE_ICONS = { driving: Car, walking: Footprints, cycling: Bike } as const

  return (
    <div id="localisation" className="scroll-mt-28 w-full h-[350px] md:h-[450px] relative">
      <MapGL
        ref={mapRef}
        {...viewState}
        onMove={handleMove}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: '100%' }}
        reuseMaps
        attributionControl={false}
        dragRotate={false}
        touchPitch={false}
        maxPitch={0}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Property marker */}
        <Marker latitude={lat} longitude={lng} anchor="bottom">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 bg-accent rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div className="h-2 w-2 bg-accent rounded-full mt-0.5 opacity-40" />
          </div>
        </Marker>

        {/* Commute route line */}
        {commuteRoute && (
          <Source id="commute-route" type="geojson" data={commuteRoute}>
            <Layer
              id="route-line-bg"
              type="line"
              paint={{
                'line-color': '#2563EB',
                'line-width': 6,
                'line-opacity': 0.3,
              }}
            />
            <Layer
              id="route-line"
              type="line"
              paint={{
                'line-color': '#2563EB',
                'line-width': 3,
                'line-opacity': 0.9,
              }}
            />
          </Source>
        )}
      </MapGL>

      {/* Address overlay */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2.5 shadow-sm border border-gray-100">
        <p className="text-sm font-medium text-gray-900">{address}</p>
        <p className="text-xs text-gray-500">{postal_code} {city}</p>
      </div>

      {/* ── Controls top-left ── */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 z-[5]">
        {/* Commute calculator */}
        <button
          onClick={() => { setShowCommute(v => !v); if (showCommute) clearCommute() }}
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
      </div>

      {/* ── Commute panel ── */}
      {showCommute && (
        <div className="absolute top-3 right-14 z-[5] w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-900">Temps de trajet</span>
              <button onClick={() => { setShowCommute(false); clearCommute() }} className="text-gray-500 hover:text-gray-600 cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Profile pills */}
            <div className="flex gap-1 mb-2">
              {(['driving', 'walking', 'cycling'] as const).map(p => {
                const Icon = PROFILE_ICONS[p]
                return (
                  <button
                    key={p}
                    onClick={() => setCommuteProfile(p)}
                    className={cn(
                      'flex-1 h-7 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer',
                      commuteProfile === p ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {{ driving: 'Voiture', walking: 'À pied', cycling: 'Vélo' }[p]}
                  </button>
                )
              })}
            </div>

            {/* Address input */}
            <input
              type="text"
              value={commuteAddress}
              onChange={(e) => searchCommuteAddress(e.target.value)}
              placeholder="Adresse de votre lieu de travail..."
              className="w-full h-8 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          {/* Geocoding results */}
          {commuteResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto border-b border-gray-100">
              {commuteResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => fetchRoute(r.center)}
                  className="w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left cursor-pointer truncate"
                >
                  {r.place_name}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {commuteLoading && (
            <div className="p-3 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Calcul de l'itinéraire...
            </div>
          )}

          {/* Result */}
          {commuteDuration !== null && !commuteLoading && (
            <div className="p-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{commuteDuration}</span>
                <span className="text-xs text-gray-500">min</span>
                <span className="text-xs text-gray-500">· {commuteDistance} km</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {{ driving: 'En voiture', walking: 'À pied', cycling: 'À vélo' }[commuteProfile]}
                {commuteAddress && ` vers ${commuteAddress.split(',')[0]}`}
              </p>
              <button
                onClick={clearCommute}
                className="mt-2 w-full h-7 rounded-lg text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Effacer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
