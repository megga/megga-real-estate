// MEGGA Marketplace — Property X hero section.
// Adaptation FR du hero "Elevate your lifestyle with us" :
// - Grande photo (radius 24px / BR Large)
// - Texte centré (Display gros, line-height 1.05)
// - 2 CTAs centrés
// - Markers maison animés (pulse)

import { PX } from '../tokens'
import PxButton from '../PxButton'

function HomeMarker({ top, left, size = 'md' }: { top: string; left: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 52 : size === 'sm' ? 36 : 44
  return (
    <div style={{
      position: 'absolute',
      top, left,
      width: dim, height: dim,
      borderRadius: PX.radius.pill,
      background: PX.neutral100,
      boxShadow: PX.shadow.regular,
      display: 'grid',
      placeItems: 'center',
      animation: 'px-pulse 2.6s ease-in-out infinite',
    }}>
      <svg width={dim * 0.45} height={dim * 0.45} viewBox="0 0 24 24" fill="none"
        stroke={PX.neutral700} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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
      padding: '120px 40px 0',
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
        maxWidth: PX.containerDesktop,
        margin: '0 auto',
        height: 720,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        backgroundImage: `url("https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=2400&q=85")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Overlay sombre subtil pour assurer lisibilité du texte blanc */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(20,22,28,0.15) 0%, rgba(20,22,28,0.40) 100%)',
        }} />

        {/* Markers maison */}
        <HomeMarker top="18%" left="14%" size="md" />
        <HomeMarker top="44%" left="8%" size="sm" />
        <HomeMarker top="68%" left="28%" size="md" />
        <HomeMarker top="28%" left="76%" size="md" />
        <HomeMarker top="58%" left="84%" size="sm" />

        {/* Bloc central : titre + CTAs */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: PX.neutral100,
          width: '100%',
          maxWidth: 880,
          padding: '0 24px',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 'clamp(40px, 6.5vw, 88px)',
            lineHeight: 1.02,
            letterSpacing: '-3px',
            fontWeight: 500,
            color: PX.neutral100,
          }}>
            Élevez votre style de vie avec MEGGA
          </h1>
          <div style={{
            marginTop: 32,
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <PxButton to="/acheter" variant="invert" size="lg">
              Commencer
            </PxButton>
            <PxButton to="/louer" variant="ghost" size="lg" showIcon={false}>
              <span style={{ color: PX.neutral100, opacity: 0.92 }}>Explorer les biens</span>
            </PxButton>
          </div>
        </div>
      </div>
    </section>
  )
}
