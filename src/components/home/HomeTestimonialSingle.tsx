// MEGGA Homepage — Single testimonial section (port 1:1 du proto megga-body.jsx).
// Card grise avec portrait rond gauche + quote + nom · ville à droite.

import { HOME_FONT, HOME_M } from './homeTokens'

const QUOTE =
  'MEGGA m’a permis de signer mon mandat depuis mon canapé un dimanche soir. ' +
  'L’estimation IA était à 2% de l’offre finale. Bluffant.'
const NAME = 'Camille Aebischer'
const LOCATION = 'Lausanne'
const PORTRAIT = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&auto=format'

export default function HomeTestimonialSingle() {
  return (
    <section
      style={{
        padding: '40px clamp(20px, 5vw, 80px) 80px',
        background: HOME_M.cream,
      }}
    >
      <div
        style={{
          background: HOME_M.section,
          borderRadius: 24,
          padding: 'clamp(40px, 5vw, 60px)',
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: 'clamp(28px, 4vw, 48px)',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 'clamp(140px, 16vw, 200px)',
            height: 'clamp(140px, 16vw, 200px)',
            borderRadius: 999,
            overflow: 'hidden',
            background: HOME_M.border,
            flexShrink: 0,
          }}
        >
          <img
            src={PORTRAIT}
            alt={NAME}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
            loading="lazy"
          />
        </div>

        <div>
          <svg
            width="40"
            height="28"
            style={{ marginBottom: 16, display: 'block' }}
          >
            <path
              d="M4 22 L4 14 Q 4 4 14 4 M22 22 L22 14 Q 22 4 32 4"
              stroke={HOME_M.ink}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              fontFamily: HOME_FONT,
              fontSize: 'clamp(18px, 2.5vw, 26px)',
              fontWeight: 600,
              color: HOME_M.ink,
              lineHeight: 1.4,
              letterSpacing: -0.3,
            }}
          >
            « {QUOTE} »
          </div>
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: HOME_FONT,
                fontSize: 14,
                fontWeight: 600,
                color: HOME_M.ink,
              }}
            >
              {NAME}
            </span>
            <span
              style={{
                fontFamily: HOME_FONT,
                fontSize: 13,
                color: HOME_M.muted,
              }}
            >
              · {LOCATION}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
