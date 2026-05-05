// MEGGA Homepage — Regions section (port 1:1 du proto megga-regions.jsx).
// Carte Suisse stylisée 7 régions BFS + cartes liste à droite.
// Hover/click sur une région → highlight croisé carte ↔ card.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HOME_FONT, HOME_M } from './homeTokens'

interface Region {
  id: string
  name: string
  cities: string
  listings: number
  d: string
  label: { x: number; y: number }
}

const REGIONS: Region[] = [
  {
    id: 'lemanique',
    name: 'Lémanique',
    cities: 'Genève · Lausanne · Sion',
    listings: 412,
    d: 'M 60 380 L 90 340 L 140 320 L 180 305 L 220 295 L 260 305 L 300 330 L 340 360 L 360 400 L 380 430 L 360 470 L 320 490 L 270 495 L 210 480 L 160 460 L 110 430 Z',
    label: { x: 200, y: 400 },
  },
  {
    id: 'mittelland',
    name: 'Espace Mittelland',
    cities: 'Berne · Fribourg · Neuchâtel',
    listings: 528,
    d: 'M 220 295 L 260 270 L 320 250 L 380 245 L 430 250 L 470 270 L 480 310 L 470 350 L 440 380 L 400 400 L 360 400 L 340 360 L 300 330 L 260 305 Z',
    label: { x: 360, y: 320 },
  },
  {
    id: 'nordwest',
    name: 'Nord-Ouest',
    cities: 'Bâle · Aarau',
    listings: 287,
    d: 'M 380 245 L 420 200 L 480 180 L 540 185 L 580 210 L 590 245 L 560 275 L 520 285 L 470 270 L 430 250 Z',
    label: { x: 490, y: 230 },
  },
  {
    id: 'zurich',
    name: 'Zurich',
    cities: 'Zurich · Winterthour',
    listings: 619,
    d: 'M 580 210 L 620 200 L 670 205 L 700 230 L 715 270 L 690 300 L 640 305 L 600 290 L 590 245 Z',
    label: { x: 645, y: 250 },
  },
  {
    id: 'zentralschweiz',
    name: 'Suisse centrale',
    cities: 'Lucerne · Zoug · Schwyz',
    listings: 341,
    d: 'M 470 350 L 480 310 L 520 285 L 560 275 L 600 290 L 640 305 L 660 345 L 640 385 L 600 410 L 550 415 L 510 405 L 480 390 Z',
    label: { x: 565, y: 350 },
  },
  {
    id: 'ostschweiz',
    name: 'Suisse orientale',
    cities: 'Saint-Gall · Coire · Glaris',
    listings: 392,
    d: 'M 670 205 L 730 195 L 800 195 L 860 215 L 900 250 L 920 300 L 900 360 L 860 410 L 810 440 L 760 440 L 710 410 L 680 370 L 660 345 L 690 300 L 715 270 L 700 230 Z',
    label: { x: 800, y: 320 },
  },
  {
    id: 'ticino',
    name: 'Tessin',
    cities: 'Lugano · Bellinzone · Locarno',
    listings: 178,
    d: 'M 600 410 L 640 385 L 660 345 L 680 370 L 710 410 L 700 450 L 680 490 L 650 510 L 620 490 L 605 450 Z',
    label: { x: 655, y: 450 },
  },
]

export default function HomeRegions() {
  const [active, setActive] = useState<string | null>(null)

  return (
    <section
      style={{
        padding: '100px clamp(20px, 5vw, 80px)',
        background: HOME_M.cream,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          justifyContent: 'space-between',
          gap: 40,
          marginBottom: 48,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: 640 }}>
          <h2
            style={{
              fontFamily: HOME_FONT,
              fontSize: 'clamp(36px, 5vw, 56px)',
              fontWeight: 700,
              color: HOME_M.ink,
              lineHeight: 1.0,
              margin: 0,
              letterSpacing: -1.6,
            }}
          >
            Explorez<br />par région.
          </h2>
          <p
            style={{
              fontFamily: HOME_FONT,
              fontSize: 15,
              color: HOME_M.soft,
              lineHeight: 1.6,
              marginTop: 18,
              maxWidth: 520,
            }}
          >
            Les 7 régions économiques suisses · Survolez la carte pour voir les
            biens disponibles dans chaque région · 33’000+ annonces actives.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 40,
          alignItems: 'stretch',
        }}
      >
        <SwissMap active={active} setActive={setActive} />

        {/* Region cards on the right */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'repeat(7, 1fr)',
            gap: 8,
          }}
        >
          {REGIONS.map((r, i) => {
            const isActive = active === r.id
            return (
              <Link
                key={r.id}
                to={`/louer?region=${r.id}`}
                onMouseEnter={() => setActive(r.id)}
                onMouseLeave={() => setActive(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: isActive ? HOME_M.ink : HOME_M.card,
                  color: isActive ? '#fff' : HOME_M.ink,
                  border: `1px solid ${isActive ? HOME_M.ink : HOME_M.border}`,
                  borderRadius: 14,
                  textDecoration: 'none',
                  fontFamily: HOME_FONT,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: isActive ? 'rgba(255,255,255,0.55)' : HOME_M.muted,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: 0.5,
                      minWidth: 22,
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        letterSpacing: -0.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        marginTop: 2,
                        color: isActive ? 'rgba(255,255,255,0.6)' : HOME_M.muted,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.cities}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: isActive ? '#fff' : HOME_M.ink,
                    }}
                  >
                    {r.listings}
                  </span>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: isActive ? 'rgba(255,255,255,0.15)' : HOME_M.section,
                      color: isActive ? '#fff' : HOME_M.ink,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 500,
                      transform: isActive ? 'translateX(2px)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

interface SwissMapProps {
  active: string | null
  setActive: (id: string | null) => void
}

function SwissMap({ active, setActive }: SwissMapProps) {
  return (
    <div
      style={{
        position: 'relative',
        background: '#f4eee0',
        border: `1px solid ${HOME_M.border}`,
        borderRadius: 24,
        overflow: 'hidden',
        aspectRatio: '1000 / 600',
        width: '100%',
      }}
    >
      <svg
        viewBox="0 0 1000 600"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          <pattern
            id="megga-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(0,0,0,0.04)"
              strokeWidth="1"
            />
          </pattern>
          <filter
            id="reg-shadow"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.18" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="1000" height="600" fill="url(#megga-grid)" />

        {/* Country outline */}
        <path
          d="M 60 380 L 90 340 L 140 320 L 180 305 L 220 295 L 260 270 L 320 250 L 380 245 L 420 200 L 480 180 L 540 185 L 580 210 L 620 200 L 670 205 L 730 195 L 800 195 L 860 215 L 900 250 L 920 300 L 900 360 L 860 410 L 810 440 L 760 440 L 710 410 L 700 450 L 680 490 L 650 510 L 620 490 L 605 450 L 600 410 L 550 415 L 510 405 L 480 390 L 440 380 L 400 400 L 380 430 L 360 470 L 320 490 L 270 495 L 210 480 L 160 460 L 110 430 Z"
          fill="rgba(255,255,255,0.4)"
          stroke="none"
        />

        {/* Regions */}
        {REGIONS.map(r => {
          const isActive = active === r.id
          return (
            <g
              key={r.id}
              onMouseEnter={() => setActive(r.id)}
              onMouseLeave={() => setActive(null)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={r.d}
                fill={isActive ? HOME_M.ink : 'rgba(255,255,255,0.85)'}
                stroke={isActive ? HOME_M.ink : 'rgba(0,0,0,0.18)'}
                strokeWidth={isActive ? 2 : 1}
                style={{ transition: 'fill 0.25s ease, stroke 0.25s ease' }}
                filter={isActive ? 'url(#reg-shadow)' : undefined}
              />
            </g>
          )
        })}

        {/* Lakes */}
        <ellipse cx="200" cy="395" rx="55" ry="14" fill="#cdd5c8" stroke="#b8c0b0" strokeWidth="1" />
        <ellipse cx="370" cy="320" rx="20" ry="8" fill="#cdd5c8" stroke="#b8c0b0" strokeWidth="1" />
        <ellipse cx="660" cy="270" rx="22" ry="9" fill="#cdd5c8" stroke="#b8c0b0" strokeWidth="1" />
        <ellipse cx="555" cy="335" rx="18" ry="7" fill="#cdd5c8" stroke="#b8c0b0" strokeWidth="1" />

        {/* Region labels with city dots */}
        {REGIONS.map(r => {
          const isActive = active === r.id
          return (
            <g key={r.id + '-label'} style={{ pointerEvents: 'none' }}>
              <circle
                cx={r.label.x}
                cy={r.label.y}
                r={isActive ? 5 : 3.5}
                fill={isActive ? '#fff' : HOME_M.ink}
                style={{ transition: 'all 0.2s ease' }}
              />
              <text
                x={r.label.x}
                y={r.label.y + 22}
                textAnchor="middle"
                style={{
                  fontFamily: HOME_FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  fill: isActive ? '#fff' : HOME_M.ink,
                  letterSpacing: -0.2,
                  transition: 'fill 0.2s ease',
                }}
              >
                {r.name}
              </text>
              <text
                x={r.label.x}
                y={r.label.y + 38}
                textAnchor="middle"
                style={{
                  fontFamily: HOME_FONT,
                  fontSize: 10,
                  fontWeight: 500,
                  fill: isActive ? 'rgba(255,255,255,0.7)' : HOME_M.muted,
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'fill 0.2s ease',
                }}
              >
                {r.listings} biens
              </text>
            </g>
          )
        })}

        {/* Compass */}
        <g transform="translate(60, 60)" style={{ pointerEvents: 'none' }}>
          <circle cx="0" cy="0" r="18" fill="#fff" stroke={HOME_M.border} strokeWidth="1" />
          <path d="M 0 -10 L 3 0 L 0 10 L -3 0 Z" fill={HOME_M.ink} />
          <text
            x="0"
            y="-13"
            textAnchor="middle"
            style={{ fontFamily: HOME_FONT, fontSize: 8, fontWeight: 700, fill: HOME_M.ink }}
          >
            N
          </text>
        </g>
      </svg>

      {/* Caption bottom-left */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 20,
          fontFamily: HOME_FONT,
          fontSize: 10,
          fontWeight: 500,
          color: HOME_M.muted,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        Confédération suisse · 7 régions
      </div>
    </div>
  )
}
