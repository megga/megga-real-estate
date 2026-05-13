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

// Floating card hors iPhone — taille Figma : 404 wide, 334 height.
// Position : extends right of iPhone par ~179px, top at 432.9px (60% du haut).
function FloatingListingCard({ listing }: { listing: Listing }) {
  return (
    <div style={{
      position: 'absolute',
      right: -179,
      top: 432,
      width: 404,
      padding: 20,
      background: PX.neutral100,
      borderRadius: PX.radius.medium,
      boxShadow: PX.shadow.large,
    }}>
      <div style={{
        height: 220,
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

      <div style={{ marginTop: 16 }}>
        <div style={{
          fontFamily: PX.font.display,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '-0.6px',
          color: PX.neutral700,
          lineHeight: 1.25,
        }}>
          {listing.title}
        </div>
        <div style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: PX.font.display,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '-0.42px',
          color: PX.neutral500,
          lineHeight: 1.25,
        }}>
          <PxFigmaIcon name="location" size={14} color={PX.neutral500} />
          {listing.address}
        </div>
        <div style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: `1px solid ${PX.neutral300}`,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          fontFamily: PX.font.display,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.39px',
          color: PX.neutral400,
          lineHeight: 1.25,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <PxFigmaIcon name="surface" size={16} color={PX.neutral400} />
            {listing.surface}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <PxFigmaIcon name="bed" size={16} color={PX.neutral400} />
            {listing.beds}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <PxFigmaIcon name="bath" size={16} color={PX.neutral400} />
            {listing.baths}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <PxFigmaIcon name="parking" size={16} color={PX.neutral400} />
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

        {/* Grid : 1fr | auto (phone) | 1fr → phone centré, text à gauche,
            stats collées tout à droite (justifySelf end).
            Reproduit exactement les positions Figma : text 0-386, phone 425-774, stats 985-1200. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 0,
        }}>
          {/* Colonne gauche : narrative — width Figma 386px, collée à gauche */}
          <div style={{ width: 386, justifySelf: 'start', display: 'flex', flexDirection: 'column', gap: 24 }}>
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
            flexShrink: 0,
          }}>
            {/* Cadre iPhone : 349×728 exact Figma */}
            <div style={{
              width: 349,
              height: 728,
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

                {/* Status bar : heure + indicateurs SVG (signal/wifi/battery) */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 28px 0',
                  zIndex: 3,
                  position: 'relative',
                }}>
                  <span style={{
                    fontFamily: PX.font.display,
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '-0.42px',
                    color: PX.neutral700,
                  }}>9:41</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {/* Signal bars */}
                    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
                      <rect x="0" y="7" width="2.5" height="4" rx="0.5" fill={PX.neutral700} />
                      <rect x="4" y="5" width="2.5" height="6" rx="0.5" fill={PX.neutral700} />
                      <rect x="8" y="3" width="2.5" height="8" rx="0.5" fill={PX.neutral700} />
                      <rect x="12" y="0" width="2.5" height="11" rx="0.5" fill={PX.neutral700} />
                    </svg>
                    {/* WiFi */}
                    <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
                      <path d="M7 2C4.5 2 2.3 2.9 0.8 4.3l1 1.1C3 4.2 4.9 3.5 7 3.5s4 0.7 5.2 1.9l1-1.1C11.7 2.9 9.5 2 7 2z" fill={PX.neutral700} />
                      <path d="M7 5C5.5 5 4.1 5.6 3.1 6.5l1 1.1C4.8 6.9 5.8 6.5 7 6.5s2.2 0.4 2.9 1.1l1-1.1C9.9 5.6 8.5 5 7 5z" fill={PX.neutral700} />
                      <circle cx="7" cy="9.5" r="1" fill={PX.neutral700} />
                    </svg>
                    {/* Battery */}
                    <svg width="24" height="11" viewBox="0 0 24 11" fill="none" aria-hidden="true">
                      <rect x="0.5" y="0.5" width="20" height="10" rx="2.5" stroke={PX.neutral700} fill="none" opacity="0.4"/>
                      <rect x="2" y="2" width="17" height="7" rx="1.5" fill={PX.neutral700} />
                      <rect x="21" y="3.5" width="2" height="4" rx="0.8" fill={PX.neutral700} opacity="0.4"/>
                    </svg>
                  </span>
                </div>

                {/* Header app : home icon + Property X + menu 3-dots */}
                <div style={{
                  marginTop: 26,
                  padding: '0 18px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: PX.font.display,
                    fontSize: 15,
                    fontWeight: 500,
                    letterSpacing: '-0.45px',
                    color: PX.neutral700,
                  }}>
                    <PxFigmaIcon name="home-poi" size={16} color={PX.neutral700} />
                    Property X
                  </span>
                  <span style={{
                    width: 30,
                    height: 30,
                    borderRadius: PX.radius.pill,
                    background: PX.neutral200,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                  }}>
                    <span style={{ width: 3, height: 3, borderRadius: 99, background: PX.neutral700 }} />
                    <span style={{ width: 3, height: 3, borderRadius: 99, background: PX.neutral700 }} />
                    <span style={{ width: 3, height: 3, borderRadius: 99, background: PX.neutral700 }} />
                  </span>
                </div>

                {/* Search input "Choisissez votre localité" */}
                <div style={{ padding: '0 18px 16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: PX.neutral200,
                    borderRadius: PX.radius.pill,
                    paddingLeft: 16,
                    paddingRight: 5,
                    paddingTop: 5,
                    paddingBottom: 5,
                  }}>
                    <span style={{
                      fontFamily: PX.font.sans,
                      fontSize: 12,
                      fontWeight: 400,
                      color: PX.neutral500,
                    }}>
                      Choisissez votre localité
                    </span>
                    <span style={{
                      width: 28,
                      height: 28,
                      borderRadius: PX.radius.pill,
                      background: PX.neutral700,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}>
                      <PxFigmaIcon name="search" size={14} color={PX.neutral100} />
                    </span>
                  </div>
                </div>

                {/* Liste des cards (3 stacked, dernier peek) */}
                <div style={{
                  padding: '0 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
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

          {/* Colonne droite : stats — width Figma 215px, collée à droite */}
          <div style={{ width: 215, justifySelf: 'end', display: 'flex', flexDirection: 'column', gap: 32 }}>
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
