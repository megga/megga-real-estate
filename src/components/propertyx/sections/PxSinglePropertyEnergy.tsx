// MEGGA Marketplace — Property X "Single Property — Energy" section.
//
// Affiche l'étiquette énergétique CECB (Certificat Énergétique Cantonal
// des Bâtiments) : scale A→G + consommation kWh/m²/an + année.
//
// Obligation légale en Suisse pour les ventes (LDCO/LCETC selon cantons).
// On affiche uniquement si energy_label est dispo dans le data.
//
// Layout porté depuis l'ancien `BienEnergyBlock` (proto) :
// - Bandes jointes (style CECB officiel), outline noir sur la note active
// - Flèche au-dessus de la note active
// - Légende "Très efficace / Peu efficace" sous la scale
// - Tuile kWh à droite (grid 1fr 280px desktop, stack mobile) — masquée
//   si energy_kwh n'est pas présent.

import { useTranslation } from 'react-i18next'
import { PX } from '..'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { ListingCardData } from '@/components/listings/ListingCard'

const GRADES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
type Grade = typeof GRADES[number]
// Palette CECB : vert (A, très efficace) → rouge (G, énergivore)
const GRADE_COLORS: Record<Grade, string> = {
  A: '#1F8A4F',
  B: '#52A847',
  C: '#9DC23F',
  D: '#F0C53A',
  E: '#EE9A3A',
  F: '#DA5F2C',
  G: '#A93D26',
}

interface Props {
  listing?: ListingCardData
}

export default function PxSinglePropertyEnergy({ listing }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  if (!listing?.energy_label) return null

  const grade = (listing.energy_label.toUpperCase() as Grade)
  if (!GRADES.includes(grade)) return null

  const activeIdx = GRADES.indexOf(grade)
  const kwh = listing.energy_kwh
  const year = listing.energy_year
  const showKwhTile = kwh != null

  return (
    <section style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      background: PX.pageBg,
      paddingTop: isMobile ? 32 : 48,
      paddingBottom: isMobile ? 32 : 48,
    }}>
      <div style={{
        width: isMobile ? 'calc(100% - 32px)' : 'min(1200px, calc(100% - 48px))',
        boxSizing: 'border-box',
      }}>
        <div style={{
          background: PX.neutral100,
          borderRadius: PX.radius.large,
          boxShadow: PX.shadow.small,
          padding: isMobile ? 24 : 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{
              fontFamily: PX.font.sans,
              fontWeight: 600,
              fontSize: 11,
              lineHeight: 1.4,
              letterSpacing: '1.4px',
              textTransform: 'uppercase',
              color: GRADE_COLORS[grade],
            }}>
              {t('marketplaceProperty.energy.eyebrow')}
            </span>
            <h2 style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: isMobile ? 24 : 32,
              lineHeight: 1.25,
              letterSpacing: isMobile ? '-0.72px' : '-0.96px',
              color: PX.neutral700,
            }}>
              {t('marketplaceProperty.energy.title')}
            </h2>
          </div>

          {/* Grid : scale (left, flex 1) + tuile kWh (right, 280px) — stack sur mobile */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: !isMobile && showKwhTile ? '1fr 280px' : '1fr',
            gap: isMobile ? 20 : 28,
            alignItems: 'center',
          }}>
            {/* Scale A→G */}
            <div>
              {/* Bandes jointes (style CECB officiel) */}
              <div style={{
                display: 'flex',
                height: isMobile ? 48 : 56,
                borderRadius: PX.radius.small,
                overflow: 'hidden',
                position: 'relative',
              }}>
                {GRADES.map((g, i) => {
                  const isActive = i === activeIdx
                  return (
                    <div
                      key={g}
                      aria-current={isActive ? 'true' : undefined}
                      style={{
                        flex: 1,
                        background: GRADE_COLORS[g],
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: PX.font.sans,
                        fontSize: isMobile ? 14 : 18,
                        fontWeight: 700,
                        position: 'relative',
                        outline: isActive ? `3px solid ${PX.neutral700}` : 'none',
                        outlineOffset: isActive ? -3 : 0,
                        zIndex: isActive ? 2 : 1,
                      }}
                    >
                      {g}
                      {isActive ? (
                        <div style={{
                          position: 'absolute',
                          top: -10,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 0,
                          height: 0,
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderTop: `8px solid ${PX.neutral700}`,
                        }} />
                      ) : null}
                    </div>
                  )
                })}
              </div>
              {/* Légende sous la scale */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 8,
                fontFamily: PX.font.sans,
                fontSize: 11,
                fontWeight: 600,
                color: PX.neutral400,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
              }}>
                <span>{t('marketplaceProperty.energy.scaleEfficient')}</span>
                <span>{t('marketplaceProperty.energy.scaleInefficient')}</span>
              </div>
            </div>

            {/* Tuile kWh — masquée si pas de data */}
            {showKwhTile ? (
              <div style={{
                background: PX.neutral200,
                borderRadius: PX.radius.medium,
                padding: 18,
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: PX.font.sans,
                  fontSize: 11,
                  fontWeight: 700,
                  color: PX.neutral400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                }}>
                  {t('marketplaceProperty.energy.consumption')}
                </div>
                <div style={{
                  fontFamily: PX.font.sans,
                  fontSize: 30,
                  fontWeight: 700,
                  color: PX.neutral700,
                  marginTop: 4,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.5px',
                }}>
                  {kwh}
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: PX.neutral400,
                    marginLeft: 4,
                  }}>
                    {t('marketplaceProperty.energy.kwhUnit')}
                  </span>
                </div>
                {year != null ? (
                  <div style={{
                    fontFamily: PX.font.sans,
                    fontSize: 11,
                    color: PX.neutral400,
                    marginTop: 6,
                  }}>
                    {t('marketplaceProperty.energy.certificateYear', { year })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Description i18n (préservée de l'ancienne version PX) */}
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '-0.4px',
            color: PX.neutral500,
          }}>
            {t('marketplaceProperty.energy.description', { grade })}
          </p>
        </div>
      </div>
    </section>
  )
}
