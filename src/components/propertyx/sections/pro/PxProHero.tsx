// MEGGA Pro — Hero "Pour les pros"
// Pattern aligné sur PxHero (dark rounded container, margin 24).
// Visuel produit : Action Board CRM dans un iPad Pro 11 Landscape bezel
// (pattern PxExploreCTA réutilisé) — montre "votre futur CRM dans la main".
// Responsive : mobile stack vertical / tablet réduit / desktop original.

import { PX, PxButton, PxAvatar, PxIconFont, PxFigmaIcon, PxLogo } from '../..'
import type { PxIconFontName } from '../..'
import { useProFadeIn } from './useProFadeIn'
import { useBreakpoint, isMobile, isDesktop } from './useBreakpoint'
import PxProBadge from './PxProBadge'
import IpadFrame from './IpadFrame'

// ─── POI pin pattern PxHero (55×55 white pill + home-poi icon) ───────
function HomePoiPin({
  top,
  left,
  bottom,
  right,
}: {
  top?: string
  left?: string
  bottom?: string
  right?: string
}) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top,
        left,
        bottom,
        right,
        width: 55,
        height: 55,
        borderRadius: PX.radius.pill,
        background: PX.neutral100,
        filter: 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.25))',
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <PxFigmaIcon name="home-poi" size={29} color={PX.neutral700} />
    </div>
  )
}

// ─── Sidebar de l'app CRM (nav left dans l'iPad) ──────────────────────
function CrmSidebarNav() {
  const ITEMS: Array<{ icon: PxIconFontName; active?: boolean }> = [
    { icon: 'dashboard', active: true },
    { icon: 'contacts' },
    { icon: 'grid' },
    { icon: 'calendar' },
    { icon: 'shield' },
    { icon: 'message' },
  ]
  return (
    <div style={{
      width: 64,
      flexShrink: 0,
      background: PX.neutral100,
      borderRight: `1px solid ${PX.neutral300}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 20,
      paddingBottom: 20,
      gap: 14,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: PX.radius.tiny,
        background: PX.neutral700, display: 'grid', placeItems: 'center',
        marginBottom: 8,
      }}>
        <PxLogo variant="dark" form="icon" size="sm" />
      </div>
      {ITEMS.map((item, i) => (
        <div key={i} style={{
          width: 40, height: 40, borderRadius: PX.radius.tiny,
          background: item.active ? PX.neutral200 : 'transparent',
          display: 'grid', placeItems: 'center',
        }}>
          <PxIconFont
            name={item.icon}
            size={18}
            color={item.active ? PX.neutral700 : PX.neutral400}
          />
        </div>
      ))}
    </div>
  )
}

function MockChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
      borderRadius: PX.radius.pill,
      background: PX.neutral200,
      color: PX.neutral700,
      fontFamily: PX.font.sans, fontSize: 11, fontWeight: 500,
      letterSpacing: '-0.33px', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function ActionRow({ name, sub, chip, avatar }: { name: string; sub: string; chip: string; avatar: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      borderRadius: PX.radius.small,
      background: PX.neutral100,
      border: `1px solid ${PX.neutral300}`,
    }}>
      <PxAvatar size={32} src={avatar} alt={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: PX.font.sans, fontSize: 13, fontWeight: 500,
          color: PX.neutral700, letterSpacing: '-0.39px', lineHeight: 1.2,
        }}>
          {name}
        </div>
        <div style={{
          fontFamily: PX.font.sans, fontSize: 11, fontWeight: 400,
          color: PX.neutral500, letterSpacing: '-0.33px',
          marginTop: 3, lineHeight: 1.3,
        }}>
          {sub}
        </div>
      </div>
      <MockChip>{chip}</MockChip>
    </div>
  )
}

function CrmMainContent() {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: PX.font.display, fontSize: 22, fontWeight: 500,
            color: PX.neutral700, letterSpacing: '-0.66px', lineHeight: 1.2,
          }}>
            Aujourd'hui
          </div>
          <div style={{
            fontFamily: PX.font.sans, fontSize: 12, fontWeight: 400,
            color: PX.neutral500, letterSpacing: '-0.36px', marginTop: 4,
          }}>
            Vendredi 16 mai · 5 actions
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 8,
        }}>
          <div style={{
            padding: '6px 12px', borderRadius: PX.radius.pill,
            background: PX.neutral200,
            fontFamily: PX.font.sans, fontSize: 12, fontWeight: 500,
            color: PX.neutral500, letterSpacing: '-0.36px',
          }}>
            Filtrer
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: PX.radius.pill,
            background: PX.neutral700, display: 'grid', placeItems: 'center',
          }}>
            <PxIconFont name="lightbulb" size={14} color={PX.neutral100} />
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 16,
        flex: 1,
        minHeight: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{
            background: PX.neutral100, border: `1px solid ${PX.neutral300}`,
            borderRadius: PX.radius.small, padding: 14,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: PX.radius.pill,
              background: PX.neutral700, display: 'grid', placeItems: 'center',
              flexShrink: 0, marginTop: 1,
            }}>
              <PxFigmaIcon name="sparkle" size={11} color={PX.neutral100} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: PX.font.sans, fontSize: 10, fontWeight: 500,
                color: PX.neutral500, letterSpacing: '-0.3px',
                textTransform: 'uppercase', lineHeight: 1,
              }}>
                MEGGA AI
              </div>
              <div style={{
                fontFamily: PX.font.sans, fontSize: 13, fontWeight: 400,
                color: PX.neutral700, letterSpacing: '-0.39px',
                lineHeight: 1.4, marginTop: 6,
              }}>
                Relance Marie Dubois (chaude depuis 12 j) — bien 4p Carouge dispo.
              </div>
            </div>
          </div>

          <ActionRow
            name="Lucas Martin"
            sub="Visite 14h00 — Champel"
            chip="Visite"
            avatar="https://i.pravatar.cc/64?img=12"
          />
          <ActionRow
            name="Marie Dubois"
            sub="Rappel feedback visite"
            chip="Relance"
            avatar="https://i.pravatar.cc/64?img=45"
          />
          <ActionRow
            name="J. Schmid"
            sub="Document KYC à valider"
            chip="LAB/KYC"
            avatar="https://i.pravatar.cc/64?img=33"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Pipeline', value: 'CHF 4.2M', icon: 'chart' as PxIconFontName },
              { label: 'Closes', value: '3', icon: 'trophy' as PxIconFontName },
            ].map(kpi => (
              <div key={kpi.label} style={{
                background: PX.neutral100, border: `1px solid ${PX.neutral300}`,
                borderRadius: PX.radius.small, padding: 12,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <PxIconFont name={kpi.icon} size={18} color={PX.neutral500} />
                <div>
                  <div style={{
                    fontFamily: PX.font.display, fontSize: 18, fontWeight: 500,
                    color: PX.neutral700, letterSpacing: '-0.54px', lineHeight: 1,
                  }}>
                    {kpi.value}
                  </div>
                  <div style={{
                    fontFamily: PX.font.sans, fontSize: 11, fontWeight: 400,
                    color: PX.neutral500, letterSpacing: '-0.33px', marginTop: 4,
                  }}>
                    {kpi.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            flex: 1, minHeight: 0,
            background: PX.neutral100, border: `1px solid ${PX.neutral300}`,
            borderRadius: PX.radius.small, padding: 14,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              fontFamily: PX.font.sans, fontSize: 12, fontWeight: 500,
              color: PX.neutral500, letterSpacing: '-0.36px',
              textTransform: 'uppercase',
            }}>
              Pipeline · 14 étapes
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: 'À qualifier', count: 5 },
                { label: 'Visite', count: 3 },
                { label: 'Offre', count: 2 },
                { label: 'Notaire', count: 1 },
              ].map(col => (
                <div key={col.label} style={{
                  padding: '6px 10px',
                  borderRadius: PX.radius.tiny,
                  background: PX.neutral200,
                  fontFamily: PX.font.sans, fontSize: 11, fontWeight: 500,
                  color: PX.neutral700, letterSpacing: '-0.33px',
                }}>
                  {col.label} · {col.count}
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: PX.font.sans, fontSize: 11, fontWeight: 400,
              color: PX.neutral500, letterSpacing: '-0.33px',
            }}>
              <PxFigmaIcon name="arrow-right" size={10} color={PX.neutral500} />
              Voir le pipeline complet
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CrmScreen() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex',
      background: PX.neutral200,
    }}>
      <CrmSidebarNav />
      <CrmMainContent />
    </div>
  )
}

// ─── Main Hero (responsive) ────────────────────────────────────────────
export default function PxProHero() {
  const bp = useBreakpoint()
  const mobile = isMobile(bp)
  const desktop = isDesktop(bp)

  const badgeRef = useProFadeIn<HTMLDivElement>(0)
  const titleRef = useProFadeIn<HTMLHeadingElement>(120)
  const subRef = useProFadeIn<HTMLParagraphElement>(220)
  const ctaRef = useProFadeIn<HTMLDivElement>(340)
  const ipadRef = useProFadeIn<HTMLDivElement>(460)
  const statsRef = useProFadeIn<HTMLDivElement>(580)

  // Responsive tokens
  const sectionPaddingX = mobile ? 12 : 24
  const innerPaddingX = mobile ? 24 : desktop ? 64 : 40
  const innerPaddingY = mobile ? 48 : desktop ? 64 : 56
  const innerPaddingBottom = mobile ? 56 : desktop ? 80 : 64
  const h1Size = mobile ? 40 : desktop ? 72 : 56
  const h1LetterSpacing = mobile ? '-1.6px' : desktop ? '-3px' : '-2.2px'
  const subSize = mobile ? 16 : 18
  const subLetterSpacing = mobile ? '-0.48px' : '-0.54px'
  const ipadScale = mobile ? 0.42 : desktop ? 0.66 : 0.52
  const stackVertical = !desktop

  return (
    <section style={{
      paddingTop: 16,
      paddingLeft: sectionPaddingX,
      paddingRight: sectionPaddingX,
      background: PX.pageBg,
    }}>
      <div style={{
        position: 'relative',
        background: PX.inkBg,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        paddingTop: innerPaddingY,
        paddingBottom: innerPaddingBottom,
        paddingLeft: innerPaddingX,
        paddingRight: innerPaddingX,
      }}>
        {/* Background aerial Genève — pattern PxHero (image full-bleed) */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url("/images/sections/location-cms/hero-aerial.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.45,
          }}
        />

        {/* Gradient overlay — gauche très sombre (texte lisible) → droite plus
            transparent (image visible derrière l'iPad). Pattern PxHero adapté. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: desktop
              ? 'linear-gradient(90deg, rgba(20,22,28,0.92) 0%, rgba(20,22,28,0.80) 35%, rgba(20,22,28,0.50) 100%)'
              : 'linear-gradient(180deg, rgba(20,22,28,0.78) 0%, rgba(20,22,28,0.88) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Fade top — gradient sombre → transparent comme PxHero ligne 89-96 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 240,
            background: 'linear-gradient(180deg, rgba(20,22,28,0.6) 0%, rgba(20,22,28,0) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* POI pins — pattern PxHero (55×55 cercle blanc + PxFigmaIcon home-poi).
            Affichés uniquement en desktop : sur mobile/tablet le layout stack
            ne laisse pas d'espace image visible sans chevaucher le contenu. */}
        {desktop && (
          <>
            <HomePoiPin top="20px" left="42%" />
            <HomePoiPin top="40px" left="68%" />
            <HomePoiPin top="14px" left="86%" />
            <HomePoiPin top="auto" bottom="32px" left="55%" />
          </>
        )}

        <div style={{
          position: 'relative',
          maxWidth: 1280,
          margin: '0 auto',
          display: stackVertical ? 'flex' : 'grid',
          flexDirection: stackVertical ? 'column' : undefined,
          gridTemplateColumns: stackVertical ? undefined : 'minmax(0, 1fr) minmax(0, 0.95fr)',
          gap: stackVertical ? 48 : 48,
          alignItems: stackVertical ? 'flex-start' : 'center',
        }}>
          {/* LEFT — Content */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div ref={badgeRef}>
              <PxProBadge icon="badge-megaphone" invert>
                Pour les agences immobilières
              </PxProBadge>
            </div>

            <h1
              ref={titleRef}
              style={{
                margin: 0,
                marginTop: mobile ? 20 : 28,
                fontFamily: PX.font.display,
                fontSize: h1Size,
                lineHeight: mobile ? 1.1 : 1.05,
                letterSpacing: h1LetterSpacing,
                fontWeight: 500,
                color: PX.inkInverse,
                maxWidth: desktop ? 620 : '100%',
              }}
            >
              Le CRM immobilier suisse, pensé par un agent.
            </h1>

            <p
              ref={subRef}
              style={{
                margin: 0,
                marginTop: mobile ? 20 : 28,
                fontFamily: PX.font.sans,
                fontSize: subSize,
                lineHeight: 1.5,
                letterSpacing: subLetterSpacing,
                fontWeight: 400,
                color: PX.inkInverseSoft,
                maxWidth: desktop ? 540 : '100%',
              }}
            >
              Compliance LAB/KYC intégrée. Pipeline 14 colonnes. Copilote IA Claude Sonnet 4.
              Conçu avec Gregory Lyonnet, agent à Genève.
            </p>

            <div
              ref={ctaRef}
              style={{
                marginTop: mobile ? 28 : 36,
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

            {/* Trust stats — responsive grid */}
            <div
              ref={statsRef}
              style={{
                marginTop: mobile ? 40 : 56,
                display: 'grid',
                gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(3, auto)',
                columnGap: mobile ? 16 : 40,
                rowGap: mobile ? 20 : 0,
                justifyContent: mobile ? 'flex-start' : 'flex-start',
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
                    fontSize: mobile ? 24 : 30,
                    fontWeight: 500,
                    letterSpacing: mobile ? '-0.72px' : '-0.9px',
                    color: PX.inkInverse,
                    lineHeight: 1,
                  }}>
                    {stat.value}
                  </span>
                  <span style={{
                    marginTop: 8,
                    fontFamily: PX.font.sans,
                    fontSize: mobile ? 12 : 13,
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

          {/* RIGHT — iPad CRM (scaled) */}
          <div
            ref={ipadRef}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <IpadFrame scale={ipadScale}>
              <CrmScreen />
            </IpadFrame>
          </div>
        </div>
      </div>
    </section>
  )
}
