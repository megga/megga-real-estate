// MEGGA Marketplace — Property X "Properties for sale/rent" hero.
// Source : Figma node 9552:21447 — sous-frame "Hero Section" (node 11781:16155)
// + Container dark 9613:28017 + Browser search 9613:28455.
//
// Branché : la barre de recherche est désormais fonctionnelle.
// - Input texte → filtre `q` (URL search params) — soumission sur Enter ou clic
// - Dropdown autocomplete villes (ILIKE prefix, debounced 200ms)
// - Le titre + badge s'adaptent au context (buy/rent)

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PX } from '../tokens'
import PxFigmaIcon from '../PxFigmaIcon'
import { useCitiesAutocomplete } from '@/hooks/useMarketListings'

interface PxListingsHeroProps {
  context: 'buy' | 'rent'
}

const COPY = {
  buy: {
    badge: 'À vendre',
    title: 'Biens à vendre',
    paragraph:
      "Plus de 33'000 biens vérifiés à travers la Suisse. Trouvez votre prochaine maison, appartement ou villa en quelques clics.",
    placeholder: 'Ville, code postal, quartier…',
  },
  rent: {
    badge: 'À louer',
    title: 'Biens à louer',
    paragraph:
      "Plus de 33'000 biens vérifiés à travers la Suisse. Trouvez votre prochaine location en quelques clics.",
    placeholder: 'Ville, code postal, quartier…',
  },
} as const

function ContextBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 6,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        background: PX.neutral600,
        borderRadius: PX.radius.pill,
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: PX.radius.pill,
          background: PX.neutral500,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <PxFigmaIcon name="tag" size={14.857} color={PX.neutral100} />
      </span>
      <span
        style={{
          paddingTop: 2,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </span>
  )
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

export default function PxListingsHero({ context }: PxListingsHeroProps) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const copy = COPY[context]

  // Input local : controlled, ne fire pas la requête à chaque keystroke.
  // La soumission (Enter, click, suggestion) écrit dans l'URL — c'est ce qui
  // déclenche le refresh de la grid via useMarketFilters.
  const [draft, setDraft] = useState(params.get('q') ?? '')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Sync si l'URL change (ex: reset depuis la filter bar)
  useEffect(() => {
    setDraft(params.get('q') ?? '')
  }, [params])

  const debounced = useDebounced(draft, 200)
  const { data: suggestions = [], isFetching } = useCitiesAutocomplete(debounced, context)

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function commit(value: string) {
    const next = new URLSearchParams(params)
    const trimmed = value.trim()
    if (trimmed) next.set('q', trimmed)
    else next.delete('q')
    // Stay on the same path, just update the search string.
    navigate(`?${next.toString()}`, { replace: false })
    setOpen(false)
  }

  return (
    <section
      style={{
        paddingTop: 24,
        paddingLeft: 24,
        paddingRight: 24,
        background: PX.neutral200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        position: 'relative',
        zIndex: 3,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1392,
          margin: '0 auto',
          background: PX.neutral700,
          borderRadius: PX.radius.large,
          paddingTop: 120,
          paddingBottom: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ContextBadge label={copy.badge} />
          <div
            style={{
              paddingTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <h1
              style={{
                margin: 0,
                width: 854.75,
                maxWidth: '100%',
                fontFamily: PX.font.display,
                fontSize: 72,
                fontWeight: 500,
                lineHeight: 1.15,
                letterSpacing: '-2.16px',
                color: PX.neutral100,
                textAlign: 'center',
              }}
            >
              {copy.title}
            </h1>
          </div>
        </div>

        <div
          style={{
            paddingTop: 16,
            paddingBottom: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              width: 562.047,
              maxWidth: '100%',
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
              textAlign: 'center',
            }}
          >
            {copy.paragraph}
          </p>
        </div>

        {/* Search browser : remplace les 4 chips de la maquette par un input
            unique avec submit + dropdown d'autocomplete (villes CH). */}
        <div
          ref={wrapRef}
          style={{
            position: 'absolute',
            top: 383,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(720px, calc(100% - 64px))',
            background: PX.neutral100,
            padding: 16,
            borderRadius: PX.radius.pill,
            boxShadow: PX.shadow.small,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <form
            onSubmit={e => {
              e.preventDefault()
              commit(draft)
            }}
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PxFigmaIcon name="search" size={20} color={PX.neutral500} />
            <input
              type="text"
              value={draft}
              placeholder={copy.placeholder}
              onChange={e => {
                setDraft(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              aria-label="Rechercher un bien"
              style={{
                flex: 1,
                marginLeft: 12,
                minWidth: 0,
                background: 'transparent',
                border: 0,
                outline: 'none',
                color: PX.neutral700,
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                paddingTop: 2,
              }}
            />
            {draft && (
              <button
                type="button"
                onClick={() => {
                  setDraft('')
                  commit('')
                }}
                aria-label="Effacer la recherche"
                style={{
                  width: 28,
                  height: 28,
                  display: 'inline-grid',
                  placeItems: 'center',
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  marginRight: 4,
                }}
              >
                <PxFigmaIcon name="close" size={12} color={PX.neutral500} />
              </button>
            )}
            <button
              type="submit"
              aria-label="Rechercher"
              style={{
                width: 40,
                height: 40,
                borderRadius: PX.radius.pill,
                background: PX.neutral700,
                border: 0,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <PxFigmaIcon name="search" size={18} color={PX.neutral100} />
            </button>
          </form>

          {open && draft.trim().length >= 2 && (
            <div
              role="listbox"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                background: PX.neutral100,
                borderRadius: 16,
                boxShadow: PX.shadow.medium,
                border: `1px solid ${PX.neutral300}`,
                overflow: 'hidden',
                zIndex: 50,
              }}
            >
              {isFetching && suggestions.length === 0 && (
                <div
                  style={{
                    padding: '12px 16px',
                    fontFamily: PX.font.display,
                    fontSize: 14,
                    color: PX.neutral500,
                  }}
                >
                  Recherche…
                </div>
              )}
              {!isFetching && suggestions.length === 0 && (
                <div
                  style={{
                    padding: '12px 16px',
                    fontFamily: PX.font.display,
                    fontSize: 14,
                    color: PX.neutral500,
                  }}
                >
                  Aucune ville trouvée. Appuyez sur Entrée pour rechercher « {draft.trim()} ».
                </div>
              )}
              {suggestions.map(city => (
                <button
                  key={city}
                  type="button"
                  role="option"
                  onClick={() => {
                    setDraft(city)
                    commit(city)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: PX.font.display,
                    fontSize: 15,
                    color: PX.neutral700,
                    letterSpacing: '-0.45px',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = PX.neutral200
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <PxFigmaIcon name="location" size={16} color={PX.neutral500} />
                  <span>{city}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
