// MEGGA Marketplace — Property X "Explore CTA" section.
// Source : Figma CTA/V3 node 11754:25966 (y=5624, h=624).
// Layout : card noire fullwidth maxWidth 1392, iPad mockup overflowing
// vers la gauche montrant une page listing property (galerie + détails),
// contenu droit avec pill + h2 + paragraphe + bouton.

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
        gridTemplateColumns: '1.3fr 1fr',
        gap: 80,
        alignItems: 'center',
        overflow: 'visible',
        position: 'relative',
      }}>
        {/* iPad mockup — overflow vers la gauche */}
        <div style={{
          position: 'relative',
          marginLeft: -120,
        }}>
          {/* Cadre iPad */}
          <div style={{
            width: '100%',
            aspectRatio: '4 / 3',
            background: PX.neutral700,
            borderRadius: 28,
            padding: 16,
            boxShadow: PX.shadow.large,
            position: 'relative',
          }}>
            {/* Écran iPad : page listing property layout 2 colonnes */}
            <div style={{
              width: '100%',
              height: '100%',
              background: PX.neutral100,
              borderRadius: 14,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr',
              gap: 16,
              padding: 16,
            }}>
              {/* GAUCHE : galerie photos */}
              <div style={{
                display: 'grid',
                gridTemplateRows: '1.4fr 1fr',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}>
                {/* Photo principale en haut, span 2 cols */}
                <div style={{
                  gridColumn: '1 / 3',
                  borderRadius: 8,
                  backgroundImage: `url("https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative',
                }}>
                  <span style={{ position: 'absolute', top: 10, left: 10 }}>
                    <PxBadge variant="invert" size="sm">À vendre</PxBadge>
                  </span>
                </div>
                {/* 2 photos en bas */}
                <div style={{
                  borderRadius: 8,
                  backgroundImage: `url("https://images.unsplash.com/photo-1600210492493-0946911123ea?w=900&q=80")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }} />
                <div style={{
                  borderRadius: 8,
                  backgroundImage: `url("https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=900&q=80")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }} />
              </div>

              {/* DROITE : détails property */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '4px 4px 4px 0',
              }}>
                {/* Address eyebrow */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: PX.font.sans,
                  fontSize: 10,
                  color: PX.neutral500,
                }}>
                  <PxIcon name="location" size={10} color={PX.neutral500} />
                  Cologny, Genève
                </div>

                {/* Title */}
                <div style={{
                  fontFamily: PX.font.display,
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: '-0.42px',
                  color: PX.neutral700,
                  lineHeight: 1.18,
                }}>
                  Modern Loft, San Francisco
                </div>

                {/* Description */}
                <div style={{
                  fontFamily: PX.font.sans,
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: PX.neutral500,
                }}>
                  Lumineux loft contemporain offrant une vue exceptionnelle sur la baie.
                </div>

                {/* Stats row */}
                <div style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  fontFamily: PX.font.sans,
                  fontSize: 9,
                  color: PX.neutral500,
                  marginTop: 4,
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <PxIcon name="surface" size={9} /> 230 m²
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <PxIcon name="bed" size={9} /> 4
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <PxIcon name="bath" size={9} /> 3
                  </span>
                </div>

                {/* Prix */}
                <div style={{
                  marginTop: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  paddingTop: 8,
                  borderTop: `1px solid ${PX.neutral300}`,
                }}>
                  <span style={{
                    fontFamily: PX.font.sans,
                    fontSize: 9,
                    color: PX.neutral500,
                  }}>Prix demandé</span>
                  <span style={{
                    fontFamily: PX.font.display,
                    fontSize: 16,
                    fontWeight: 500,
                    letterSpacing: '-0.48px',
                    color: PX.neutral700,
                  }}>$ 6'815'000 USD</span>
                </div>

                {/* Bouton "Contact agent" */}
                <div style={{
                  marginTop: 4,
                  background: PX.neutral700,
                  color: PX.neutral100,
                  borderRadius: PX.radius.pill,
                  padding: '8px 12px',
                  fontFamily: PX.font.display,
                  fontSize: 10,
                  fontWeight: 500,
                  textAlign: 'center',
                  letterSpacing: '-0.3px',
                }}>
                  Contacter l'agent →
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
