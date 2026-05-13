// MEGGA Marketplace — Property X hero section.
// Grande photo aérienne avec coins arrondis, titre centré, 2 CTAs,
// markers maison overlay.

import { PX } from '../tokens'
import PxButton, { PxArrowRight } from '../PxButton'

// Marqueur maison rond blanc (pin sur la photo)
function HomeMarker({ top, left }: { top: string; left: string }) {
  return (
    <div style={{
      position: 'absolute',
      top, left,
      width: 44, height: 44,
      borderRadius: '50%',
      background: PX.surfaceBg,
      boxShadow: PX.shadow.card,
      display: 'grid',
      placeItems: 'center',
      animation: 'px-pulse 2.4s ease-in-out infinite',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PX.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11 12 4l9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </svg>
    </div>
  )
}

export default function PxHero() {
  return (
    <section style={{
      position: 'relative',
      padding: `120px ${PX.space.pageX}px 0`,
      background: PX.pageBg,
    }}>
      <style>{`
        @keyframes px-pulse {
          0%, 100% { transform: scale(1); box-shadow: ${PX.shadow.card}; }
          50% { transform: scale(1.08); box-shadow: 0 12px 32px rgba(10,10,10,0.18); }
        }
      `}</style>

      <div style={{
        position: 'relative',
        maxWidth: 1440,
        margin: '0 auto',
        height: 640,
        borderRadius: PX.radiusImage,
        overflow: 'hidden',
        backgroundImage: `url("https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=2400&q=80")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Overlay subtil pour assurer lisibilité du texte blanc */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(10,10,10,0.10) 0%, rgba(10,10,10,0.30) 100%)',
        }} />

        {/* Markers maison */}
        <HomeMarker top="18%" left="14%" />
        <HomeMarker top="42%" left="8%" />
        <HomeMarker top="68%" left="28%" />
        <HomeMarker top="30%" left="78%" />
        <HomeMarker top="56%" left="84%" />

        {/* Texte centré */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: PX.inkInverse,
          width: '100%',
          maxWidth: 720,
          padding: '0 24px',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 'clamp(32px, 5.2vw, 64px)',
            lineHeight: 1.08,
            letterSpacing: PX.type.h1.ls,
            fontWeight: PX.type.h1.weight,
            color: PX.inkInverse,
          }}>
            Trouvez le bien<br />qui vous ressemble
          </h1>
          <p style={{
            margin: '20px auto 0',
            maxWidth: 480,
            fontFamily: PX.font.sans,
            fontSize: 'clamp(13px, 1.4vw, 16px)',
            lineHeight: 1.55,
            color: PX.inkInverseSoft,
          }}>
            La marketplace immobilière nouvelle génération en Suisse romande.
            33 000+ biens, 26 cantons, recherche IA.
          </p>
          <div style={{
            marginTop: 32,
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <PxButton to="/acheter" variant="invert" size="lg" trail={<PxArrowRight />}>
              Commencer
            </PxButton>
            <PxButton to="/louer" variant="ghost" size="lg" trail={<PxArrowRight color={PX.inkInverse} />} className="px-hero-ghost">
              Explorer les biens
            </PxButton>
          </div>
          <style>{`
            .px-hero-ghost { color: ${PX.inkInverse} !important; }
            .px-hero-ghost:hover { background: rgba(255,255,255,0.10); }
          `}</style>
        </div>
      </div>
    </section>
  )
}
