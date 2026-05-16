// MEGGA Pro — "Tout votre métier en un outil" — features grid.
// Light section, 6-card grid (3 cols × 2 rows). Cards minimal Property X.

import { PX, PxSectionLabel, PxIcon } from '../..'
import type { PxIconName } from '../..'
import { useProFadeIn } from './useProFadeIn'

interface Feature {
  icon: PxIconName
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: 'sparkle',
    title: 'Action Board IA',
    description:
      "Chaque matin, l'IA priorise vos relances, visites et tâches LAB/KYC. Ouvrez le CRM, sachez quoi faire.",
  },
  {
    icon: 'sort',
    title: 'Pipeline 14 colonnes',
    description:
      'Du nouveau lead au notaire signé. Drag & drop, deals à risque mis en avant, valeur totale temps réel.',
  },
  {
    icon: 'users',
    title: 'Matching automatique',
    description:
      'Score 0–100 sur budget, zone, type, surface, features. Nouveau bien = matchs proposés instantanément.',
  },
  {
    icon: 'shield',
    title: 'KYC en 1 clic',
    description:
      'Screening dilisense (PEP, sanctions), checklist auto, dossier complet en 5 minutes. Conforme FINMA.',
  },
  {
    icon: 'eye',
    title: 'Portail vendeur',
    description:
      "Votre vendeur voit l'avancement en temps réel : visites planifiées, feedbacks, offres reçues, documents.",
  },
  {
    icon: 'message',
    title: 'Copilote Claude Sonnet 4',
    description:
      'Résumés contacts, suggestions next-best-action, brouillons de messages. Validation humaine obligatoire.',
  },
]

function FeatureCard({ f, delay }: { f: Feature; delay: number }) {
  const ref = useProFadeIn<HTMLDivElement>(delay)
  return (
    <div
      ref={ref}
      style={{
        padding: 32,
        background: PX.neutral200,
        borderRadius: PX.radius.large,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        transition: `background ${PX.duration.base} ${PX.ease}, transform ${PX.duration.base} ${PX.ease}`,
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = PX.neutral100
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = PX.shadow.regular
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = PX.neutral200
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Icon */}
      <div style={{
        width: 48,
        height: 48,
        borderRadius: PX.radius.pill,
        background: PX.neutral700,
        display: 'grid',
        placeItems: 'center',
      }}>
        <PxIcon name={f.icon} size={22} color={PX.neutral100} />
      </div>

      {/* Title + desc */}
      <div>
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.display,
          fontSize: 22,
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: '-0.66px',
          color: PX.neutral700,
        }}>
          {f.title}
        </h3>
        <p style={{
          margin: 0,
          marginTop: 12,
          fontFamily: PX.font.sans,
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.55,
          letterSpacing: '-0.45px',
          color: PX.neutral500,
        }}>
          {f.description}
        </p>
      </div>
    </div>
  )
}

export default function PxProFeatures() {
  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const subRef = useProFadeIn<HTMLParagraphElement>(180)

  return (
    <section style={{
      paddingTop: 120,
      paddingBottom: 120,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.pageBg,
    }}>
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 24,
          marginBottom: 64,
          maxWidth: 720,
        }}>
          <div ref={labelRef}>
            <PxSectionLabel icon="settings">Le produit</PxSectionLabel>
          </div>
          <h2
            ref={titleRef}
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 56,
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-2.5px',
              color: PX.neutral700,
            }}
          >
            Tout votre métier en un seul outil.
          </h2>
          <p
            ref={subRef}
            style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontSize: 18,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.54px',
              color: PX.neutral500,
              maxWidth: 580,
            }}
          >
            Plus de jonglage entre CRM, tableur, WhatsApp et dossier papier KYC.
            Tout est dans MEGGA, conçu pour l'agent suisse.
          </p>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 24,
        }}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} f={f} delay={i * 60} />
          ))}
        </div>
      </div>
    </section>
  )
}
