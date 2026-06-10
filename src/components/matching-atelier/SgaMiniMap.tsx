// Atelier Matching — mini-carte quartier (remplace le placeholder du handoff).
//
// Carte STATIQUE (Mapbox Static Images API) : une image, pas d'instance GL —
// non-interactive comme l'exige l'esprit « mini-carte », et zéro re-render à
// chaque sélection d'acheteur. Suit le thème (light-v11 / dark-v11), pin à
// l'accent (noir clair / blanc sombre).
//
// Coordonnées : lat/lng de la row si exploitables (toutes les market_listings),
// sinon géocodage de l'adresse à la volée (biens internes sans coords —
// même API que le wizard Step2Address). Placeholder rayé en dernier recours
// (pas de token, pas d'adresse résoluble) — jamais de carte fausse.
// Logique d'URL et validation des coords : ./mapUrl (pur, testé).

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import SgaIcon from './SgaIcon'
import { buildStaticMapUrl, validCoords } from './mapUrl'

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || ''

// Dédup process-wide des géocodages (clé = adresse). null = échec mémorisé
// (les erreurs transitoires ne re-tentent pas avant rechargement — compromis
// assumé pour une mini-carte). Les abandons (unmount / changement d'adresse)
// ne polluent PAS le cache.
const geocodeCache = new Map<string, [number, number] | null>()

async function geocode(address: string, signal: AbortSignal): Promise<[number, number] | null> {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json` +
      `?access_token=${MAPBOX_TOKEN}&country=ch&limit=1&language=fr`
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`geocode ${res.status}`)
    const json = (await res.json()) as { features?: Array<{ center?: [number, number] }> }
    const c = json.features?.[0]?.center // [lng, lat]
    const coords = c ? validCoords(c[1], c[0]) : null
    geocodeCache.set(address, coords)
    return coords
  } catch (e) {
    if ((e as Error).name === 'AbortError') return null
    geocodeCache.set(address, null)
    return null
  }
}

interface SgaMiniMapProps {
  lat: number | null
  lng: number | null
  address: string
  /** repli du placeholder (« mini-carte · quartier X ») */
  label: string
  dark: boolean
  className?: string
  style?: CSSProperties
}

export default function SgaMiniMap({ lat, lng, address, label, dark, className, style }: SgaMiniMapProps) {
  // Coords résolues : row directe (si exploitable), sinon géocodage de l'adresse.
  const [resolved, setResolved] = useState<[number, number] | null>(() => validCoords(lat, lng))
  const [imgFailed, setImgFailed] = useState(false)
  const addrRef = useRef(address)

  useEffect(() => {
    setImgFailed(false)
    const direct = validCoords(lat, lng)
    if (direct) {
      setResolved(direct)
      return
    }
    setResolved(null)
    if (!MAPBOX_TOKEN || !address) return
    addrRef.current = address
    const ctrl = new AbortController()
    void geocode(address, ctrl.signal).then(center => {
      // ignore les réponses obsolètes (l'annonce a changé entre-temps)
      if (center && addrRef.current === address) setResolved(center)
    })
    return () => ctrl.abort()
  }, [lat, lng, address])

  const showMap = Boolean(MAPBOX_TOKEN) && resolved != null && !imgFailed

  return (
    <div className={className} style={style}>
      {showMap && resolved ? (
        <>
          <img
            className="sga-map-img"
            src={buildStaticMapUrl(resolved[0], resolved[1], dark, MAPBOX_TOKEN)}
            alt={`Carte — ${address}`}
            loading="lazy"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
          <span className="sga-map-credit">© Mapbox · © OpenStreetMap</span>
        </>
      ) : (
        <div className="sga-ph">
          <div className="ph-lbl">
            <SgaIcon d="location" size={20} />
            <span>{label}</span>
          </div>
        </div>
      )}
    </div>
  )
}
