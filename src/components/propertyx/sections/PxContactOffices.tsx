// MEGGA Marketplace — Property X "Contact V1 — Offices" section.
// Source : Figma node 11770:16459 — code Figma EXACT.
//
// Anatomie :
// - Section pt-80 pb-160, container 1198 centered
// - Top Content (1198 wide) : items-end justify-between
//   - Left : Badge "Our offices" + H2 "Come and visit our offices" 48 + Paragraph 16/1.5
//   - Right (button row pt-48) : Primary Button "Start exploring" 40h dark
// - Row Cards (gap 24) :
//   - Image Large (954×440 rounded-24) : photo office + gradient bottom-dark + overlay content :
//     - Title 30 white "San Francisco, CA" + paragraph white
//     - Details : location icon + address
//   - Image vertical (221×441 rounded-24) avec opacity 30

import { PX, PxFigmaIcon, PxButton } from '..'

function OfficesBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral300,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral400,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="location" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
        paddingTop: 2,
      }}>
        Our offices
      </span>
    </span>
  )
}

export default function PxContactOffices() {
  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 160,
      paddingLeft: 24,
      paddingRight: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 40,
      background: PX.pageBg,
    }}>
      {/* Top Content : 1198 wide, items-end justify-between */}
      <div style={{
        width: 1198,
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <OfficesBadge />
          <div style={{ paddingTop: 16 }}>
            <h2 style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 48,
              lineHeight: 1.25,
              letterSpacing: '-1.44px',
              color: PX.neutral700,
              whiteSpace: 'nowrap',
            }}>
              Come and visit our offices
            </h2>
          </div>
          <div style={{ paddingTop: 16 }}>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              maxWidth: 480,
            }}>
              Lorem ipsum dolor sit amet consectetur fermentum eget fringilla egestas a aliquam arcu arcu nunc pretium id.
            </p>
          </div>
        </div>
        <div style={{ paddingTop: 48, flexShrink: 0 }}>
          <PxButton variant="primary" size="sm">Start exploring</PxButton>
        </div>
      </div>

      {/* Row Cards */}
      <div style={{
        display: 'flex',
        gap: 24,
        alignItems: 'center',
        width: 1198,
        maxWidth: '100%',
      }}>
        {/* Image Large 954×440 */}
        <div style={{
          position: 'relative',
          width: 954,
          height: 440,
          borderRadius: PX.radius.large,
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <img
            src="/images/sections/contact/office-sf.jpg"
            alt="San Francisco office"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Gradient overlay (top transparent → bottom dark 80%) */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
          }} />
          {/* Content overlay : bottom-left */}
          <div style={{
            position: 'absolute',
            left: 30,
            bottom: 30,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxWidth: 469,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 30,
                lineHeight: 1.25,
                letterSpacing: '-0.9px',
                color: PX.neutral100,
              }}>
                San Francisco, CA
              </h3>
              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral100,
                maxWidth: 379,
              }}>
                Lorem ipsum dolor sit amet consectetur tellus eu enim ultrices imperdiet faucibus elementum.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PxFigmaIcon name="location" size={20} color={PX.neutral100} />
              <span style={{
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 16,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral100,
                paddingTop: 6,
              }}>
                58 Middle Point Rd, San Francisco, California (CA), 94124
              </span>
            </div>
          </div>
        </div>

        {/* Image Vertical 221×441, opacity 30 */}
        <div style={{
          position: 'relative',
          width: 221,
          height: 441,
          borderRadius: PX.radius.large,
          overflow: 'hidden',
          flexShrink: 0,
          opacity: 0.3,
        }}>
          <img
            src="/images/sections/contact/office-vertical.jpg"
            alt="Office workspace"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>
    </section>
  )
}
