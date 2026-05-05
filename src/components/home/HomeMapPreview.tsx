// MEGGA Homepage — Map preview section (port 1:1 du proto megga-body.jsx).
// 2-col headline + stylised SVG map with pins + price chip + zoom controls.

import { Link } from 'react-router-dom'
import { HOME_FONT, HOME_M } from './homeTokens'

const PINS = [
  [180, 120],
  [380, 90],
  [560, 230],
  [640, 130],
  [280, 290],
  [490, 60],
] as const

const BLOCKS = [
  [60, 40, 80, 40],
  [170, 150, 70, 30],
  [300, 60, 90, 40],
  [460, 210, 80, 30],
  [600, 60, 90, 50],
  [680, 210, 60, 40],
] as const

export default function HomeMapPreview() {
  return (
    <section
      style={{
        padding: '40px clamp(20px, 5vw, 80px) 80px',
        background: HOME_M.cream,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.4fr)',
          gap: 60,
          alignItems: 'center',
        }}
      >
        {/* Left — headline + CTA */}
        <div>
          <h2
            style={{
              fontFamily: HOME_FONT,
              fontSize: 'clamp(32px, 4.5vw, 48px)',
              fontWeight: 700,
              color: HOME_M.ink,
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: -1.2,
            }}
          >
            Trouvez votre bien<br />sur la carte.
          </h2>
          <p
            style={{
              fontFamily: HOME_FONT,
              fontSize: 14,
              color: HOME_M.soft,
              lineHeight: 1.6,
              maxWidth: 360,
              marginTop: 16,
            }}
          >
            Carte interactive Mapbox avec 33’000+ biens en temps réel. Filtres
            par prix, type, surface, écoles à proximité, transports.
          </p>
          <Link
            to="/louer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 24,
              height: 46,
              padding: '0 22px',
              borderRadius: 999,
              background: HOME_M.ink,
              color: '#fff',
              textDecoration: 'none',
              fontFamily: HOME_FONT,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Explorer la carte <span>→</span>
          </Link>
        </div>

        {/* Right — stylised map */}
        <div
          style={{
            height: 380,
            borderRadius: 20,
            overflow: 'hidden',
            position: 'relative',
            background: '#e8ece4',
            border: `1px solid ${HOME_M.border}`,
            filter: 'saturate(0.6)',
          }}
        >
          <svg
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            viewBox="0 0 800 380"
            style={{ display: 'block' }}
          >
            <rect width="800" height="380" fill="#e8ece4" />
            {/* Roads */}
            <path
              d="M0 110 Q 200 80 400 130 T 800 100"
              stroke="#c0c8b8"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M0 260 Q 160 290 360 270 T 800 290"
              stroke="#c0c8b8"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M180 0 Q 200 180 250 380"
              stroke="#d0d4ca"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M540 0 Q 560 180 600 380"
              stroke="#d0d4ca"
              strokeWidth="2"
              fill="none"
            />
            {/* Lake */}
            <path
              d="M280 180 Q 360 160 440 180 Q 480 220 420 250 Q 340 270 290 240 Z"
              fill="#cdd5c8"
              stroke="#b8c0b0"
            />
            {/* Blocks */}
            {BLOCKS.map(([x, y, w, h], i) => (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                fill="#d8dccf"
                stroke="#c0c8b8"
                rx="4"
              />
            ))}
            {/* Greenery */}
            <circle cx="120" cy="280" r="18" fill="#c8d2bc" />
            <circle cx="700" cy="120" r="22" fill="#c8d2bc" />
          </svg>

          {/* Pins overlay */}
          {PINS.map(([x, y], i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${(x / 800) * 100}%`,
                top: `${(y / 380) * 100}%`,
              }}
            >
              <svg width="28" height="36">
                <path
                  d="M14 0 C 6 0 0 6 0 14 C 0 24 14 36 14 36 C 14 36 28 24 28 14 C 28 6 22 0 14 0 Z"
                  fill={HOME_M.ink}
                />
                <circle cx="14" cy="14" r="5" fill={HOME_M.green} />
              </svg>
            </div>
          ))}

          {/* Featured pin with price */}
          <div
            style={{
              position: 'absolute',
              left: '42%',
              top: '30%',
              background: '#fff',
              borderRadius: 999,
              padding: '6px 14px',
              fontFamily: HOME_FONT,
              fontSize: 13,
              fontWeight: 700,
              color: HOME_M.ink,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              border: `2px solid ${HOME_M.green}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            CHF 1.2M
          </div>

          {/* Zoom controls */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {['+', '−'].map(s => (
              <div
                key={s}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: HOME_FONT,
                  fontSize: 18,
                  fontWeight: 600,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
