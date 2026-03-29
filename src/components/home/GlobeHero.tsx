import { useEffect, useRef, useState } from 'react'
import MapGL, { type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// Switzerland coordinates
const SWISS_CENTER: [number, number] = [8.2275, 46.8182]

interface GlobeHeroProps {
  className?: string
  children?: React.ReactNode
}

/**
 * Cinematic globe-to-Switzerland zoom animation as a hero background.
 * Starts from a globe view and smoothly zooms into Switzerland.
 */
export default function GlobeHero({ className, children }: GlobeHeroProps) {
  const mapRef = useRef<MapRef>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!loaded) return
    const map = mapRef.current?.getMap()
    if (!map) return

    // Start the cinematic zoom after a brief pause
    const timer = setTimeout(() => {
      map.flyTo({
        center: SWISS_CENTER,
        zoom: 7.5,
        pitch: 50,
        bearing: 20,
        duration: 6000,
        essential: true,
      })
    }, 800)

    return () => clearTimeout(timer)
  }, [loaded])

  if (!MAPBOX_TOKEN) return <div className={className}>{children}</div>

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="absolute inset-0">
        <MapGL
          ref={mapRef}
          initialViewState={{
            longitude: SWISS_CENTER[0],
            latitude: 20,
            zoom: 1.5,
            pitch: 0,
            bearing: 0,
          }}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/standard"
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
          interactive={false}
          projection={{ name: 'globe' }}
          fog={{
            color: 'rgb(186, 210, 235)',
            'high-color': 'rgb(36, 92, 223)',
            'horizon-blend': 0.02,
            'space-color': 'rgb(11, 11, 25)',
            'star-intensity': 0.6,
          }}
          onLoad={() => setLoaded(true)}
          reuseMaps
        />
      </div>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60 z-[1]" />

      {/* Content overlay */}
      <div className="relative z-[2]">
        {children}
      </div>
    </div>
  )
}
