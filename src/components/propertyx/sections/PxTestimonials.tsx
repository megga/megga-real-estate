// MEGGA Marketplace — Property X testimonials section.
// 3 cards de témoignages, layout asymétrique (1 grande à gauche, 2 petites
// à droite empilées).

import { PX } from '../tokens'
import PxSectionLabel from '../PxSectionLabel'

const TESTIMONIALS = [
  {
    id: 't1',
    quote: "MEGGA a transformé ma recherche d'appartement à Genève. L'IA me proposait des biens qui correspondaient vraiment à mes critères — j'ai trouvé en 2 semaines au lieu de 6 mois.",
    name: 'Sophie Bertrand',
    location: 'Carouge, GE',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
  },
  {
    id: 't2',
    quote: "Service exceptionnel, équipe à l'écoute, transparence totale sur les frais. Je recommande à 100%.",
    name: 'Marc Dubois',
    location: 'Lausanne, VD',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
  },
  {
    id: 't3',
    quote: "Plateforme intuitive, beaucoup de choix, agents pro. Du jamais vu en Suisse romande.",
    name: 'Léa Marchand',
    location: 'Sion, VS',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
  },
]

function TestimonialCard({ t, compact }: { t: typeof TESTIMONIALS[0]; compact: boolean }) {
  return (
    <div style={{
      padding: compact ? 24 : 32,
      background: PX.surfaceBg,
      borderRadius: PX.radiusCard,
      boxShadow: PX.shadow.soft,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 20,
      height: '100%',
    }}>
      <p style={{
        margin: 0,
        fontFamily: PX.font.display,
        fontSize: compact ? 15 : 19,
        lineHeight: 1.5,
        color: PX.ink,
        letterSpacing: -0.2,
        fontWeight: 500,
      }}>
        « {t.quote} »
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={t.avatar} alt={t.name} style={{
          width: compact ? 40 : 48,
          height: compact ? 40 : 48,
          borderRadius: 999,
          objectFit: 'cover',
        }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: PX.ink }}>{t.name}</div>
          <div style={{ fontSize: 12.5, color: PX.inkMuted, marginTop: 2 }}>{t.location}</div>
        </div>
      </div>
    </div>
  )
}

export default function PxTestimonials() {
  return (
    <section style={{
      padding: `${PX.space.section}px ${PX.space.pageX}px`,
      background: PX.pageBg,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 48, maxWidth: 540 }}>
          <PxSectionLabel>Témoignages</PxSectionLabel>
          <h2 style={{
            margin: '16px 0 0',
            fontFamily: PX.font.display,
            fontSize: 'clamp(28px, 4vw, 44px)',
            lineHeight: 1.12,
            letterSpacing: -0.8,
            fontWeight: 600,
            color: PX.ink,
          }}>
            Ce que pensent nos clients
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 20,
        }}>
          <TestimonialCard t={TESTIMONIALS[0]} compact={false} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <TestimonialCard t={TESTIMONIALS[1]} compact />
            <TestimonialCard t={TESTIMONIALS[2]} compact />
          </div>
        </div>
      </div>
    </section>
  )
}
