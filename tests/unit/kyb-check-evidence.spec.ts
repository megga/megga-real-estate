/**
 * Garde-fou : la console montre CE QUI A ÉTÉ COMPARÉ, pas seulement le verdict.
 *
 * ⛔ CE QUE CE MODULE CORRIGE, constaté en console le 18.08.2026 sur un dossier réel : la
 * ligne « Raison sociale ↔ registre » affichait « Ne correspond pas » et rien d'autre. Le
 * relecteur devait déplier la ligne, ouvrir « Voir la réponse brute » et lire du JSON pour
 * apprendre que le registre dit « Juarts - Julien Ahmedi » quand l'agence a déclaré
 * « Juarts ». Deux gestes et un décodage pour comparer deux chaînes.
 *
 * ⚠ Et c'est le cas NOMINAL suisse : une raison individuelle est inscrite sous « nom
 * commercial - nom du titulaire ». Tout agent indépendant produira ce `mismatch`.
 *
 * Les formes testées ici sont les preuves RÉELLES lues en production, pas des inventions.
 */
import { describe, it, expect } from 'vitest'
import { summarizeKybEvidence, isBlockingCheck } from '@/lib/kybCheckEvidence'

describe('summarizeKybEvidence', () => {
  it('LE CAS RÉEL : raison sociale déclarée face à celle du registre', () => {
    // Preuve telle qu'elle est en base pour l'agence 6c5d3e48 (dossier du 01.08.2026).
    expect(summarizeKybEvidence('registry_legal_name_match', {
      uid: 'CHE458476132',
      declared_legal_name: 'Juarts',
      registry_legal_names: ['Juarts - Julien Ahmedi'],
      municipalities: ['Genève'],
    })).toEqual({ declared: 'Juarts', found: 'Juarts - Julien Ahmedi' })
  })

  it('joint plusieurs réponses du registre au lieu d\'en choisir une', () => {
    // Un même numéro peut porter plusieurs inscriptions : en retenir une seule ferait
    // croire à une contradiction là où il y a une liste.
    expect(summarizeKybEvidence('registry_lookup', {
      declared: 'CHE-458.476.132',
      registry_legal_names: ['Juarts - Julien Ahmedi', 'Juarts Sàrl'],
      reason: 'existence_confirmed_status_not_published',
    })).toEqual({
      declared: 'CHE-458.476.132',
      found: 'Juarts - Julien Ahmedi · Juarts Sàrl',
      note: 'existence_confirmed_status_not_published',
    })
  })

  it('⚠ le MOTIF accompagne le couple — sans lui, un `partial` reste inexpliqué', () => {
    const r = summarizeKybEvidence('registry_lookup', {
      declared: 'CHE-458.476.132',
      registry_legal_names: ['Juarts - Julien Ahmedi'],
      reason: 'existence_confirmed_status_not_published',
    })
    expect(r?.note).toBe('existence_confirmed_status_not_published')
  })

  it('adresse : la ligne envoyée face à celle que Mapbox a résolue', () => {
    expect(summarizeKybEvidence('address_geocode', {
      query: 'rue le Corbusier 12, 1208, Genève',
      place_name: 'Rue Le-Corbusier 12, 1208 Genève, Switzerland',
      declared_country: 'CH',
    })).toEqual({
      declared: 'rue le Corbusier 12, 1208, Genève',
      found: 'Rue Le-Corbusier 12, 1208 Genève, Switzerland',
    })
  })

  it('numéro de registre : le déclaré face à sa forme normalisée', () => {
    expect(summarizeKybEvidence('registry_number_format', {
      declared: 'CHE-458.476.132', normalized: 'CHE458476132', check_digit_valid: true,
    })).toEqual({ declared: 'CHE-458.476.132', found: 'CHE458476132' })
  })

  it('⛔ une source INJOIGNABLE n\'a rien comparé : seul le motif est rendu', () => {
    // Afficher un couple vide ferait croire à une comparaison qui n'a pas eu lieu.
    expect(summarizeKybEvidence('vat_lookup', {
      reason: 'error', error_type: 'KybSourcePendingCredentialsError', message: 'identifiants absents',
    })).toEqual({ note: 'identifiants absents' })
  })

  it('rend `null` sur ce qu\'il ne sait pas lire, plutôt qu\'un couple faux', () => {
    expect(summarizeKybEvidence('pep_sanctions_screening', { hits: [] })).toBeNull()
    expect(summarizeKybEvidence('registry_legal_name_match', {})).toBeNull()
    expect(summarizeKybEvidence('registry_legal_name_match', null)).toBeNull()
    expect(summarizeKybEvidence('registry_legal_name_match', 'texte libre')).toBeNull()
    expect(summarizeKybEvidence('registry_legal_name_match', ['tableau'])).toBeNull()
  })

  it('ignore les valeurs vides plutôt que d\'afficher un blanc', () => {
    expect(summarizeKybEvidence('registry_country_match', {
      declared_country: '  ', registry_country: 'CH',
    })).toEqual({ found: 'CH' })
  })
})

/**
 * ⛔ `isBlockingCheck` est le MIROIR de `recompute_agency_verification`. Si les deux
 * divergent, l'écran range en « ce qui bloque » un contrôle que le moteur laisse passer
 * (ou l'inverse) — et le relecteur décide sur une carte fausse.
 */
describe('isBlockingCheck', () => {
  it('un véto ne passe QUE sur match exact', () => {
    expect(isBlockingCheck({ result: 'match', isVeto: true })).toBe(false)
    expect(isBlockingCheck({ result: 'partial', isVeto: true })).toBe(true)
    expect(isBlockingCheck({ result: 'mismatch', isVeto: true })).toBe(true)
  })

  it('⚠ une source INJOIGNABLE retient sur un véto, et sur lui seul', () => {
    // Contre-intuitif : `unavailable` est neutre au score (exclu du numérateur ET du
    // dénominateur) mais fait échouer un véto, qui exige `match`. C'est le cas de
    // registry_lookup en Suisse, et c'est ce qui doit se voir sur la ligne.
    expect(isBlockingCheck({ result: 'unavailable', isVeto: true })).toBe(true)
    expect(isBlockingCheck({ result: 'unavailable', isVeto: false })).toBe(false)
  })

  it('une revue humaine en attente retient, quel que soit le type', () => {
    expect(isBlockingCheck({ result: 'pending_manual_review', isVeto: false })).toBe(true)
    expect(isBlockingCheck({ result: 'pending_manual_review', isVeto: true })).toBe(true)
  })

  it('⛔ un mismatch NON véto ne retient PAS — il pèse sur le score, sans plus', () => {
    expect(isBlockingCheck({ result: 'mismatch', isVeto: false })).toBe(false)
    expect(isBlockingCheck({ result: 'partial', isVeto: false })).toBe(false)
  })
})
