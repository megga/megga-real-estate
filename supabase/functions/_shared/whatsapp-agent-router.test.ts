import { describe, it, expect } from 'vitest'
import { extractPairingCode, isPairingCodeValid } from './whatsapp-agent-router'

describe('whatsapp-agent-router — pairing code', () => {
  it('extractPairingCode : isole 6 chiffres exacts (espaces/texte tolérés)', () => {
    expect(extractPairingCode('123456')).toBe('123456')
    expect(extractPairingCode('  123456 ')).toBe('123456')
    expect(extractPairingCode('Code: 123456')).toBe('123456')
    expect(extractPairingCode('mon code est 123 456')).toBe('123456')
  })
  it('extractPairingCode : null si pas exactement 6 chiffres', () => {
    expect(extractPairingCode('12345')).toBeNull()
    expect(extractPairingCode('1234567')).toBeNull()
    expect(extractPairingCode('bonjour')).toBeNull()
    expect(extractPairingCode('')).toBeNull()
    expect(extractPairingCode(null)).toBeNull()
    expect(extractPairingCode(undefined)).toBeNull()
  })
  it('isPairingCodeValid : vrai seulement si futur', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isPairingCodeValid(future)).toBe(true)
    expect(isPairingCodeValid(past)).toBe(false)
    expect(isPairingCodeValid(null)).toBe(false)
    expect(isPairingCodeValid('not-a-date')).toBe(false)
  })
})
