// MEGGA Marketplace — Property X "About" section.
// Figma node 9641:26996.
// Layout absolu fidèle au Figma : Content 1200×728 avec iPhone (425.36, 0),
// floating Image (123.64, 432.9, 404.5×334), Text Wrapper (left 0, vert-center),
// Stats Wrapper (left 985, vert-center).

import { PX, PxButton, PxFigmaIcon, PxLogo } from '..'

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
          <PxFigmaIcon name={listing.badge === 'À vendre' ? 'tag' : 'key'} size={10} color={PX.neutral100} />
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
          Contacter l’agence
          <PxFigmaIcon name="chevron-right" size={10} color={PX.neutral700} />
        </button>
      </div>
    </div>
  )
}

// Floating card hors iPhone — Figma node 11754:26159 "Image" 404.5×334
// (rectangle image avec overlay badge & favorite + bandeau bas type "card").
// Figma : x=123.64 RELATIF À L'IPHONE (qui est à x=425.36 dans le Content).
// → Position absolue dans le Content : left = 425.36 + 123.64 = 549.0
function FloatingListingCard({ listing }: { listing: Listing }) {
  return (
    <div style={{
      position: 'absolute',
      left: 549,
      top: 432.9,
      width: 404.5,
      height: 334,
      padding: 20,
      background: PX.neutral100,
      borderRadius: PX.radius.medium,
      boxShadow: PX.shadow.large,
    }}>
      <div style={{
        height: 200,
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
          <PxFigmaIcon name={listing.badge === 'À vendre' ? 'tag' : 'key'} size={12} color={PX.neutral100} />
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

      <div style={{ marginTop: 12 }}>
        <div style={{
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: '-0.48px',
          color: PX.neutral700,
          lineHeight: 1.25,
        }}>
          {listing.title}
        </div>
        <div style={{
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: PX.font.display,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '-0.36px',
          color: PX.neutral500,
          lineHeight: 1.25,
        }}>
          <PxFigmaIcon name="location" size={12} color={PX.neutral500} />
          {listing.address}
        </div>
        <div style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontFamily: PX.font.display,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '-0.33px',
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
      </div>
    </div>
  )
}

// Stats column item — Figma node 11754:26173/26178
function StatItem({ label, value, suffix, description }: {
  label: string
  value: string
  suffix?: string
  description: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <div style={{
        fontFamily: PX.font.display,
        fontSize: 18,
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: '-0.54px',
        color: PX.neutral700,
        whiteSpace: 'nowrap',
      }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'flex-start' }}>
        <div style={{
          fontFamily: PX.font.display,
          fontWeight: 500,
          letterSpacing: '-2.16px',
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 72, color: PX.neutral700 }}>{value}</span>
          {suffix && (
            <span style={{ fontSize: 72, color: PX.neutral400, fontWeight: 400 }}>{suffix}</span>
          )}
        </div>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
          width: 215,
        }}>{description}</p>
      </div>
    </div>
  )
}

export default function PxAboutSection() {
  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 160,
      paddingLeft: 40,
      paddingRight: 40,
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Top Content : Badge + Title (centred) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <AboutBadge />
        <div style={{ paddingTop: 16, paddingBottom: 48 }}>
          <h2 style={{
            margin: 0,
            width: 507,
            fontFamily: PX.font.display,
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
            textAlign: 'center',
          }}>
            La meilleure façon de trouver votre prochain bien
          </h2>
        </div>
      </div>

      {/* Content (Figma 11805:17634) : 1200×728, layout absolu */}
      <div style={{
        position: 'relative',
        width: 1200,
        height: 728,
      }}>
        {/* Text Wrapper (Figma 9640:26906) : left 0, vert-center */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          {/* Title (Figma 9641:26923) : pb-24, h4 24px */}
          <div style={{ paddingBottom: 24 }}>
            <h3 style={{
              margin: 0,
              width: 386,
              fontFamily: PX.font.display,
              fontSize: 24,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.72px',
              color: PX.neutral700,
            }}>
              Transformer des vies grâce à des biens d'exception
            </h3>
          </div>

          {/* Paragraphes (Figma 9641:26921) : gap 24, w 359/360.945 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            alignItems: 'flex-start',
            justifyContent: 'center',
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
          }}>
            <p style={{ margin: 0, width: 359 }}>
              33 000 biens à louer, 26 cantons, 4 langues. Filtres précis,
              carte interactive, alertes personnalisées — la marketplace pensée
              pour le marché suisse.
            </p>
            <p style={{ margin: 0, width: 360.945 }}>
              Toutes les agences MEGGA passent par une vérification KYC complète.
              Vous savez exactement à qui vous parlez, à chaque étape.
            </p>
          </div>

          {/* Button Row (Figma 9641:26915) : pt-24 */}
          <div style={{ paddingTop: 24 }}>
            <PxButton to="/acheter" variant="primary" size="lg">
              Commencer
            </PxButton>
          </div>
        </div>

        {/* iPhone (Figma 11754:26160) : left 425.36, top 0, 349.29×728 */}
        <div style={{
          position: 'absolute',
          left: 425.36,
          top: 0,
          width: 349.29,
          height: 728,
        }}>
          {/* Cadre iPhone */}
          <div style={{
            width: '100%',
            height: '100%',
            background: PX.neutral700,
            borderRadius: 52,
            padding: 10,
            boxSizing: 'border-box',
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

              {/* Header app : logo MEGGA + menu 3-dots */}
              <div style={{
                marginTop: 26,
                padding: '0 18px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <PxLogo form="text" size="sm" variant="dark" />
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
        </div>

        {/* Floating card "Luxury Loft · Genève" (Figma 11754:26159 : left 123.64, top 432.9, 404.5×334) */}
        <FloatingListingCard listing={FLOATING_LISTING} />

        {/* Stats Wrapper (Figma 11754:26172) : left 985, vert-center, gap 32 */}
        <div style={{
          position: 'absolute',
          left: 985,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 32,
        }}>
          <StatItem
            label="Biens publiés"
            value="33"
            suffix="k+"
            description="Mis à jour quotidiennement depuis l'ensemble de la Suisse."
          />
          <StatItem
            label="Cantons couverts"
            value="26"
            description="Toute la Suisse, de Genève à St-Gall, en 4 langues."
          />
        </div>
      </div>
    </section>
  )
}
