// MEGGA Marketplace — Property X "Single Property — Map" section.
//
// Carte Mapbox du bien (marker centré + zoom +/- + style navigation-day).
// Bouton "Ouvrir dans Google Maps" en fallback pour itinéraire externe.
//
// Affichée uniquement si lat + lng + token Mapbox dispos.
// Pour le scope Sprint 2 : carte simple. POI quartier, commute time
// et price overlay temporel viendront sur Sprint 3.

import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useTranslation } from 'react-i18next'
import { PX, PxIcon } from '..'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { ListingCardData } from '@/components/listings/ListingCard'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

interface Props {
  listing?: ListingCardData
}

export default function PxSinglePropertyMap({ listing }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  // Pas de listing, pas de coords, ou pas de token → on ne rend rien
  // (la section disparaît silencieusement pour les Flatfox listings sans
  // géoloc, plutôt que d'afficher un placeholder confus).
  if (!listing?.lat || !listing?.lng || !MAPBOX_TOKEN) return null

  const { lat, lng } = listing
  const address = [listing.address, listing.city].filter(Boolean).join(', ')
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

  return (
    <section style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      background: PX.pageBg,
      paddingTop: isMobile ? 32 : 64,
      paddingBottom: isMobile ? 32 : 64,
    }}>
      <div style={{
        width: isMobile ? 'calc(100% - 32px)' : 'min(1200px, calc(100% - 48px))',
        boxSizing: 'border-box',
      }}>
        {/* Header : title + open in Google Maps link */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <h2 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: isMobile ? 24 : 36,
            lineHeight: 1.25,
            letterSpacing: isMobile ? '-0.72px' : '-1.08px',
            color: PX.neutral700,
          }}>
            {t('marketplaceProperty.map.title')}
          </h2>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 14,
              lineHeight: 1.25,
              letterSpacing: '-0.4px',
              color: PX.neutral700,
            }}
          >
            <span style={{ paddingTop: 2 }}>{t('marketplaceProperty.map.openInMaps')}</span>
            <PxIcon name="external" size={14} color={PX.neutral700} />
          </a>
        </div>

        {/* Address text */}
        {address ? (
          <p style={{
            margin: 0,
            paddingBottom: 16,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
          }}>
            {address}
          </p>
        ) : null}

        {/* Map container */}
        <div style={{
          width: '100%',
          height: isMobile ? 320 : 460,
          borderRadius: PX.radius.large,
          overflow: 'hidden',
          background: PX.neutral200,
        }}>
          <MapGL
            initialViewState={{ longitude: lng, latitude: lat, zoom: 15 }}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/navigation-day-v1"
            style={{ width: '100%', height: '100%' }}
            reuseMaps
            attributionControl={false}
            dragRotate={false}
            touchPitch={false}
            maxPitch={0}
          >
            <Marker longitude={lng} latitude={lat} anchor="bottom">
              <MapPin />
            </Marker>
            <NavigationControl position="bottom-right" showCompass={false} />
          </MapGL>
        </div>
      </div>
    </section>
  )
}

// Marker custom Property X — pin rond avec ombre, taille adaptative.
function MapPin() {
  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: PX.neutral700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 16px rgba(20, 22, 28, 0.35)',
      border: `3px solid ${PX.neutral100}`,
    }}>
      <div style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: PX.neutral100,
      }} />
    </div>
  )
}
