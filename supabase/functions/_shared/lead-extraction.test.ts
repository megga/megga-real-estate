import { describe, expect, it } from 'vitest'
import { LEAD_FEATURES, LEAD_SYSTEM_PROMPT, parseLeadExtraction, verifyAddress } from './lead-extraction.ts'

const SOURCE = `Bonjour Madame, je m'appelle Nora Keller, de nationalité française, domiciliée
rue de Carouge 12, 1205 Genève. Nous cherchons à acheter un appartement ou un attique de
4.5 pièces, 110 m² minimum, avec balcon et place de parc, à Carouge ou Champel, entre
900'000 et 1'250'000 CHF. Écrivez-moi plutôt sur WhatsApp : +41 79 555 12 34,
nora.keller@example.ch`

const reponse = (x: Record<string, unknown>) => JSON.stringify(x)

describe('parseLeadExtraction', () => {
  it('garde les 11 champs d’origine au même sens (contrat d’« Importer des leads »)', () => {
    const r = parseLeadExtraction(reponse({
      firstName: 'Nora', lastName: 'Keller', email: 'nora.keller@example.ch', phone: '+41 79 555 12 34',
      intent: 'buyer', budget: 1250000, rooms: 4.5, zone: 'Carouge, Champel', urgency: 'normal', nextAction: 'match', confidence: 0.9,
    }), SOURCE)
    expect(r?.fields).toMatchObject({
      firstName: 'Nora', lastName: 'Keller', email: 'nora.keller@example.ch', phone: '+41 79 555 12 34',
      intent: 'buyer', budget: 1250000, rooms: 4.5, zone: 'Carouge, Champel', urgency: 'normal', nextAction: 'match', confidence: 0.9,
    })
  })

  it('rend des valeurs NEUTRES pour les champs ajoutés quand le modèle ne les donne pas', () => {
    const r = parseLeadExtraction(reponse({ firstName: 'Nora', intent: 'buyer' }), SOURCE)
    expect(r?.fields).toMatchObject({
      civility: '', language: '', preferredChannel: '', budgetMin: null, surfaceMin: null,
      propertyTypes: [], cantons: [], cities: [], features: [], nationality: '', residenceCountry: '',
      homeAddress: '', propertyAddress: '',
    })
  })

  it('lit toute la fiche : fourchette, surface, types, lieux, indispensables, identité, canal', () => {
    const r = parseLeadExtraction(reponse({
      intent: 'buyer', budget: 1250000, budgetMin: 900000, surfaceMin: 110,
      propertyTypes: ['apartment', 'apartment'], cantons: ['ge'], cities: ['Carouge', 'Champel'],
      features: ['balcon', 'parking'], civility: 'mrs', language: 'fr', preferredChannel: 'whatsapp',
      nationality: 'fr', homeAddress: 'Rue de Carouge 12, 1205 Genève',
    }), SOURCE)
    expect(r?.fields).toMatchObject({
      budgetMin: 900000, surfaceMin: 110, propertyTypes: ['apartment'], cantons: ['GE'],
      cities: ['Carouge', 'Champel'], features: ['balcon', 'parking'], civility: 'mrs', language: 'fr',
      preferredChannel: 'whatsapp', nationality: 'FR', homeAddress: 'Rue de Carouge 12, 1205 Genève',
    })
  })

  it('borne chaque énumération et trace ce qu’il a remplacé — jamais une valeur libre', () => {
    const r = parseLeadExtraction(reponse({
      intent: 'investor', civility: 'dr', language: 'es', preferredChannel: 'fax',
      propertyTypes: ['castle', 'house'], cantons: ['XX', 'VD'], features: ['piscine', 'jardin'],
      nationality: 'France', residenceCountry: 'CHE',
    }), SOURCE)
    expect(r?.fields).toMatchObject({
      intent: 'buyer', civility: '', language: '', preferredChannel: '',
      propertyTypes: ['house'], cantons: ['VD'], features: ['jardin'], nationality: '', residenceCountry: '',
    })
    expect(r?.coercions.map((c) => c.field).sort()).toEqual(['civility', 'intent', 'language', 'preferredChannel'])
  })

  it('refuse un e-mail, un téléphone ou une adresse qui ne figurent pas dans le message', () => {
    const r = parseLeadExtraction(reponse({
      email: 'nora@keller.ch', phone: '+41 22 000 00 00',
      homeAddress: 'Avenue de Champel 8, 1206 Genève', propertyAddress: 'Chemin des Crêts 3',
    }), SOURCE)
    expect(r?.fields).toMatchObject({ email: '', phone: '', homeAddress: '', propertyAddress: '' })
  })

  it('jette un minimum supérieur au maximum, et un code de canton rangé en commune', () => {
    const r = parseLeadExtraction(reponse({ budget: 900000, budgetMin: 1250000, cities: ['GE', 'Carouge'] }), SOURCE)
    expect(r?.fields.budgetMin).toBeNull()
    expect(r?.fields.cities).toEqual(['Carouge'])
  })

  it('tolère les balises de code autour du JSON, et rend null pour autre chose que du JSON objet', () => {
    expect(parseLeadExtraction('```json\n{"firstName":"Nora"}\n```', SOURCE)?.fields.firstName).toBe('Nora')
    expect(parseLeadExtraction('pas du json', SOURCE)).toBeNull()
    expect(parseLeadExtraction('[1,2]', SOURCE)).toBeNull()
  })
})

describe('verifyAddress', () => {
  it('accepte une adresse réécrite (casse, accents, ponctuation) dont chaque mot figure dans le texte', () => {
    expect(verifyAddress('Rue de Carouge 12, 1205 GENEVE', SOURCE)).toBe('Rue de Carouge 12, 1205 GENEVE')
  })
  it('refuse un numéro ou une rue que le message ne porte pas', () => {
    expect(verifyAddress('Rue de Carouge 14, 1205 Genève', SOURCE)).toBe('')
    expect(verifyAddress('Rue du Stand 12', SOURCE)).toBe('')
  })
})

describe('LEAD_SYSTEM_PROMPT', () => {
  it('annonce au modèle exactement le vocabulaire d’indispensables que la lecture accepte', () => {
    for (const f of LEAD_FEATURES) expect(LEAD_SYSTEM_PROMPT).toContain(`"${f}"`)
  })
  it('ne demande PAS la date de naissance : elle est masquée avant l’appel, par construction', () => {
    expect(LEAD_SYSTEM_PROMPT).not.toMatch(/birth|naissance/i)
  })
})
