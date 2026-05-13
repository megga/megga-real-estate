// MEGGA Marketplace — Property X hero section.
// Source : Figma node 11754:25560 ("Hero Section") :
//   - Outer padding 24px (container 1392×900 dans viewport 1440)
//   - Background image fills container with radius large (24)
//   - Top fade overlay 480px (top half)
//   - 6 POI pins (Logo frames 55×55) à positions exactes
//   - Top Content centered horizontally, H1 à 80px du top
//   - CTAs : Primary dark pill (172×40) + Link ghost (141×22)

import { PX, PxButton, PxIcon, PxLink } from '..'

interface MarkerProps { top: string; left: string }

function HomeMarker({ top, left }: MarkerProps) {
  // Pin size 55×55 d'après Figma (Logo frame), icône intérieure 29×29 (~52%)
  return (
    <div style={{
      position: 'absolute',
      top, left,
      width: 55, height: 55,
      borderRadius: PX.radius.pill,
      background: PX.neutral100,
      boxShadow: PX.shadow.regular,
      display: 'grid',
      placeItems: 'center',
      animation: 'px-pulse 2.6s ease-in-out infinite',
    }}>
      <PxIcon name="home" size={29} color={PX.neutral700} strokeWidth={1.6} />
    </div>
  )
}

export default function PxHero() {
  return (
    <section style={{
      position: 'relative',
      // 24px padding around (fidèle Figma container 1392 dans 1440)
      padding: '24px 24px 0',
      background: PX.neutral100,
    }}>
      <style>{`
        @keyframes px-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>

      <div style={{
        position: 'relative',
        maxWidth: PX.containerDesktop - 48,  // 1392
        margin: '0 auto',
        height: 900,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        backgroundImage: `url("https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=2400&q=85")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Fade overlay top — 480px du top, gradient sombre vers transparent en bas */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 480,
          background: 'linear-gradient(180deg, rgba(20,22,28,0.30) 0%, rgba(20,22,28,0) 100%)',
          pointerEvents: 'none',
        }} />

        {/* 6 POI pins — positions fidèles Figma (ratios sur 1392×900) */}
        <HomeMarker top="44.6%" left="2.5%"  />{/* x=34,  y=401 */}
        <HomeMarker top="53.3%" left="30.1%" />{/* x=419, y=479 */}
        <HomeMarker top="73.7%" left="11.3%" />{/* x=157, y=663 */}
        <HomeMarker top="65.4%" left="56.5%" />{/* x=787, y=588 */}
        <HomeMarker top="74.6%" left="86.9%" />{/* x=1210,y=671 */}
        <HomeMarker top="52.8%" left="89.1%" />{/* x=1240,y=475 */}

        {/* Top Content : centré horizontalement, ~80px depuis le top */}
        <div style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: PX.neutral100,
          width: '100%',
          // Figma 613 (anglais court). FR plus long → 820 pour casser sur 2 lignes.
          maxWidth: 820,
          padding: '0 24px',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: PX.font.display,
            // Figma Display/10/Medium : 72/1.15/-3/500
            fontSize: 'clamp(40px, 5.6vw, 72px)',
            lineHeight: 1.15,
            letterSpacing: '-3px',
            fontWeight: 500,
            color: PX.neutral100,
          }}>
            Élevez votre style de vie avec MEGGA
          </h1>
          {/* Buttons Row : Primary dark pill + Link ghost */}
          <div style={{
            marginTop: 32,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <PxButton to="/acheter" variant="primary" size="lg">
              Commencer
            </PxButton>
            <PxLink to="/publier" variant="light" arrow>
              Publier des biens
            </PxLink>
          </div>
        </div>
      </div>
    </section>
  )
}
