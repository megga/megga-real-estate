import { describe, it, expect } from 'vitest'
import { parseDeepgram } from './whatsapp-transcribe'

describe('parseDeepgram', () => {
  it('extrait transcript + confidence + langue', () => {
    const r = parseDeepgram({ results: { channels: [{
      detected_language: 'fr',
      alternatives: [{ transcript: 'bonjour je cherche un 3 pièces', confidence: 0.97 }],
    }] } })
    expect(r).toEqual({ transcript: 'bonjour je cherche un 3 pièces', confidence: 0.97, lang: 'fr' })
  })
  it('repli propre si réponse vide', () => {
    expect(parseDeepgram({})).toEqual({ transcript: '', confidence: 0, lang: null })
  })
})
