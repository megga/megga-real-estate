// MEGGA Marketplace — Property X "Single Property — Map" section.
//
// Carte Mapbox centrée sur le bien avec un marker à l'adresse exacte.
// Affichée entre PxSinglePropertyBody et PxSinglePropertyEnergy. Conditionnel :
// rendu seulement si lat/lng sont présents ET token Mapbox dispo.
//
// Design : carte 420px desktop / 320px mobile dans une card PX (radius large,
// shadow small). Pas de POI ni scores — minimal volontaire (voir audit `/listing`
// vs `/propriete`). NavigationControl pour zoom in/out, scrollZoom désactivé
// pour ne pas hijacker le scroll de la page.

import { useTranslation } from 'react-i18next'
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { PX, PxFigmaIcon } from '..'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { ListingCardData } from '@/components/listings/ListingCard'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

interface Props {
  listing?: ListingCardData
}

export default function PxSinglePropertyMap({ listing }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  if (!listing?.lat || !listing?.lng || !MAPBOX_TOKEN) return null

  const addressLine = [listing.address, listing.city].filter(Boolean).join(', ')

  return (
    <section style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      background: PX.pageBg,
      paddingTop: isMobile ? 32 : 48,
      paddingBottom: isMobile ? 32 : 48,
    }}>
      <div style={{
        width: isMobile ? 'calc(100% - 32px)' : 'min(1200px, calc(100% - 48px))',
        boxSizing: 'border-box',
      }}>
        <div style={{
          background: PX.neutral100,
          borderRadius: PX.radius.large,
          boxShadow: PX.shadow.small,
          overflow: 'hidden',
        }}>
          <div style={{ padding: isMobile ? '20px 24px 16px' : '32px 40px 20px' }}>
            <h2 style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: isMobile ? 24 : 32,
              lineHeight: 1.25,
              letterSpacing: isMobile ? '-0.72px' : '-0.96px',
              color: PX.neutral700,
            }}>
              {t('marketplaceProperty.map.title')}
            </h2>
            {addressLine ? (
              <p style={{
                margin: '8px 0 0',
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.4px',
                color: PX.neutral500,
              }}>
                {addressLine}
              </p>
            ) : null}
          </div>
          <div style={{
            width: '100%',
            height: isMobile ? 320 : 420,
            position: 'relative',
          }}>
            <MapGL
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: listing.lng,
                latitude: listing.lat,
                zoom: 14.5,
              }}
              mapStyle="mapbox://styles/mapbox/navigation-day-v1"
              attributionControl={false}
              scrollZoom={false}
              dragRotate={false}
              touchZoomRotate={false}
              style={{ width: '100%', height: '100%' }}
            >
              <Marker longitude={listing.lng} latitude={listing.lat} anchor="bottom">
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: PX.neutral700,
                  border: '3px solid #FFFFFF',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: 'translate(0, 8px)',
                }}>
                  <PxFigmaIcon name="home-simple" size={18} color={PX.neutral100} />
                </div>
              </Marker>
              <NavigationControl position="top-right" showCompass={false} />
            </MapGL>
          </div>
        </div>
      </div>
    </section>
  )
}
