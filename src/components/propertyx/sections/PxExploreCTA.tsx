// MEGGA Marketplace — Property X "Explore your dream home" CTA section.
// Section noire avec iPad mockup à gauche et titre + CTA à droite.

import { PX } from '../tokens'
import PxButton, { PxArrowRight } from '../PxButton'
import PxSectionLabel from '../PxSectionLabel'

export default function PxExploreCTA() {
  return (
    <section style={{
      padding: `${PX.space.section}px ${PX.space.pageX}px`,
      background: PX.inkBg,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: PX.inkBgSubtle,
          borderRadius: PX.radiusCard,
          padding: '48px 56px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 56,
          alignItems: 'center',
        }}>
          {/* "iPad mockup" — image avec biens visibles */}
          <div style={{
            position: 'relative',
            aspectRatio: '1.3 / 1',
            borderRadius: PX.radiusImage,
            backgroundImage: `url("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            overflow: 'hidden',
          }}>
            {/* Carte de prix flottante en haut à droite */}
            <div style={{
              position: 'absolute',
              top: 20, right: 20,
              padding: '12px 16px',
              background: PX.surfaceBg,
              borderRadius: PX.radiusInput,
              boxShadow: PX.shadow.card,
            }}>
              <div style={{ fontSize: 11, color: PX.inkMuted, marginBottom: 2 }}>Prix demandé</div>
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 18,
                fontWeight: 700,
                color: PX.ink,
                fontVariantNumeric: 'tabular-nums',
              }}>CHF 1'250'000</div>
            </div>
          </div>

          {/* Texte CTA */}
          <div>
            <PxSectionLabel invert>Contactez-nous</PxSectionLabel>
            <h2 style={{
              margin: '16px 0 16px',
              fontFamily: PX.font.display,
              fontSize: 'clamp(28px, 3.8vw, 44px)',
              lineHeight: 1.12,
              letterSpacing: -0.8,
              fontWeight: 600,
              color: PX.inkInverse,
            }}>
              Explorez votre futur chez-vous dès aujourd'hui
            </h2>
            <p style={{
              margin: '0 0 28px',
              fontSize: 14.5,
              lineHeight: 1.6,
              color: PX.inkInverseSoft,
              maxWidth: 420,
            }}>
              Parlez à un de nos agents certifiés. Un appel suffit pour cadrer votre
              recherche et identifier les 3 meilleurs biens pour vous.
            </p>
            <PxButton to="/acheter" variant="invert" size="lg" trail={<PxArrowRight />}>
              Commencer
            </PxButton>
          </div>
        </div>
      </div>
    </section>
  )
}
