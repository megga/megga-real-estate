// MEGGA Marketplace — Property X "Featured properties" section.
// Refactor avec PxBadge, PxIcon, PxCircleButton, PxButton, PxSectionLabel.

import { PX, PxBadge, PxIcon, PxCircleButton, PxButton, PxSectionLabel } from '..'

const FEATURED = [
  {
    id: 'feat-1',
    badge: 'À louer',
    title: 'Loft contemporain à Carouge',
    description: 'Lumineux 120 m² avec vue dégagée, finitions haut de gamme et terrasse plein sud — quartier prisé.',
    address: '12 rue de la Filature, 1227 Carouge',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80',
  },
  {
    id: 'feat-2',
    badge: 'À vendre',
    title: 'Villa avec vue sur le lac, Cologny',
    description: 'Demeure d\'exception 280 m² avec piscine, jardin arboré et vue panoramique sur le Léman.',
    address: 'Route de la Capite, 1223 Cologny',
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1600&q=80',
  },
]

function FeaturedCard({ p, large }: { p: typeof FEATURED[0]; large: boolean }) {
  return (
    <div style={{
      position: 'relative',
      // Fidèle Figma : main 954, peek 221 (ratio 4.32:1)
      // Hauteur 440px (au lieu de minHeight 560 qui rendait trop carré)
      width: large ? 954 : 221,
      height: 440,
      flexShrink: 0,
      borderRadius: PX.radius.large,
      overflow: 'hidden',
      backgroundImage: `url("${p.image}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      cursor: 'pointer',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)',
      }} />
      {/* Badge "À louer" top-left */}
      <span style={{ position: 'absolute', top: 32, left: 32, zIndex: 2 }}>
        <PxBadge variant="invert" size="sm">{p.badge}</PxBadge>
      </span>
      {/* Cercle action top-right (favori) — fidèle Figma */}
      {large && (
        <span style={{ position: 'absolute', top: 32, right: 32, zIndex: 2 }}>
          <PxCircleButton size="sm" variant="light" ariaLabel="Ajouter aux favoris">
            <PxIcon name="bookmark" size={14} color={PX.neutral700} />
          </PxCircleButton>
        </span>
      )}
      {large && (
        <div style={{
          position: 'absolute', bottom: 32, left: 32, right: 32,
          color: PX.neutral100,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <h3 style={{
            margin: 0,
            fontFamily: PX.font.display,
            // Display/6/Medium ~ 28px
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: '-0.84px',
            lineHeight: 1.18,
            color: PX.neutral100,
            maxWidth: 380,
          }}>{p.title}</h3>
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '-0.42px',
            color: 'rgba(255,255,255,0.72)',
            maxWidth: 380,
          }}>{p.description}</p>
          <div style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: PX.font.sans,
            fontSize: 14,
            letterSpacing: '-0.42px',
            color: 'rgba(255,255,255,0.72)',
          }}>
            <PxIcon name="location" size={16} color="rgba(255,255,255,0.72)" />
            {p.address}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PxFeaturedProperties() {
  return (
    <section style={{
      padding: `${PX.sectionDefault}px 24px`,
      background: PX.inkBg,
    }}>
      <div style={{ maxWidth: 1392, margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          marginBottom: 40,
        }}>
          <div>
            <PxSectionLabel icon="star" invert>Biens vedettes</PxSectionLabel>
            <h2 style={{
              margin: '12px 0 8px',
              fontFamily: PX.font.display,
              fontSize: 'clamp(28px, 4vw, 48px)',
              lineHeight: 1.12,
              letterSpacing: '-1.3px',
              fontWeight: 500,
              color: PX.neutral100,
            }}>
              Biens vedettes
            </h2>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontSize: 14,
              lineHeight: 1.5,
              letterSpacing: '-0.42px',
              color: 'rgba(255,255,255,0.72)',
              maxWidth: 480,
            }}>
              Une sélection curatée par notre équipe parmi les biens les plus
              remarquables de la semaine.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <PxCircleButton size="lg" variant="light" ariaLabel="Précédent">
              <PxIcon name="chevron-left" size={16} color={PX.neutral700} />
            </PxCircleButton>
            <PxCircleButton size="lg" variant="light" ariaLabel="Suivant">
              <PxIcon name="chevron-right" size={16} color={PX.neutral700} />
            </PxCircleButton>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: 24,
          // Fidèle Figma : wrapper 1199 centré, légère overflow possible
          overflow: 'hidden',
          paddingLeft: 96,
        }}>
          <FeaturedCard p={FEATURED[0]} large />
          <FeaturedCard p={FEATURED[1]} large={false} />
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
          <PxButton to="/acheter" variant="invert" size="lg">
            Voir tous les biens vedettes
          </PxButton>
        </div>
      </div>
    </section>
  )
}
