// MEGGA Marketplace — Property X hero section.
// Source : Figma node 11754:25560 (HeroSection) — code Figma exact.
//
// Structure fidèle :
//   <section pt-24 px-24>
//     <Container h-900 rounded-24 mb-[-56]>
//       <Background image + 6 POI pins + fade overlay>
//       <Top Content pt-80>
//         <H1 72/1.15/-3 w-613>
//         <Buttons Row pt-24 gap-16>
//           <PrimaryButton "Start exploring" />
//           <Link "Post properties" with chevron-right />
//         </Buttons Row>
//       </Top Content>
//     </Container>
//   </section>
//
// La SearchBar (Browser) suit dans PxSearchBar mais doit overlap -56.

import { PX, PxButton, PxIcon, PxFigmaIcon, PxLink } from '..'

// POI pins fidèles Figma : 55×55 pill + icon home 29px. Positions exactes.
const POI_PINS = [
  { rightOffset: 1302.09, top: 401.39 },
  { rightOffset:  918.09, top: 479.39 },
  { rightOffset: 1180.09, top: 663.39 },
  { rightOffset:  550.09, top: 588.39 },
  { rightOffset:  127.09, top: 671.39 },
  { rightOffset:   97.09, top: 475.39 },
] as const

function HomeMarker({ rightOffset, top }: { rightOffset: number; top: number }) {
  return (
    <div style={{
      position: 'absolute',
      // Figma "right: 1302.09px" relatif au coin droit du container 1392
      // → calculé en %, on a 1394 width donc rightOffset / 1394
      right: `${(rightOffset / 1394) * 100}%`,
      top: `${(top / 900) * 100}%`,
      width: 55,
      height: 55,
      borderRadius: PX.radius.pill,
      background: PX.neutral100,
      filter: 'drop-shadow(0px 2px 2px rgba(25, 33, 61, 0.08))',
      display: 'grid',
      placeItems: 'center',
    }}>
      <PxFigmaIcon name="home-poi" size={29} color={PX.neutral700} />
    </div>
  )
}

export default function PxHero() {
  return (
    <section style={{
      // Figma : pt-24 px-24 pb-0
      paddingTop: 24,
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: 0,
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Container : h-900, rounded-24
          Note : Figma a mb-[-56] mais comme la SearchBar est dans une
          section séparée, on gère l'overlap via marginTop -56 dans PxSearchBar */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: PX.containerDesktop - 48,  // 1392
        height: 900,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        background: PX.neutral700,
      }}>
        {/* Background image — full bleed 1394×909 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=2400&q=85")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />

        {/* Fade overlay top : 480px tall gradient sombre→transparent */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 480,
          background: 'linear-gradient(180deg, rgba(20,22,28,0.30) 0%, rgba(20,22,28,0) 100%)',
          pointerEvents: 'none',
        }} />

        {/* 6 POI pins aux positions Figma exactes */}
        {POI_PINS.map((pin, i) => (
          <HomeMarker key={i} rightOffset={pin.rightOffset} top={pin.top} />
        ))}

        {/* Top Content : pt-80, centered horizontally */}
        <div style={{
          position: 'relative',
          paddingTop: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {/* H1 : 72px / 1.10 (Display 10 fidèle Figma) / tracking -2.16 / weight 500
              Figma w-[613] (EN court) — pour FR plus long, on étend à 820 */}
          <h1 style={{
            margin: 0,
            maxWidth: 820,
            fontFamily: PX.font.display,
            fontSize: 72,
            lineHeight: 1.10,
            letterSpacing: '-2.16px',
            fontWeight: 500,
            textAlign: 'center',
            color: PX.neutral100,
          }}>
            Élevez votre style de vie avec MEGGA
          </h1>

          {/* Buttons Row : pt-24, gap-16, centered */}
          <div style={{
            paddingTop: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <PxButton to="/acheter" variant="primary" size="lg">
              Commencer
            </PxButton>
            <PxLink to="/publier" variant="light">
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: PX.neutral300,
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
              }}>
                Publier des biens
                <PxIcon name="chevron-right" size={16} color={PX.neutral300} />
              </span>
            </PxLink>
          </div>
        </div>
      </div>
    </section>
  )
}
