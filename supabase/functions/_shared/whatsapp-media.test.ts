import { describe, it, expect } from 'vitest'
import { extFromMime, buildMediaKey, parseMetaMediaMeta } from './whatsapp-media'

describe('extFromMime', () => {
  it('mappe les mimes courants', () => {
    expect(extFromMime('audio/ogg; codecs=opus')).toBe('ogg')
    expect(extFromMime('image/jpeg')).toBe('jpg')
    expect(extFromMime('application/pdf')).toBe('pdf')
  })
  it('repli bin si inconnu', () => {
    expect(extFromMime('application/x-weird')).toBe('bin')
    expect(extFromMime(null)).toBe('bin')
  })
})

describe('buildMediaKey', () => {
  it('clé déterministe scopée agence/message', () => {
    expect(buildMediaKey('ag1', 'msg9', 'audio/ogg')).toBe('wa/ag1/msg9.ogg')
  })
})

describe('parseMetaMediaMeta', () => {
  it('lit url + mime de la réponse Graph étape 1', () => {
    expect(parseMetaMediaMeta({ url: 'https://x/y', mime_type: 'audio/ogg' }))
      .toEqual({ url: 'https://x/y', mime: 'audio/ogg' })
  })
  it('null si pas d’url', () => {
    expect(parseMetaMediaMeta({})).toBeNull()
  })
})
