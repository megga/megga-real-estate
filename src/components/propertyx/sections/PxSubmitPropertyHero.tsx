// MEGGA Marketplace — Property X "Submit Property" hero (dark).
// Source : Figma node 9552:21463 sous-frame "Hero Section" (11781:18521).
// Structure : container 1392×593.7 rounded-24 bg-neutral700, badge "Post a
// free property" (check icon circle) + title 72 white center 600.5 wide +
// paragraph 16 neutral400 center 562 wide.

import { PX } from '..'

export default function PxSubmitPropertyHero() {
  return (
    <section style={{
      width: '100%',
      maxWidth: PX.containerDesktop,
      margin: '0 auto',
      paddingLeft: 24,
      paddingRight: 24,
      position: 'relative',
      zIndex: 1,
    }}>
      {/* Container : 1392×593.7 rounded-24 bg-neutral700, flex-col items-center pt-72 */}
      <div style={{
        width: '100%',
        height: 593.727,
        background: PX.neutral700,
        borderRadius: PX.radius.large,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 72,
        overflow: 'hidden',
      }}>
        {/* Title Wrapper : w-600.5, flex-col items-center, h-220 */}
        <div style={{
          width: 600.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          {/* Badge "Post a free property" : pill avec icône check à gauche
              206×38 — bg neutral600 (légèrement plus clair que le hero) */}
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
            color: PX.neutral100,
            flexShrink: 0,
          }}>
            {/* Inner circle 26×26 avec check icon blanc */}
            <span style={{
              width: 26,
              height: 26,
              borderRadius: PX.radius.pill,
              background: PX.neutral500,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.2l2.5 2.5L9.5 3.7"
                  stroke={PX.neutral100}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {/* Text "Post a free property" : 16/Medium white lh-1.25 ls-0.48 */}
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              whiteSpace: 'nowrap',
            }}>
              Post a free property
            </span>
          </span>

          {/* Frame 1000007651 : w-600.5 h-182, paddingTop-16 = pt-Sections/PD Extra Small */}
          <div style={{
            paddingTop: 16,
            width: 600.5,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {/* Heading H1 : 72 Medium white lh-1.15 ls-2.16 center w-600.5 h-166 */}
            <h1 style={{
              margin: 0,
              width: 600.5,
              fontFamily: PX.font.display,
              fontSize: 72,
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: '-2.16px',
              color: PX.neutral100,
              textAlign: 'center',
            }}>
              Post a property for sale or rent
            </h1>
          </div>
        </div>

        {/* Paragraph wrapper : w-562 h-96, pt-16 */}
        <div style={{
          paddingTop: 16,
          width: 562.047,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {/* Paragraph Default : 16/Regular neutral400 lh-1.5 ls-0.48 center w-562 h-48 */}
          <p style={{
            margin: 0,
            width: 562.047,
            height: 48,
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral400,
            textAlign: 'center',
          }}>
            Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti. Metus in eu vel morbi dui nunc tellus. Non a massa maecenas massa.
          </p>
        </div>
      </div>
    </section>
  )
}
