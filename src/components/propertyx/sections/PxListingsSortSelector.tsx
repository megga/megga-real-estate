// MEGGA Marketplace — Property X sort dropdown.
//
// Placé en top-right de la grid. Lit/écrit la clé `sort` de l'URL via
// useMarketFilters. Le hook useMarketListings accepte déjà les valeurs
// 'newest' | 'price_asc' | 'price_desc' | 'surface_desc' | 'best_deals' | 'recommended'.

import { PX } from '../tokens'
import { SORT_OPTIONS, useMarketFilters, type SortValue } from '@/hooks/useMarketFilters'

interface PxListingsSortSelectorProps {
  context: 'buy' | 'rent'
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m4 6 4 4 4-4" stroke={PX.neutral500} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PxListingsSortSelector({ context }: PxListingsSortSelectorProps) {
  const { filters, update } = useMarketFilters(context)
  const current = filters.sort ?? 'newest'

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          fontFamily: PX.font.display,
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.42px',
          color: PX.neutral500,
        }}
      >
        Trier par
      </span>
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          background: PX.neutral100,
          border: `1px solid ${PX.neutral300}`,
          borderRadius: PX.radius.pill,
          height: 40,
          minWidth: 200,
          paddingLeft: 16,
          paddingRight: 36,
        }}
      >
        <select
          aria-label="Trier les biens"
          value={current}
          onChange={e => update({ sort: e.target.value as SortValue })}
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
          {SORT_OPTIONS.map(o => (
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
      </span>
    </label>
  )
}
