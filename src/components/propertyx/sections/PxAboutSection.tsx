// MEGGA Marketplace — Property X "About" section.
// Annonces dans le mockup iPhone : design fidèle Figma node 11754:26160
// (image + badge overlay + titre + adresse map pin + stats m²/lits/bains/parking
// + bouton "Contacter l'agent").

import { PX, PxButton, PxFigmaIcon } from '..'

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

// Données des annonces (3 cards in-phone + 1 floating)
type Listing = {
  title: string
  address: string
  image: string
  badge: 'À louer' | 'À vendre'
  surface: string
  beds: number
  baths: number
  parking: number
}

const PHONE_LISTINGS: Listing[] = [
  {
    title: 'Loft contemporain · Carouge',
    address: '12 rue de la Filature, 1227 Carouge',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=80',
    badge: 'À louer',
    surface: '110 m²',
    beds: 3,
    baths: 2,
    parking: 1,
  },
  {
    title: 'Maison familiale · Cologny',
    address: 'Route de la Capite, 1223 Cologny',
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=900&q=80',
    badge: 'À vendre',
    surface: '250 m²',
    beds: 5,
    baths: 3,
    parking: 2,
  },
  {
    title: 'Penthouse · Eaux-Vives',
    address: 'Quai Gustave-Ador, 1207 Genève',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80',
    badge: 'À louer',
    surface: '180 m²',
    beds: 4,
    baths: 2,
    parking: 2,
  },
]

const FLOATING_LISTING: Listing = {
  title: 'Luxury Loft · Genève',
  address: '3508 Brookside Rd, 1206 Genève',
  image: 'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=600&q=80',
  badge: 'À louer',
  surface: '130 m²',
  beds: 3,
  baths: 2,
  parking: 2,
}

// Card listing fidèle Figma — image avec badge + titre + adresse +
// (stats inline avec "Contact agent" à droite, sur une seule ligne).
function PhoneListingCard({ listing }: { listing: Listing }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Image avec badge overlay */}
      <div style={{
        height: 158,
        backgroundImage: `url("${listing.image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 12,
        position: 'relative',
      }}>
        <span style={{
          position: 'absolute',
          top: 10,
          left: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: PX.neutral700,
          color: PX.neutral100,
          paddingLeft: 8,
          paddingRight: 10,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: PX.radius.pill,
          fontFamily: PX.font.display,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '-0.3px',
          lineHeight: 1.25,
        }}>
          <PxFigmaIcon name="key" size={10} color={PX.neutral100} />
          {listing.badge}
        </span>
      </div>

      {/* Titre */}
      <div style={{
        marginTop: 10,
        fontFamily: PX.font.display,
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: '-0.42px',
        color: PX.neutral700,
        lineHeight: 1.25,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {listing.title}
      </div>

      {/* Adresse map pin */}
      <div style={{
        marginTop: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: PX.font.display,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '-0.33px',
        color: PX.neutral500,
        lineHeight: 1.25,
      }}>
        <PxFigmaIcon name="location" size={10} color={PX.neutral500} />
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{listing.address}</span>
      </div>

      {/* Bottom row : stats + "Contact agent" sur une seule ligne */}
      <div style={{
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: PX.font.display,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '-0.3px',
          color: PX.neutral400,
          lineHeight: 1.25,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <PxFigmaIcon name="surface" size={13} color={PX.neutral400} />
            {listing.surface}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <PxFigmaIcon name="bed" size={13} color={PX.neutral400} />
            {listing.beds}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <PxFigmaIcon name="bath" size={13} color={PX.neutral400} />
            {listing.baths}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <PxFigmaIcon name="parking" size={13} color={PX.neutral400} />
            {listing.parking}
          </span>
        </div>
        <button type="button" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: 0,
          background: 'transparent',
          border: 0,
          color: PX.neutral700,
          fontFamily: PX.font.display,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '-0.3px',
          lineHeight: 1.25,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          Contact agent
          <PxFigmaIcon name="chevron-right" size={10} color={PX.neutral700} />
        </button>
      </div>
    </div>
  )
}

// Floating card hors iPhone — fidèle Figma : white card, padding 16,
// image avec badge + "+" circle, titre 18px, adresse map pin, divider,
// stats avec icônes Figma.
function FloatingListingCard({ listing }: { listing: Listing }) {
  return (
    <div style={{
      position: 'absolute',
      right: -56,
      bottom: 56,
      width: 312,
      padding: 16,
      background: PX.neutral100,
      borderRadius: PX.radius.medium,
      boxShadow: PX.shadow.large,
    }}>
      <div style={{
        height: 184,
        backgroundImage: `url("${listing.image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: PX.radius.tiny,
        position: 'relative',
      }}>
        <span style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: PX.neutral700,
          color: PX.neutral100,
          paddingLeft: 10,
          paddingRight: 12,
          paddingTop: 5,
          paddingBottom: 5,
          borderRadius: PX.radius.pill,
          fontFamily: PX.font.display,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '-0.36px',
          lineHeight: 1.25,
        }}>
          <PxFigmaIcon name="key" size={12} color={PX.neutral100} />
          {listing.badge}
        </span>
        <button type="button" aria-label="Ajouter aux favoris" style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 32,
          height: 32,
          borderRadius: PX.radius.pill,
          border: 0,
          background: PX.neutral100,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          boxShadow: PX.shadow.small,
        }}>
          <PxFigmaIcon name="plus" size={14} color={PX.neutral700} />
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{
          fontFamily: PX.font.display,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.54px',
          color: PX.neutral700,
          lineHeight: 1.25,
        }}>
          {listing.title}
        </div>
        <div style={{
          marginTop: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: PX.font.display,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.39px',
          color: PX.neutral500,
          lineHeight: 1.25,
        }}>
          <PxFigmaIcon name="location" size={13} color={PX.neutral500} />
          {listing.address}
        </div>
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${PX.neutral300}`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontFamily: PX.font.display,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '-0.36px',
          color: PX.neutral400,
          lineHeight: 1.25,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <PxFigmaIcon name="surface" size={15} color={PX.neutral400} />
            {listing.surface}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <PxFigmaIcon name="bed" size={15} color={PX.neutral400} />
            {listing.beds}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <PxFigmaIcon name="bath" size={15} color={PX.neutral400} />
            {listing.baths}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <PxFigmaIcon name="parking" size={15} color={PX.neutral400} />
            {listing.parking}
          </span>
        </div>
      </div>
    </div>
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
            {/* Cadre iPhone : titane noir, bord arrondi 52px — fidèle Figma 349×728 */}
            <div style={{
              width: 360,
              height: 740,
              background: PX.neutral700,
              borderRadius: 52,
              padding: 10,
              boxShadow: PX.shadow.large,
              position: 'relative',
            }}>
              {/* Écran (intérieur) */}
              <div style={{
                width: '100%',
                height: '100%',
                background: PX.neutral100,
                borderRadius: 42,
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

                {/* Status bar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 24px 0',
                  fontFamily: PX.font.display,
                  fontSize: 13,
                  fontWeight: 600,
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

                {/* Header app (logo + menu) */}
                <div style={{
                  marginTop: 28,
                  padding: '0 16px 10px',
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
                    color: PX.neutral500,
                  }}>⋯</span>
                </div>

                {/* Search input "Choose your location" */}
                <div style={{ padding: '0 16px 12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: PX.neutral200,
                    borderRadius: PX.radius.pill,
                    paddingLeft: 14,
                    paddingRight: 4,
                    paddingTop: 4,
                    paddingBottom: 4,
                  }}>
                    <span style={{
                      fontFamily: PX.font.sans,
                      fontSize: 11,
                      color: PX.neutral500,
                    }}>
                      Choisissez votre localité
                    </span>
                    <span style={{
                      width: 24,
                      height: 24,
                      borderRadius: PX.radius.pill,
                      background: PX.neutral700,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}>
                      <PxFigmaIcon name="search" size={12} color={PX.neutral100} />
                    </span>
                  </div>
                </div>

                {/* Liste des cards (3 stacked, dernier peek) */}
                <div style={{
                  padding: '0 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  overflow: 'hidden',
                }}>
                  {PHONE_LISTINGS.map(listing => (
                    <PhoneListingCard key={listing.title} listing={listing} />
                  ))}
                </div>
              </div>
            </div>

            {/* Floating card "Luxury Loft · Genève" */}
            <FloatingListingCard listing={FLOATING_LISTING} />
          </div>

          {/* Colonne droite : stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <div>
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
