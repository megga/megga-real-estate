// Matching · Recherche — carte Mapbox RÉELLE (react-map-gl/mapbox), chargée en lazy.
// Rendue UNIQUEMENT quand VITE_MAPBOX_TOKEN est présent ; sinon les consommateurs
// (MrhMapView / MrhExtDetail) gardent leur fond CSS. Isolée dans son propre module
// → mapbox-gl (~1,7 Mo) ne pèse sur le bundle QUE si l'utilisateur ouvre une carte.
//
// ⚠ Isolation lazy : n'importer 'mapbox-gl' / 'react-map-gl' QU'ICI (garde ESLint
// no-restricted-imports). Un import statique ailleurs ré-embarque 1,7 Mo dans le
// bundle principal.
//
// Le token est un `pk.*` public (côté client, injecté au build par GitHub Actions —
// `VITE_MAPBOX_TOKEN`), même mécanisme que l'étape adresse du wizard.
//
// ROBUSTESSE : `HAS_MAPBOX` (côté consommateur) ne teste que la PRÉSENCE du token,
// pas sa validité. Un token révoqué/expiré → mapbox émet un onError 401 (async, ne
// throw pas) ; un échec WebGL peut throw en synchrone. Les DEUX basculent sur le
// `fallback` (fond CSS) au lieu d'un écran blanc : onError → état `authFailed`,
// throw synchrone → `MapBoundary`.

import { Component, useState } from 'react'
import type { CSSProperties, ReactNode, ErrorInfo } from 'react'
import Map, { Marker, NavigationControl, type MarkerProps } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

// Interne : le token ne s'exporte pas (chaque surface lit VITE_MAPBOX_TOKEN elle-même ;
// dé-exporté aussi pour satisfaire react-refresh/only-export-components).
const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || ''

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
  /**
   * Coin des contrôles de zoom. À déplacer quand l'appelant pose lui-même un
   * bouton en haut à droite : `NavigationControl` et l'overlay s'empilent dans
   * le même contexte (z-index 2 des deux côtés) et le dernier de l'arbre gagne,
   * donc le bouton de l'appelant volerait les clics du zoom.
   */
  controlsPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  overlay?: ReactNode
  radius?: number
  interactive?: boolean
  /** Rendu de repli si la carte échoue (token invalide, WebGL perdu…) — pas d'écran blanc. */
  fallback?: ReactNode
}

// Boundary local : capte un throw SYNCHRONE de mapbox-gl (init WebGL, contexte perdu)
// et bascule sur le repli, au lieu de laisser remonter jusqu'à l'error boundary racine
// (qui blanchirait toute la page Recherche / la fiche).
class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[MrhMapbox] carte plantée → repli CSS', err.message, info.componentStack)
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// Distingue un échec d'AUTH (token invalide/expiré → jamais récupérable, on bascule)
// d'une erreur de tuile transitoire (mapbox retente seul → on log seulement).
function isAuthError(e: unknown): boolean {
  const err = (e as { error?: { status?: number; message?: string } })?.error
  return err?.status === 401 || err?.status === 403 || /\b40[13]\b|unauthorized|access token|not authorized/i.test(err?.message ?? '')
}

export default function MrhMapbox({ markers, bounds, center, dark, controls, controlsPosition = 'top-right', overlay, radius = 20, interactive = true, fallback }: Props) {
  const [authFailed, setAuthFailed] = useState(false)
  const mapStyle = dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'
  const initialViewState = bounds
    ? { bounds, fitBoundsOptions: { padding: 44, maxZoom: 15 } }
    : center
      ? { longitude: center.lng, latitude: center.lat, zoom: center.zoom ?? 14 }
      : { longitude: 8.23, latitude: 46.82, zoom: 7 } // repli : centre Suisse

  const wrap: CSSProperties = { position: 'relative', width: '100%', height: '100%', borderRadius: radius, overflow: 'hidden' }

  // Token présent mais invalide/révoqué → repli CSS (si fourni).
  if (authFailed && fallback) return <div style={wrap}>{fallback}{overlay}</div>

  const inner = (
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
        onError={(e) => {
          const err = (e as unknown as { error?: { message?: string } })?.error
          console.error('[MrhMapbox] onError', err?.message ?? e)
          if (fallback && isAuthError(e)) setAuthFailed(true)
        }}
      >
        {controls && <NavigationControl position={controlsPosition} showCompass={false} />}
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

  // Un throw synchrone (WebGL) est capté par MapBoundary → repli CSS.
  return fallback ? <MapBoundary fallback={<div style={wrap}>{fallback}{overlay}</div>}>{inner}</MapBoundary> : inner
}
