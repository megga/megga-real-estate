// MEGGA — Market Recherche Filters Bar
// Faithful port of design proto megga-search-filters.jsx (FiltersBar).
// Rounded-10 rectangular pills, ink-on-active, full-width sticky, labeled Sauvegarder.

import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bookmark, SlidersHorizontal } from 'lucide-react'
import type { Filters } from '@/lib/searchFilters'
import { CANTON_LABELS } from '@/lib/searchFilters'
import { PROPERTY_TYPE_LABELS } from '@/lib/constants'
import { formatCHF } from '@/lib/utils'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  borderSoft: '#EFF1F4',
  section: '#F2F4F8',
  surface: '#FFFFFF',
  blue: '#0041D9',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

// ── FilterPill ─────────────────────────────────────────────────────────────

interface FilterPillProps {
  label: string
  value?: string | null
  active: boolean
  onClick: () => void
  onClear?: () => void
  hasArrow?: boolean
  pillRef?: (el: HTMLDivElement | null) => void
}

function FilterPill({ label, value, active, onClick, onClear, hasArrow = true, pillRef }: FilterPillProps) {
  return (
    <div ref={pillRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          height: 38,
          padding: '0 14px',
          borderRadius: 10,
          background: active ? M.ink : '#fff',
          color: active ? '#fff' : M.ink,
          border: `1px solid ${active ? M.ink : M.border}`,
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.borderColor = M.ink
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.borderColor = M.border
        }}
      >
        <span style={{ color: active ? 'rgba(255,255,255,0.65)' : M.muted, fontWeight: 500 }}>{label}</span>
        {value && <span style={{ fontWeight: 700 }}>{value}</span>}
        {active && onClear ? (
          <span
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            style={{ marginLeft: 4, opacity: 0.7, cursor: 'pointer' }}
          >
            ×
          </span>
        ) : (
          hasArrow && <span style={{ fontSize: 10, opacity: 0.5 }}>▾</span>
        )}
      </button>
    </div>
  )
}

// ── Dropdown ───────────────────────────────────────────────────────────────

interface DropdownProps {
  open: boolean
  onClose: () => void
  anchor: HTMLElement | null
  width?: number
  children: React.ReactNode
}

function Dropdown({ open, onClose, anchor, width = 280, children }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) && anchor && !anchor.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, anchor, onClose])

  if (!open || !anchor) return null
  const r = anchor.getBoundingClientRect()
  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: r.bottom + 8,
        left: r.left,
        width,
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 12,
        boxShadow: '0 18px 40px rgba(14,20,16,0.14)',
        zIndex: 80,
        padding: 16,
        fontFamily: FONT,
      }}
    >
      {children}
    </div>
  )
}

// ── Range Inputs ───────────────────────────────────────────────────────────

interface RangeInputsProps {
  minV: string
  maxV: string
  onMin: (v: string) => void
  onMax: (v: string) => void
  suffix?: string
}

function RangeInputs({ minV, maxV, onMin, onMax, suffix = '' }: RangeInputsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {[
        { label: 'Min', v: minV, on: onMin, ph: 'Min' + (suffix ? ' ' + suffix : '') },
        { label: 'Max', v: maxV, on: onMax, ph: 'Max' + (suffix ? ' ' + suffix : '') },
      ].map((f, i) => (
        <div key={i}>
          <div style={{ fontSize: 11, fontWeight: 600, color: M.muted, marginBottom: 4 }}>{f.label}</div>
          <input
            type="number"
            value={f.v || ''}
            onChange={(e) => f.on(e.target.value)}
            placeholder={f.ph}
            style={{
              width: '100%',
              height: 38,
              padding: '0 10px',
              border: `1px solid ${M.border}`,
              borderRadius: 8,
              fontFamily: FONT,
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Main FiltersBar ────────────────────────────────────────────────────────

interface MarketRechercheFiltersBarProps {
  filters: Filters
  updateFilter: (patch: Partial<Filters>) => void
  onOpenMore: () => void
  morePlusActiveCount: number
  onSaveSearch: () => void
  hasActiveFilters: boolean
}

const POPULAR_CITIES = ['Genève', 'Lausanne', 'Zürich', 'Berne', 'Vaud', 'Valais']

export default function MarketRechercheFiltersBar({
  filters,
  updateFilter,
  onOpenMore,
  morePlusActiveCount,
  onSaveSearch,
  hasActiveFilters,
}: MarketRechercheFiltersBarProps) {
  type OpenKey = 'location' | 'type' | 'price' | 'rooms' | 'area' | null
  const [open, setOpen] = useState<OpenKey>(null)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const navigate = useNavigate()
  const location = useLocation()

  const isRent = filters.context === 'rent'

  const switchToTab = (tab: 'acheter' | 'louer') => {
    const target = tab === 'louer' ? '/rent' : '/buy'
    if (location.pathname === target) return
    // Preserve current search params
    navigate({ pathname: target, search: location.search })
  }

  // Type options — limited to the 4 design options + commercial
  const TYPE_OPTIONS: { v: string; l: string }[] = [
    { v: '__all__', l: 'Tous biens' },
    ...Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => ({ v, l })),
  ]

  // Location label (city or canton)
  const locationLabel =
    filters.city ||
    (filters.canton ? CANTON_LABELS[filters.canton] || filters.canton : '') ||
    'Toute la Suisse'
  const locationActive = !!(filters.city || filters.canton)

  // Type label
  const typeLabel = filters.types.length
    ? filters.types
        .map((t) => PROPERTY_TYPE_LABELS[t as keyof typeof PROPERTY_TYPE_LABELS] || t)
        .join(', ')
    : 'Tous'
  const typeActive = filters.types.length > 0

  // Price label
  const priceUnit = isRent ? '/m' : ''
  const priceLabel = (() => {
    if (filters.minPrice && filters.maxPrice) {
      return `${formatCHF(Number(filters.minPrice))} – ${formatCHF(Number(filters.maxPrice))}${priceUnit}`
    }
    if (filters.minPrice) return `≥ ${formatCHF(Number(filters.minPrice))}${priceUnit}`
    if (filters.maxPrice) return `≤ ${formatCHF(Number(filters.maxPrice))}${priceUnit}`
    return 'Tous'
  })()
  const priceActive = !!(filters.minPrice || filters.maxPrice)

  // Rooms label
  const roomsLabel = filters.rooms ? `${filters.rooms}+` : 'Toutes'
  const roomsActive = !!filters.rooms

  // Area label
  const areaLabel = (() => {
    if (filters.minSurface) return `≥ ${filters.minSurface} m²`
    return 'Toutes'
  })()
  const areaActive = !!filters.minSurface

  return (
    <div
      style={{
        position: 'sticky',
        top: 64,
        zIndex: 40,
        background: '#fff',
        borderBottom: `1px solid ${M.border}`,
        padding: '14px 32px',
        fontFamily: FONT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Tab Acheter / Louer (design proto) */}
        <div style={{ display: 'inline-flex', padding: 3, background: M.section, borderRadius: 10 }}>
          {([['acheter', 'Acheter'], ['louer', 'Louer']] as const).map(([k, l]) => {
            const isActive = (k === 'louer' && isRent) || (k === 'acheter' && !isRent)
            return (
              <button
                key={k}
                type="button"
                onClick={() => switchToTab(k)}
                style={{
                  height: 32,
                  padding: '0 16px',
                  border: 'none',
                  borderRadius: 8,
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? M.ink : M.muted,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 2px rgba(14,20,16,0.06)' : 'none',
                }}
              >
                {l}
              </button>
            )
          })}
        </div>

        {/* Location pill */}
        <FilterPill
          label="Lieu"
          value={locationActive ? locationLabel : null}
          active={locationActive}
          onClick={() => setOpen(open === 'location' ? null : 'location')}
          onClear={() => updateFilter({ city: '', canton: '' })}
          pillRef={(el) => { refs.current.location = el }}
        />

        {/* Type pill */}
        <FilterPill
          label="Bien"
          value={typeActive ? typeLabel : null}
          active={typeActive}
          onClick={() => setOpen(open === 'type' ? null : 'type')}
          onClear={() => updateFilter({ types: [] })}
          pillRef={(el) => { refs.current.type = el }}
        />

        {/* Price pill */}
        <FilterPill
          label="Prix"
          value={priceActive ? priceLabel : null}
          active={priceActive}
          onClick={() => setOpen(open === 'price' ? null : 'price')}
          onClear={() => updateFilter({ minPrice: '', maxPrice: '' })}
          pillRef={(el) => { refs.current.price = el }}
        />

        {/* Rooms pill */}
        <FilterPill
          label="Pièces"
          value={roomsActive ? roomsLabel : null}
          active={roomsActive}
          onClick={() => setOpen(open === 'rooms' ? null : 'rooms')}
          onClear={() => updateFilter({ rooms: '' })}
          pillRef={(el) => { refs.current.rooms = el }}
        />

        {/* Area pill */}
        <FilterPill
          label="Surface"
          value={areaActive ? areaLabel : null}
          active={areaActive}
          onClick={() => setOpen(open === 'area' ? null : 'area')}
          onClear={() => updateFilter({ minSurface: '' })}
          pillRef={(el) => { refs.current.area = el }}
        />

        {/* More filters button */}
        <button
          type="button"
          onClick={onOpenMore}
          style={{
            height: 38,
            padding: '0 14px',
            borderRadius: 10,
            background: '#fff',
            color: M.ink,
            border: `1px solid ${M.border}`,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <SlidersHorizontal size={14} strokeWidth={1.6} />
          Plus de filtres
          {morePlusActiveCount > 0 && (
            <span
              style={{
                background: M.ink,
                color: '#fff',
                borderRadius: 999,
                padding: '1px 7px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {morePlusActiveCount}
            </span>
          )}
        </button>

        <div style={{ flex: 1 }} />

        {/* Save search */}
        <button
          type="button"
          onClick={onSaveSearch}
          disabled={!hasActiveFilters}
          title={hasActiveFilters ? 'Sauvegarder cette recherche' : 'Affinez votre recherche pour la sauvegarder'}
          style={{
            height: 38,
            padding: '0 14px',
            borderRadius: 10,
            background: 'transparent',
            border: `1px solid ${M.border}`,
            color: hasActiveFilters ? M.ink : M.muted,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
            opacity: hasActiveFilters ? 1 : 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (hasActiveFilters) e.currentTarget.style.borderColor = M.ink
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = M.border
          }}
        >
          <Bookmark size={14} strokeWidth={1.6} />
          Sauvegarder
        </button>
      </div>

      {/* Dropdown: Location */}
      <Dropdown open={open === 'location'} onClose={() => setOpen(null)} anchor={refs.current.location || null} width={300}>
        <div style={{ fontSize: 12, fontWeight: 700, color: M.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Lieu
        </div>
        <input
          type="text"
          value={filters.city || ''}
          onChange={(e) => updateFilter({ city: e.target.value })}
          placeholder="Ville, canton ou quartier"
          style={{
            width: '100%',
            height: 40,
            padding: '0 12px',
            border: `1px solid ${M.border}`,
            borderRadius: 8,
            fontFamily: FONT,
            fontSize: 13,
            outline: 'none',
            marginBottom: 10,
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {POPULAR_CITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                updateFilter({ city: c })
                setOpen(null)
              }}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 999,
                border: `1px solid ${M.border}`,
                background: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                color: M.ink,
                fontFamily: FONT,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Dropdown: Type */}
      <Dropdown open={open === 'type'} onClose={() => setOpen(null)} anchor={refs.current.type || null} width={220}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TYPE_OPTIONS.map((o) => {
            const isAll = o.v === '__all__'
            const selected = isAll ? filters.types.length === 0 : filters.types.includes(o.v)
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => {
                  if (isAll) {
                    updateFilter({ types: [] })
                  } else {
                    const next = filters.types.includes(o.v)
                      ? filters.types.filter((x) => x !== o.v)
                      : [...filters.types, o.v]
                    updateFilter({ types: next })
                  }
                }}
                style={{
                  height: 36,
                  padding: '0 12px',
                  border: 'none',
                  borderRadius: 8,
                  background: selected ? M.section : 'transparent',
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  color: M.ink,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {o.l}
              </button>
            )
          })}
        </div>
      </Dropdown>

      {/* Dropdown: Price */}
      <Dropdown open={open === 'price'} onClose={() => setOpen(null)} anchor={refs.current.price || null} width={300}>
        <div style={{ fontSize: 12, fontWeight: 700, color: M.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Prix CHF
        </div>
        <RangeInputs
          minV={filters.minPrice}
          maxV={filters.maxPrice}
          onMin={(v) => updateFilter({ minPrice: v })}
          onMax={(v) => updateFilter({ maxPrice: v })}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {(isRent
            ? [
                ['', '1500', '< 1500'],
                ['1500', '2500', '1.5K – 2.5K'],
                ['2500', '4000', '2.5K – 4K'],
                ['4000', '', '> 4K'],
              ]
            : [
                ['', '500000', '< 500K'],
                ['500000', '1000000', '500K – 1M'],
                ['1000000', '2000000', '1M – 2M'],
                ['2000000', '', '> 2M'],
              ]
          ).map(([mi, ma, l]) => (
            <button
              key={l}
              type="button"
              onClick={() => updateFilter({ minPrice: mi, maxPrice: ma })}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 999,
                border: `1px solid ${M.border}`,
                background: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                color: M.ink,
                fontFamily: FONT,
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Dropdown: Rooms */}
      <Dropdown open={open === 'rooms'} onClose={() => setOpen(null)} anchor={refs.current.rooms || null} width={260}>
        <div style={{ fontSize: 12, fontWeight: 700, color: M.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Pièces minimum
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['1', '2', '3', '4', '5'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => updateFilter({ rooms: filters.rooms === n ? '' : n })}
              style={{
                flex: 1,
                height: 38,
                border: `1px solid ${filters.rooms === n ? M.ink : M.border}`,
                borderRadius: 8,
                background: filters.rooms === n ? M.ink : '#fff',
                color: filters.rooms === n ? '#fff' : M.ink,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {n}+
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Dropdown: Area */}
      <Dropdown open={open === 'area'} onClose={() => setOpen(null)} anchor={refs.current.area || null} width={300}>
        <div style={{ fontSize: 12, fontWeight: 700, color: M.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Surface minimum (m²)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['30', '50', '80', '100', '150', '200'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateFilter({ minSurface: filters.minSurface === s ? '' : s })}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 999,
                border: `1px solid ${filters.minSurface === s ? M.ink : M.border}`,
                background: filters.minSurface === s ? M.ink : '#fff',
                color: filters.minSurface === s ? '#fff' : M.ink,
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {s} m²
            </button>
          ))}
        </div>
      </Dropdown>
    </div>
  )
}
