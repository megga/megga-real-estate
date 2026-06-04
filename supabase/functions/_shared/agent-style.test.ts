import { describe, it, expect } from 'vitest'
import { formatStyleBlock, type LearnedStyle } from './agent-style'

const base: LearnedStyle = { language: 'fr', formality: 'tu', emoji: true, traits: 'phrases courtes, va droit au but', status: 'active', updated_at: '2026-06-03T00:00:00Z', sample_count: 20 }

describe('formatStyleBlock', () => {
  it('rend un bloc tonal borné pour un style actif', () => {
    const s = formatStyleBlock(base)
    expect(s).toContain('Style de cet agent')
    expect(s).toContain('phrases courtes')
    expect(s.length).toBeLessThanOrEqual(320)
  })
  it('renvoie chaîne vide si le style n\'est pas actif ou absent', () => {
    expect(formatStyleBlock({ ...base, status: 'suggested' })).toBe('')
    expect(formatStyleBlock({ ...base, status: 'off' })).toBe('')
    expect(formatStyleBlock(null)).toBe('')
    expect(formatStyleBlock(undefined)).toBe('')
  })
  it('tronque traits trop longs (borne le prompt)', () => {
    const long = formatStyleBlock({ ...base, traits: 'x'.repeat(500) })
    expect(long.length).toBeLessThanOrEqual(320)
  })
})
