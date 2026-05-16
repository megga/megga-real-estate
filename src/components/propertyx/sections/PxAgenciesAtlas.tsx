// MEGGA Marketplace — Property X "Atlas des agences" (refonte v2 éditoriale).
//
// Concept : remplacer la grille 2-col de cards par un index alphabétique de
// type magazine. Pensé pour scaler à 6000+ entrées.
//
// Composition :
//   1. Hero compact (eyebrow "L'index" + H1 "Atlas des agences" + sous-titre)
//      Pas de search pill : tout passe par la barre sticky en dessous.
//   2. Sticky alpha bar : search compact + A B C D... + compteur monospace
//   3. Sections par lettre : énorme caractère (120px Objectivity 100) à
//      gauche + colonne de rows (numéro + logo 40 + nom 24 + ville + verified)
//   4. Empty state éditorial si la lettre est vide

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PX, PxFigmaIcon } from '..'

export interface AgencyAtlasItem {
  id: string
  name: string
  slug: string
  canton: string | null
  city: string | null
  logo_url: string | null
  status?: string | null
}

interface PxAgenciesAtlasProps {
  agencies: AgencyAtlasItem[]
  isLoading: boolean
  totalCount: number | null
}

const ALPHABET = ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as const

function bucketOf(name: string): string {
  const first = name.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase()
  return /^[A-Z]$/.test(first) ? first : '#'
}

function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0')
}

// ─── Hero (compact, sans browser pill) ──────────────────────────────────
function AtlasHero({ subtitle }: { subtitle: string }) {
  const { t } = useTranslation('directory')
  return (
    <section style={{
      paddingTop: 24,
      paddingLeft: 24,
      paddingRight: 24,
      width: '100%',
    }}>
      <div style={{
        background: PX.neutral700,
        borderRadius: PX.radius.large,
        paddingTop: 96,
        paddingBottom: 96,
        paddingLeft: 24,
        paddingRight: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        {/* Eyebrow : pill dark + texte simple, plus discret que la version grid */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 6,
          paddingBottom: 6,
          background: PX.neutral600,
          border: `1px solid ${PX.borderInverse}`,
          borderRadius: PX.radius.pill,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: PX.radius.pill,
            background: PX.neutral400,
          }} />
          <span style={{
            fontFamily: PX.font.display,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: PX.neutral400,
          }}>{t('atlas.eyebrow', 'L’index')}</span>
        </span>

        <h1 style={{
          margin: '24px 0 0 0',
          fontFamily: PX.font.display,
          fontSize: 'clamp(40px, 7vw, 88px)',
          fontWeight: 500,
          lineHeight: 1.05,
          letterSpacing: '-2.4px',
          color: PX.neutral100,
          maxWidth: 920,
        }}>
          {t('atlas.title', 'Atlas des agences immobilières')}
        </h1>

        <p style={{
          margin: '20px 0 0 0',
          fontFamily: PX.font.display,
          fontSize: 18,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.36px',
          color: PX.neutral400,
          maxWidth: 560,
        }}>
          {subtitle}
        </p>
      </div>
    </section>
  )
}

// ─── Sticky alpha bar (search + alphabet + compteur) ────────────────────
interface AlphaBarProps {
  search: string
  onSearchChange: (v: string) => void
  activeLetter: string | null
  onLetterChange: (l: string) => void
  availableLetters: Set<string>
  visibleCount: number
  totalCount: number | null
}

function AlphaBar({
  search, onSearchChange,
  activeLetter, onLetterChange,
  availableLetters,
  visibleCount, totalCount,
}: AlphaBarProps) {
  const { t } = useTranslation('directory')
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: PX.neutral100,
      borderBottom: `1px solid ${PX.neutral300}`,
      paddingTop: 14,
      paddingBottom: 14,
      paddingLeft: 24,
      paddingRight: 24,
      backdropFilter: 'saturate(180%) blur(8px)',
      WebkitBackdropFilter: 'saturate(180%) blur(8px)',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        {/* Search compact */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: PX.neutral200,
          borderRadius: PX.radius.pill,
          paddingLeft: 14,
          paddingRight: 14,
          height: 40,
          width: 280,
          maxWidth: '100%',
        }}>
          <PxFigmaIcon name="search" size={16} color={PX.neutral500} />
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={t('agencies.searchPlaceholder')}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 0,
              outline: 'none',
              fontFamily: PX.font.display,
              fontSize: 14,
              fontWeight: 400,
              letterSpacing: '-0.42px',
              color: PX.neutral700,
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear"
              style={{
                background: 'transparent',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                color: PX.neutral500,
                fontFamily: PX.font.display,
                fontSize: 14,
              }}
            >×</button>
          )}
        </div>

        {/* Alphabet — wraps on small screens but stays single row up to ~720 */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center',
          overflowX: 'auto',
        }}>
          {ALPHABET.map(letter => {
            const available = availableLetters.has(letter)
            const isActive = activeLetter === letter
            return (
              <button
                key={letter}
                type="button"
                onClick={() => available && onLetterChange(letter)}
                disabled={!available}
                style={{
                  width: 28,
                  height: 28,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? PX.neutral700 : 'transparent',
                  color: isActive ? PX.neutral100 : (available ? PX.neutral700 : PX.neutral400),
                  border: 0,
                  borderRadius: 6,
                  cursor: available ? 'pointer' : 'not-allowed',
                  fontFamily: PX.font.display,
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: '-0.39px',
                  opacity: available ? 1 : 0.35,
                  transition: `background ${PX.duration.fast} ${PX.ease}, color ${PX.duration.fast} ${PX.ease}`,
                  padding: 0,
                }}
              >{letter}</button>
            )
          })}
        </div>

        {/* Counter — monospace pour effet "page d'index" */}
        <div style={{
          fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
          fontSize: 12,
          fontWeight: 500,
          color: PX.neutral500,
          letterSpacing: 0,
          whiteSpace: 'nowrap',
          minWidth: 90,
          textAlign: 'right',
        }}>
          {pad(visibleCount, 3)} / {totalCount != null ? pad(totalCount, 4) : '—'}
        </div>
      </div>
    </div>
  )
}

// ─── Single index row ───────────────────────────────────────────────────
function IndexRow({ agency, index }: { agency: AgencyAtlasItem; index: number }) {
  const initials = agency.name
    .split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const verified = agency.status === 'verified'
  const location = [agency.city, agency.canton ? `(${agency.canton})` : null].filter(Boolean).join(' ')

  return (
    <Link
      to={`/agences/${agency.slug}`}
      className="atlas-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 48px 1fr auto auto',
        alignItems: 'center',
        gap: 20,
        padding: '20px 16px',
        borderBottom: `1px solid ${PX.neutral300}`,
        textDecoration: 'none',
        color: 'inherit',
        position: 'relative',
        transition: `background ${PX.duration.base} ${PX.ease}`,
      }}
    >
      {/* Numéro */}
      <span style={{
        fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
        fontSize: 12,
        fontWeight: 500,
        color: PX.neutral400,
        letterSpacing: 0,
      }}>
        {pad(index)}
      </span>

      {/* Logo 40×40 sans cadre — juste l'image en place */}
      <span style={{
        width: 40,
        height: 40,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        {agency.logo_url ? (
          <img
            src={agency.logo_url}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ maxWidth: 40, maxHeight: 40, objectFit: 'contain', display: 'block' }}
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
          width: 40,
          height: 40,
          borderRadius: 999,
          background: PX.neutral200,
          color: PX.neutral500,
          fontFamily: PX.font.display,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.39px',
        }}>{initials || 'AG'}</span>
      </span>

      {/* Nom */}
      <span className="atlas-row__name" style={{
        fontFamily: PX.font.display,
        fontSize: 24,
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '-0.72px',
        color: PX.neutral700,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: `transform ${PX.duration.base} ${PX.ease}`,
      }}>{agency.name}</span>

      {/* Location + verified */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {location && (
          <span style={{
            fontFamily: PX.font.display,
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: '-0.42px',
            color: PX.neutral500,
            whiteSpace: 'nowrap',
          }}>{location}</span>
        )}
        {verified && (
          <span title="Agence vérifiée" style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 18,
            height: 18,
            borderRadius: 999,
            background: PX.neutral700,
            color: PX.neutral100,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: PX.font.display,
          }}>✓</span>
        )}
      </span>

      {/* Chevron — n'apparaît qu'au hover */}
      <span className="atlas-row__chev" style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 24,
        opacity: 0,
        transform: 'translateX(-4px)',
        transition: `opacity ${PX.duration.base} ${PX.ease}, transform ${PX.duration.base} ${PX.ease}`,
      }}>
        <PxFigmaIcon name="chevron-right" size={14} color={PX.neutral700} />
      </span>
    </Link>
  )
}

// ─── Letter section (huge letter + rows) ────────────────────────────────
function LetterSection({
  letter,
  agencies,
  startIndex,
  letterRef,
}: {
  letter: string
  agencies: AgencyAtlasItem[]
  startIndex: number
  letterRef?: (el: HTMLElement | null) => void
}) {
  return (
    <section
      ref={letterRef as React.LegacyRef<HTMLElement>}
      data-letter={letter}
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        alignItems: 'start',
        paddingTop: 56,
        paddingBottom: 24,
        gap: 24,
      }}
      className="atlas-section"
    >
      {/* Big letter — sticky on scroll within the section */}
      <div style={{
        position: 'sticky',
        top: 84, // alpha bar height + breathing room
        alignSelf: 'start',
      }}>
        <span style={{
          display: 'block',
          fontFamily: PX.font.display,
          fontSize: 144,
          fontWeight: 100,
          lineHeight: 1,
          letterSpacing: '-6px',
          color: PX.neutral400,
          fontVariantNumeric: 'tabular-nums',
          userSelect: 'none',
        }}>{letter}</span>
        <span style={{
          display: 'inline-block',
          marginTop: 12,
          fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
          fontSize: 11,
          fontWeight: 500,
          color: PX.neutral500,
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
        }}>{pad(agencies.length, 3)} entrées</span>
      </div>

      {/* Rows */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        borderTop: `1px solid ${PX.neutral300}`,
      }}>
        {agencies.map((a, i) => (
          <IndexRow key={a.id} agency={a} index={startIndex + i + 1} />
        ))}
      </div>
    </section>
  )
}

// ─── Main composition ──────────────────────────────────────────────────
export default function PxAgenciesAtlas({
  agencies,
  isLoading,
  totalCount,
}: PxAgenciesAtlasProps) {
  const { t } = useTranslation('directory')
  const [search, setSearch] = useState('')
  const [activeLetter, setActiveLetter] = useState<string | null>(null)

  // Group all agencies by first letter
  const grouped = useMemo(() => {
    const map = new Map<string, AgencyAtlasItem[]>()
    for (const a of agencies) {
      const k = bucketOf(a.name)
      const list = map.get(k)
      if (list) list.push(a)
      else map.set(k, [a])
    }
    // sort each bucket by name
    for (const list of map.values()) list.sort((x, y) => x.name.localeCompare(y.name, 'fr'))
    return map
  }, [agencies])

  const availableLetters = useMemo(() => new Set(grouped.keys()), [grouped])

  // Apply search filter
  const filteredAgencies = useMemo(() => {
    if (!search.trim()) return agencies
    const q = search.toLowerCase()
    return agencies.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.city && a.city.toLowerCase().includes(q))
    )
  }, [agencies, search])

  // Re-group filtered set
  const filteredGrouped = useMemo(() => {
    const map = new Map<string, AgencyAtlasItem[]>()
    for (const a of filteredAgencies) {
      const k = bucketOf(a.name)
      const list = map.get(k)
      if (list) list.push(a)
      else map.set(k, [a])
    }
    for (const list of map.values()) list.sort((x, y) => x.name.localeCompare(y.name, 'fr'))
    return map
  }, [filteredAgencies])

  // Decide which letters to render :
  // - if user clicked a letter → show only that one
  // - if search active → show all letters with results
  // - default → show ALL alphabetically (perf : ok up to ~3-5K rows ; could
  //   be virtualized later)
  const lettersToRender = useMemo(() => {
    if (activeLetter) return [activeLetter]
    return ALPHABET.filter(l => filteredGrouped.has(l))
  }, [activeLetter, filteredGrouped])

  // Compute startIndex per letter so numbering is global
  const indexedSections = useMemo(() => {
    const sections: Array<{ letter: string; agencies: AgencyAtlasItem[]; startIndex: number }> = []
    let cursor = 0
    for (const letter of lettersToRender) {
      const list = filteredGrouped.get(letter) || []
      sections.push({ letter, agencies: list, startIndex: cursor })
      cursor += list.length
    }
    return sections
  }, [lettersToRender, filteredGrouped])

  const visibleCount = indexedSections.reduce((sum, s) => sum + s.agencies.length, 0)

  // Auto-jump to top when changing letter
  useEffect(() => {
    if (activeLetter) {
      window.scrollTo({ top: window.scrollY, behavior: 'smooth' }) // small noop, but keeps focus
    }
  }, [activeLetter])

  return (
    <>
      {/* Inline styles for hover behaviors */}
      <style>{`
        .atlas-row:hover {
          background: ${PX.neutral200};
        }
        .atlas-row:hover .atlas-row__name {
          transform: translateX(4px);
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 4px;
        }
        .atlas-row:hover .atlas-row__chev {
          opacity: 1;
          transform: translateX(0);
        }
        @media (max-width: 720px) {
          .atlas-section {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <AtlasHero subtitle={t('atlas.subtitle', { count: totalCount?.toLocaleString('fr-CH') ?? '—', defaultValue: 'Toutes les {{count}} agences immobilières de Suisse, classées par ordre alphabétique.' })} />

      <AlphaBar
        search={search}
        onSearchChange={v => { setSearch(v); setActiveLetter(null) }}
        activeLetter={activeLetter}
        onLetterChange={setActiveLetter}
        availableLetters={availableLetters}
        visibleCount={visibleCount}
        totalCount={totalCount}
      />

      <main style={{
        maxWidth: 1200,
        margin: '0 auto',
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 160,
      }}>
        {isLoading ? (
          <div style={{ paddingTop: 80 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: 20,
                borderBottom: `1px solid ${PX.neutral300}`,
              }}>
                <div style={{ width: 36, height: 12, background: PX.neutral200, borderRadius: 4 }} />
                <div style={{ width: 40, height: 40, background: PX.neutral200, borderRadius: 999 }} />
                <div style={{ flex: 1, height: 16, background: PX.neutral200, borderRadius: 4 }} />
                <div style={{ width: 120, height: 12, background: PX.neutral200, borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : indexedSections.length === 0 ? (
          <div style={{
            paddingTop: 120,
            paddingBottom: 120,
            textAlign: 'center',
          }}>
            <span style={{
              display: 'block',
              fontFamily: PX.font.display,
              fontSize: 96,
              fontWeight: 100,
              letterSpacing: '-3px',
              color: PX.neutral300,
              lineHeight: 1,
            }}>∅</span>
            <p style={{
              marginTop: 16,
              fontFamily: PX.font.display,
              fontSize: 18,
              fontWeight: 500,
              color: PX.neutral700,
              letterSpacing: '-0.54px',
            }}>{t('agencies.noResult')}</p>
            {(search || activeLetter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setActiveLetter(null) }}
                style={{
                  marginTop: 16,
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: PX.font.display,
                  fontSize: 14,
                  fontWeight: 500,
                  color: PX.neutral700,
                  textDecoration: 'underline',
                  textUnderlineOffset: 4,
                }}
              >{t('atlas.viewAll', 'Voir toutes les lettres')}</button>
            )}
          </div>
        ) : (
          indexedSections.map(s => (
            <LetterSection
              key={s.letter}
              letter={s.letter}
              agencies={s.agencies}
              startIndex={s.startIndex}
            />
          ))
        )}
      </main>
    </>
  )
}
