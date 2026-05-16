// MEGGA Pro — "Tout votre métier en un outil" — features section.
// Pattern strict PropertyXAboutPage "Values" : 3 rows × 2 cards, dividers
// neutral300 1px entre rows, alignement alternance end/start, width 272.
// Icons : PxIconFont (filled) — 100% catalogue Property X listé.

import { PX, PxIconFont } from '../..'
import type { PxIconFontName } from '../..'
import { useProFadeIn } from './useProFadeIn'
import PxProBadge from './PxProBadge'

interface Feature {
  icon: PxIconFontName
  title: string
  description: string
}

// 6 capacités — alignement alternation comme About page Property X
const FEATURES: Feature[] = [
  {
    icon: 'dashboard',
    title: 'Action Board IA',
    description:
      "Chaque matin, l'IA priorise vos relances, visites et tâches LAB/KYC. Ouvrez le CRM, sachez quoi faire.",
  },
  {
    icon: 'grid',
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
    icon: 'lightbulb',
    title: 'Copilote Claude Sonnet 4',
    description:
      'Résumés contacts, suggestions next-best-action, brouillons de messages. Validation humaine obligatoire.',
  },
]

function FeatureCard({ f, alignment, delay }: { f: Feature; alignment: 'end' | 'start'; delay: number }) {
  const ref = useProFadeIn<HTMLDivElement>(delay)
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        flex: 1,
        maxWidth: 480,
        alignSelf: alignment === 'end' ? 'flex-end' : 'flex-start',
      }}
    >
      {/* Filled icon 28×28 — pattern PropertyXAboutPage exact */}
      <div style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <PxIconFont name={f.icon} size={28} color={PX.neutral700} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.display,
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
        }}>
          {f.title}
        </h3>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
          maxWidth: 480,
        }}>
          {f.description}
        </p>
      </div>
    </div>
  )
}

function Divider() {
  return (
    <div style={{
      height: 1,
      background: PX.neutral300,
      width: '100%',
    }} />
  )
}

export default function PxProFeatures() {
  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const subRef = useProFadeIn<HTMLParagraphElement>(180)

  return (
    <section style={{
      paddingTop: 160,
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
          marginBottom: 80,
          maxWidth: 720,
        }}>
          <div ref={labelRef}>
            <PxProBadge icon="badge-allprops-home">Le produit</PxProBadge>
          </div>
          <h2
            ref={titleRef}
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 48,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-1.44px',
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
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              maxWidth: 562,
            }}
          >
            Plus de jonglage entre CRM, tableur, WhatsApp et dossier papier KYC.
            Tout est dans MEGGA, conçu pour l'agent suisse.
          </p>
        </div>

        {/* Grid — exact PropertyXAboutPage pattern : 3 rows × 2 cards + dividers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
          {/* Row 1 — items-end */}
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end' }}>
            <FeatureCard f={FEATURES[0]} alignment="end" delay={0} />
            <FeatureCard f={FEATURES[1]} alignment="end" delay={80} />
          </div>
          <Divider />

          {/* Row 2 — items-end */}
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end' }}>
            <FeatureCard f={FEATURES[2]} alignment="end" delay={160} />
            <FeatureCard f={FEATURES[3]} alignment="end" delay={240} />
          </div>
          <Divider />

          {/* Row 3 — items-start */}
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
            <FeatureCard f={FEATURES[4]} alignment="start" delay={320} />
            <FeatureCard f={FEATURES[5]} alignment="start" delay={400} />
          </div>
        </div>
      </div>
    </section>
  )
}
