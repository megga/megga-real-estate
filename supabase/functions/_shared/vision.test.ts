import { describe, it, expect } from 'vitest'
import { isReadableDocMime, parseGemini } from './vision'

describe('isReadableDocMime', () => {
  it('accepte images et PDF', () => {
    expect(isReadableDocMime('image/png')).toBe(true)
    expect(isReadableDocMime('image/jpeg')).toBe(true)
    expect(isReadableDocMime('image/webp')).toBe(true)
    expect(isReadableDocMime('application/pdf')).toBe(true)
  })
  it('refuse les types non lisibles et le vide', () => {
    expect(isReadableDocMime('audio/ogg')).toBe(false)
    expect(isReadableDocMime('application/zip')).toBe(false)
    expect(isReadableDocMime('text/plain')).toBe(false)
    expect(isReadableDocMime(null)).toBe(false)
    expect(isReadableDocMime(undefined)).toBe(false)
    expect(isReadableDocMime('')).toBe(false)
  })
})

describe('parseGemini', () => {
  it('concatène le texte des parts', () => {
    const json = { candidates: [{ content: { parts: [{ text: 'Ligne 1' }, { text: '\nLigne 2' }] } }] }
    expect(parseGemini(json)).toBe('Ligne 1\nLigne 2')
  })
  it('repli vide si réponse malformée ou sans candidat', () => {
    expect(parseGemini({})).toBe('')
    expect(parseGemini({ candidates: [] })).toBe('')
    expect(parseGemini(null)).toBe('')
    expect(parseGemini({ candidates: [{ content: {} }] })).toBe('')
  })
})
