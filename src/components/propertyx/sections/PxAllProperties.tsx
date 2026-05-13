// MEGGA Marketplace — Property X "All properties" section.
// Refactor avec PxBadge, PxIcon, PxLink, PxSectionLabel.

import { PX, PxBadge, PxIcon, PxLink, PxSectionLabel } from '..'

interface PropMock {
  id: string
  badge: 'À louer' | 'À vendre'
  image: string
  address: string
  title: string
  description: string
  surface: number
  bedrooms: number
  bathrooms: number
}

const PROPS: PropMock[] = [
  {
    id: 'p1', badge: 'À louer',
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80',
    address: '2238 Rue de la Servette, Genève',
    title: 'Appartement lumineux à Servette',
    description: 'Lumineux 4.5 pièces avec balcon, proche des transports et commerces.',
    surface: 110, bedrooms: 3, bathrooms: 2,
  },
  {
    id: 'p2', badge: 'À vendre',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
    address: '15 Chemin de Champel, Genève',
    title: 'Maison moderne à Champel',
    description: 'Villa contemporaine avec jardin, 5 chambres, garage double, vue dégagée.',
    surface: 230, bedrooms: 5, bathrooms: 3,
  },
  {
    id: 'p3', badge: 'À louer',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80',
    address: 'Avenue de la Gare, Lausanne',
    title: 'Loft contemporain à Lausanne',
    description: 'Loft de 130m² entièrement rénové, prestations haut de gamme.',
    surface: 130, bedrooms: 2, bathrooms: 2,
  },
]

function PropertyRow({ p }: { p: PropMock }) {
  return (
    <a href={`/listing/${p.id}`} style={{
      display: 'flex',
      gap: 24,
      padding: 16,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
      textDecoration: 'none',
      color: 'inherit',
      transition: `box-shadow ${PX.duration.fast} ${PX.ease}, transform ${PX.duration.fast} ${PX.ease}`,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = PX.shadow.regular; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = PX.shadow.small; e.currentTarget.style.transform = 'translateY(0)' }}>
      <div style={{
        flexShrink: 0,
        width: 220, height: 180,
        borderRadius: PX.radius.small,
        backgroundImage: `url("${p.image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      }}>
        <span style={{ position: 'absolute', top: 10, left: 10 }}>
          <PxBadge variant="invert" size="sm">{p.badge}</PxBadge>
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: PX.font.sans,
            fontSize: 14,
            letterSpacing: '-0.42px',
            color: PX.neutral400,
            marginBottom: 4,
          }}>
            <PxIcon name="location" size={13} color={PX.neutral400} />
            {p.address}
          </div>
          <h3 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 20,
            fontWeight: 500,
            color: PX.neutral700,
            letterSpacing: '-0.6px',
            lineHeight: 1.25,
          }}>{p.title}</h3>
          <p style={{
            margin: '8px 0 0',
            fontFamily: PX.font.sans,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '-0.42px',
            color: PX.neutral500,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{p.description}</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          fontFamily: PX.font.sans,
          fontSize: 14,
          letterSpacing: '-0.42px',
          color: PX.neutral500,
          marginTop: 12,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PxIcon name="surface" size={14} color={PX.neutral500} /> {p.surface} m²
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PxIcon name="bed" size={14} color={PX.neutral500} /> {p.bedrooms} ch.
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PxIcon name="bath" size={14} color={PX.neutral500} /> {p.bathrooms} sdb
          </span>
        </div>
      </div>
    </a>
  )
}

export default function PxAllProperties() {
  return (
    <section style={{
      padding: `${PX.sectionDefault}px 40px`,
      background: PX.neutral100,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64, alignItems: 'start' }}>
          <div style={{ position: 'sticky', top: 100 }}>
            <PxSectionLabel icon="home">Tous les biens</PxSectionLabel>
            <h2 style={{
              margin: '16px 0 16px',
              fontFamily: PX.font.display,
              fontSize: 'clamp(28px, 4vw, 48px)',
              lineHeight: 1.12,
              letterSpacing: '-1.3px',
              fontWeight: 500,
              color: PX.neutral700,
            }}>
              Découvrez tous nos biens disponibles
            </h2>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontSize: 14,
              lineHeight: 1.5,
              letterSpacing: '-0.42px',
              color: PX.neutral500,
              maxWidth: 320,
            }}>
              33 000 biens à louer dans toute la Suisse romande. Notre algorithme
              de matching IA vous trouve les meilleures opportunités selon vos critères.
            </p>
            <div style={{ marginTop: 20 }}>
              <PxLink to="/acheter" variant="dark" weight="medium" arrow>
                Parcourir tous les biens
              </PxLink>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PROPS.map(p => <PropertyRow key={p.id} p={p} />)}
          </div>
        </div>
      </div>
    </section>
  )
}
