// MEGGA Marketplace — Property X "Agences" page Grid section.
// Annuaire filtrable des agences (logo + nom + ville/canton).
//
// Card pattern : reprend fidèlement PxBlogTeaser / PxPropertiesGrid
//   - bg neutral100 rounded-large overflow-hidden shadow-small
//   - zone visuelle haut h-200 bg neutral200 : LOGO centré max 120×120
//   - content area pt-24 pb-32 px-32 : titre 24px + location + verified pill
//     + Primary Circle Button DARK (40, neutral700) à droite
//   - 3 colonnes w-382 sur container w-1200

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PX, PxFigmaIcon } from '..'

const PAGE_SIZE = 30

export interface AgencyDirectoryItem {
  id: string
  name: string
  slug: string
  canton: string | null
  city: string | null
  logo_url: string | null
  website_url: string | null
  status?: string | null
}

interface PxAgenciesGridProps {
  agencies: AgencyDirectoryItem[]
  isLoading: boolean
  hasFilter: boolean
  onClearFilters: () => void
  selectedCantonLabel?: string | null
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/).filter(Boolean)
    .map(w => w[0])
    .join('').toUpperCase().slice(0, 2)
}

// ─── Pill "Vérifiée" LIGHT (bg neutral300, texte neutral700) ────────────
// Pattern eyebrow Property X type CategoryBadge mais en variante light.
function VerifiedPill({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 10,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral200,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 18,
        height: 18,
        borderRadius: PX.radius.pill,
        background: PX.neutral700,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        color: PX.neutral100,
        fontFamily: PX.font.display,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
      }}>✓</span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.39px',
        color: PX.neutral700,
      }}>{label}</span>
    </span>
  )
}

// ─── Card vertical Property X (Blog/Properties pattern) ─────────────────
function AgencyCardPx({ agency }: { agency: AgencyDirectoryItem }) {
  const { t } = useTranslation('directory')
  const initials = initialsOf(agency.name)
  const location = [agency.city, agency.canton ? `(${agency.canton})` : null]
    .filter(Boolean).join(' ')
  const verified = agency.status === 'verified'

  return (
    <Link
      to={`/agences/${agency.slug}`}
      className="px-agency-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        background: PX.neutral100,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.small,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        transition: `box-shadow ${PX.duration.base} ${PX.ease}, transform ${PX.duration.base} ${PX.ease}`,
      }}
    >
      {/* Visual area : h-200, bg neutral200, logo centré max 120 */}
      <div className="px-agency-card__visual" style={{
        position: 'relative',
        width: '100%',
        height: 200,
        background: PX.neutral200,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        transition: `background ${PX.duration.base} ${PX.ease}`,
      }}>
        {agency.logo_url ? (
          <img
            src={agency.logo_url}
            alt={agency.name}
            loading="lazy"
            decoding="async"
            style={{
              maxWidth: 120,
              maxHeight: 120,
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              transition: `transform ${PX.duration.base} ${PX.ease}`,
            }}
            className="px-agency-card__logo"
            onError={e => {
              const img = e.currentTarget
              img.style.display = 'none'
              const sib = img.nextElementSibling as HTMLElement | null
              if (sib) sib.style.display = 'inline-flex'
            }}
          />
        ) : null}
        <span style={{
          display: agency.logo_url ? 'none' : 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 88,
          height: 88,
          borderRadius: PX.radius.pill,
          background: PX.neutral100,
          color: PX.neutral500,
          fontFamily: PX.font.display,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: '-0.84px',
        }}>{initials || 'AG'}</span>
      </div>

      {/* Content Wrapper : flex items-center justify-between, pt-24 pb-32 px-32 */}
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingTop: 24,
        paddingBottom: 32,
        paddingLeft: 32,
        paddingRight: 32,
        flexShrink: 0,
      }}>
        {/* Content : flex-col gap-8 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-start',
          minWidth: 0,
          flex: 1,
        }}>
          {/* Title 24/Medium tracking-0.72 (PxBlogTeaser exact) */}
          <h3 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            color: PX.neutral700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}>{agency.name}</h3>

          {/* Meta row : location + verified pill */}
          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {location && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <PxFigmaIcon name="location" size={16} color={PX.neutral400} />
                <span style={{
                  fontFamily: PX.font.display,
                  fontSize: 14,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-0.42px',
                  color: PX.neutral400,
                  whiteSpace: 'nowrap',
                }}>{location}</span>
              </span>
            )}
            {verified && <VerifiedPill label={t('badge.verified')} />}
          </div>
        </div>

        {/* Primary Circle Button DARK 40 + chevron-right 16 (PxBlogTeaser exact) */}
        <span
          className="px-agency-card__btn"
          aria-label={t('viewAgency')}
          style={{
            width: 40,
            height: 40,
            borderRadius: PX.radius.pill,
            background: PX.neutral700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: `transform ${PX.duration.base} ${PX.ease}, background ${PX.duration.base} ${PX.ease}`,
          }}
        >
          <PxFigmaIcon name="chevron-right" size={16} color={PX.neutral100} />
        </span>
      </div>
    </Link>
  )
}

// ─── Skeleton card (même structure) ─────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
      overflow: 'hidden',
    }}>
      <div style={{ width: '100%', height: 200, background: PX.neutral200 }} />
      <div style={{
        padding: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 18, width: '70%', background: PX.neutral200, borderRadius: 4 }} />
          <div style={{ height: 12, width: '45%', background: PX.neutral200, borderRadius: 4 }} />
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 999, background: PX.neutral200 }} />
      </div>
    </div>
  )
}

// ─── Main grid section ──────────────────────────────────────────────────
export default function PxAgenciesGrid({
  agencies,
  isLoading,
  hasFilter,
  onClearFilters,
  selectedCantonLabel,
}: PxAgenciesGridProps) {
  const { t } = useTranslation('directory')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  // Reset pagination when filter/search changes — React-idiomatic
  // pattern : compare prev props during render (cheaper than useEffect).
  const [prevAgencies, setPrevAgencies] = useState(agencies)
  if (agencies !== prevAgencies) {
    setPrevAgencies(agencies)
    setVisibleCount(PAGE_SIZE)
  }

  const visibleAgencies = agencies.slice(0, visibleCount)
  const hasMore = agencies.length > visibleCount

  return (
    <section style={{
      paddingTop: 96,
      paddingBottom: 160,
      paddingLeft: 24,
      paddingRight: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      position: 'relative',
      zIndex: 2,
      background: PX.neutral100,
    }}>
      <style>{`
        .px-agency-card {
          will-change: transform;
        }
        .px-agency-card:hover {
          box-shadow: ${PX.shadow.medium};
          transform: translateY(-2px);
        }
        .px-agency-card:hover .px-agency-card__visual {
          background: ${PX.neutral300};
        }
        .px-agency-card:hover .px-agency-card__logo {
          transform: scale(1.04);
        }
        .px-agency-card:hover .px-agency-card__btn {
          transform: scale(1.06);
        }
        .px-agencies-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          width: 100%;
          max-width: 1200px;
        }
        @media (min-width: 720px) {
          .px-agencies-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (min-width: 1080px) {
          .px-agencies-grid { grid-template-columns: 1fr 1fr 1fr; }
        }
      `}</style>

      {/* Counter row */}
      <div style={{
        width: '100%',
        maxWidth: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <p style={{
          margin: 0,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>
          {agencies.length > 1
            ? t('agencies.count_plural', { count: agencies.length.toLocaleString('fr-CH') })
            : t('agencies.count', { count: agencies.length })}
          {selectedCantonLabel && ` ${t('agencies.inCanton', { canton: selectedCantonLabel })}`}
        </p>

        {hasFilter && (
          <button
            type="button"
            onClick={onClearFilters}
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              fontFamily: PX.font.display,
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.42px',
              color: PX.neutral700,
              textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
          >
            {t('agencies.clearSearch')}
          </button>
        )}
      </div>

      {/* Grid / states */}
      {isLoading ? (
        <div className="px-agencies-grid">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : agencies.length === 0 ? (
        <div style={{
          width: '100%',
          maxWidth: 1200,
          padding: '80px 24px',
          textAlign: 'center',
          background: PX.neutral200,
          borderRadius: PX.radius.large,
        }}>
          <p style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.6px',
            color: PX.neutral700,
          }}>{t('agencies.noResult')}</p>
          {hasFilter && (
            <button
              type="button"
              onClick={onClearFilters}
              style={{
                marginTop: 16,
                background: 'transparent',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                fontFamily: PX.font.display,
                fontSize: 14,
                fontWeight: 500,
                color: PX.neutral500,
                textDecoration: 'underline',
                textUnderlineOffset: 4,
              }}
            >
              {t('agencies.clearSearch')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="px-agencies-grid">
            {visibleAgencies.map(agency => (
              <AgencyCardPx key={agency.id} agency={agency} />
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              style={{
                marginTop: 48,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: PX.neutral700,
                color: PX.neutral100,
                border: 0,
                cursor: 'pointer',
                paddingLeft: 24,
                paddingRight: 24,
                paddingTop: 14,
                paddingBottom: 14,
                borderRadius: PX.radius.pill,
                fontFamily: PX.font.display,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '-0.42px',
              }}
            >
              {t('agencies.loadMore', { defaultValue: 'Voir plus ({{shown}} / {{total}})', shown: visibleAgencies.length, total: agencies.length })}
            </button>
          )}
        </>
      )}
    </section>
  )
}
