import { describe, it, expect } from 'vitest'
import { isReadableDocMime, parseGemini, parseMediaUnderstanding, threadTextFor, ID_DOC_REDACTION_FR } from './vision'

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

describe('parseMediaUnderstanding', () => {
  it('parse un JSON valide', () => {
    const u = parseMediaUnderstanding('{"kind":"property_photo","caption":"Salon lumineux","text":""}')
    expect(u).toEqual({ kind: 'property_photo', caption: 'Salon lumineux', text: '' })
  })
  it('kind inconnu → other', () => {
    expect(parseMediaUnderstanding('{"kind":"selfie","caption":"x"}')?.kind).toBe('other')
  })
  it('JSON cassé ou vide → null', () => {
    expect(parseMediaUnderstanding('pas du json')).toBeNull()
    expect(parseMediaUnderstanding('{"kind":"other","caption":"","text":""}')).toBeNull() // rien d'exploitable
  })
  it('borne caption et texte', () => {
    const u = parseMediaUnderstanding(JSON.stringify({ kind: 'document', caption: 'C'.repeat(500), text: 'T'.repeat(5000) }))
    expect(u!.caption.length).toBeLessThanOrEqual(200)
    expect(u!.text.length).toBeLessThanOrEqual(3000)
  })
})

describe('threadTextFor — garde-fou résidence', () => {
  it('pièce d’identité → libellé neutre, JAMAIS l’OCR', () => {
    const out = threadTextFor({ kind: 'id_document', caption: 'CNI de Jean Dupont 12.03.1980', text: 'No 123456 né le…' })
    expect(out).toBe(ID_DOC_REDACTION_FR)
    expect(out).not.toContain('Dupont')
    expect(out).not.toContain('123456')
  })
  it('média normal → caption + texte combinés', () => {
    expect(threadTextFor({ kind: 'listing', caption: 'Annonce 3.5p Carouge', text: 'CHF 1’200’000' }))
      .toBe('Annonce 3.5p Carouge\nCHF 1’200’000')
  })
})
