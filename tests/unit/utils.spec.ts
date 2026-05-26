// First unit test — covers the most-used pure utilities from src/lib/utils.ts.
// These functions are called everywhere (every listing card, every KPI, every
// price label), so a regression here would be visible across the whole app.
// They were also rewritten as "type-defensive" after a prod incident (see
// CLAUDE.md §7) — the null/string/undefined cases below pin that fix down.

import { describe, it, expect } from 'vitest'
import { formatCHF, formatRent, formatSurface } from '@/lib/utils'

describe('formatCHF', () => {
  it('formats an integer with Swiss apostrophe thousand-separator', () => {
    expect(formatCHF(720000)).toBe("CHF 720'000")
  })

  it('accepts a string input (React Hook Form returns strings from <input type="number">)', () => {
    expect(formatCHF('1250000')).toBe("CHF 1'250'000")
  })

  it('returns "CHF —" for null (missing value, not zero)', () => {
    expect(formatCHF(null)).toBe('CHF —')
  })

  it('returns "CHF —" for undefined', () => {
    expect(formatCHF(undefined)).toBe('CHF —')
  })

  it('returns "CHF —" for empty string (RHF reset state)', () => {
    expect(formatCHF('')).toBe('CHF —')
  })

  it('returns "CHF —" for a non-numeric string', () => {
    expect(formatCHF('not-a-number')).toBe('CHF —')
  })

  it('handles zero', () => {
    expect(formatCHF(0)).toBe('CHF 0')
  })

  it('rounds decimals (no fractional CHF displayed)', () => {
    expect(formatCHF(720000.49)).toBe("CHF 720'000")
  })
})

describe('formatRent', () => {
  it('appends "/mois" to a valid amount', () => {
    expect(formatRent(2500)).toBe("CHF 2'500/mois")
  })

  it('returns "CHF —/mois" for null (missing value)', () => {
    expect(formatRent(null)).toBe('CHF —/mois')
  })

  it('returns "CHF —/mois" for non-numeric string', () => {
    expect(formatRent('not-a-number')).toBe('CHF —/mois')
  })

  it('handles string input', () => {
    expect(formatRent('3800')).toBe("CHF 3'800/mois")
  })
})

describe('formatSurface', () => {
  it('appends " m²" to the number', () => {
    expect(formatSurface(120)).toBe('120 m²')
  })

  it('handles zero', () => {
    expect(formatSurface(0)).toBe('0 m²')
  })
})
