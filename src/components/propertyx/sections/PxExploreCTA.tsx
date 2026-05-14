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

import { PX, PxButton, PxIcon, PxFigmaIcon, PxLogo } from '..'

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

// iPad screen content — positionné dans les inset Figma exact du bezel iPad
function IPadScreen() {
  return (
    <div style={{
      position: 'absolute',
      inset: '5.09% 3.56% 5.02% 3.67%',
      background: PX.neutral200,
      borderRadius: 18,
      overflow: 'hidden',
      zIndex: 2,
    }}>
      {/* Status bar simplifiée tout en haut */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 31,
        right: 31,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 8,
        color: PX.neutral700,
        fontFamily: PX.font.display,
      }}>
        <span>9:41</span>
        <span>100%</span>
      </div>

      {/* Logo "Property X" en haut à gauche (fidèle maquette) */}
      <div style={{
        position: 'absolute',
        top: 32,
        left: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: PX.font.display,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.39px',
        color: PX.neutral700,
      }}>
        <PxFigmaIcon name="home-poi" size={16} color={PX.neutral700} />
        Property X
      </div>

      {/* 3-dot menu top-right circle (Figma exact) */}
      <div style={{
        position: 'absolute',
        top: 28,
        right: 15,
        width: 35,
        height: 35,
        borderRadius: PX.radius.pill,
        background: PX.neutral100,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}>
        <span style={{ width: 4, height: 4, borderRadius: 99, background: PX.neutral700 }} />
        <span style={{ width: 4, height: 4, borderRadius: 99, background: PX.neutral700 }} />
        <span style={{ width: 4, height: 4, borderRadius: 99, background: PX.neutral700 }} />
      </div>

      {/* Search bar pill "Choose your location" centré en haut */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 238,
        background: PX.neutral200,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.pill,
        paddingLeft: 10,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 31,
      }}>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 9.5,
          color: PX.neutral500,
        }}>Choose your location</span>
        <span style={{
          width: 23,
          height: 23,
          borderRadius: PX.radius.pill,
          background: PX.neutral700,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}>
          <PxIcon name="search" size={11} color={PX.neutral100} />
        </span>
      </div>

      {/* Zone photos (1 grande + 4 small grid) — proportions Figma exactes */}
      <div style={{
        position: 'absolute',
        top: 75,
        left: 10,
        right: 10,
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 5,
        height: 220,
      }}>
        <div style={{
          gridRow: 'span 2',
          borderRadius: 6,
          backgroundImage: `url("https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=85")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div style={{
          borderRadius: 6,
          backgroundImage: `url("https://images.unsplash.com/photo-1600210492493-0946911123ea?w=600&q=80")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div style={{
          borderRadius: 6,
          backgroundImage: `url("https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&q=80")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div style={{
          borderRadius: 6,
          backgroundImage: `url("https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&q=80")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div style={{
          borderRadius: 6,
          backgroundImage: `url("https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600&q=80")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}>
          {/* White circle button avec icône grid/menu — fidèle Figma 11805:14015 */}
          <span style={{
            position: 'absolute',
            bottom: 5,
            right: 5,
            width: 22,
            height: 22,
            borderRadius: PX.radius.pill,
            background: PX.neutral100,
            display: 'grid',
            placeItems: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <rect x="1.5" y="1.5" width="3.5" height="3.5" rx="0.5" fill={PX.neutral700} />
              <rect x="7" y="1.5" width="3.5" height="3.5" rx="0.5" fill={PX.neutral700} />
              <rect x="1.5" y="7" width="3.5" height="3.5" rx="0.5" fill={PX.neutral700} />
              <rect x="7" y="7" width="3.5" height="3.5" rx="0.5" fill={PX.neutral700} />
            </svg>
          </span>
        </div>
      </div>

      {/* Bottom : Property details left + Contact agent middle + Form panel right
          Layout 3 zones fidèle Figma 11805:13902 */}
      <div style={{
        position: 'absolute',
        top: 310,
        left: 10,
        right: 10,
        display: 'grid',
        gridTemplateColumns: '1.4fr auto 1fr',
        gap: 14,
        alignItems: 'start',
      }}>
        {/* LEFT : address + title + description + stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: PX.font.display,
            fontSize: 11,
            fontWeight: 500,
            color: PX.neutral700,
          }}>
            <PxFigmaIcon name="location" size={13} color={PX.neutral700} />
            2238 Stradella Rd, SF
          </div>
          <div style={{
            fontFamily: PX.font.display,
            fontSize: 17,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.51px',
            color: PX.neutral700,
          }}>
            Luxury Loft in San Francisco
          </div>
          <p style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 11,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.33px',
            color: PX.neutral500,
          }}>
            Sem egestas elit pretium turpis eu quis tristique phasellus pellentesque elementum pharetra iaculis metus pretium viverra tortor faucibus.
          </p>

          {/* Stats row */}
          <div style={{
            marginTop: 4,
            display: 'flex',
            gap: 14,
            fontFamily: PX.font.display,
            fontSize: 11,
            color: PX.neutral400,
            fontWeight: 500,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PxFigmaIcon name="surface" size={14} color={PX.neutral400} /> 2,553 sqtf
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PxFigmaIcon name="bed" size={14} color={PX.neutral400} /> 3
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PxFigmaIcon name="bath" size={14} color={PX.neutral400} /> 2
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PxFigmaIcon name="parking" size={14} color={PX.neutral400} /> 3
            </span>
          </div>
        </div>

        {/* MIDDLE : "Contact agent ›" link (Figma exact 11805:13930) */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          paddingTop: 26,
          fontFamily: PX.font.display,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '-0.3px',
          color: PX.neutral700,
          whiteSpace: 'nowrap',
        }}>
          Contact agent
          <PxIcon name="chevron-right" size={9} color={PX.neutral700} />
        </div>

        {/* RIGHT : Price + form panel (Figma 11805:13904 — white card overlap) */}
        <div style={{
          background: PX.neutral100,
          borderRadius: 10,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxShadow: PX.shadow.small,
        }}>
          <div style={{
            fontFamily: PX.font.display,
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: '-0.51px',
            color: PX.neutral700,
          }}>$ 8,495,000 USD</div>
          <div style={{
            fontFamily: PX.font.display,
            fontSize: 11,
            fontWeight: 500,
            color: PX.neutral500,
          }}>Property for sale</div>
          <div style={{
            height: 1,
            background: PX.neutral300,
            marginTop: 4,
            marginBottom: 4,
          }} />
          <div style={{
            fontFamily: PX.font.display,
            fontSize: 11,
            fontWeight: 500,
            color: PX.neutral700,
            marginBottom: 2,
          }}>Get in touch to receive more info</div>
          {/* 3 input fields pill bg-neutral200 — Figma exact */}
          {['Full name', 'Email address', 'Email address'].map((ph, i) => (
            <div key={i} style={{
              background: PX.neutral200,
              borderRadius: PX.radius.pill,
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 9,
              paddingBottom: 9,
              fontFamily: PX.font.display,
              fontSize: 10,
              color: PX.neutral500,
              display: 'flex',
              alignItems: 'center',
            }}>{ph}</div>
          ))}
        </div>
      </div>
    </div>
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
        {/* Container DARK : bg-neutral700, padding 120 horizontal, 160 vertical,
            rounded-24, content aligned RIGHT */}
        <div style={{
          background: PX.neutral700,
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

        {/* iPad mockup : Figma exact — w-851 h-614, extends 189px hors bento à gauche
            (Figma right: 732 from container w-1394 → x=-189 → 851 width) */}
        <div style={{
          position: 'absolute',
          left: -189,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 851,
          height: 614,
          zIndex: 2,
        }}>
          {/* Vrai cadre iPad Pro 11 Space Gray (PNG officiel Figma) en background */}
          <img
            src="/images/devices/ipad-pro-11.png"
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          {/* Écran iPad par-dessus le bezel — positionné dans les inset Figma */}
          <IPadScreen />
        </div>
      </div>
    </section>
  )
}
