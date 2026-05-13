// MEGGA Marketplace — Property X "Explore CTA" section.
// Source : Figma CTA/V3 node 11754:25966 (y=5624, h=624) — iPad mockup gauche
// (overflow), titre + paragraphe + bouton droite. Fond noir.

import { PX, PxSectionLabel, PxButton, PxBadge, PxIcon } from '..'

export default function PxExploreCTA() {
  return (
    <section style={{
      padding: `${PX.sectionDefault}px 24px`,
      background: PX.neutral100,
    }}>
      <div style={{
        maxWidth: 1392,
        margin: '0 auto',
        background: PX.inkBg,
        borderRadius: PX.radius.large,
        padding: '64px 80px 64px 0',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: 56,
        alignItems: 'center',
        overflow: 'visible',
        position: 'relative',
      }}>
        {/* iPad mockup — overflow vers la gauche */}
        <div style={{
          position: 'relative',
          marginLeft: -64,
        }}>
          {/* Cadre iPad */}
          <div style={{
            width: '100%',
            aspectRatio: '4 / 3',
            background: PX.neutral700,
            borderRadius: 24,
            padding: 14,
            boxShadow: PX.shadow.large,
            position: 'relative',
          }}>
            {/* Écran iPad : page listing property */}
            <div style={{
              width: '100%',
              height: '100%',
              background: PX.neutral100,
              borderRadius: 14,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              gap: 12,
              padding: 16,
            }}>
              {/* Photo principale gauche */}
              <div style={{
                gridRow: 'span 2',
                borderRadius: 10,
                backgroundImage: `url("https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
              }}>
                <span style={{ position: 'absolute', top: 12, left: 12 }}>
                  <PxBadge variant="invert" size="sm">À vendre</PxBadge>
                </span>
              </div>
              {/* Photo droite haut */}
              <div style={{
                borderRadius: 10,
                backgroundImage: `url("https://images.unsplash.com/photo-1600210492493-0946911123ea?w=900&q=80")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }} />
              {/* Photo droite bas */}
              <div style={{
                borderRadius: 10,
                backgroundImage: `url("https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=900&q=80")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }} />
              {/* Info card en bas, full width des deux colonnes */}
              <div style={{
                gridColumn: '1 / 3',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                padding: '4px 4px 0',
              }}>
                <div>
                  <div style={{
                    fontFamily: PX.font.display,
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: '-0.42px',
                    color: PX.neutral700,
                  }}>
                    Modern Loft · San Francisco
                  </div>
                  <div style={{
                    marginTop: 2,
                    display: 'flex',
                    gap: 10,
                    fontFamily: PX.font.sans,
                    fontSize: 11,
                    color: PX.neutral500,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <PxIcon name="surface" size={11} /> 230 m²
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <PxIcon name="bed" size={11} /> 4
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <PxIcon name="bath" size={11} /> 3
                    </span>
                  </div>
                </div>
                <div style={{
                  fontFamily: PX.font.display,
                  fontSize: 16,
                  fontWeight: 500,
                  letterSpacing: '-0.48px',
                  color: PX.neutral700,
                }}>
                  CHF 6'815'000
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contenu droite */}
        <div>
          <PxSectionLabel icon="message" invert>Contactez-nous</PxSectionLabel>
          <h2 style={{
            margin: '16px 0 16px',
            fontFamily: PX.font.display,
            fontSize: 'clamp(28px, 4vw, 48px)',
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
    </section>
  )
}
