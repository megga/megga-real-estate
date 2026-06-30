import { describe, it, expect } from 'vitest'
import { parseDebugToken, tokenDaysMetric, tokenNeedsAlert } from './whatsapp-token'

const NOW = Date.UTC(2026, 6, 1, 0, 0, 0) // 2026-07-01
const inDays = (d: number) => Math.floor(NOW / 1000) + d * 86_400

describe('parseDebugToken', () => {
  it('token valide qui expire dans 10 jours', () => {
    const h = parseDebugToken({ data: { is_valid: true, expires_at: inDays(10) } }, NOW)
    expect(h.isValid).toBe(true)
    expect(h.daysLeft).toBe(10)
    expect(h.error).toBeNull()
  })
  it('token valide qui n’expire jamais (expires_at=0)', () => {
    const h = parseDebugToken({ data: { is_valid: true, expires_at: 0 } }, NOW)
    expect(h.isValid).toBe(true)
    expect(h.expiresAt).toBeNull()
    expect(h.daysLeft).toBeNull()
  })
  it('token invalide → error remontée', () => {
    const h = parseDebugToken({ data: { is_valid: false, error: { message: 'Session expired' } } }, NOW)
    expect(h.isValid).toBe(false)
    expect(h.error).toBe('Session expired')
  })
  it('réponse malformée → invalide, unparseable', () => {
    expect(parseDebugToken({}, NOW)).toEqual({ isValid: false, expiresAt: null, daysLeft: null, error: 'unparseable' })
    expect(parseDebugToken(null, NOW).isValid).toBe(false)
  })
})

describe('tokenDaysMetric', () => {
  it('-1 invalide, 9999 jamais, sinon jours', () => {
    expect(tokenDaysMetric({ isValid: false, expiresAt: null, daysLeft: null, error: 'x' })).toBe(-1)
    expect(tokenDaysMetric({ isValid: true, expiresAt: null, daysLeft: null, error: null })).toBe(9999)
    expect(tokenDaysMetric({ isValid: true, expiresAt: inDays(10), daysLeft: 10, error: null })).toBe(10)
  })
})

describe('tokenNeedsAlert', () => {
  it('alerte si invalide ou expire sous 7 jours', () => {
    expect(tokenNeedsAlert({ isValid: false, expiresAt: null, daysLeft: null, error: 'x' })).toBe(true)
    expect(tokenNeedsAlert({ isValid: true, expiresAt: inDays(3), daysLeft: 3, error: null })).toBe(true)
    expect(tokenNeedsAlert({ isValid: true, expiresAt: inDays(10), daysLeft: 10, error: null })).toBe(false)
    expect(tokenNeedsAlert({ isValid: true, expiresAt: null, daysLeft: null, error: null })).toBe(false)
  })
})
