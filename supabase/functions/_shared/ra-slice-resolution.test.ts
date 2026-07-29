import { describe, it, expect } from 'vitest'
import {
  checkSliceResolution, assertSliceResolved, SLUG_TO_CODE,
  RESOLUTION_MIN_SAMPLE, type SliceHit,
} from './ra-slice-resolution'

// Annonces telles que l'API RA les renvoie : postcode + state en toutes lettres.
const hit = (postcode: number, state: string): SliceHit => ({ postcode, state })

// Une réponse SCOPÉE : 12 annonces uriennes, relevées le 26/07/2026 sur
// canton-uri (Erstfeld, Schattdorf, Altdorf, Andermatt, Seelisberg…).
const uriScope: SliceHit[] = [
  hit(6472, 'Uri'), hit(6467, 'Uri'), hit(6460, 'Uri'), hit(6490, 'Uri'),
  hit(6377, 'Uri'), hit(6462, 'Uri'), hit(6468, 'Uri'), hit(6473, 'Uri'),
  hit(6454, 'Uri'), hit(6482, 'Uri'), hit(6493, 'Uri'), hit(6465, 'Uri'),
]

// Une réponse NATIONALE : ce que RA sert quand il ignore le slug. Bariolée.
const national: SliceHit[] = [
  hit(4852, 'Aargau'), hit(1950, 'Valais'), hit(8312, 'Zürich'), hit(6900, 'Ticino'),
  hit(1201, 'Genève'), hit(3000, 'Bern'), hit(9000, 'St. Gallen'), hit(4000, 'Basel-Stadt'),
  hit(7000, 'Graubünden'), hit(2000, 'Neuchâtel'), hit(6300, 'Zug'), hit(1700, 'Fribourg'),
]

describe('checkSliceResolution — le cas qui motive tout', () => {
  it('accepte une réponse scopée sur le bon canton', () => {
    const r = checkSliceResolution('canton-uri', uriScope)
    expect(r.resolu).toBe(true)
    expect(r.attendu).toBe('UR')
    expect(r.bons).toBe(12)
  })

  it('refuse une réponse nationale servie sous un slug de canton', () => {
    const r = checkSliceResolution('canton-uri', national)
    expect(r.resolu).toBe(false)
    expect(r.bons).toBe(0)
    expect(r.classables).toBe(12)
  })

  it('refuse aussi quand le national contient un peu du bon canton', () => {
    // Le national comporte forcément quelques annonces du canton demandé : ce
    // n'est pas parce qu'on en trouve que le slug a été résolu.
    const melange = [...national.slice(0, 9), hit(6460, 'Uri'), hit(6472, 'Uri'), hit(6490, 'Uri')]
    const r = checkSliceResolution('canton-uri', melange)
    expect(r.resolu).toBe(false)
    expect(r.bons).toBe(3)
  })
})

describe('checkSliceResolution — tolérance aux cas légitimes', () => {
  it('tolère quelques annonces limitrophes', () => {
    // 9 sur 12 dans le canton demandé : scoping normal, pas une dégradation.
    const r = checkSliceResolution('canton-uri', [
      ...uriScope.slice(0, 9), hit(6430, 'Schwyz'), hit(6440, 'Schwyz'), hit(6003, 'Luzern'),
    ])
    expect(r.resolu).toBe(true)
  })

  it('ne juge pas un échantillon trop maigre', () => {
    // AI tient sur une seule page de 27 ; une bande de prix étroite peut n'en
    // renvoyer que 3. Sur si peu, un refus serait du bruit.
    const r = checkSliceResolution('canton-uri', national.slice(0, RESOLUTION_MIN_SAMPLE - 1))
    expect(r.resolu).toBe(true)
    expect(r.raison).toContain('insuffisant')
  })

  it('ne juge pas quand les annonces ne sont pas localisables', () => {
    const sansLieu: SliceHit[] = Array.from({ length: 12 }, () => ({ postcode: null, state: null }))
    const r = checkSliceResolution('canton-uri', sansLieu)
    expect(r.resolu).toBe(true)
    expect(r.classables).toBe(0)
  })

  it('laisse passer la requête nationale de runFresh (slug vide)', () => {
    const r = checkSliceResolution('', national)
    expect(r.resolu).toBe(true)
    expect(r.raison).toBe('requête nationale')
  })

  it('laisse passer un slug absent de la table', () => {
    const r = checkSliceResolution('canton-inexistant-xyz-99', national)
    expect(r.resolu).toBe(true)
    expect(r.raison).toBe('slug hors table')
  })
})

describe('checkSliceResolution — les 5 cantons autrefois invisibles', () => {
  // Ces cantons partaient dans un voisin avant la correction du NPA. Le
  // garde-fou ne doit pas les refuser maintenant qu'ils sont bien classés.
  it.each([
    ['canton-glaris', 'GL', [hit(8750, 'Glarus'), hit(8752, 'Glarus'), hit(8775, 'Glarus'), hit(8865, 'Glarus'), hit(8783, 'Glarus'), hit(8867, 'Glarus'), hit(8762, 'Glarus'), hit(8877, 'Glarus')]],
    ['canton-nidwald', 'NW', [hit(6370, 'Nidwalden'), hit(6376, 'Nidwalden'), hit(6052, 'Nidwalden'), hit(6362, 'Nidwalden'), hit(6386, 'Nidwalden'), hit(6373, 'Nidwalden'), hit(6383, 'Nidwalden'), hit(6375, 'Nidwalden')]],
    ['canton-obwald', 'OW', [hit(6060, 'Obwalden'), hit(6390, 'Obwalden'), hit(6053, 'Obwalden'), hit(6072, 'Obwalden'), hit(6074, 'Obwalden'), hit(6078, 'Obwalden'), hit(6064, 'Obwalden'), hit(6068, 'Obwalden')]],
    ['canton-appenzell-rhodes-interieures', 'AI', [hit(9050, 'Appenzell Innerrhoden'), hit(9054, 'Appenzell Innerrhoden'), hit(9057, 'Appenzell Innerrhoden'), hit(9058, 'Appenzell Innerrhoden'), hit(9108, 'Appenzell Innerrhoden'), hit(9413, 'Appenzell Innerrhoden'), hit(9050, 'Appenzell Innerrhoden'), hit(9054, 'Appenzell Innerrhoden')]],
  ])('%s est reconnu comme scopé', (slug, code, listings) => {
    const r = checkSliceResolution(slug, listings as SliceHit[])
    expect(r.attendu).toBe(code)
    expect(r.resolu).toBe(true)
  })
})

describe('assertSliceResolved', () => {
  it('ne lève pas sur une slice saine', () => {
    expect(() => assertSliceResolved('canton-uri', uriScope)).not.toThrow()
  })

  it('lève avec un message qui nomme le canton et le compte', () => {
    expect(() => assertSliceResolved('canton-uri', national))
      .toThrow(/slug non résolu: canton-uri attendait UR mais 0\/12/)
  })
})

describe('SLUG_TO_CODE', () => {
  it('couvre les 26 cantons sans doublon de code', () => {
    const codes = Object.values(SLUG_TO_CODE)
    expect(codes).toHaveLength(26)
    expect(new Set(codes).size).toBe(26)
  })

  it('contient les 5 cantons qui affichaient zéro bien', () => {
    for (const c of ['AI', 'GL', 'NW', 'OW', 'UR']) {
      expect(Object.values(SLUG_TO_CODE)).toContain(c)
    }
  })
})
