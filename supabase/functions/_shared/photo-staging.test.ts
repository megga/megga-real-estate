import { describe, it, expect } from 'vitest'
import { stagedPhotoUrlsForAgency } from './photo-staging'

const BASE = 'https://xyz.supabase.co'
const AG = 'agency-1'
const ok = (p: string) => `${BASE}/storage/v1/object/public/property-photos/${AG}/chat-staging/${p}`

describe('stagedPhotoUrlsForAgency — garde SSRF', () => {
  it('accepte les URLs staging de l\'agence de l\'agent', () => {
    const urls = [ok('a.jpg'), ok('b.png')]
    expect(stagedPhotoUrlsForAgency(BASE, AG, urls)).toEqual(urls)
  })

  it('rejette une AUTRE agence (fuite cross-tenant)', () => {
    const foreign = `${BASE}/storage/v1/object/public/property-photos/agency-2/chat-staging/x.jpg`
    expect(stagedPhotoUrlsForAgency(BASE, AG, [foreign])).toEqual([])
  })

  it('rejette un autre préfixe de la même agence (hors chat-staging)', () => {
    const other = `${BASE}/storage/v1/object/public/property-photos/${AG}/properties/p/x.jpg`
    expect(stagedPhotoUrlsForAgency(BASE, AG, [other])).toEqual([])
  })

  it('rejette une URL arbitraire (SSRF) et un autre bucket', () => {
    expect(stagedPhotoUrlsForAgency(BASE, AG, [
      'http://169.254.169.254/latest/meta-data/',
      'https://evil.example/x.jpg',
      `${BASE}/storage/v1/object/public/documents/${AG}/chat-staging/x.jpg`,
    ])).toEqual([])
  })

  it('rejette le path traversal et le préfixe seul (sans objet)', () => {
    expect(stagedPhotoUrlsForAgency(BASE, AG, [ok('../../etc/passwd')])).toEqual([])
    expect(stagedPhotoUrlsForAgency(BASE, AG, [`${BASE}/storage/v1/object/public/property-photos/${AG}/chat-staging/`])).toEqual([])
  })

  it('gère base/agence manquantes et entrées non conformes', () => {
    expect(stagedPhotoUrlsForAgency(BASE, null, [ok('a.jpg')])).toEqual([])
    expect(stagedPhotoUrlsForAgency('', AG, [ok('a.jpg')])).toEqual([])
    expect(stagedPhotoUrlsForAgency(BASE, AG, 'not-array')).toEqual([])
    expect(stagedPhotoUrlsForAgency(BASE, AG, [123, null, ok('a.jpg')])).toEqual([ok('a.jpg')])
  })

  it('tolère un baseUrl avec slash final', () => {
    expect(stagedPhotoUrlsForAgency(`${BASE}/`, AG, [ok('a.jpg')])).toEqual([ok('a.jpg')])
  })
})
