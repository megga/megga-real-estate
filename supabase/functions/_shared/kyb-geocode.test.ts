// Le géocodage KYB, après le passage de Geocoding v5 à v6 (16.08.2026).
//
// POURQUOI CES TESTS EXISTENT. Le port v5 → v6 n'est pas un changement d'URL : la forme
// de la réponse change. Et le défaut qu'il fallait empêcher est SILENCIEUX — lire
// `feature.context[]` (v5) sur une réponse v6 ne lève pas, ça rend `undefined`, donc
// `partial` sur chaque dossier, indéfiniment, sans une ligne de journal. Un connecteur
// qui répond « je ne sais pas » à tout ressemble à un connecteur qui marche.
import { describe, it, expect } from 'vitest'
import { countryCodeOf, regionCodeOf, classifyGeocode } from './kyb-sources'

/** Une réponse v6 réelle, réduite à ce que le connecteur lit. */
const geneve = {
  properties: {
    full_address: 'Rue du Rhône 14, 1204 Genève, Suisse',
    context: {
      country: { country_code: 'CH', name: 'Suisse' },
      region: { region_code: 'GE', region_code_full: 'CH-GE', name: 'Genève' },
    },
  },
}

describe('countryCodeOf — forme v6', () => {
  it('lit le code pays dans le contexte NOMMÉ', () => {
    expect(countryCodeOf(geneve)).toBe('CH')
  })

  it('⛔ une réponse de forme v5 rend null, elle ne ment pas', () => {
    // v5 mettait le pays dans un TABLEAU `context[]` avec `short_code`. Si Mapbox
    // servait encore cette forme, il faut un `partial` franc, pas un faux `match`.
    const v5 = { context: [{ id: 'country.1', short_code: 'ch' }] } as never
    expect(countryCodeOf(v5)).toBeNull()
  })

  it('absent ou vide : null', () => {
    expect(countryCodeOf(undefined)).toBeNull()
    expect(countryCodeOf({ properties: {} })).toBeNull()
    expect(countryCodeOf({ properties: { context: { country: { country_code: '  ' } } } })).toBeNull()
  })
})

describe('regionCodeOf — les deux formes que v6 sert', () => {
  it('préfère `region_code`, déjà nu', () => {
    expect(regionCodeOf(geneve)).toBe('GE')
  })

  it('retombe sur `region_code_full` et en retire le préfixe pays', () => {
    // Mapbox ne garantit pas les deux champs sur toutes les régions du monde.
    const sansNu = {
      properties: { context: { region: { region_code_full: 'CH-VD', name: 'Vaud' } } },
    }
    expect(regionCodeOf(sansNu)).toBe('VD')
  })

  it('une forme sans tiret n’invente pas de canton', () => {
    expect(regionCodeOf({ properties: { context: { region: { region_code_full: 'CH' } } } })).toBeNull()
  })
})

describe('classifyGeocode — ce qu’un mismatch signifie vraiment', () => {
  it('pays déclaré = pays géocodé : match', () => {
    expect(classifyGeocode('CH', 'GE', geneve)).toBe('match')
    expect(classifyGeocode('ch', null, geneve)).toBe('match')
  })

  it('pays contradictoire : mismatch', () => {
    expect(classifyGeocode('FR', null, geneve)).toBe('mismatch')
  })

  it('canton contradictoire : mismatch, mais SEULEMENT en Suisse', () => {
    expect(classifyGeocode('CH', 'VD', geneve)).toBe('mismatch')
    // Hors CH, le canton déclaré ne veut rien dire et ne doit rien faire basculer.
    const paris = {
      properties: { context: { country: { country_code: 'FR' }, region: { region_code: 'IDF' } } },
    }
    expect(classifyGeocode('FR', 'VD', paris)).toBe('match')
  })

  it('⛔ une donnée ABSENTE vaut partial, jamais mismatch', () => {
    // Mapbox n'est pas un registre exhaustif : un résultat absent ne prouve pas que
    // l'adresse n'existe pas. Confondre « je ne sais pas » et « c'est faux » ferait
    // refuser des dossiers valides.
    expect(classifyGeocode('CH', 'GE', undefined)).toBe('partial')
    expect(classifyGeocode('CH', 'GE', { properties: {} })).toBe('partial')
  })

  it('canton absent de la réponse : le pays suffit à confirmer', () => {
    const sansRegion = { properties: { context: { country: { country_code: 'CH' } } } }
    expect(classifyGeocode('CH', 'GE', sansRegion)).toBe('match')
  })
})
