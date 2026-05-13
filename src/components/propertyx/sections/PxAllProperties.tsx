// MEGGA Marketplace — Property X "All properties" section.
// Section claire, header gauche + biens à droite en cards horizontales
// (photo + meta). Mock pour l'instant.

import { PX } from '../tokens'
import PxSectionLabel from '../PxSectionLabel'

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

function StatIcon({ kind }: { kind: 'surface' | 'bed' | 'bath' }) {
  const paths = {
    surface: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></>,
    bed: <><path d="M2 18v-4a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v4M2 18h20M6 10V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></>,
    bath: <><path d="M9 7V5a3 3 0 0 1 6 0v2M2 13h20M3 13v4a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4"/></>,
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PX.inkMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {paths[kind]}
    </svg>
  )
}

function PropertyRow({ p }: { p: PropMock }) {
  return (
    <a href={`/listing/${p.id}`} style={{
      display: 'flex',
      gap: 24,
      padding: 16,
      background: PX.surfaceBg,
      borderRadius: PX.radiusCard,
      boxShadow: PX.shadow.soft,
      textDecoration: 'none',
      color: 'inherit',
      transition: `box-shadow ${PX.duration.fast} ${PX.ease}, transform ${PX.duration.fast} ${PX.ease}`,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = PX.shadow.card; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = PX.shadow.soft; e.currentTarget.style.transform = 'translateY(0)' }}>
      <div style={{
        flexShrink: 0,
        width: 220, height: 180,
        borderRadius: PX.radiusImage,
        backgroundImage: `url("${p.image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      }}>
        <span style={{
          position: 'absolute', top: 10, left: 10,
          padding: '4px 10px',
          background: PX.surfaceBg,
          borderRadius: PX.radiusPill,
          fontSize: 11.5,
          fontWeight: 600,
          color: PX.ink,
        }}>{p.badge}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12.5, color: PX.inkMuted, marginBottom: 4,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PX.inkMuted} strokeWidth="1.7">
              <path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {p.address}
          </div>
          <h3 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 20,
            fontWeight: 600,
            color: PX.ink,
            letterSpacing: -0.3,
          }}>{p.title}</h3>
          <p style={{
            margin: '8px 0 0',
            fontSize: 13.5,
            lineHeight: 1.55,
            color: PX.inkSoft,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{p.description}</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          fontSize: 12.5, color: PX.inkMuted, marginTop: 12,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <StatIcon kind="surface" /> {p.surface} m²
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <StatIcon kind="bed" /> {p.bedrooms} ch.
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <StatIcon kind="bath" /> {p.bathrooms} sdb
          </span>
        </div>
      </div>
    </a>
  )
}

export default function PxAllProperties() {
  return (
    <section style={{
      padding: `${PX.space.section}px ${PX.space.pageX}px`,
      background: PX.pageBg,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64, alignItems: 'start' }}>
          {/* Header gauche */}
          <div style={{ position: 'sticky', top: 100 }}>
            <PxSectionLabel>Tous les biens</PxSectionLabel>
            <h2 style={{
              margin: '16px 0 16px',
              fontFamily: PX.font.display,
              fontSize: 'clamp(28px, 4vw, 42px)',
              lineHeight: 1.12,
              letterSpacing: -0.8,
              fontWeight: 600,
              color: PX.ink,
            }}>
              Découvrez tous nos biens disponibles
            </h2>
            <p style={{
              margin: 0,
              fontSize: 14.5,
              lineHeight: 1.6,
              color: PX.inkSoft,
              maxWidth: 320,
            }}>
              33 000 biens à louer dans toute la Suisse romande. Notre algorithme
              de matching IA vous trouve les meilleures opportunités selon vos critères.
            </p>
            <a href="/acheter" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 20,
              fontSize: 14,
              fontWeight: 600,
              color: PX.ink,
              textDecoration: 'none',
              borderBottom: `1px solid ${PX.ink}`,
              paddingBottom: 2,
            }}>
              Parcourir toute la marketplace →
            </a>
          </div>

          {/* Liste de biens */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PROPS.map(p => <PropertyRow key={p.id} p={p} />)}
          </div>
        </div>
      </div>
    </section>
  )
}
