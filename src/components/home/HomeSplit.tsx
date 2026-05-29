// MEGGA Homepage — Split section (port 1:1 du proto megga-body.jsx).
// 2-col headline + photo grid (intérieur + carte estimation + photo archi + price card).

import { Link } from 'react-router-dom'
import { HOME_FONT, HOME_M } from './homeTokens'

export default function HomeSplit() {
  return (
    <section
      style={{
        padding: '40px clamp(20px, 5vw, 80px) 80px',
        background: HOME_M.cream,
      }}
    >
      {/* Headline + intro */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 60,
          marginBottom: 40,
          alignItems: 'end',
        }}
      >
        <h2
          style={{
            fontFamily: HOME_FONT,
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 700,
            color: HOME_M.ink,
            lineHeight: 1.05,
            margin: 0,
            letterSpacing: -1.5,
          }}
        >
          Estimer votre bien,<br />en moins d’une minute.
        </h2>
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: HOME_M.section,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polygon points="6,4 16,10 6,16" fill={HOME_M.ink} />
            </svg>
          </div>
          <div
            style={{
              fontFamily: HOME_FONT,
              fontSize: 13,
              color: HOME_M.soft,
              maxWidth: 240,
              lineHeight: 1.5,
            }}
          >
            Une estimation IA en 60 secondes. Affinée par un agent local sous 24h
            si vous le souhaitez.
          </div>
        </div>
      </div>

      {/* Photo grid — 1.5fr / 0.9fr / 0.9fr */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 0.9fr) minmax(0, 0.9fr)',
          gap: 16,
        }}
      >
        {/* Big interior photo */}
        <PhotoCard
          h={420}
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format"
          alt="Intérieur lumineux"
          label="INTÉRIEUR"
        />

        {/* Estimation CTA card */}
        <div
          style={{
            background: HOME_M.section,
            borderRadius: 16,
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 420,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: HOME_FONT,
                fontSize: 22,
                fontWeight: 700,
                color: HOME_M.ink,
                lineHeight: 1.2,
              }}
            >
              Combien vaut votre bien aujourd’hui ?
            </div>
            <div
              style={{
                fontFamily: HOME_FONT,
                fontSize: 13,
                color: HOME_M.soft,
                lineHeight: 1.5,
                marginTop: 12,
              }}
            >
              Comparables récents, indice cantonal, biais d’emplacement —
              le tout sourcé et auditable.
            </div>
          </div>
          <Link
            to="/estimates"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-start',
              height: 40,
              padding: '0 18px',
              borderRadius: 999,
              background: HOME_M.ink,
              color: '#fff',
              textDecoration: 'none',
              fontFamily: HOME_FONT,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            /estimates <span>→</span>
          </Link>
        </div>

        {/* Right column: small photo + price card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PhotoCard
            h={260}
            src="https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&auto=format"
            alt="Bien architectural"
            label="ARCHI"
          />
          <div
            style={{
              background: HOME_M.card,
              border: `1px solid ${HOME_M.border}`,
              borderRadius: 16,
              padding: 18,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: HOME_FONT,
                fontSize: 11,
                fontWeight: 600,
                color: HOME_M.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Estimation moyenne · Genève
            </div>
            <div
              style={{
                fontFamily: HOME_FONT,
                fontSize: 24,
                fontWeight: 700,
                color: HOME_M.ink,
                marginTop: 4,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -0.4,
              }}
            >
              CHF 690’000
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

interface PhotoCardProps {
  h: number
  src: string
  alt: string
  label?: string
}

function PhotoCard({ h, src, alt, label }: PhotoCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        height: h,
        borderRadius: 16,
        overflow: 'hidden',
        background: HOME_M.section,
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
        loading="lazy"
      />
      {label && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 999,
            fontFamily: HOME_FONT,
            fontSize: 10,
            fontWeight: 700,
            color: HOME_M.ink,
            letterSpacing: 0.5,
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}
