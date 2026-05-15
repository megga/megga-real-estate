// MEGGA Marketplace — Property X filter bar.
//
// Affiche les filtres principaux (canton, type, prix min/max, pièces min,
// surface min) + bouton reset + compteur "X biens trouvés".
//
// Lit/écrit dans l'URL via useMarketFilters. Les inputs numériques (prix,
// surface) utilisent un état local éphémère (focus/blur) pour afficher la
// valeur formatée (apostrophe suisse pour les prix, "m²" pour la surface)
// sans casser le caret pendant la saisie.

import { useEffect, useId, useState } from 'react'
import { PX } from '../tokens'
import PxFigmaIcon from '../PxFigmaIcon'
import { formatCHF } from '@/lib/utils'
import {
  CANTON_LABELS,
  PROPERTY_TYPES,
  SWISS_CANTONS,
  useMarketFilters,
} from '@/hooks/useMarketFilters'
import { useMarketListingsCount } from '@/hooks/useMarketListings'

interface PxListingsFilterBarProps {
  context: 'buy' | 'rent'
}

// ─── Building blocks ───────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m4 6 4 4 4-4" stroke={PX.neutral500} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PillSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  minWidth = 160,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  placeholder: string
  ariaLabel: string
  minWidth?: number
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        background: PX.neutral100,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.pill,
        height: 48,
        minWidth,
        paddingLeft: 16,
        paddingRight: 36,
      }}
    >
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 0,
          outline: 'none',
          color: value ? PX.neutral700 : PX.neutral500,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          paddingTop: 2,
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        style={{
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          display: 'flex',
        }}
      >
        <ChevronDown />
      </span>
    </div>
  )
}

/**
 * Pill input qui accepte un nombre. Focus = saisie brute, blur = display
 * formaté via `format(value)`. Commit sur blur ou Enter — pas par keystroke
 * (évite une requête Supabase par chiffre tapé).
 */
function NumberPill({
  value,
  onChange,
  placeholder,
  ariaLabel,
  format,
  width = 160,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder: string
  ariaLabel: string
  format: (n: number) => string
  width?: number
}) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState<string>(value ? String(value) : '')

  useEffect(() => {
    if (!focused) setRaw(value ? String(value) : '')
  }, [value, focused])

  const display = focused ? raw : value ? format(value) : ''

  const commit = () => {
    const cleaned = raw.replace(/\D/g, '')
    const n = cleaned ? parseInt(cleaned, 10) : NaN
    const next = Number.isFinite(n) && n > 0 ? n : undefined
    if (next !== value) onChange(next)
  }

  return (
    <input
      aria-label={ariaLabel}
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        commit()
      }}
      onChange={e => setRaw(e.target.value.replace(/[^\d]/g, ''))}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
      }}
      style={{
        height: 48,
        width,
        background: PX.neutral100,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.pill,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 2,
        outline: 'none',
        color: PX.neutral700,
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
      }}
    />
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function PxListingsFilterBar({ context }: PxListingsFilterBarProps) {
  const { filters, selectedType, update, reset, isEmpty } = useMarketFilters(context)
  const { data: count, isLoading: countLoading } = useMarketListingsCount(filters)
  const labelId = useId()

  const cantonOptions = SWISS_CANTONS.map(c => ({
    value: c,
    label: `${CANTON_LABELS[c]} (${c})`,
  }))

  const typeOptions = PROPERTY_TYPES.map(t => ({ value: t.value, label: t.label }))

  const roomsOptions = [
    { value: '1', label: '1+ pièce' },
    { value: '2', label: '2+ pièces' },
    { value: '3', label: '3+ pièces' },
    { value: '4', label: '4+ pièces' },
    { value: '5', label: '5+ pièces' },
    { value: '6', label: '6+ pièces' },
    { value: '7', label: '7+ pièces' },
  ]

  const formatPrice = (n: number) => formatCHF(n).replace('CHF ', '').trim()
  const formatSurface = (n: number) => `${n} m²`

  // Compteur formaté avec apostrophe suisse (fr-CH n'utilise pas U+2019 nativement
  // mais Gregory utilise l'apostrophe typographique partout — on remplace l'espace
  // que toLocaleString génère par défaut).
  const countLabel = countLoading
    ? 'Recherche…'
    : count === 1
      ? '1 bien trouvé'
      : `${(count ?? 0).toLocaleString('fr-CH').replace(/\s/g, '’')} biens trouvés`

  return (
    <section
      aria-labelledby={labelId}
      style={{
        width: '100%',
        maxWidth: 1392,
        margin: '0 auto',
        paddingLeft: 24,
        paddingRight: 24,
        position: 'relative',
        zIndex: 4,
      }}
    >
      <h2
        id={labelId}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Filtres de recherche
      </h2>

      <div
        style={{
          background: PX.neutral100,
          border: `1px solid ${PX.neutral300}`,
          borderRadius: PX.radius.large,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: PX.shadow.small,
        }}
      >
        {/* Row 1 — selects + inputs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <PillSelect
            ariaLabel="Canton"
            value={filters.canton ?? ''}
            onChange={v => update({ canton: v || null })}
            options={cantonOptions}
            placeholder="Canton"
            minWidth={180}
          />
          <PillSelect
            ariaLabel="Type de bien"
            value={selectedType ?? ''}
            onChange={v => update({ type: v || null })}
            options={typeOptions}
            placeholder="Type"
            minWidth={160}
          />
          <NumberPill
            ariaLabel="Prix minimum"
            value={filters.minPrice}
            onChange={v => update({ minPrice: v ?? null })}
            placeholder="Prix min"
            format={formatPrice}
          />
          <NumberPill
            ariaLabel="Prix maximum"
            value={filters.maxPrice}
            onChange={v => update({ maxPrice: v ?? null })}
            placeholder="Prix max"
            format={formatPrice}
          />
          <PillSelect
            ariaLabel="Nombre de pièces minimum"
            value={filters.minRooms ? String(filters.minRooms) : ''}
            onChange={v => update({ minRooms: v ? parseInt(v, 10) : null })}
            options={roomsOptions}
            placeholder="Pièces"
            minWidth={150}
          />
          <NumberPill
            ariaLabel="Surface minimum en m²"
            value={filters.minSurface}
            onChange={v => update({ minSurface: v ?? null })}
            placeholder="Surface min"
            format={formatSurface}
            width={150}
          />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={reset}
              disabled={isEmpty}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 48,
                paddingLeft: 16,
                paddingRight: 16,
                background: 'transparent',
                border: `1px solid ${isEmpty ? PX.neutral300 : PX.neutral700}`,
                borderRadius: PX.radius.pill,
                color: isEmpty ? PX.neutral400 : PX.neutral700,
                cursor: isEmpty ? 'not-allowed' : 'pointer',
                fontFamily: PX.font.display,
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.42px',
                opacity: isEmpty ? 0.6 : 1,
              }}
            >
              <PxFigmaIcon name="close" size={12} color={isEmpty ? PX.neutral400 : PX.neutral700} />
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Row 2 — counter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 4,
          }}
        >
          <span
            data-testid="listings-count"
            style={{
              fontFamily: PX.font.display,
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.42px',
              color: PX.neutral500,
            }}
          >
            {countLabel}
          </span>
        </div>
      </div>
    </section>
  )
}
