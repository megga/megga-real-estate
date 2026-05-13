// MEGGA Marketplace — Property X hero section.
// Refactor utilisant les atomes du DS (PxButton, PxIcon).

import { PX, PxButton, PxIcon } from '..'

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
      <PxIcon name="home" size={dim * 0.45} color={PX.neutral700} strokeWidth={1.6} />
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
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(20,22,28,0.15) 0%, rgba(20,22,28,0.40) 100%)',
        }} />

        <HomeMarker top="18%" left="14%" size="md" />
        <HomeMarker top="44%" left="8%" size="sm" />
        <HomeMarker top="68%" left="28%" size="md" />
        <HomeMarker top="28%" left="76%" size="md" />
        <HomeMarker top="58%" left="84%" size="sm" />

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
            // Figma Display/10/Medium : 72/1.15/-3/500
            fontSize: 'clamp(40px, 5.6vw, 72px)',
            lineHeight: 1.15,
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
