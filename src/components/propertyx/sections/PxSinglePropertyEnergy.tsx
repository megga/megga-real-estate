// MEGGA Marketplace — Property X "Single Property — Energy" section.
//
// Affiche l'étiquette énergétique CECB (Certificat Énergétique Cantonal
// des Bâtiments) du bien : note A→G + consommation kWh/m²/an + année.
//
// Obligation légale en Suisse pour les ventes (LDCO/LCETC selon cantons).
// On affiche uniquement si energy_label est dispo dans le data.

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
  // Si label invalide (autre que A-G), on ne rend rien plutôt qu'un défaut
  if (!GRADES.includes(grade)) return null

  const activeIdx = GRADES.indexOf(grade)

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

          {/* Scale A→G */}
          <div style={{
            display: 'flex',
            gap: isMobile ? 4 : 8,
            width: '100%',
          }}>
            {GRADES.map((g, idx) => {
              const isActive = idx === activeIdx
              return (
                <div
                  key={g}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {/* Marker arrow above active grade */}
                  <div style={{ height: 16, display: 'flex', alignItems: 'center' }}>
                    {isActive ? (
                      <div style={{
                        width: 0,
                        height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: `8px solid ${PX.neutral700}`,
                      }} />
                    ) : null}
                  </div>
                  {/* Band */}
                  <div
                    aria-current={isActive ? 'true' : undefined}
                    style={{
                      width: '100%',
                      height: isMobile ? 40 : 56,
                      background: GRADE_COLORS[g],
                      borderRadius: PX.radius.small,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: isActive ? `2px solid ${PX.neutral700}` : '2px solid transparent',
                      boxShadow: isActive ? '0 4px 16px rgba(20, 22, 28, 0.2)' : 'none',
                      transform: isActive ? 'scale(1.05)' : 'scale(1)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <span style={{
                      fontFamily: PX.font.sans,
                      fontWeight: 700,
                      fontSize: isMobile ? 14 : 18,
                      letterSpacing: '0px',
                      color: '#FFFFFF',
                    }}>
                      {g}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer : description */}
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
