// MEGGA Pro — Testimonial Gregory (autorité agent) + bandeau agences pilotes.
// Section DARK full-bleed.

import { PX, PxAvatar, PxFigmaIcon } from '../..'
import type { PxAvatarSize } from '../..'
import { useProFadeIn } from './useProFadeIn'
import { useBreakpoint, isMobile, isDesktop } from './useBreakpoint'
import PxProBadge from './PxProBadge'

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

export default function PxProTestimonial() {
  const bp = useBreakpoint()
  const mobile = isMobile(bp)
  const desktop = isDesktop(bp)
  const stack = !desktop
  const avatarSize: PxAvatarSize = mobile ? 120 : desktop ? 200 : 160

  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const quoteRef = useProFadeIn<HTMLDivElement>(120)
  const authorRef = useProFadeIn<HTMLDivElement>(240)
  const pilotsRef = useProFadeIn<HTMLDivElement>(360)

  return (
    <section style={{
      paddingTop: mobile ? 16 : 24,
      paddingLeft: mobile ? 12 : 24,
      paddingRight: mobile ? 12 : 24,
      paddingBottom: mobile ? 16 : 24,
      background: PX.pageBg,
    }}>
      <div style={{
        background: PX.inkBg,
        borderRadius: PX.radius.large,
        paddingTop: mobile ? 56 : desktop ? 96 : 72,
        paddingBottom: mobile ? 56 : desktop ? 96 : 72,
        paddingLeft: mobile ? 24 : desktop ? 64 : 40,
        paddingRight: mobile ? 24 : desktop ? 64 : 40,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'relative',
          maxWidth: 1100,
          margin: '0 auto',
          display: stack ? 'flex' : 'grid',
          flexDirection: stack ? 'column' : undefined,
          gridTemplateColumns: stack ? undefined : 'auto minmax(0, 1fr)',
          gap: stack ? 32 : 56,
          alignItems: stack ? 'flex-start' : 'center',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: stack ? 'flex-start' : 'center',
            gap: 16,
          }}>
            <div style={{
              position: 'relative',
            }}>
              <PxAvatar size={avatarSize} src="https://i.pravatar.cc/400?img=68" alt="Gregory Lyonnet" />
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
                <PxFigmaIcon name="check" size={20} color={PX.neutral700} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 20 : 28 }}>
            <div ref={labelRef}>
              <PxProBadge icon="badge-testimonials-message" invert>Témoignage</PxProBadge>
            </div>

            <div ref={quoteRef}>
              <p style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: mobile ? 22 : desktop ? 30 : 26,
                fontWeight: 500,
                lineHeight: 1.3,
                letterSpacing: mobile ? '-0.66px' : '-0.9px',
                color: PX.inkInverse,
                maxWidth: 720,
              }}>
                « J'ai conçu MEGGA pour mon propre quotidien. Le KYC me prenait des heures,
                les relances tombaient en oubli, mon vendeur ne savait jamais où en était
                son bien. Aujourd'hui, je gagne deux soirées par semaine — et mes vendeurs
                me trouvent transparent. »
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
