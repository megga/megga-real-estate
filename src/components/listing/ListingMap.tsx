import { useState } from 'react'
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'
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
  const [viewState, setViewState] = useState({
    latitude: lat || 46.2044,
    longitude: lng || 6.1432,
    zoom: 14,
  })

  if (!lat || !lng || !MAPBOX_TOKEN) {
    return (
      <div id="localisation" className="scroll-mt-28 w-full h-[350px] md:h-[400px] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500">{address}</p>
          <p className="text-xs text-gray-400">{postal_code} {city}</p>
        </div>
      </div>
    )
  }

  return (
    <div id="localisation" className="scroll-mt-28 w-full h-[350px] md:h-[450px] relative">
      <MapGL
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        reuseMaps
        attributionControl={false}
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
      </MapGL>

      {/* Address overlay */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2.5 shadow-sm border border-gray-100">
        <p className="text-sm font-medium text-gray-900">{address}</p>
        <p className="text-xs text-gray-500">{postal_code} {city}</p>
      </div>
    </div>
  )
}
