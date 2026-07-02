// Atelier Matching — mini-carte quartier (remplace le placeholder du handoff).
//
// Carte STATIQUE (Mapbox Static Images API) : une image, pas d'instance GL —
// non-interactive comme l'exige l'esprit « mini-carte », et zéro re-render à
// chaque sélection d'acheteur. Style streets-v12 (couleur) dans les deux
// thèmes — la carte est du contenu, comme les photos ; pin noir d'accent.
//
// Coordonnées : lat/lng de la row si exploitables (toutes les market_listings),
// sinon géocodage de l'adresse à la volée (biens internes sans coords —
// même API que le wizard Step2Address). Placeholder rayé en dernier recours
// (pas de token, pas d'adresse résoluble) — jamais de carte fausse.
// Logique d'URL et validation des coords : ./mapUrl (pur, testé).

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import SgaIcon from './SgaIcon'
import { buildStaticMapUrl, geocodeAddress, validCoords } from '@/lib/mapbox'

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || ''

interface SgaMiniMapProps {
  lat: number | null
  lng: number | null
  address: string
  /** repli du placeholder (« mini-carte · quartier X ») */
  label: string
  className?: string
  style?: CSSProperties
}

export default function SgaMiniMap({ lat, lng, address, label, className, style }: SgaMiniMapProps) {
  const { t } = useTranslation('matching')
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
    void geocodeAddress(address, MAPBOX_TOKEN, ctrl.signal).then(center => {
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
            src={buildStaticMapUrl(resolved[0], resolved[1], MAPBOX_TOKEN)}
            alt={t('atelier.mapAlt', { address })}
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
