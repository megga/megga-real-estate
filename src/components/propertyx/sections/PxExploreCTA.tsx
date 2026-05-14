// MEGGA Marketplace — Property X "Explore CTA" section CTA/V3.
// Source : Figma node 11754:25966 — code Figma exact.
//
// Structure fidèle :
//   <CTA/V3 relative size-full>
//     <Container dark : absolute right-24, w-1394, top-50% translateY,
//                       bg-neutral700, px-120 py-160, rounded-24,
//                       flex items-start justify-end>
//       <Content (placé à droite via justify-end)>
//         <Badge "Get in touch" dark : bg-neutral600 + cercle bg-neutral500>
//         <H2 48 Display/8 w-447>
//         <Paragraph 16/1.5 neutral400 w-480>
//         <Button "Start exploring" WHITE bg + dark circle arrow>
//       </Content>
//     </Container>
//     <iPad absolute right-732, w-851 h-613 :
//       - Bezel iPad Pro 11
//       - Screen avec photos + property details + form>
//   </CTA/V3>

import { PX, PxButton, PxFigmaIcon } from '..'

// Badge "Get in touch" — fidèle Figma 11754:25966 : bg-neutral600 + cercle bg-neutral500 + STAR icon
function GetInTouchBadge() {
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
      }}>Get in touch</span>
    </span>
  )
}

export default function PxExploreCTA() {
  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 80,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.neutral100,
    }}>
      <div style={{
        position: 'relative',
        maxWidth: 1392,
        margin: '0 auto',
        minHeight: 624,  // Figma section height
      }}>
        {/* Container DARK : bg-neutral700, FULL WIDTH 1392 (parent maxWidth),
            padding 120 horizontal, 160 vertical, rounded-24, content aligned
            à droite via justify-end. L'iPad flotte par-dessus (zIndex 2). */}
        <div style={{
          background: PX.neutral700,
          width: '100%',
          paddingLeft: 120,
          paddingRight: 120,
          paddingTop: 160,
          paddingBottom: 160,
          borderRadius: PX.radius.large,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box',
        }}>
          {/* Content placé à droite */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}>
            {/* Title Wrapper */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}>
              <GetInTouchBadge />
              {/* Title : pt-16, 48 Display/8/Medium tracking-1.44, w-447 */}
              <h2 style={{
                margin: 0,
                paddingTop: 16,
                width: 447,
                fontFamily: PX.font.display,
                fontSize: 48,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-1.44px',
                color: PX.neutral100,
              }}>
                Explore your dream home today
              </h2>
            </div>
            {/* Paragraph : pt-16, 16/1.5 neutral400 (pas neutral100 sur dark!),
                w-480 — texte EXACT Figma 11754:25966 */}
            <p style={{
              margin: 0,
              paddingTop: 16,
              width: 480,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
            }}>
              Lorem ipsum dolor sit amet consectetur. Volutpat et lacinia sit
              aenean consequat. Id tellus eget libero eget non odio tristique.
            </p>
            {/* Button row : pt-24 — WHITE bg "Start exploring" */}
            <div style={{
              paddingTop: 24,
            }}>
              <PxButton to="/acheter" variant="invert" size="lg">
                Start exploring
              </PxButton>
            </div>
          </div>
        </div>

        {/* iPad mockup : rendu Figma node 11748:15191 utilisé tel quel (PNG)
            → fidélité pixel-perfect garantie sans recréer le contenu en React.
            Dimensions Figma 1852×1335 → ratio 1.388:1, scalé à w-870 h-627 */}
        <div style={{
          position: 'absolute',
          left: -189,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 870,
          height: 627,
          zIndex: 2,
        }}>
          <img
            src="/images/sections/cta/ipad-property.png"
            alt="Property X iPad preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 24px rgba(25, 33, 61, 0.12))',
            }}
          />
        </div>
      </div>
    </section>
  )
}
