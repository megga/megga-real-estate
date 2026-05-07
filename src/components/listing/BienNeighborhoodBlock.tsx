// MEGGA — Bien neighborhood block (port 1:1 du proto megga-bien-features.jsx).
// Card wrapper + SectionTitle "Le quartier" + variant "scores" (éditorial) ou
// "map" (Leaflet OSM via Carto CDN tiles, no API key needed).
//
// Variant "map" (default): grid 1fr 320px — carte 380px à gauche + liste
// d'amenities groupées par catégorie (transit/school/shop/park/sport) à droite.
//
// Variant "scores": tiles Marchabilité/Transports/Calme + bloc "Le mot de
// MEGGA" + liste compacte 2-col des amenities.

import { useEffect, useRef, useState, type ReactNode } from 'react'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  green: '#0041D9',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

type NearbyKind = 'school' | 'transit' | 'shop' | 'park' | 'sport'

export interface NearbyItem {
  kind: NearbyKind
  name: string
  distMin: number
}

interface BienForBlock {
  id?: string | null
  title: string
  neighborhood: string
  type?: string | null
  view?: string | null
  addr?: string | null
  lat?: number | null
  lng?: number | null
  nearby: NearbyItem[]
}

// ─── Icon meta (port proto KIND_META) ────────────────────────────────────

const KIND_META: Record<NearbyKind, { label: string; icon: ReactNode }> = {
  school: {
    label: 'Écoles',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M7 2l6 3-6 3-6-3 6-3z M3 6v3l4 2 4-2V6" />
      </svg>
    ),
  },
  transit: {
    label: 'Transports',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="2" width="8" height="9" rx="1.5" />
        <circle cx="5" cy="9" r="0.8" />
        <circle cx="9" cy="9" r="0.8" />
        <path d="M3 6h8 M5 11l-1 1 M9 11l1 1" />
      </svg>
    ),
  },
  shop: {
    label: 'Commerces',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 5h10l-1 7H3z M5 5V3a2 2 0 014 0v2" />
      </svg>
    ),
  },
  park: {
    label: 'Espaces verts',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M7 2c2 2 3 4 3 5a3 3 0 11-6 0c0-1 1-3 3-5z M7 10v3" />
      </svg>
    ),
  },
  sport: {
    label: 'Sport',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="7" cy="7" r="5" />
        <path d="M2 7h10 M7 2v10 M3 3l8 8 M11 3l-8 8" />
      </svg>
    ),
  },
}

const KIND_COLOR: Record<NearbyKind, string> = {
  transit: '#3D5AFE',
  school: '#0041D9',
  shop: '#7B5CFF',
  park: '#1F8A4F',
  sport: '#0E1410',
}

const KIND_ORDER: NearbyKind[] = ['transit', 'school', 'shop', 'park', 'sport']

// ─── Score computation (port proto computeScores) ───────────────────────

function computeScores(bien: BienForBlock) {
  const nb = bien.nearby || []
  const minBy = (kind: NearbyKind) => {
    const items = nb.filter(n => n.kind === kind)
    return items.length ? Math.min(...items.map(n => n.distMin)) : null
  }
  const countBy = (kind: NearbyKind) => nb.filter(n => n.kind === kind).length

  const dShop = minBy('shop') ?? 20
  const dPark = minBy('park') ?? 20
  const dSchool = minBy('school') ?? 20
  const walkRaw = 100 - (dShop * 2.4 + dPark * 1.6 + dSchool * 1.4)
  const walk = Math.max(35, Math.min(99, Math.round(walkRaw + countBy('shop') * 2)))

  const dTransit = minBy('transit') ?? 20
  const transitRaw = 100 - dTransit * 6
  const transit = Math.max(40, Math.min(99, Math.round(transitRaw + countBy('transit') * 4)))

  const isVilla = bien.type === 'maison' || bien.type === 'villa' || bien.type === 'chalet'
  const view = bien.view || 'city'
  const calmBase = isVilla ? 82 : view === 'lake' ? 74 : view === 'green' ? 86 : view === 'mountain' ? 90 : 64
  const calm = Math.max(45, Math.min(98, calmBase + (dTransit > 6 ? 6 : 0) - (countBy('shop') > 2 ? 4 : 0)))

  return { walk, transit, calm }
}

function scoreLabel(kind: 'walk' | 'transit' | 'calm', score: number): string {
  if (kind === 'walk') {
    if (score >= 90) return 'Paradis du piéton'
    if (score >= 75) return 'Très praticable'
    if (score >= 60) return 'Praticable'
    return 'Voiture utile'
  }
  if (kind === 'transit') {
    if (score >= 85) return 'Excellent réseau'
    if (score >= 70) return 'Bon réseau'
    if (score >= 55) return 'Correct'
    return 'Limité'
  }
  if (kind === 'calm') {
    if (score >= 85) return 'Très calme'
    if (score >= 70) return 'Calme'
    if (score >= 55) return 'Vivant'
    return 'Animé'
  }
  return ''
}

function buildEditorial(bien: BienForBlock): string {
  const nb = bien.nearby || []
  const transit = nb.find(n => n.kind === 'transit')
  const shopCount = nb.filter(n => n.kind === 'shop').length
  const park = nb.find(n => n.kind === 'park')
  const school = nb.find(n => n.kind === 'school')
  const parts: string[] = []
  if (transit) {
    const transitName = transit.name.split(' — ')[0]
    const lowered = transitName.charAt(0).toLowerCase() + transitName.slice(1)
    parts.push(`le ${lowered} à ${transit.distMin} min à pied`)
  }
  if (shopCount >= 2) parts.push(`${shopCount} commerces dans un rayon de 500 m`)
  if (park) parts.push(`${park.name} à ${park.distMin} min`)
  if (school && parts.length < 3) parts.push(`${school.name} à ${school.distMin} min`)
  const intro = bien.type === 'maison' || bien.type === 'villa' || bien.type === 'chalet'
    ? `Quartier résidentiel de ${bien.neighborhood}` : `Au cœur de ${bien.neighborhood}`
  return `${intro} ${parts.join(', ')}.`
}

// ─── Variant A: Editorial scores ────────────────────────────────────────

interface ScoreTileProps {
  value: number
  label: string
  kind: 'walk' | 'transit' | 'calm'
  accent: string
}

function ScoreTile({ value, label, kind, accent }: ScoreTileProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 14,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 700,
          color: M.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 44,
            fontWeight: 800,
            color: M.ink,
            lineHeight: 1,
            letterSpacing: -1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: M.muted }}>/100</span>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: accent, marginTop: 4 }}>
        {scoreLabel(kind, value)}
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: '#EEF1F6',
          marginTop: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${value}%`,
            background: accent,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  )
}

function EditorialScores({ bien }: { bien: BienForBlock }) {
  const { walk, transit, calm } = computeScores(bien)
  const editorial = buildEditorial(bien)
  const grouped: Partial<Record<NearbyKind, NearbyItem[]>> = {}
  ;(bien.nearby || []).forEach(n => {
    if (!grouped[n.kind]) grouped[n.kind] = []
    grouped[n.kind]!.push(n)
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <ScoreTile value={walk} label="Marchabilité" kind="walk" accent="#0041D9" />
        <ScoreTile value={transit} label="Transports" kind="transit" accent="#3D5AFE" />
        <ScoreTile value={calm} label="Calme" kind="calm" accent="#1F8A4F" />
      </div>

      <div
        style={{
          padding: '18px 22px',
          borderLeft: `3px solid #0041D9`,
          background: '#F6F8FC',
          borderRadius: '0 10px 10px 0',
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            color: '#0041D9',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 6,
          }}
        >
          Le mot de MEGGA
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 15,
            lineHeight: 1.55,
            color: M.ink,
            fontWeight: 500,
          }}
        >
          {editorial}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 32px' }}>
        {KIND_ORDER.map(k => {
          const items = grouped[k]
          if (!items) return null
          const meta = KIND_META[k]
          return (
            <div key={k}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#0041D9' }}>
                {meta.icon}
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 11,
                    fontWeight: 700,
                    color: M.ink,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  {meta.label}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      paddingLeft: 22,
                      gap: 12,
                      fontFamily: FONT,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: M.soft,
                        fontWeight: 500,
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {it.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: M.muted,
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {it.distMin} min
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Variant C: Real Leaflet map ────────────────────────────────────────

// Minimal Leaflet types — we load it dynamically from unpkg.
type LeafletGlobal = {
  map: (el: HTMLElement, opts: Record<string, unknown>) => LeafletMap
  tileLayer: (url: string, opts: Record<string, unknown>) => { addTo: (m: LeafletMap) => void }
  marker: (
    latLng: [number, number],
    opts?: Record<string, unknown>,
  ) => {
    addTo: (m: LeafletMap) => { bindPopup: (html: string) => unknown }
  }
  divIcon: (opts: Record<string, unknown>) => unknown
}
type LeafletMap = { remove: () => void }

declare global {
  interface Window {
    L?: LeafletGlobal
  }
}

function useLeaflet() {
  const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.L)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.L) {
      setReady(true)
      return
    }
    if (document.getElementById('leaflet-css')) return
    const css = document.createElement('link')
    css.id = 'leaflet-css'
    css.rel = 'stylesheet'
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
    css.crossOrigin = ''
    document.head.appendChild(css)
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
    s.crossOrigin = ''
    s.onload = () => setReady(true)
    document.head.appendChild(s)
  }, [])
  return ready
}

function RealMap({ bien }: { bien: BienForBlock }) {
  const ready = useLeaflet()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return
    const L = window.L
    if (!L) return
    const lat = bien.lat || 46.2
    const lng = bien.lng || 6.15

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    const bienIcon = L.divIcon({
      className: 'megga-bien-pin',
      html: `<div style="position:relative;width:36px;height:46px;">
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:999px;background:#0041D9;opacity:0.18;"></div>
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:999px;background:#0041D9;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,65,217,0.35);display:flex;align-items:center;justify-content:center;">
          <div style="width:8px;height:8px;border-radius:999px;background:#fff;"></div>
        </div>
      </div>`,
      iconSize: [36, 46],
      iconAnchor: [18, 23],
    })
    L.marker([lat, lng], { icon: bienIcon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(
        `<div style="font-family:Manrope,sans-serif;font-weight:700;color:#0E1410;">${bien.title}</div><div style="font-family:Manrope,sans-serif;font-size:12px;color:#5A615C;">${bien.addr || ''}</div>`,
      )

    const nb = bien.nearby || []
    nb.forEach((n, i) => {
      const angle = (i / Math.max(nb.length, 1)) * Math.PI * 2 + 0.5
      const distM = (n.distMin || 5) * 75 + (i % 3) * 35
      const dLat = (distM / 111000) * Math.cos(angle)
      const dLng = (distM / (111000 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle)
      const pLat = lat + dLat
      const pLng = lng + dLng
      const color = KIND_COLOR[n.kind] || '#5A615C'
      const icon = L.divIcon({
        className: 'megga-amenity-pin',
        html: `<div style="width:18px;height:18px;border-radius:999px;background:#fff;border:2px solid ${color};box-shadow:0 2px 6px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;">
          <div style="width:6px;height:6px;border-radius:999px;background:${color};"></div>
        </div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      L.marker([pLat, pLng], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:700;">${n.name}</div><div style="font-family:Manrope,sans-serif;font-size:12px;color:#5A615C;">${n.distMin} min à pied</div>`,
        )
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [ready, bien.id, bien.lat, bien.lng, bien.nearby, bien.title, bien.addr])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 380,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${M.border}`,
        background: '#EEF1F6',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!ready && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT,
            fontSize: 13,
            color: M.muted,
          }}
        >
          Chargement de la carte…
        </div>
      )}
    </div>
  )
}

function RealMapVariant({ bien }: { bien: BienForBlock }) {
  const grouped: Partial<Record<NearbyKind, NearbyItem[]>> = {}
  ;(bien.nearby || []).forEach(n => {
    if (!grouped[n.kind]) grouped[n.kind] = []
    grouped[n.kind]!.push(n)
  })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
      <RealMap bien={bien} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxHeight: 380,
          overflowY: 'auto',
          paddingRight: 4,
        }}
      >
        {KIND_ORDER.map(k => {
          const items = grouped[k]
          if (!items) return null
          const meta = KIND_META[k]
          return (
            <div key={k}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  color: KIND_COLOR[k],
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: KIND_COLOR[k],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 11,
                    fontWeight: 700,
                    color: M.ink,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  {meta.label}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      paddingLeft: 18,
                      gap: 12,
                      fontFamily: FONT,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: M.soft,
                        fontWeight: 500,
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {it.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: M.muted,
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {it.distMin} min
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Wrapper (port proto NeighborhoodBlock) ──────────────────────────────

interface BienNeighborhoodBlockProps {
  neighborhood: string
  /** "scores" éditorial OR "map" Leaflet — proto default = "map" */
  variant?: 'scores' | 'map'
  bienId?: string | null
  title?: string
  type?: string | null
  view?: string | null
  addr?: string | null
  lat?: number | null
  lng?: number | null
  nearby?: NearbyItem[]
}

export default function BienNeighborhoodBlock({
  neighborhood,
  variant = 'map',
  bienId,
  title = '',
  type,
  view,
  addr,
  lat,
  lng,
  nearby,
}: BienNeighborhoodBlockProps) {
  // Default nearby data when not provided — proto fixture-style
  const safeNearby: NearbyItem[] = nearby && nearby.length > 0 ? nearby : [
    { kind: 'transit', name: 'Transports publics', distMin: 5 },
    { kind: 'transit', name: 'Bus / tram à proximité', distMin: 7 },
    { kind: 'school', name: 'École primaire', distMin: 6 },
    { kind: 'school', name: 'Collège', distMin: 9 },
    { kind: 'shop', name: 'Migros', distMin: 5 },
    { kind: 'shop', name: 'Coop', distMin: 7 },
    { kind: 'shop', name: 'Boulangerie', distMin: 4 },
    { kind: 'park', name: 'Espace vert', distMin: 8 },
    { kind: 'sport', name: 'Centre sportif', distMin: 10 },
  ]

  const bien: BienForBlock = {
    id: bienId,
    title,
    neighborhood,
    type: type ?? null,
    view: view ?? null,
    addr: addr ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
    nearby: safeNearby,
  }

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
      {variant === 'map' ? <RealMapVariant bien={bien} /> : <EditorialScores bien={bien} />}
    </div>
  )
}
