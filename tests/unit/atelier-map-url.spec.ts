// Unit test — helpers purs de la mini-carte Mapbox de l'Atelier Matching.
// Verrou anti-régression sur deux invariants faciles à casser par accident :
//   - l'ORDRE lng/lat (Mapbox veut lng,lat ; la DB stocke lat + lng séparés —
//     une inversion donne une carte plausible mais fausse, sans erreur)
//   - le style/pin selon le thème (light-v11 noir / dark-v11 blanc)
// + la garde « null island » (0,0) qui évite une carte du golfe de Guinée
//   quand une colonne géo n'est pas remplie (revue adversariale, 10 juin 2026).

import { describe, it, expect } from 'vitest'
import { buildStaticMapUrl, validCoords } from '@/components/matching-atelier/mapUrl'

describe('validCoords', () => {
  it('accepte une coord suisse valide et renvoie [lng, lat] (ordre Mapbox)', () => {
    // Carouge : lat 46.1817, lng 6.1397
    expect(validCoords(46.1817, 6.1397)).toEqual([6.1397, 46.1817])
  })

  it('rejette une coord manquante (null/undefined)', () => {
    expect(validCoords(null, 6.1397)).toBeNull()
    expect(validCoords(46.1817, null)).toBeNull()
    expect(validCoords(undefined, undefined)).toBeNull()
  })

  it('rejette le « null island » (0,0) — colonne géo non remplie', () => {
    expect(validCoords(0, 0)).toBeNull()
  })

  it('accepte une vraie coord même si un seul axe vaut 0 (équateur / méridien)', () => {
    expect(validCoords(0, 6.1397)).toEqual([6.1397, 0])
    expect(validCoords(46.1817, 0)).toEqual([0, 46.1817])
  })

  it('rejette NaN / Infinity', () => {
    expect(validCoords(NaN, 6.1397)).toBeNull()
    expect(validCoords(46.1817, Infinity)).toBeNull()
  })

  it('rejette hors des bornes géographiques', () => {
    expect(validCoords(91, 6.1397)).toBeNull()
    expect(validCoords(-91, 6.1397)).toBeNull()
    expect(validCoords(46.1817, 181)).toBeNull()
    expect(validCoords(46.1817, -181)).toBeNull()
  })
})

describe('buildStaticMapUrl', () => {
  const lng = 6.1397
  const lat = 46.1817

  it('thème clair → light-v11 + pin noir, ordre lng,lat, zoom 13 @2x, token injecté', () => {
    const u = buildStaticMapUrl(lng, lat, false, 'pk.test-token')
    expect(u).toContain('/styles/v1/mapbox/light-v11/static/')
    expect(u).toContain(`pin-s+0b0c0e(${lng},${lat})`)
    expect(u).toContain(`/${lng},${lat},13,0/500x320@2x`)
    expect(u).toContain('access_token=pk.test-token')
    expect(u).toContain('attribution=false&logo=false')
  })

  it('thème sombre → dark-v11 + pin blanc', () => {
    const u = buildStaticMapUrl(lng, lat, true, 'pk.test-token')
    expect(u).toContain('/styles/v1/mapbox/dark-v11/static/')
    expect(u).toContain(`pin-s+f4f6f8(${lng},${lat})`)
  })

  it("place le pin et le centre dans l'ordre lng,lat (pas lat,lng)", () => {
    const u = buildStaticMapUrl(lng, lat, false, 't')
    // lng (6.x) doit précéder lat (46.x) dans le marqueur ET le centre
    expect(u.indexOf(`${lng}`)).toBeLessThan(u.indexOf(`${lat}`))
  })
})
