// MEGGA Marketplace — Property X testimonials section.
// Source : Figma Home V3 (node 9552:21432) — layout asymétrique 5 cards.
// Refactor avec PxAvatar + PxSectionLabel + PxButton.

import { PX, PxAvatar, PxSectionLabel, PxButton } from '..'

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
  {
    id: 't4',
    quote: "Une plateforme imbattable pour la qualité du service et la couverture nationale.",
    name: 'Matteo Conti',
    location: 'Lugano, TI',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
  },
  {
    id: 't5',
    quote: "J'ai trouvé mon premier appartement en quelques jours. Une expérience fluide et transparente.",
    name: 'Sandra Hofer',
    location: 'Zurich, ZH',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80',
  },
]

function TestimonialCard({ t, compact }: { t: typeof TESTIMONIALS[0]; compact: boolean }) {
  return (
    <div style={{
      padding: compact ? 24 : 32,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
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
        color: PX.neutral700,
        letterSpacing: '-0.57px',
        fontWeight: 500,
      }}>
        « {t.quote} »
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <PxAvatar src={t.avatar} alt={t.name} size={compact ? 40 : 48} />
        <div>
          <div style={{
            fontFamily: PX.font.sans,
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '-0.42px',
            color: PX.neutral700,
          }}>{t.name}</div>
          <div style={{
            fontFamily: PX.font.sans,
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: '-0.42px',
            color: PX.neutral500,
            marginTop: 2,
          }}>{t.location}</div>
        </div>
      </div>
    </div>
  )
}

export default function PxTestimonials() {
  return (
    <section style={{
      padding: `${PX.sectionDefault}px 40px`,
      background: PX.neutral100,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Layout fidèle Figma : 2 colonnes alignées
            LEFT  : header (label+H2+intro) → card 1 → card 2
            RIGHT : card 3 → card 4 → bouton "Commencer" */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          alignItems: 'start',
        }}>
          {/* Colonne gauche */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <PxSectionLabel icon="message">Témoignages</PxSectionLabel>
              <h2 style={{
                margin: '16px 0 16px',
                fontFamily: PX.font.display,
                fontSize: 'clamp(28px, 4vw, 44px)',
                lineHeight: 1.12,
                letterSpacing: '-1.3px',
                fontWeight: 500,
                color: PX.neutral700,
              }}>
                Ce que pensent nos clients
              </h2>
              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
                maxWidth: 380,
              }}>
                5 000 clients accompagnés depuis 2019 en Suisse romande
                et alémanique. Voici quelques retours d'expérience.
              </p>
            </div>
            <TestimonialCard t={TESTIMONIALS[1]} compact />
            <TestimonialCard t={TESTIMONIALS[2]} compact />
          </div>

          {/* Colonne droite */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <TestimonialCard t={TESTIMONIALS[0]} compact />
            <TestimonialCard t={TESTIMONIALS[3]} compact />
            {/* Bouton "Commencer" placé dans la colonne droite, fidèle V3 */}
            <div>
              <PxButton to="/acheter" variant="primary" size="lg">
                Commencer
              </PxButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
