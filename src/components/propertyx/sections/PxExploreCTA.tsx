// MEGGA Marketplace — Property X "Explore CTA" section.
// Refactor avec PxSectionLabel, PxButton.

import { PX, PxSectionLabel, PxButton } from '..'

export default function PxExploreCTA() {
  return (
    <section style={{
      padding: `${PX.sectionDefault}px 40px`,
      background: PX.inkBg,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: PX.inkBgSubtle,
          borderRadius: PX.radius.large,
          padding: '48px 56px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 56,
          alignItems: 'center',
        }}>
          <div style={{
            position: 'relative',
            aspectRatio: '1.3 / 1',
            borderRadius: PX.radius.small,
            backgroundImage: `url("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 20, right: 20,
              padding: '12px 16px',
              background: PX.neutral100,
              borderRadius: PX.radius.small,
              boxShadow: PX.shadow.regular,
            }}>
              <div style={{
                fontFamily: PX.font.sans,
                fontSize: 11,
                color: PX.neutral500,
                marginBottom: 2,
              }}>Prix demandé</div>
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 18,
                fontWeight: 500,
                color: PX.neutral700,
                letterSpacing: '-0.54px',
                fontVariantNumeric: 'tabular-nums',
              }}>CHF 1'250'000</div>
            </div>
          </div>

          <div>
            <PxSectionLabel icon="message" invert>Contactez-nous</PxSectionLabel>
            <h2 style={{
              margin: '16px 0 16px',
              fontFamily: PX.font.display,
              fontSize: 'clamp(28px, 3.8vw, 44px)',
              lineHeight: 1.12,
              letterSpacing: '-1.3px',
              fontWeight: 500,
              color: PX.neutral100,
            }}>
              Explorez votre futur chez-vous dès aujourd'hui
            </h2>
            <p style={{
              margin: '0 0 28px',
              fontFamily: PX.font.sans,
              fontSize: 14,
              lineHeight: 1.5,
              letterSpacing: '-0.42px',
              color: 'rgba(255,255,255,0.72)',
              maxWidth: 420,
            }}>
              Parlez à un de nos agents certifiés. Un appel suffit pour cadrer votre
              recherche et identifier les 3 meilleurs biens pour vous.
            </p>
            <PxButton to="/acheter" variant="invert" size="lg">
              Commencer
            </PxButton>
          </div>
        </div>
      </div>
    </section>
  )
}
