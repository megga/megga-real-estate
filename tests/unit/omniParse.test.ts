// Parseur d'omnibox Matching · Recherche — verrouille le routage texte→jetons typés.
// C'est la VÉRIF de la refonte « recherche géographique » : l'UI authentifiée n'est
// pas prévisualisable, donc ces cas pins le comportement (canton/type/budget→SQL,
// pièces/surface/texte→client). Cf. le bug « Zurich en vente ne ramenait rien ».

import { describe, it, expect } from 'vitest'
import { parseQuery, parseAmount, norm } from '@/components/matching-recherche/omniParse'

const val = (raw: string, f: string) => parseQuery(raw).filter((t) => t.field === f).map((t) => t.value)
const first = (raw: string, f: string) => val(raw, f)[0]

describe('norm', () => {
  it('lowercases, strips accents, normalises hyphens/spaces', () => {
    expect(norm('Genève')).toBe('geneve')
    expect(norm('La Chaux-de-Fonds')).toBe('la chaux de fonds')
    expect(norm('  Zürich  ')).toBe('zurich')
  })
})

describe('parseAmount', () => {
  it('parses suffixed millions / thousands', () => {
    expect(parseAmount('1.5M')).toBe(1_500_000)
    expect(parseAmount('1,5m')).toBe(1_500_000)
    expect(parseAmount('800k')).toBe(800_000)
    expect(parseAmount('2 mio')).toBe(2_000_000)
  })
  it('parses grouped plain numbers (Swiss apostrophe / spaces / CHF)', () => {
    expect(parseAmount("1'200'000")).toBe(1_200_000)
    expect(parseAmount('1 200 000')).toBe(1_200_000)
    expect(parseAmount("CHF 720'000")).toBe(720_000)
    expect(parseAmount('900000')).toBe(900_000)
  })
  it('rejects small / ambiguous numbers (rooms, surface)', () => {
    expect(parseAmount('4')).toBeNull()
    expect(parseAmount('120')).toBeNull()
  })
})

describe('parseQuery — geo', () => {
  it('lowercase canton name → canton token (the "zurich en vente" bug)', () => {
    expect(val('zurich', 'canton')).toEqual(['ZH'])
  })
  it('FR names with accents + IT/DE variants', () => {
    expect(first('Genève', 'canton')).toBe('GE')
    expect(first('Valais', 'canton')).toBe('VS')
    expect(first('Tessin', 'canton')).toBe('TI')
    expect(first('Zürich', 'canton')).toBe('ZH')
  })
  it('uppercase 2-letter code only; lowercase common words are NOT cantons', () => {
    expect(first('GE', 'canton')).toBe('GE')
    expect(val('ne', 'canton')).toEqual([]) // "ne" (négation) ≠ Neuchâtel
    expect(val('so', 'canton')).toEqual([]) // "so" ≠ Soleure
  })
  it('known city → city token (SQL p_city, exact), no canton/text', () => {
    expect(first('Nyon', 'city')).toBe('nyon')
    expect(val('Nyon', 'canton')).toEqual([])
    expect(val('Nyon', 'text')).toEqual([])
    expect(first('Carouge', 'city')).toBe('carouge')
  })
  it('multi-word city name → city token', () => {
    expect(first('La Chaux-de-Fonds', 'city')).toBe('la chaux de fonds')
  })
})

describe('parseQuery — budget', () => {
  it('"sous X" → budgetMax', () => { expect(first('sous 1.5M', 'budgetMax')).toBe(1_500_000) })
  it('"< X" → budgetMax', () => { expect(first('< 800k', 'budgetMax')).toBe(800_000) })
  it('bare suffixed amount → budgetMax', () => { expect(first('1.2M', 'budgetMax')).toBe(1_200_000) })
  it('range → budgetMin + budgetMax', () => {
    expect(first('entre 800k et 1.2M', 'budgetMin')).toBe(800_000)
    expect(first('entre 800k et 1.2M', 'budgetMax')).toBe(1_200_000)
  })
  it('"dès X" → budgetMin', () => { expect(first('dès 500k', 'budgetMin')).toBe(500_000) })
})

describe('parseQuery — rooms / surface', () => {
  it('"N pièces" → rooms', () => { expect(first('4.5 pièces', 'rooms')).toBe(4.5) })
  it('"N p" → rooms', () => { expect(first('5 p', 'rooms')).toBe(5) })
  it('"N m2" → surface', () => { expect(first('120 m2', 'surface')).toBe(120) })
})

describe('parseQuery — type (mapped to the 5 real enums)', () => {
  it('canonical words → enum', () => {
    expect(first('appartement', 'type')).toBe('apartment')
    expect(first('maison', 'type')).toBe('house')
    expect(first('terrain', 'type')).toBe('land')
    expect(first('immeuble', 'type')).toBe('commercial')
  })
  it('sub-type → enum + text refine', () => {
    expect(first('attique', 'type')).toBe('apartment')
    expect(first('attique', 'text')).toBe('attique')
    expect(first('villa', 'type')).toBe('house')
    expect(first('villa', 'text')).toBe('villa')
  })
  it('"garage" stays free text (feature, not a property type)', () => {
    expect(val('garage', 'type')).toEqual([])
    expect(first('garage', 'text')).toBe('garage')
  })
})

describe('parseQuery — combos & residual', () => {
  it('"Lausanne 5 pièces sous 2M" (ville + pièces + budget)', () => {
    expect(first('Lausanne 5 pièces sous 2M', 'city')).toBe('lausanne')
    expect(first('Lausanne 5 pièces sous 2M', 'rooms')).toBe(5)
    expect(first('Lausanne 5 pièces sous 2M', 'budgetMax')).toBe(2_000_000)
  })
  it('"appartement Genève sous 900k"', () => {
    expect(first('appartement Genève sous 900k', 'type')).toBe('apartment')
    expect(first('appartement Genève sous 900k', 'canton')).toBe('GE')
    expect(first('appartement Genève sous 900k', 'budgetMax')).toBe(900_000)
  })
  it('a street stays plain text — no false canton/type/budget', () => {
    const r = parseQuery('Rue du Rhône 12')
    expect(r.filter((t) => t.field === 'canton')).toHaveLength(0)
    expect(r.filter((t) => t.field === 'type')).toHaveLength(0)
    expect(r.filter((t) => t.field === 'budgetMax')).toHaveLength(0)
    expect(r.some((t) => t.field === 'text')).toBe(true)
  })
  it('empty / blank input → no tokens', () => {
    expect(parseQuery('')).toEqual([])
    expect(parseQuery('   ')).toEqual([])
  })
})
