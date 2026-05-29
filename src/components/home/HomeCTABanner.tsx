// MEGGA Homepage — CTA banner section (port 1:1 du proto megga-body.jsx).
// Bandeau dark gradient avec headline + sub + CTA, photo facade en background.

import { Link } from 'react-router-dom'
import { HOME_FONT, HOME_M } from './homeTokens'

const BG_PHOTO =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600&auto=format'

export default function HomeCTABanner() {
  return (
    <section
      style={{
        padding: '0 clamp(20px, 5vw, 80px) 80px',
        background: HOME_M.cream,
      }}
    >
      <div
        style={{
          height: 320,
          borderRadius: 24,
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #2a3528 0%, #1a1f17 100%)',
        }}
      >
        {/* Background photo */}
        <img
          src={BG_PHOTO}
          alt="Façade architecturale au crépuscule"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 55%',
          }}
          loading="lazy"
        />
        {/* Dark gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(14, 20, 16, 0.65) 0%, rgba(14, 20, 16, 0.4) 60%, rgba(14, 20, 16, 0.55) 100%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: 'clamp(28px, 4vw, 60px)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 32,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                fontFamily: HOME_FONT,
                fontSize: 'clamp(28px, 4vw, 48px)',
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.05,
                margin: 0,
                letterSpacing: -1.2,
              }}
            >
              Vendez votre bien sans tracas.
            </h2>
            <p
              style={{
                fontFamily: HOME_FONT,
                fontSize: 'clamp(14px, 1.4vw, 16px)',
                color: 'rgba(255,255,255,0.85)',
                marginTop: 12,
                margin: '12px 0 0',
              }}
            >
              Un agent local certifié · Mandat signé en ligne · Honoraires
              transparents
            </p>
          </div>
          <Link
            to="/sell"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              height: 56,
              padding: '0 28px',
              borderRadius: 999,
              background: HOME_M.ink,
              color: '#fff',
              textDecoration: 'none',
              fontFamily: HOME_FONT,
              fontSize: 15,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            Démarrer maintenant <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
