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
]

function TestimonialCard({ t }: { t: typeof TESTIMONIALS[0]; compact?: boolean }) {
  // Layout fidèle Figma : Avatar 80×80 LEFT + Content RIGHT (quote + name/location).
  // Card 540×240, padding 43px top/bottom, 52px left/right.
  return (
    <div style={{
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
      padding: '43px 52px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 24,
      minHeight: 240,
    }}>
      <PxAvatar src={t.avatar} alt={t.name} size={80} />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 16,
        minHeight: 148,
      }}>
        <p style={{
          margin: 0,
          fontFamily: PX.font.display,
          // Display/4/Medium = 20/1.25/500/-3 (taille citation Figma)
          fontSize: 18,
          lineHeight: 1.25,
          letterSpacing: '-0.54px',
          fontWeight: 500,
          color: PX.neutral700,
        }}>
          “{t.quote}”
        </p>
        <div>
          <div style={{
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-0.48px',
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
      padding: `${PX.sectionDefault}px 24px`,
      background: PX.neutral100,
    }}>
      <div style={{ maxWidth: 1112, margin: '0 auto' }}>
        {/* Layout fidèle Figma : 2 colonnes 540 + 32 gap (1112 total)
            LEFT  : header (label+H2+intro) → card 1 → card 2
            RIGHT : card 3 → card 4 → bouton "Commencer" */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 32,
          alignItems: 'start',
        }}>
          {/* Colonne gauche */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <PxSectionLabel icon="message">Témoignages</PxSectionLabel>
              <h2 style={{
                margin: '16px 0 16px',
                fontFamily: PX.font.display,
                fontSize: 'clamp(28px, 4vw, 48px)',
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
            <TestimonialCard t={TESTIMONIALS[1]} />
            <TestimonialCard t={TESTIMONIALS[2]} />
          </div>

          {/* Colonne droite */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <TestimonialCard t={TESTIMONIALS[0]} />
            <TestimonialCard t={TESTIMONIALS[3]} />
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
