// MEGGA Pro — "Pourquoi les agences signent" — 3 promesses chiffrées.
// Light section, 3 cards horizontal.
// Atoms : PxProBadge (eyebrow badge-featured-star), PxIconFont (filled icons).

import { PX, PxIconFont } from '../..'
import type { PxIconFontName } from '../..'
import { useProFadeIn } from './useProFadeIn'
import { useBreakpoint, isMobile, isDesktop } from './useBreakpoint'
import PxProBadge from './PxProBadge'

interface Promise {
  metric: string
  unit: string
  label: string
  description: string
  icon: PxIconFontName
}

const PROMISES: Promise[] = [
  {
    metric: '−40',
    unit: '%',
    label: 'Temps administratif',
    description:
      "Action Board IA, génération automatique des relances et des documents. L'agent récupère ses soirées.",
    icon: 'hourglass',
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
    icon: 'lightning',
  },
]

function PromiseCard({ p, delay, mobile }: { p: Promise; delay: number; mobile: boolean }) {
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
        padding: mobile ? 28 : 40,
        display: 'flex',
        flexDirection: 'column',
        gap: mobile ? 18 : 24,
        position: 'relative',
      }}
    >
      <div style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PxIconFont name={p.icon} size={28} color={PX.neutral700} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: mobile ? 56 : 72,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: mobile ? '-2.2px' : '-3px',
          color: PX.neutral700,
        }}>
          {p.metric}
        </span>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: mobile ? 28 : 36,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: mobile ? '-1.1px' : '-1.5px',
          color: PX.neutral500,
          paddingBottom: 4,
          marginLeft: 4,
        }}>
          {p.unit}
        </span>
      </div>

      {/* Label */}
      <div>
        <div style={{
          fontFamily: PX.font.display,
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
        }}>
          {p.label}
        </div>
        <p style={{
          margin: 0,
          marginTop: 12,
          fontFamily: PX.font.sans,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>
          {p.description}
        </p>
      </div>
    </div>
  )
}

export default function PxProPromises() {
  const bp = useBreakpoint()
  const mobile = isMobile(bp)
  const desktop = isDesktop(bp)

  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const subRef = useProFadeIn<HTMLParagraphElement>(180)

  return (
    <section style={{
      paddingTop: mobile ? 80 : desktop ? 160 : 120,
      paddingBottom: mobile ? 48 : 80,
      paddingLeft: mobile ? 16 : 24,
      paddingRight: mobile ? 16 : 24,
      background: PX.pageBg,
    }}>
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
          gap: mobile ? 16 : 24,
          marginBottom: mobile ? 40 : 64,
          maxWidth: 720,
        }}>
          <div ref={labelRef}>
            <PxProBadge icon="badge-featured-star">ROI mesurable</PxProBadge>
          </div>
          <h2
            ref={titleRef}
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: mobile ? 32 : 48,
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: mobile ? '-1.28px' : '-1.44px',
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
              fontSize: mobile ? 15 : 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              maxWidth: 562,
            }}
          >
            Pas une promesse marketing : les chiffres remontés par les 10 agences pilotes
            après 3 mois d'usage quotidien.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : desktop ? 'repeat(3, 1fr)' : '1fr 1fr',
          gap: mobile ? 16 : 24,
          alignItems: 'stretch',
        }}>
          {PROMISES.map((p, i) => (
            <PromiseCard key={p.label} p={p} delay={i * 90} mobile={mobile} />
          ))}
        </div>
      </div>
    </section>
  )
}
