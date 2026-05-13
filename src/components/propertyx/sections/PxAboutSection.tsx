// MEGGA Marketplace — Property X "About" section.
// Refactor utilisant les atomes + VRAIE icône Figma user pour le badge eyebrow.

import { PX, PxButton, PxBadge, PxFigmaIcon } from '..'

// Badge "About us" — LIGHT bg-neutral300 + cercle bg-neutral400 + icône user Figma
function AboutBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral300,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral400,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-about-user" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
      }}>À propos de MEGGA</span>
    </span>
  )
}

export default function PxAboutSection() {
  return (
    <section style={{
      padding: `${PX.sectionDefault}px 40px`,
      background: PX.neutral100,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <AboutBadge />
          <h2 style={{
            margin: '16px auto 0',
            maxWidth: 720,
            fontFamily: PX.font.display,
            fontSize: 'clamp(28px, 4vw, 48px)',
            lineHeight: 1.12,
            letterSpacing: '-1.4px',
            fontWeight: 500,
            color: PX.neutral700,
          }}>
            La meilleure façon de trouver votre prochain bien
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr 1fr',
          gap: 48,
          alignItems: 'center',
        }}>
          {/* Colonne gauche : narrative */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h3 style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 20,
                fontWeight: 500,
                color: PX.neutral700,
                letterSpacing: '-0.6px',
                lineHeight: 1.25,
              }}>
                Une recherche transparente
              </h3>
              <p style={{
                margin: '8px 0 0',
                fontFamily: PX.font.sans,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
              }}>
                33 000 biens à louer, 26 cantons, 4 langues. Filtres précis,
                carte interactive, alertes personnalisées.
              </p>
            </div>
            <div>
              <h3 style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 20,
                fontWeight: 500,
                color: PX.neutral700,
                letterSpacing: '-0.6px',
                lineHeight: 1.25,
              }}>
                Des agents certifiés
              </h3>
              <p style={{
                margin: '8px 0 0',
                fontFamily: PX.font.sans,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
              }}>
                Tous les agents MEGGA passent par une vérification KYC complète.
                Vous savez à qui vous parlez.
              </p>
            </div>
            <div style={{ marginTop: 8 }}>
              <PxButton to="/acheter" variant="primary" size="lg">
                Commencer
              </PxButton>
            </div>
          </div>

          {/* Colonne centre : iPhone mockup (frame Figma 11754:26160) */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}>
            {/* Cadre iPhone : titane noir, bord arrondi 48px */}
            <div style={{
              width: 320,
              height: 640,
              background: PX.neutral700,
              borderRadius: 48,
              padding: 10,
              boxShadow: PX.shadow.large,
              position: 'relative',
            }}>
              {/* Écran (intérieur) */}
              <div style={{
                width: '100%',
                height: '100%',
                background: PX.neutral100,
                borderRadius: 38,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {/* Dynamic Island */}
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 110,
                  height: 30,
                  background: PX.neutral700,
                  borderRadius: 20,
                  zIndex: 2,
                }} />

                {/* Status bar (heure / icônes) */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 24px 0',
                  fontFamily: PX.font.display,
                  fontSize: 13,
                  fontWeight: 500,
                  color: PX.neutral700,
                  zIndex: 3,
                  position: 'relative',
                }}>
                  <span>9:41</span>
                  <span style={{ display: 'flex', gap: 4, fontSize: 11 }}>
                    <span>•••</span>
                    <span>📶</span>
                    <span>🔋</span>
                  </span>
                </div>

                {/* Header app (logo + search) */}
                <div style={{
                  marginTop: 32,
                  padding: '0 16px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontFamily: PX.font.display,
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: '-0.42px',
                    color: PX.neutral700,
                  }}>
                    🏠 Property X
                  </span>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: PX.radius.pill,
                    background: PX.neutral200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                  }}>⋯</span>
                </div>

                {/* Card de propriété (grand visuel) */}
                <div style={{ padding: '0 16px 12px' }}>
                  <div style={{
                    borderRadius: PX.radius.small,
                    overflow: 'hidden',
                    background: PX.neutral200,
                  }}>
                    <div style={{
                      height: 160,
                      backgroundImage: `url("https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=80")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                    }}>
                      <span style={{ position: 'absolute', top: 8, left: 8 }}>
                        <PxBadge variant="invert" size="sm">À louer</PxBadge>
                      </span>
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{
                        fontFamily: PX.font.display,
                        fontSize: 13,
                        fontWeight: 500,
                        letterSpacing: '-0.4px',
                        color: PX.neutral700,
                      }}>
                        Loft contemporain · Carouge
                      </div>
                      <div style={{
                        marginTop: 2,
                        fontFamily: PX.font.sans,
                        fontSize: 11,
                        color: PX.neutral500,
                      }}>
                        12 rue de la Filature, 1227 Carouge
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mini card secondaire */}
                <div style={{ padding: '0 16px' }}>
                  <div style={{
                    display: 'flex',
                    gap: 10,
                    padding: 8,
                    background: PX.neutral200,
                    borderRadius: PX.radius.small,
                  }}>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      backgroundImage: `url("https://images.unsplash.com/photo-1613977257363-707ba9348227?w=400&q=80")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: PX.font.display,
                        fontSize: 12,
                        fontWeight: 500,
                        letterSpacing: '-0.36px',
                        color: PX.neutral700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        Villa, Cologny
                      </div>
                      <div style={{
                        marginTop: 2,
                        fontFamily: PX.font.sans,
                        fontSize: 10,
                        color: PX.neutral500,
                      }}>
                        Route de la Capite
                      </div>
                      <div style={{
                        marginTop: 4,
                        fontFamily: PX.font.display,
                        fontSize: 11,
                        fontWeight: 500,
                        color: PX.neutral700,
                      }}>
                        CHF 2'450'000
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mini-card flottante "Luxury Loft" (overlap iPhone à droite, fidèle Figma) */}
            <div style={{
              position: 'absolute',
              right: -32,
              bottom: 80,
              width: 200,
              background: PX.neutral100,
              borderRadius: PX.radius.small,
              boxShadow: PX.shadow.large,
              overflow: 'hidden',
            }}>
              <div style={{
                height: 100,
                backgroundImage: `url("https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=600&q=80")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }} />
              <div style={{ padding: 10 }}>
                <div style={{
                  fontFamily: PX.font.display,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '-0.36px',
                  color: PX.neutral700,
                }}>
                  Luxury Loft · Genève
                </div>
                <div style={{
                  marginTop: 2,
                  fontFamily: PX.font.sans,
                  fontSize: 10,
                  color: PX.neutral500,
                }}>
                  3508 Brookside Rd
                </div>
              </div>
            </div>
          </div>

          {/* Colonne droite : stats — labels plain text (pas pills),
              fidèle Figma node 11754:26172 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <div>
              {/* Label plain "Homes purchased" style — Display/2/Medium */}
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '-0.48px',
                color: PX.neutral700,
              }}>Biens disponibles</div>
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 72,
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: '-3px',
                color: PX.neutral700,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 12,
              }}>
                33<span style={{ color: PX.neutral400 }}>k+</span>
              </div>
              <p style={{
                margin: '12px 0 0',
                fontFamily: PX.font.sans,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
                maxWidth: 220,
              }}>
                Mis à jour quotidiennement depuis l'ensemble de la Suisse.
              </p>
            </div>
            <div>
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '-0.48px',
                color: PX.neutral700,
              }}>Cantons couverts</div>
              <div style={{
                fontFamily: PX.font.display,
                fontSize: 72,
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: '-3px',
                color: PX.neutral700,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 12,
              }}>26</div>
              <p style={{
                margin: '12px 0 0',
                fontFamily: PX.font.sans,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
                maxWidth: 220,
              }}>
                Toute la Suisse, de Genève à St-Gall, en 4 langues.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
