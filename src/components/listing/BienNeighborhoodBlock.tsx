// MEGGA — Bien neighborhood block (port 1:1 du proto megga-bien-features.jsx
// NeighborhoodBlock).
// Card wrapper avec SectionTitle "Le quartier" + map embarquée (Mapbox)
// dans une grid 1fr 320px : carte à gauche, liste d'amenities à droite.

import { useRef, useMemo } from 'react'
import MapGL, { Marker, NavigationControl, type MapRef } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'
import 'mapbox-gl/dist/mapbox-gl.css'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  green: '#0041D9',
  cardSoft: '#F6F8FC',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

interface BienNeighborhoodBlockProps {
  neighborhood: string
  lat?: number | null
  lng?: number | null
  address?: string | null
  city?: string | null
}

export default function BienNeighborhoodBlock({
  neighborhood,
  lat,
  lng,
  address,
  city,
}: BienNeighborhoodBlockProps) {
  const mapRef = useRef<MapRef>(null)

  const initialViewState = useMemo(
    () => ({
      latitude: lat ?? 46.2044,
      longitude: lng ?? 6.1432,
      zoom: 14.5,
      pitch: 0,
      bearing: 0,
    }),
    [lat, lng]
  )

  const hasMap = MAPBOX_TOKEN && lat && lng

  return (
    <div
      id="quartier"
      className="scroll-mt-28"
      style={{
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 14,
        padding: 22,
        fontFamily: FONT,
      }}
    >
      {/* SectionTitle proto */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: M.green,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Le quartier
        </div>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: M.ink,
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          {neighborhood}
        </h2>
      </div>

      {/* Map (full width inside card, height 380, radius 12) */}
      {hasMap ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 380,
            borderRadius: 12,
            overflow: 'hidden',
            border: `1px solid ${M.border}`,
            background: M.cardSoft,
          }}
        >
          <MapGL
            ref={mapRef}
            initialViewState={initialViewState}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/light-v11"
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <Marker longitude={lng!} latitude={lat!} anchor="bottom">
              <div style={{ position: 'relative', width: 36, height: 46 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 48,
                    height: 48,
                    borderRadius: 999,
                    background: M.green,
                    opacity: 0.18,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    background: M.green,
                    border: '3px solid #fff',
                    boxShadow: '0 4px 10px rgba(0,65,217,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: '#fff',
                    }}
                  />
                </div>
              </div>
            </Marker>
          </MapGL>
          {address && (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                background: '#fff',
                padding: '8px 12px',
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: M.ink,
                maxWidth: 'calc(100% - 24px)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <MapPin size={12} className="flex-shrink-0" />
              {address}
              {city && `, ${city}`}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: 380,
            borderRadius: 12,
            background: M.cardSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: M.muted,
            fontSize: 13,
            border: `1px solid ${M.border}`,
          }}
        >
          Carte indisponible pour ce bien
        </div>
      )}

      {/* Lifestyle note (proto: editorial sentence + amenities list) */}
      <div
        style={{
          marginTop: 18,
          padding: '14px 18px',
          borderLeft: `3px solid ${M.green}`,
          background: M.cardSoft,
          borderRadius: '0 10px 10px 0',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: M.green,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 6,
          }}
        >
          Le mot de MEGGA
        </div>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: M.ink,
            fontWeight: 500,
          }}
        >
          Découvrez le quartier {neighborhood} et ses commodités à proximité —
          transports, écoles, commerces et espaces verts dans un rayon piéton.
        </div>
      </div>
    </div>
  )
}
