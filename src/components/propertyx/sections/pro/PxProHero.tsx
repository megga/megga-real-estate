// MEGGA Pro — Hero "Pour les pros"
// Pattern aligné sur PxHero (dark rounded container, margin 24).
// 100% atoms Property X : eyebrow PxProBadge (badge-megaphone), PxButton,
// PxFigmaIcon, PxIconFont, PxAvatar.

import { PX, PxButton, PxAvatar, PxIconFont, PxFigmaIcon } from '../..'
import { useProFadeIn } from './useProFadeIn'
import PxProBadge from './PxProBadge'

// ─── Action Board Mockup ─────────────────────────────────────────────
// Mini-CRM stylisé en atomes PX.* — pas de capture mais une représentation
// fidèle de la DA. Plus on-brand qu'un screenshot Tailwind.

function MockChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
      borderRadius: PX.radius.pill,
      background: PX.neutral200,
      color: PX.neutral500,
      fontFamily: PX.font.sans,
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '-0.3px',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function MockRow({ name, sub, chip, avatar }: { name: string; sub: string; chip: string; avatar: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: PX.radius.small,
      background: PX.neutral100,
      border: `1px solid ${PX.neutral300}`,
    }}>
      <PxAvatar size={32} src={avatar} alt={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: PX.font.sans,
          fontSize: 13,
          fontWeight: 500,
          color: PX.neutral700,
          letterSpacing: '-0.4px',
          lineHeight: 1.2,
        }}>
          {name}
        </div>
        <div style={{
          fontFamily: PX.font.sans,
          fontSize: 11,
          fontWeight: 400,
          color: PX.neutral500,
          letterSpacing: '-0.3px',
          marginTop: 3,
          lineHeight: 1.3,
        }}>
          {sub}
        </div>
      </div>
      <MockChip>{chip}</MockChip>
    </div>
  )
}

function ActionBoardMockup() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 460,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      padding: 24,
      boxShadow: PX.shadow.large,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: PX.font.sans,
            fontSize: 18,
            fontWeight: 500,
            color: PX.neutral700,
            letterSpacing: '-0.54px',
            lineHeight: 1.2,
          }}>
            Aujourd'hui
          </div>
          <div style={{
            fontFamily: PX.font.sans,
            fontSize: 12,
            fontWeight: 400,
            color: PX.neutral500,
            letterSpacing: '-0.36px',
            marginTop: 4,
          }}>
            Vendredi 16 mai · 5 actions
          </div>
        </div>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: PX.radius.pill,
          background: PX.neutral700,
          display: 'grid',
          placeItems: 'center',
        }}>
          <PxIconFont name="lightbulb" size={14} color={PX.neutral100} />
        </div>
      </div>

      {/* AI Suggestion banner */}
      <div style={{
        background: PX.neutral200,
        borderRadius: PX.radius.small,
        padding: 14,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <div style={{
          width: 22,
          height: 22,
          borderRadius: PX.radius.pill,
          background: PX.neutral700,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}>
          <PxFigmaIcon name="sparkle" size={11} color={PX.neutral100} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: PX.font.sans,
            fontSize: 12,
            fontWeight: 500,
            color: PX.neutral500,
            letterSpacing: '-0.36px',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}>
            MEGGA AI
          </div>
          <div style={{
            fontFamily: PX.font.sans,
            fontSize: 13,
            fontWeight: 400,
            color: PX.neutral700,
            letterSpacing: '-0.39px',
            lineHeight: 1.4,
            marginTop: 6,
          }}>
            Relance Marie Dubois (chaude depuis 12 j) — bien 4p Carouge dispo.
          </div>
        </div>
      </div>

      {/* Action rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MockRow
          name="Lucas Martin"
          sub="Visite 14h00 — Champel"
          chip="Visite"
          avatar="https://i.pravatar.cc/64?img=12"
        />
        <MockRow
          name="Marie Dubois"
          sub="Rappel feedback visite"
          chip="Relance"
          avatar="https://i.pravatar.cc/64?img=45"
        />
        <MockRow
          name="J. Schmid"
          sub="Document KYC à valider"
          chip="LAB/KYC"
          avatar="https://i.pravatar.cc/64?img=33"
        />
      </div>

      {/* Footer pipeline mini-stats */}
      <div style={{
        display: 'flex',
        gap: 10,
        paddingTop: 8,
        borderTop: `1px solid ${PX.neutral300}`,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: PX.neutral500, fontFamily: PX.font.sans, letterSpacing: '-0.3px' }}>
            Pipeline
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, color: PX.neutral700, fontFamily: PX.font.sans, letterSpacing: '-0.6px', marginTop: 2 }}>
            CHF 4.2M
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: PX.neutral500, fontFamily: PX.font.sans, letterSpacing: '-0.3px' }}>
            Closes ce mois
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, color: PX.neutral700, fontFamily: PX.font.sans, letterSpacing: '-0.6px', marginTop: 2 }}>
            3
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Hero ───────────────────────────────────────────────────────
export default function PxProHero() {
  const badgeRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(120)
  const subRef = useProFadeIn<HTMLParagraphElement>(220)
  const ctaRef = useProFadeIn<HTMLDivElement>(340)
  const mockRef = useProFadeIn<HTMLDivElement>(460)
  const statsRef = useProFadeIn<HTMLDivElement>(580)

  return (
    <section style={{
      paddingTop: 24,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.pageBg,
    }}>
      <div style={{
        position: 'relative',
        background: PX.inkBg,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        paddingTop: 64,
        paddingBottom: 80,
        paddingLeft: 64,
        paddingRight: 64,
      }}>
        <div style={{
          position: 'relative',
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.85fr)',
          gap: 64,
          alignItems: 'center',
        }}>
          {/* LEFT — Content */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div ref={badgeRef}>
              <PxProBadge icon="badge-megaphone" invert>
                Pour les agences immobilières
              </PxProBadge>
            </div>

            <h1
              ref={titleRef}
              style={{
                margin: 0,
                marginTop: 28,
                fontFamily: PX.font.display,
                fontSize: 72,
                lineHeight: 1.05,
                letterSpacing: '-3px',
                fontWeight: 500,
                color: PX.inkInverse,
                maxWidth: 620,
              }}
            >
              Le CRM immobilier suisse, pensé par un agent.
            </h1>

            <p
              ref={subRef}
              style={{
                margin: 0,
                marginTop: 28,
                fontFamily: PX.font.sans,
                fontSize: 18,
                lineHeight: 1.5,
                letterSpacing: '-0.54px',
                fontWeight: 400,
                color: PX.inkInverseSoft,
                maxWidth: 540,
              }}
            >
              Compliance LAB/KYC intégrée. Pipeline 14 colonnes. Copilote IA Claude Sonnet 4.
              Conçu avec Gregory Lyonnet, agent à Genève.
            </p>

            <div
              ref={ctaRef}
              style={{
                marginTop: 36,
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <PxButton variant="invert" size="lg" to="/register">
                Créer mon compte gratuit
              </PxButton>
              <PxButton variant="ghost" size="lg" to="#tarifs" showIcon={false}>
                <span style={{ color: PX.inkInverse }}>Voir les tarifs</span>
              </PxButton>
            </div>

            {/* Trust stats */}
            <div
              ref={statsRef}
              style={{
                marginTop: 56,
                display: 'flex',
                gap: 40,
                flexWrap: 'wrap',
              }}
            >
              {[
                { value: '10+', label: 'Agences pilotes' },
                { value: '26', label: 'Cantons couverts' },
                { value: '4', label: 'Langues — FR/DE/EN/IT' },
              ].map(stat => (
                <div key={stat.label} style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontFamily: PX.font.display,
                    fontSize: 30,
                    fontWeight: 500,
                    letterSpacing: '-0.9px',
                    color: PX.inkInverse,
                    lineHeight: 1,
                  }}>
                    {stat.value}
                  </span>
                  <span style={{
                    marginTop: 8,
                    fontFamily: PX.font.sans,
                    fontSize: 13,
                    fontWeight: 400,
                    letterSpacing: '-0.4px',
                    color: PX.inkInverseMuted,
                  }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Mockup */}
          <div
            ref={mockRef}
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <ActionBoardMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
