// MEGGA Marketplace — Property X "Agences" page Grid section.
// Annuaire filtrable des agences immobilières (logo + nom + ville/canton).
// Pattern : container w-1200, compteur + grille 2-col de cards horizontaux.
//
// Card pattern :
//   - bg neutral100, rounded-large, border neutral300
//   - logo box 64×64 (rounded-medium, border, image object-contain ou initiales)
//   - name 18/medium neutral700
//   - city + canton, icon location V37 + texte 14 neutral500
//   - chevron-right à droite (rotate slight on hover)

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PX, PxFigmaIcon } from '..'

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
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function AgencyCardPx({ agency }: { agency: AgencyDirectoryItem }) {
  const { t } = useTranslation('directory')
  const initials = initialsOf(agency.name)
  const location = [agency.city, agency.canton ? `(${agency.canton})` : null]
    .filter(Boolean).join(' ')

  return (
    <Link
      to={`/agences/${agency.slug}`}
      className="px-agency-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: 24,
        background: PX.neutral100,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.large,
        textDecoration: 'none',
        transition: `box-shadow ${PX.duration.base} ${PX.ease}, border-color ${PX.duration.base} ${PX.ease}, transform ${PX.duration.base} ${PX.ease}`,
        boxShadow: 'none',
        color: 'inherit',
      }}
    >
      {/* Logo box 64×64 */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: PX.radius.medium,
        border: `1px solid ${PX.neutral300}`,
        background: PX.neutral100,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {agency.logo_url ? (
          <img
            src={agency.logo_url}
            alt={agency.name}
            loading="lazy"
            decoding="async"
            style={{
              width: 48,
              height: 48,
              objectFit: 'contain',
              display: 'block',
            }}
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
          fontFamily: PX.font.display,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.54px',
          color: PX.neutral500,
        }}>
          {initials || 'AG'}
        </span>
      </div>

      {/* Name + location */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 18,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.54px',
          color: PX.neutral700,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{agency.name}</span>

        {location && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: PX.font.display,
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.25,
            letterSpacing: '-0.42px',
            color: PX.neutral500,
            overflow: 'hidden',
          }}>
            <PxFigmaIcon name="location" size={14} color={PX.neutral500} />
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{location}</span>
          </span>
        )}
      </div>

      {/* Right : chevron + optional website indicator */}
      <span
        className="px-agency-card__chevron"
        style={{
          width: 32,
          height: 32,
          borderRadius: PX.radius.pill,
          background: PX.neutral200,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          transition: `background ${PX.duration.base} ${PX.ease}`,
        }}
      >
        <PxFigmaIcon name="chevron-right" size={14} color={PX.neutral700} />
        <span className="sr-only">{t('viewAgency')}</span>
      </span>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      padding: 24,
      background: PX.neutral100,
      border: `1px solid ${PX.neutral300}`,
      borderRadius: PX.radius.large,
      height: 112,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: PX.radius.medium,
        background: PX.neutral200,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 14, width: '60%', background: PX.neutral200, borderRadius: 4 }} />
        <div style={{ height: 12, width: '40%', background: PX.neutral200, borderRadius: 4 }} />
      </div>
    </div>
  )
}

export default function PxAgenciesGrid({
  agencies,
  isLoading,
  hasFilter,
  onClearFilters,
  selectedCantonLabel,
}: PxAgenciesGridProps) {
  const { t } = useTranslation('directory')

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
      {/* Hover styles + responsive grid */}
      <style>{`
        .px-agency-card:hover {
          box-shadow: ${PX.shadow.medium};
          border-color: ${PX.neutral400} !important;
          transform: translateY(-1px);
        }
        .px-agency-card:hover .px-agency-card__chevron {
          background: ${PX.neutral700} !important;
        }
        .px-agency-card:hover .px-agency-card__chevron svg {
          color: ${PX.neutral100} !important;
        }
        .px-agencies-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          width: 100%;
          max-width: 1200px;
        }
        @media (min-width: 768px) {
          .px-agencies-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
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
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : agencies.length === 0 ? (
        <div style={{
          width: '100%',
          maxWidth: 1200,
          padding: '80px 24px',
          textAlign: 'center',
          border: `1px dashed ${PX.neutral300}`,
          borderRadius: PX.radius.large,
        }}>
          <p style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 18,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.54px',
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
        <div className="px-agencies-grid">
          {agencies.map(agency => (
            <AgencyCardPx key={agency.id} agency={agency} />
          ))}
        </div>
      )}
    </section>
  )
}
