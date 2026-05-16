// MEGGA Pro — "Comment ça marche" — accordion 3 étapes + mockup dynamique.
// Pattern adapté de PxHowItWorks. Section DARK.

import { useState } from 'react'
import { PX, PxAvatar, PxIconFont, PxFigmaIcon } from '../..'
import { useProFadeIn } from './useProFadeIn'
import PxProBadge from './PxProBadge'

type StepId = 'import' | 'match' | 'close'

interface Step {
  id: StepId
  number: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    id: 'import',
    number: '01',
    title: 'Importez en 1 clic',
    body:
      'CSV, vCard, Apimo, Sweepbright, Excel. Vos contacts et biens migrent en quelques secondes. Aucune ligne perdue.',
  },
  {
    id: 'match',
    number: '02',
    title: "Laissez l'IA matcher",
    body:
      'Le moteur de matching note chaque acheteur ↔ bien de 0 à 100. Les meilleurs matchs apparaissent dans votre Action Board, prêts à être envoyés.',
  },
  {
    id: 'close',
    number: '03',
    title: 'Closez en conformité',
    body:
      'Screening LAB/KYC en 1 clic, portail vendeur transparent, copilote négociation. Tout pour signer plus vite, sans risque réglementaire.',
  },
]

// ─── Mockups par étape ────────────────────────────────────────────────

function MockImportCard() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 480,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      padding: 28,
      boxShadow: PX.shadow.large,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <PxIconFont name="inbox" size={18} color={PX.neutral700} />
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.54px',
          color: PX.neutral700,
        }}>
          Import contacts
        </span>
      </div>

      <div style={{
        border: `1.5px dashed ${PX.neutral300}`,
        borderRadius: PX.radius.medium,
        padding: 24,
        textAlign: 'center',
        background: PX.neutral200,
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: PX.radius.pill,
          background: PX.neutral700,
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto',
        }}>
          <PxFigmaIcon name="arrow-up" size={18} color={PX.neutral100} />
        </div>
        <div style={{
          marginTop: 12,
          fontFamily: PX.font.sans,
          fontSize: 14,
          fontWeight: 500,
          color: PX.neutral700,
          letterSpacing: '-0.42px',
        }}>
          contacts-agence.csv
        </div>
        <div style={{
          marginTop: 4,
          fontFamily: PX.font.sans,
          fontSize: 12,
          fontWeight: 400,
          color: PX.neutral500,
          letterSpacing: '-0.36px',
        }}>
          247 contacts détectés
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Nom complet', mapped: 'full_name' },
          { label: 'Téléphone', mapped: 'phone' },
          { label: 'Budget', mapped: 'budget' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 10,
            borderRadius: PX.radius.tiny,
            background: PX.neutral200,
            fontFamily: PX.font.sans,
            fontSize: 13,
            letterSpacing: '-0.39px',
          }}>
            <span style={{ color: PX.neutral500, fontWeight: 400 }}>{row.label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: PX.neutral700, fontWeight: 500 }}>{row.mapped}</span>
              <span style={{
                width: 16, height: 16, borderRadius: PX.radius.pill, background: PX.neutral700,
                display: 'grid', placeItems: 'center',
              }}>
                <PxFigmaIcon name="check" size={9} color={PX.neutral100} />
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockMatchCard() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 480,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      padding: 28,
      boxShadow: PX.shadow.large,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <PxIconFont name="users" size={18} color={PX.neutral700} />
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.54px',
          color: PX.neutral700,
        }}>
          Matchs suggérés
        </span>
      </div>

      {[
        { name: 'Marie Dubois', score: 94, criteria: '4p · Carouge · 800K–1.2M', avatar: 'https://i.pravatar.cc/64?img=45' },
        { name: 'P. Schneider', score: 87, criteria: 'Villa · Vandœuvres · ≤ 3M', avatar: 'https://i.pravatar.cc/64?img=64' },
        { name: 'Lucas Martin', score: 76, criteria: '3p · Eaux-Vives · 600K', avatar: 'https://i.pravatar.cc/64?img=12' },
      ].map(m => (
        <div key={m.name} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          marginBottom: 8,
          borderRadius: PX.radius.small,
          border: `1px solid ${PX.neutral300}`,
        }}>
          <PxAvatar size={40} src={m.avatar} alt={m.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: PX.font.sans,
              fontSize: 14,
              fontWeight: 500,
              color: PX.neutral700,
              letterSpacing: '-0.42px',
            }}>{m.name}</div>
            <div style={{
              marginTop: 3,
              fontFamily: PX.font.sans,
              fontSize: 12,
              fontWeight: 400,
              color: PX.neutral500,
              letterSpacing: '-0.36px',
            }}>{m.criteria}</div>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
          }}>
            <span style={{
              fontFamily: PX.font.display,
              fontSize: 18,
              fontWeight: 500,
              color: PX.neutral700,
              letterSpacing: '-0.54px',
              lineHeight: 1,
            }}>{m.score}</span>
            <div style={{
              width: 56,
              height: 4,
              borderRadius: PX.radius.pill,
              background: PX.neutral200,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${m.score}%`,
                background: PX.neutral700,
              }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MockCloseCard() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 480,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      padding: 28,
      boxShadow: PX.shadow.large,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <PxIconFont name="shield" size={18} color={PX.neutral700} />
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.54px',
          color: PX.neutral700,
        }}>
          KYC Dubois · Marie
        </span>
      </div>

      <div style={{
        background: PX.neutral200,
        borderRadius: PX.radius.small,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: PX.radius.pill, background: PX.neutral700,
          display: 'grid', placeItems: 'center',
        }}>
          <PxFigmaIcon name="check" size={12} color={PX.neutral100} />
        </span>
        <span style={{
          fontFamily: PX.font.sans,
          fontSize: 13,
          fontWeight: 500,
          color: PX.neutral700,
          letterSpacing: '-0.39px',
        }}>
          Screening dilisense : aucun match PEP / sanctions
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: "Pièce d'identité", done: true },
          { label: 'Justificatif de domicile', done: true },
          { label: 'Source des fonds', done: true },
          { label: 'Profession et activité', done: false },
        ].map(item => (
          <div key={item.label} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            borderRadius: PX.radius.tiny,
            border: `1px solid ${PX.neutral300}`,
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: PX.radius.pill,
              background: item.done ? PX.neutral700 : 'transparent',
              border: item.done ? 'none' : `1.5px solid ${PX.neutral400}`,
              display: 'grid', placeItems: 'center',
            }}>
              {item.done && <PxFigmaIcon name="check" size={9} color={PX.neutral100} />}
            </span>
            <span style={{
              fontFamily: PX.font.sans,
              fontSize: 13,
              fontWeight: item.done ? 400 : 500,
              color: item.done ? PX.neutral500 : PX.neutral700,
              letterSpacing: '-0.39px',
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 16,
        padding: 12,
        background: PX.neutral700,
        borderRadius: PX.radius.small,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: PX.font.sans,
          fontSize: 13,
          fontWeight: 500,
          color: PX.neutral100,
          letterSpacing: '-0.39px',
        }}>
          Dossier complet à 75 %
        </span>
        <span style={{
          fontFamily: PX.font.sans,
          fontSize: 12,
          fontWeight: 400,
          color: PX.neutral400,
          letterSpacing: '-0.36px',
        }}>
          3 / 4
        </span>
      </div>
    </div>
  )
}

function StepMockup({ id }: { id: StepId }) {
  // Crossfade : les 3 mockups sont stackés via grid (mêmes coordonnées 1/1).
  // Le grid container prend la hauteur du plus grand des 3. Seul l'actif a
  // opacity 1. Transition 280ms ease Property X.
  const slots: Array<{ key: StepId; el: React.ReactNode }> = [
    { key: 'import', el: <MockImportCard /> },
    { key: 'match', el: <MockMatchCard /> },
    { key: 'close', el: <MockCloseCard /> },
  ]
  return (
    <div style={{
      display: 'grid',
      width: '100%',
      maxWidth: 480,
    }}>
      {slots.map(slot => (
        <div
          key={slot.key}
          style={{
            gridArea: '1 / 1',
            opacity: id === slot.key ? 1 : 0,
            pointerEvents: id === slot.key ? 'auto' : 'none',
            transition: `opacity 280ms ${PX.ease}`,
          }}
        >
          {slot.el}
        </div>
      ))}
    </div>
  )
}

// ─── Accordion item ───────────────────────────────────────────────────

function AccordionItem({
  step,
  active,
  onClick,
}: {
  step: Step
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: 28,
        borderRadius: PX.radius.large,
        background: active ? PX.inkBgSubtle : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: `background ${PX.duration.base} ${PX.ease}`,
        display: 'flex',
        flexDirection: 'column',
        gap: active ? 16 : 0,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 14,
          fontWeight: 500,
          color: active ? PX.inkInverse : PX.inkInverseMuted,
          letterSpacing: '-0.42px',
          minWidth: 32,
        }}>
          {step.number}
        </span>
        <span style={{
          flex: 1,
          fontFamily: PX.font.display,
          fontSize: 24,
          fontWeight: 500,
          color: active ? PX.inkInverse : PX.inkInverseSoft,
          letterSpacing: '-0.72px',
          lineHeight: 1.25,
        }}>
          {step.title}
        </span>
        <span style={{
          width: 32,
          height: 32,
          borderRadius: PX.radius.pill,
          background: active ? PX.inkInverse : 'rgba(255,255,255,0.10)',
          display: 'grid',
          placeItems: 'center',
          transition: `transform ${PX.duration.base} ${PX.ease}, background ${PX.duration.base} ${PX.ease}`,
          transform: active ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}>
          <PxFigmaIcon
            name="chevron-down"
            size={12}
            color={active ? PX.neutral700 : PX.inkInverse}
          />
        </span>
      </div>
      <div
        style={{
          overflow: 'hidden',
          maxHeight: active ? 200 : 0,
          opacity: active ? 1 : 0,
          transition: `max-height ${PX.duration.base} ${PX.ease}, opacity ${PX.duration.base} ${PX.ease}`,
          paddingLeft: 48,
        }}
      >
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.55,
          letterSpacing: '-0.45px',
          color: PX.inkInverseSoft,
          maxWidth: 480,
        }}>
          {step.body}
        </p>
      </div>
    </button>
  )
}

// ─── Main section ─────────────────────────────────────────────────────

export default function PxProHowItWorks() {
  const [active, setActive] = useState<StepId>('import')
  const labelRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(100)
  const contentRef = useProFadeIn<HTMLDivElement>(200)

  return (
    <section style={{
      paddingTop: 24,
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: 24,
      background: PX.pageBg,
    }}>
      <div style={{
        background: PX.inkBg,
        borderRadius: PX.radius.large,
        paddingTop: 96,
        paddingBottom: 96,
        paddingLeft: 64,
        paddingRight: 64,
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
              <PxProBadge icon="badge-process-check" invert>Comment ça marche</PxProBadge>
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
                color: PX.inkInverse,
              }}
            >
              De 0 à signé en 3 mouvements.
            </h2>
          </div>

          {/* Content : accordion left + mockup right */}
          <div
            ref={contentRef}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1fr)',
              gap: 64,
              alignItems: 'center',
            }}
          >
            {/* Accordion */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STEPS.map(step => (
                <AccordionItem
                  key={step.id}
                  step={step}
                  active={active === step.id}
                  onClick={() => setActive(step.id)}
                />
              ))}
            </div>

            {/* Mockup */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <StepMockup id={active} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
