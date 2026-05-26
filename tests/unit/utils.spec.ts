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

  // Note: the docstring promises "CHF —" for null/undefined, but the actual
  // implementation coerces them to 0 via `?? 0`. The "CHF —" path only fires
  // for genuinely non-numeric strings. Tests pin the real behaviour.
  it('coerces null to 0 (docstring says "CHF —" but ?? 0 wins)', () => {
    expect(formatCHF(null)).toBe('CHF 0')
  })

  it('coerces undefined to 0 (same caveat)', () => {
    expect(formatCHF(undefined)).toBe('CHF 0')
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

  it('coerces null to 0 (consistent with formatCHF behaviour)', () => {
    expect(formatRent(null)).toBe('CHF 0/mois')
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
