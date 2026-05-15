// MEGGA Marketplace — Toggle de mode d'affichage (Liste / Split / Carte).
//
// Sticky en haut du grid section, lit/écrit le param `view` dans l'URL pour
// deep-linking. 3 modes :
//   - 'list' : grid pleine largeur (défaut mobile)
//   - 'split' : grid 50% / carte 50% (défaut desktop)
//   - 'map' : carte plein écran
//
// Le mode 'split' est désactivé sous 1024px (la carte serait trop étroite).

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PX } from '../tokens'
import PxFigmaIcon from '../PxFigmaIcon'

export type ViewMode = 'list' | 'split' | 'map'

const VALID_MODES: ViewMode[] = ['list', 'split', 'map']

function getDefaultMode(): ViewMode {
  if (typeof window === 'undefined') return 'list'
  return window.matchMedia('(min-width: 1024px)').matches ? 'split' : 'list'
}

/**
 * Lit le mode depuis l'URL. Si absent ou invalide, retourne le défaut
 * responsive (split desktop / list mobile).
 */
export function useViewMode(): {
  mode: ViewMode
  setMode: (m: ViewMode) => void
} {
  const [params, setParams] = useSearchParams()
  const urlMode = params.get('view')

  // Mode initial : URL prioritaire, sinon défaut responsive
  const [defaultMode, setDefaultMode] = useState<ViewMode>(() => getDefaultMode())

  // Re-évalue le défaut si la taille de l'écran change (responsive).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setDefaultMode(getDefaultMode())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const mode: ViewMode = VALID_MODES.includes(urlMode as ViewMode)
    ? (urlMode as ViewMode)
    : defaultMode

  const setMode = (next: ViewMode) => {
    const nextParams = new URLSearchParams(params)
    if (next === defaultMode) {
      // Si on revient au défaut, on retire le param pour garder l'URL propre.
      nextParams.delete('view')
    } else {
      nextParams.set('view', next)
    }
    setParams(nextParams, { replace: true })
  }

  return { mode, setMode }
}

// ─── Toggle UI ───────────────────────────────────────────────────────────────

interface PxListingsViewToggleProps {
  mode: ViewMode
  onChange: (m: ViewMode) => void
  /** Affichage compact (sans labels textuels) — utile en mobile. */
  compact?: boolean
}

type ToggleOption = {
  value: ViewMode
  label: string
  icon: 'lines' | 'columns' | 'location'
  ariaLabel: string
}

const OPTIONS: ToggleOption[] = [
  { value: 'list', label: 'Liste', icon: 'lines', ariaLabel: 'Vue liste' },
  { value: 'split', label: 'Liste + carte', icon: 'columns', ariaLabel: 'Vue liste et carte' },
  { value: 'map', label: 'Carte', icon: 'location', ariaLabel: 'Vue carte' },
]

export default function PxListingsViewToggle({
  mode,
  onChange,
  compact = false,
}: PxListingsViewToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Mode d'affichage des biens"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        background: PX.neutral200,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.pill,
      }}
    >
      {OPTIONS.map(opt => {
        const active = mode === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel}
            onClick={() => onChange(opt.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              paddingLeft: compact ? 10 : 14,
              paddingRight: compact ? 10 : 14,
              background: active ? PX.neutral700 : 'transparent',
              color: active ? PX.neutral100 : PX.neutral700,
              border: 0,
              borderRadius: PX.radius.pill,
              cursor: 'pointer',
              fontFamily: PX.font.display,
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.39px',
              transition: `background ${PX.duration.fast} ${PX.ease}, color ${PX.duration.fast} ${PX.ease}`,
            }}
          >
            <ViewIcon
              name={opt.icon}
              color={active ? PX.neutral100 : PX.neutral700}
            />
            {!compact && <span style={{ paddingTop: 1 }}>{opt.label}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────
// On n'a pas d'icônes "lines" et "columns" dans PxFigmaIcon catalog, donc on
// dessine en SVG inline plutôt qu'invoquer une icône inexistante.

function ViewIcon({
  name,
  color,
}: {
  name: 'lines' | 'columns' | 'location'
  color: string
}) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    'aria-hidden': true,
  } as const

  if (name === 'lines') {
    return (
      <svg {...common}>
        <line x1="3" y1="4.5" x2="13" y2="4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="8" x2="13" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="11.5" x2="13" y2="11.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'columns') {
    return (
      <svg {...common}>
        <rect x="2.5" y="3" width="5" height="10" rx="1" stroke={color} strokeWidth="1.5" />
        <rect x="8.5" y="3" width="5" height="10" rx="1" stroke={color} strokeWidth="1.5" />
      </svg>
    )
  }
  return <PxFigmaIcon name="location" size={14} color={color} />
}
