// Matching · Recherche — carte Mapbox RÉELLE (react-map-gl/mapbox), chargée en lazy.
// Rendue UNIQUEMENT quand VITE_MAPBOX_TOKEN est présent ; sinon les consommateurs
// (MrhMapView / MrhExtDetail) gardent leur fond CSS. Isolée dans son propre module
// → mapbox-gl (~1,5 Mo) ne pèse sur le bundle QUE si l'utilisateur ouvre une carte.
//
// Le token est un `pk.*` public (côté client, injecté au build par GitHub Actions —
// `VITE_MAPBOX_TOKEN`), même mécanisme que l'étape adresse du wizard.

import type { CSSProperties, ReactNode } from 'react'
import Map, { Marker, NavigationControl, type MarkerProps } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || ''

export interface MrhMarker {
  id: string
  lng: number
  lat: number
  el: ReactNode
  anchor?: MarkerProps['anchor']
  z?: number
  onClick?: () => void
  onEnter?: () => void
  onLeave?: () => void
}

interface Props {
  markers: MrhMarker[]
  /** cadre initial : [[minLng, minLat], [maxLng, maxLat]] */
  bounds?: [[number, number], [number, number]] | null
  /** ou centre unique (fiche détail = 1 pin) */
  center?: { lng: number; lat: number; zoom?: number } | null
  dark: boolean
  controls?: boolean
  overlay?: ReactNode
  radius?: number
  interactive?: boolean
}

export default function MrhMapbox({ markers, bounds, center, dark, controls, overlay, radius = 20, interactive = true }: Props) {
  const mapStyle = dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'
  const initialViewState = bounds
    ? { bounds, fitBoundsOptions: { padding: 44, maxZoom: 15 } }
    : center
      ? { longitude: center.lng, latitude: center.lat, zoom: center.zoom ?? 14 }
      : { longitude: 8.23, latitude: 46.82, zoom: 7 } // repli : centre Suisse

  const wrap: CSSProperties = { position: 'relative', width: '100%', height: '100%', borderRadius: radius, overflow: 'hidden' }
  return (
    <div style={wrap}>
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        interactive={interactive}
        dragRotate={false}
        pitchWithRotate={false}
        touchZoomRotate={false}
        reuseMaps
      >
        {controls && <NavigationControl position="top-right" showCompass={false} />}
        {markers.map((mk) => (
          <Marker key={mk.id} longitude={mk.lng} latitude={mk.lat} anchor={mk.anchor ?? 'center'} style={{ zIndex: mk.z ?? 1 }}>
            <div
              onMouseEnter={mk.onEnter}
              onMouseLeave={mk.onLeave}
              onClick={mk.onClick ? (e) => { e.stopPropagation(); mk.onClick!() } : undefined}
              style={{ cursor: mk.onClick ? 'pointer' : 'default' }}
            >
              {mk.el}
            </div>
          </Marker>
        ))}
      </Map>
      {overlay}
    </div>
  )
}
