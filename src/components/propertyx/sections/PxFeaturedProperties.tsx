// MEGGA Marketplace — Property X "Featured properties" section.
// Section fond noir, grande card de bien à gauche, preview à droite,
// CTA en bas centré. Mock pour l'instant — wiring useMarketListings à venir.

import { PX } from '../tokens'
import PxButton from '../PxButton'
import PxSectionLabel from '../PxSectionLabel'

const FEATURED = [
  {
    id: 'feat-1',
    badge: 'À louer',
    title: 'Loft contemporain à Carouge',
    address: '12 rue de la Filature, 1227 Carouge',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80',
  },
  {
    id: 'feat-2',
    badge: 'À vendre',
    title: 'Villa avec vue sur le lac, Cologny',
    address: 'Route de la Capite, 1223 Cologny',
    image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1600&q=80',
  },
]

function FeaturedCard({ p, large }: { p: typeof FEATURED[0]; large: boolean }) {
  return (
    <div style={{
      position: 'relative',
      flex: large ? 2 : 1,
      borderRadius: PX.radiusImage,
      overflow: 'hidden',
      backgroundImage: `url("${p.image}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      minHeight: large ? 520 : 520,
      cursor: 'pointer',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)',
      }} />
      {/* Badge en haut à gauche */}
      <span style={{
        position: 'absolute', top: 16, left: 16,
        padding: '6px 12px',
        background: PX.surfaceBg,
        borderRadius: PX.radiusPill,
        fontSize: 12,
        fontWeight: 600,
        color: PX.ink,
        zIndex: 2,
      }}>{p.badge}</span>
      {/* Texte en bas (uniquement sur grande card) */}
      {large && (
        <div style={{
          position: 'absolute', bottom: 24, left: 24, right: 24,
          color: PX.inkInverse,
        }}>
          <h3 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: -0.4,
            color: PX.inkInverse,
          }}>{p.title}</h3>
          <div style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13.5,
            color: PX.inkInverseSoft,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PX.inkInverseSoft} strokeWidth="1.7">
              <path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
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
      padding: `${PX.space.section}px ${PX.space.pageX}px`,
      background: PX.inkBg,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          marginBottom: 40,
        }}>
          <div>
            <PxSectionLabel invert>Biens vedettes</PxSectionLabel>
            <h2 style={{
              margin: '12px 0 8px',
              fontFamily: PX.font.display,
              fontSize: 'clamp(28px, 4vw, 44px)',
              lineHeight: 1.12,
              letterSpacing: -0.8,
              fontWeight: 600,
              color: PX.inkInverse,
            }}>
              Biens vedettes
            </h2>
            <p style={{
              margin: 0,
              fontSize: 14.5,
              color: PX.inkInverseSoft,
              maxWidth: 480,
            }}>
              Une sélection curatée par notre équipe parmi les biens les plus
              remarquables de la semaine.
            </p>
          </div>
          {/* Boutons nav carousel (placeholders pour l'instant) */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button aria-label="Précédent" style={navBtn(false)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 4 6 8l4 4" stroke={PX.inkInverse} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button aria-label="Suivant" style={navBtn(true)}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke={PX.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <FeaturedCard p={FEATURED[0]} large />
          <FeaturedCard p={FEATURED[1]} large={false} />
        </div>

        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
          <PxButton to="/acheter" variant="invert" size="md">
            Voir tous les biens vedettes
          </PxButton>
        </div>
      </div>
    </section>
  )
}

function navBtn(active: boolean): React.CSSProperties {
  return {
    width: 40, height: 40,
    borderRadius: 999,
    background: active ? PX.inkInverse : 'rgba(255,255,255,0.10)',
    border: 0,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  }
}
