// MEGGA Marketplace — Property X "Single Property — CTA/V1" section.
// Source : Figma node 11781:16361 / 11748:17471 (CTA/V1 master) — code Figma EXACT.
//
// Anatomie :
// - Section : padding 24 horizontal, 0 vertical, bg pageBg blanc
// - Container DARK : bg-neutral700 (#14161C), height 544, rounded 24, px-48,
//   max-width 1392, flex items-center justify-between
// - LEFT "Image Wrapper" 700×524 : iPad rotated -10deg (bezel + property card
//   mockup). Asset PNG isolé Figma (transparent bg).
//   • Le PNG est centré dans le wrapper avec width 821 (bbox bbox de la
//     rotation), bleed ~60px chaque côté DANS le bento dark (donc reste
//     visuellement dans la bento sauf sur 12px à gauche en bord viewport).
// - RIGHT "Content" w-480, flex-col gap-32 :
//   - Badge "Get in touch" bg-neutral600 + circle 26px neutral500 + star icon
//   - H2 48 white "Explore your\ndream home today"
//   - Paragraph 16/1.5 neutral400
//   - PxButton INVERT bg-white "Start exploring" + dark circle arrow

import { useTranslation } from 'react-i18next'
import { PX, PxButton, PxFigmaIcon } from '..'
import { useIsMobile } from '@/hooks/useMediaQuery'

function GetInTouchBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral600,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral500,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-featured-star" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral100,
        paddingTop: 2,
      }}>
        {label}
      </span>
    </span>
  )
}

export default function PxSinglePropertyCTA() {
  const isMobile = useIsMobile()
  const { t } = useTranslation()
  return (
    <section style={{
      paddingLeft: isMobile ? 16 : 24,
      paddingRight: isMobile ? 16 : 24,
      paddingTop: 0,
      paddingBottom: 0,
      background: PX.pageBg,
    }}>
      <div style={{
        background: PX.neutral700,
        height: isMobile ? 'auto' : 544,
        maxWidth: 1392,
        margin: '0 auto',
        borderRadius: PX.radius.large,
        paddingLeft: isMobile ? 24 : 48,
        paddingRight: isMobile ? 24 : 48,
        paddingTop: isMobile ? 40 : 0,
        paddingBottom: isMobile ? 40 : 0,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        gap: isMobile ? 32 : 24,
        boxSizing: 'border-box',
        position: 'relative',
      }}>
        {/* LEFT — iPad PNG. Caché sur mobile pour économiser de l'espace. */}
        {!isMobile && (
          <div style={{
            width: 700,
            height: 524,
            position: 'relative',
            flexShrink: 0,
          }}>
            <img
              src="/images/sections/single-property/cta-ipad-iso.png"
              alt={t('marketplaceProperty.cta.imageAlt')}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 821,
                height: 'auto',
                maxWidth: 'none',
                display: 'block',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        {/* RIGHT — Content */}
        <div style={{
          width: isMobile ? '100%' : 480,
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 24 : 32,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', width: '100%' }}>
            <GetInTouchBadge label={t('marketplaceProperty.cta.badge')} />
            <h2 style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: isMobile ? 32 : 48,
              lineHeight: 1.25,
              letterSpacing: isMobile ? '-0.96px' : '-1.44px',
              color: PX.neutral100,
            }}>
              {t('marketplaceProperty.cta.title')}
            </h2>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
            }}>
              {t('marketplaceProperty.cta.subtitle')}
            </p>
          </div>

          <PxButton variant="invert" size="sm">
            {t('marketplaceProperty.cta.button')}
          </PxButton>
        </div>
      </div>
    </section>
  )
}
