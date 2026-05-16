// MEGGA Pro — Testimonial Gregory (autorité agent) + bandeau agences pilotes.
// Section DARK full-bleed.

import { PX, PxSectionLabel, PxAvatar } from '../..'
import { useProFadeIn } from './useProFadeIn'

const PILOT_AGENCIES = [
  'Lyonnet Immobilier',
  'Vivendi Real Estate',
  'Helvetia Properties',
  'Riviera Patrimoine',
  'Léman Estate',
  'Champel Conseil',
  'Carouge & Co',
  'Genève Premium',
  'Suisse Habitat',
  'Romandie Real',
]

function QuoteMark() {
  return (
    <svg width="56" height="42" viewBox="0 0 56 42" fill="none" aria-hidden>
      <path
        d="M0 42V26.6c0-5.1.9-9.6 2.8-13.5C4.7 9.2 7.3 5.9 10.7 3.4 14 1.1 17.7 0 21.6 0v9.5c-3.4.7-6.2 2.4-8.3 5.1-2 2.6-3 6-3 10v.6h11V42H0Zm31 0V26.6c0-5.1.9-9.6 2.8-13.5C35.7 9.2 38.3 5.9 41.7 3.4 45 1.1 48.7 0 52.6 0v9.5c-3.4.7-6.2 2.4-8.3 5.1-2 2.6-3 6-3 10v.6h11V42H31Z"
        fill="rgba(255,255,255,0.16)"
      />
    </svg>
  )
}

export default function PxProTestimonial() {
  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const quoteRef = useProFadeIn<HTMLDivElement>(120)
  const authorRef = useProFadeIn<HTMLDivElement>(240)
  const pilotsRef = useProFadeIn<HTMLDivElement>(360)

  return (
    <section style={{
      paddingTop: 24,
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: 24,
      background: PX.pageBg,
    }}>
      <div style={{
        background: PX.inkBg,
        borderRadius: PX.radius.large,
        paddingTop: 96,
        paddingBottom: 96,
        paddingLeft: 64,
        paddingRight: 64,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle grid texture */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
            opacity: 0.4,
            pointerEvents: 'none',
          }}
        />

        <div style={{
          position: 'relative',
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: 56,
          alignItems: 'center',
        }}>
          {/* LEFT — Avatar */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              position: 'relative',
            }}>
              <PxAvatar size={200} src="https://i.pravatar.cc/400?img=68" alt="Gregory Lyonnet" />
              {/* Verified badge */}
              <div style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                width: 44,
                height: 44,
                borderRadius: PX.radius.pill,
                background: PX.inkInverse,
                display: 'grid',
                placeItems: 'center',
                boxShadow: PX.shadow.medium,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="m5 12 5 5L20 7"
                    stroke={PX.neutral700}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* RIGHT — Quote + author */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div ref={labelRef}>
              <PxSectionLabel icon="star" invert>Témoignage</PxSectionLabel>
            </div>

            <div ref={quoteRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <QuoteMark />
              <p style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 32,
                fontWeight: 500,
                lineHeight: 1.3,
                letterSpacing: '-1.2px',
                color: PX.inkInverse,
                maxWidth: 720,
              }}>
                J'ai conçu MEGGA pour mon propre quotidien. Le KYC me prenait des heures,
                les relances tombaient en oubli, mon vendeur ne savait jamais où en était
                son bien. Aujourd'hui, je gagne deux soirées par semaine — et mes vendeurs
                me trouvent transparent.
              </p>
            </div>

            <div
              ref={authorRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                paddingTop: 8,
                borderTop: `1px solid rgba(255,255,255,0.12)`,
              }}
            >
              <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{
                  fontFamily: PX.font.display,
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: '-0.54px',
                  color: PX.inkInverse,
                }}>
                  Gregory Lyonnet
                </span>
                <span style={{
                  fontFamily: PX.font.sans,
                  fontSize: 14,
                  fontWeight: 400,
                  letterSpacing: '-0.42px',
                  color: PX.inkInverseMuted,
                }}>
                  Fondateur · Agent immobilier indépendant · Genève
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pilot agencies marquee */}
        <div
          ref={pilotsRef}
          style={{
            position: 'relative',
            marginTop: 80,
            paddingTop: 32,
            borderTop: `1px solid rgba(255,255,255,0.10)`,
          }}
        >
          <div style={{
            textAlign: 'center',
            fontFamily: PX.font.sans,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '-0.4px',
            color: PX.inkInverseMuted,
            textTransform: 'uppercase',
            marginBottom: 32,
          }}>
            <span style={{ opacity: 0.7 }}>+ 10 agences pilotes en Suisse romande</span>
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 12,
          }}>
            {PILOT_AGENCIES.map(name => (
              <span
                key={name}
                style={{
                  padding: '8px 16px',
                  borderRadius: PX.radius.pill,
                  border: `1px solid rgba(255,255,255,0.12)`,
                  background: 'rgba(255,255,255,0.04)',
                  fontFamily: PX.font.display,
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: '-0.42px',
                  color: PX.inkInverseSoft,
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
