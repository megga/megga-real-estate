// Carte de localisation d'un bien — IMAGE STATIQUE Mapbox (une <img loading="lazy">,
// zéro instance WebGL) : se charge sur chaque annonce / match / fiche sans saturer le
// navigateur. Coords stockées d'abord (lat/lng du bien) ; géocodage de l'adresse en
// fallback rare. État vide honnête si pas de token ou pas de localisation résoluble —
// jamais de carte fausse. Générique (thème CRM Tailwind), réutilisable hors Atelier.

import { useEffect, useRef, useState } from 'react'
import MEIcon from '@/components/propertyx/MEIcon'
import { cn } from '@/lib/utils'
import { buildStaticMapUrl, geocodeAddress, validCoords } from '@/lib/mapbox'

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || ''

interface Props {
  lat: number | null | undefined
  lng: number | null | undefined
  /** Repli pour géocoder si lat/lng absents (biens sans coords stockées). */
  address?: string
  /** Texte de l'état vide (pas de localisation). */
  emptyHint?: string
  className?: string
}

export function PropertyStaticMap({ lat, lng, address = '', emptyHint = 'Localisation indisponible', className }: Props) {
  const [resolved, setResolved] = useState<[number, number] | null>(() => validCoords(lat ?? null, lng ?? null))
  const [imgFailed, setImgFailed] = useState(false)
  const addrRef = useRef(address)

  useEffect(() => {
    setImgFailed(false)
    const direct = validCoords(lat ?? null, lng ?? null)
    if (direct) {
      setResolved(direct)
      return
    }
    setResolved(null)
    if (!MAPBOX_TOKEN || !address) return
    addrRef.current = address
    const ctrl = new AbortController()
    void geocodeAddress(address, MAPBOX_TOKEN, ctrl.signal).then((center) => {
      if (center && addrRef.current === address) setResolved(center)
    })
    return () => ctrl.abort()
  }, [lat, lng, address])

  const showMap = Boolean(MAPBOX_TOKEN) && resolved != null && !imgFailed

  return (
    <div className={cn('relative w-full h-full overflow-hidden bg-theme-section', className)}>
      {showMap && resolved ? (
        <>
          <img
            src={buildStaticMapUrl(resolved[0], resolved[1], MAPBOX_TOKEN)}
            alt={address ? `Carte — ${address}` : 'Carte de localisation'}
            loading="lazy"
            draggable={false}
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute right-1.5 bottom-1.5 rounded bg-theme-card/80 px-1.5 py-0.5 text-[10px] text-theme-muted">
            © Mapbox · © OpenStreetMap
          </span>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center">
            <MEIcon name="location" className="mx-auto mb-1 h-6 w-6 text-theme-muted" />
            <p className="text-xs text-theme-muted">{emptyHint}</p>
          </div>
        </div>
      )}
    </div>
  )
}
