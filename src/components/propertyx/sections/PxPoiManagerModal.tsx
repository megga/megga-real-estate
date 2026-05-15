// MEGGA Marketplace — Modal "Mes lieux".
//
// Gère jusqu'à 3 POIs (Travail, École, Sport, custom). Chaque POI :
//   - Label libre (avec presets pour aller vite)
//   - Adresse texte → Mapbox Geocoding (debounced 250ms, suggestions CH only)
//   - Coords résolues, stockées en localStorage
//
// Convention CLAUDE.md §3 : modal toujours via createPortal sur document.body
// avec z-index élevé. Backdrop semi-opaque, fermeture sur Esc / clic
// backdrop.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PX } from '../tokens'
import PxFigmaIcon from '../PxFigmaIcon'
import {
  POI_LABEL_PRESETS,
  useUserPois,
  type UserPoi,
} from '@/hooks/useUserPois'
import {
  geocodeSuggestions,
  type GeocodingSuggestion,
} from '@/lib/mapboxClient'

interface PxPoiManagerModalProps {
  open: boolean
  onClose: () => void
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

// ─── Sous-composant : formulaire d'ajout ─────────────────────────────────────

function AddPoiForm({
  onAdd,
  disabled,
}: {
  onAdd: (poi: Omit<UserPoi, 'id' | 'addedAt'>) => boolean
  disabled: boolean
}) {
  const [label, setLabel] = useState<string>(POI_LABEL_PRESETS[0])
  const [customLabel, setCustomLabel] = useState<string>('')
  const isCustom = label === '__custom__'
  const effectiveLabel = isCustom ? customLabel.trim() : label

  const [addressInput, setAddressInput] = useState('')
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<GeocodingSuggestion | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounced(addressInput, 250)
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([])
  const [fetching, setFetching] = useState(false)

  // Fetch suggestions when query changes
  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setSuggestions([])
      return
    }
    const ctrl = new AbortController()
    setFetching(true)
    geocodeSuggestions(debouncedQuery, ctrl.signal)
      .then(res => setSuggestions(res))
      .finally(() => setFetching(false))
    return () => ctrl.abort()
  }, [debouncedQuery])

  // Outside click closes dropdown
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const canAdd = !disabled && effectiveLabel.length > 0 && chosen !== null

  const submit = () => {
    if (!canAdd || !chosen) return
    const ok = onAdd({
      label: effectiveLabel,
      address: chosen.fullAddress,
      lat: chosen.lat,
      lng: chosen.lng,
    })
    if (ok) {
      // Reset
      setLabel(POI_LABEL_PRESETS[0])
      setCustomLabel('')
      setAddressInput('')
      setChosen(null)
      setSuggestions([])
      setOpen(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        background: PX.neutral200,
        borderRadius: PX.radius.medium,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Label selector */}
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            background: PX.neutral100,
            border: `1px solid ${PX.neutral300}`,
            borderRadius: PX.radius.pill,
            height: 44,
            minWidth: 130,
            paddingLeft: 14,
            paddingRight: 32,
          }}
        >
          <select
            aria-label="Catégorie de lieu"
            value={label}
            onChange={e => setLabel(e.target.value)}
            disabled={disabled}
            style={{
              width: '100%',
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: PX.neutral700,
              fontFamily: PX.font.display,
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.42px',
              paddingTop: 2,
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            {POI_LABEL_PRESETS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value="__custom__">Personnalisé…</option>
          </select>
          <span
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
            aria-hidden
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="m4 6 4 4 4-4" stroke={PX.neutral500} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {isCustom && (
          <input
            aria-label="Nom personnalisé du lieu"
            type="text"
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value.slice(0, 24))}
            placeholder="Nom du lieu"
            disabled={disabled}
            style={{
              height: 44,
              minWidth: 140,
              background: PX.neutral100,
              border: `1px solid ${PX.neutral300}`,
              borderRadius: PX.radius.pill,
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 2,
              outline: 'none',
              color: PX.neutral700,
              fontFamily: PX.font.display,
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.25,
              letterSpacing: '-0.42px',
            }}
          />
        )}

        {/* Address input + autocomplete */}
        <div
          ref={wrapRef}
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 220,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-grid',
              placeItems: 'center',
            }}
            aria-hidden
          >
            <PxFigmaIcon name="location" size={16} color={PX.neutral500} />
          </span>
          <input
            aria-label="Adresse du lieu"
            type="text"
            value={chosen ? chosen.fullAddress : addressInput}
            onChange={e => {
              setChosen(null)
              setAddressInput(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Adresse, code postal, ville…"
            disabled={disabled}
            style={{
              width: '100%',
              height: 44,
              background: PX.neutral100,
              border: `1px solid ${chosen ? PX.neutral700 : PX.neutral300}`,
              borderRadius: PX.radius.pill,
              paddingLeft: 38,
              paddingRight: 14,
              paddingTop: 2,
              outline: 'none',
              color: PX.neutral700,
              fontFamily: PX.font.display,
              fontSize: 14,
              fontWeight: 400,
              lineHeight: 1.25,
              letterSpacing: '-0.42px',
            }}
          />

          {open && debouncedQuery.length >= 3 && !chosen && (
            <div
              role="listbox"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: PX.neutral100,
                borderRadius: PX.radius.medium,
                boxShadow: PX.shadow.medium,
                border: `1px solid ${PX.neutral300}`,
                overflow: 'hidden',
                zIndex: 1,
                maxHeight: 240,
                overflowY: 'auto',
              }}
            >
              {fetching && suggestions.length === 0 && (
                <div style={{ padding: '10px 14px', fontFamily: PX.font.display, fontSize: 13, color: PX.neutral500 }}>
                  Recherche…
                </div>
              )}
              {!fetching && suggestions.length === 0 && (
                <div style={{ padding: '10px 14px', fontFamily: PX.font.display, fontSize: 13, color: PX.neutral500 }}>
                  Aucun lieu trouvé.
                </div>
              )}
              {suggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  onClick={() => {
                    setChosen(s)
                    setAddressInput(s.fullAddress)
                    setOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    width: '100%',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = PX.neutral200 }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ marginTop: 2, flexShrink: 0 }}>
                    <PxFigmaIcon name="location" size={14} color={PX.neutral500} />
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: PX.font.display,
                        fontSize: 14,
                        fontWeight: 500,
                        color: PX.neutral700,
                        letterSpacing: '-0.42px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}
                    >
                      {s.label}
                    </span>
                    <span
                      style={{
                        fontFamily: PX.font.display,
                        fontSize: 12,
                        color: PX.neutral500,
                        letterSpacing: '-0.36px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 400,
                      }}
                    >
                      {s.fullAddress}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!canAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 44,
            paddingLeft: 16,
            paddingRight: 18,
            background: canAdd ? PX.neutral700 : PX.neutral300,
            color: canAdd ? PX.neutral100 : PX.neutral500,
            border: 0,
            borderRadius: PX.radius.pill,
            cursor: canAdd ? 'pointer' : 'not-allowed',
            fontFamily: PX.font.display,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.42px',
          }}
        >
          <PxFigmaIcon name="plus" size={12} color={canAdd ? PX.neutral100 : PX.neutral500} />
          Ajouter
        </button>
      </div>
    </div>
  )
}

// ─── Modal principal ─────────────────────────────────────────────────────────

export default function PxPoiManagerModal({ open, onClose }: PxPoiManagerModalProps) {
  const { pois, addPoi, removePoi, canAddMore, maxPois } = useUserPois()
  const titleId = useId()

  // Fermeture sur Esc
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), [])

  if (!open || !portalTarget) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 22, 28, 0.55)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 100,
        overflowY: 'auto',
        paddingTop: '8vh',
        paddingBottom: '8vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(640px, calc(100% - 32px))',
          background: PX.neutral100,
          borderRadius: PX.radius.large,
          boxShadow: PX.shadow.large,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 24,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.72px',
                color: PX.neutral700,
              }}
            >
              Mes lieux
            </h2>
            <p
              style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 14,
                fontWeight: 400,
                lineHeight: 1.5,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
                maxWidth: 480,
              }}
            >
              Ajoutez jusqu{'’'}à {maxPois} lieux (travail, école, sport…) pour
              voir le temps de trajet en voiture sur chaque bien.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 36,
              height: 36,
              borderRadius: PX.radius.pill,
              border: `1px solid ${PX.neutral300}`,
              background: PX.neutral100,
              cursor: 'pointer',
              display: 'inline-grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <PxFigmaIcon name="close" size={12} color={PX.neutral700} />
          </button>
        </div>

        {/* Add form */}
        <AddPoiForm
          onAdd={poi => {
            const next = addPoi(poi)
            return next !== null
          }}
          disabled={!canAddMore}
        />

        {!canAddMore && (
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 13,
              color: PX.neutral500,
              letterSpacing: '-0.39px',
              paddingLeft: 4,
            }}
          >
            Limite de {maxPois} lieux atteinte — supprimez-en un pour en ajouter un autre.
          </p>
        )}

        {/* Existing POIs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pois.length === 0 && (
            <p
              style={{
                margin: 0,
                padding: '16px 4px',
                fontFamily: PX.font.display,
                fontSize: 13,
                color: PX.neutral500,
                fontStyle: 'italic',
              }}
            >
              Aucun lieu enregistré. Ajoutez-en un pour commencer.
            </p>
          )}
          {pois.map(p => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 16,
                background: PX.neutral200,
                borderRadius: PX.radius.medium,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: PX.font.display,
                    fontSize: 15,
                    fontWeight: 500,
                    color: PX.neutral700,
                    letterSpacing: '-0.45px',
                  }}
                >
                  {p.label}
                </span>
                <span
                  style={{
                    fontFamily: PX.font.display,
                    fontSize: 13,
                    fontWeight: 400,
                    color: PX.neutral500,
                    letterSpacing: '-0.39px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={p.address}
                >
                  {p.address}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removePoi(p.id)}
                aria-label={`Supprimer ${p.label}`}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: PX.radius.pill,
                  background: 'transparent',
                  border: `1px solid ${PX.neutral300}`,
                  cursor: 'pointer',
                  display: 'inline-grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <PxFigmaIcon name="close" size={10} color={PX.neutral700} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    portalTarget,
  )
}
