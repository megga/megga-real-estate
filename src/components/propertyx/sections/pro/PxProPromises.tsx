// MEGGA Pro — "Pourquoi les agences signent" — 3 promesses chiffrées.
// Light section, 3 cards horizontal. Wow moment : gros chiffres Display 8 (48px).

import { PX, PxSectionLabel, PxIcon } from '../..'
import type { PxIconName } from '../..'
import { useProFadeIn } from './useProFadeIn'

interface Promise {
  metric: string
  unit: string
  label: string
  description: string
  icon: PxIconName
}

const PROMISES: Promise[] = [
  {
    metric: '−40',
    unit: '%',
    label: 'Temps administratif',
    description:
      "Action Board IA, génération automatique des relances et des documents. L'agent récupère ses soirées.",
    icon: 'clock',
  },
  {
    metric: '−60',
    unit: '%',
    label: 'Risque LAB/KYC',
    description:
      'Screening dilisense intégré, dossier KYC complet en moins de 5 minutes. Conforme FINMA et LBA.',
    icon: 'shield',
  },
  {
    metric: '+30',
    unit: '%',
    label: 'Vitesse de closing',
    description:
      'Matching acheteurs ↔ biens, portail vendeur transparent, copilote négociation. Le deal va plus vite.',
    icon: 'sparkle',
  },
]

function PromiseCard({ p, delay }: { p: Promise; delay: number }) {
  const ref = useProFadeIn<HTMLDivElement>(delay)

  return (
    <div
      ref={ref}
      style={{
        flex: 1,
        minWidth: 0,
        background: PX.neutral100,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.large,
        padding: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        position: 'relative',
        transition: `transform ${PX.duration.base} ${PX.ease}, box-shadow ${PX.duration.base} ${PX.ease}`,
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        const card = e.currentTarget
        card.style.transform = 'translateY(-6px)'
        card.style.boxShadow = PX.shadow.medium
      }}
      onMouseLeave={(e) => {
        const card = e.currentTarget
        card.style.transform = 'translateY(0)'
        card.style.boxShadow = 'none'
      }}
    >
      {/* Icon top-right pill */}
      <div style={{
        position: 'absolute',
        top: 24,
        right: 24,
        width: 44,
        height: 44,
        borderRadius: PX.radius.pill,
        background: PX.neutral200,
        display: 'grid',
        placeItems: 'center',
      }}>
        <PxIcon name={p.icon} size={20} color={PX.neutral700} />
      </div>

      {/* Big metric */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 80,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-3.5px',
          color: PX.neutral700,
        }}>
          {p.metric}
        </span>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 36,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-1.5px',
          color: PX.neutral500,
          paddingBottom: 8,
          marginLeft: 4,
        }}>
          {p.unit}
        </span>
      </div>

      {/* Label */}
      <div>
        <div style={{
          fontFamily: PX.font.display,
          fontSize: 22,
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: '-0.66px',
          color: PX.neutral700,
        }}>
          {p.label}
        </div>
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
          {p.description}
        </p>
      </div>
    </div>
  )
}

export default function PxProPromises() {
  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const subRef = useProFadeIn<HTMLParagraphElement>(180)

  return (
    <section style={{
      paddingTop: 160,
      paddingBottom: 80,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.pageBg,
    }}>
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
      }}>
        {/* Section header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 24,
          marginBottom: 64,
          maxWidth: 720,
        }}>
          <div ref={labelRef}>
            <PxSectionLabel icon="sparkle">ROI mesurable</PxSectionLabel>
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
            Pourquoi les agences signent.
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
            Pas une promesse marketing : les chiffres remontés par les 10 agences pilotes
            après 3 mois d'usage quotidien.
          </p>
        </div>

        {/* Cards */}
        <div style={{
          display: 'flex',
          gap: 24,
          alignItems: 'stretch',
          flexWrap: 'wrap',
        }}>
          {PROMISES.map((p, i) => (
            <PromiseCard key={p.label} p={p} delay={i * 90} />
          ))}
        </div>
      </div>
    </section>
  )
}
