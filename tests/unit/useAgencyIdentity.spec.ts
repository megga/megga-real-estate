// Hook useAgencyIdentity (étape 2 KYB, tâche 3) — logique pure testée sans Supabase.
//
// Sur le même motif que tests/unit/identity-gate.spec.ts : le hook lui-même compose
// useQuery/useAuth (non unit-testé, ce dépôt n'a pas @testing-library/react — voir
// identity-gate.spec.ts pour le précédent), mais TOUTE la logique de décision
// (mapping des lignes DB, construction des payloads d'écriture) vit dans des
// fonctions pures exportées, testées ici directement.

import { describe, it, expect } from 'vitest'
import {
  mapPersonRow,
  buildPersonPayload,
  buildRolePayload,
  isRoleActive,
  type PersonRow,
} from '@/hooks/useAgencyIdentity'

// Dates relatives à "maintenant", même motif que tests/backend/agency-identity-submit.spec.ts
// (frontière valid_to demain/aujourd'hui/hier) — une correction de fuseau ou un test qui
// tourne à minuit ne doit pas rendre ces cas ambigus.
const tomorrowIso = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const yesterdayIso = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const todayIso = () => new Date().toISOString().slice(0, 10)

describe('isRoleActive — même définition d\'actif que la RPC submit_agency_identity (valid_to null OU futur, comparaison stricte)', () => {
  it('valid_to null -> actif', () => {
    expect(isRoleActive(null)).toBe(true)
  })

  it('valid_to dans le futur -> actif (le mandat court encore, revue tâche 3)', () => {
    expect(isRoleActive(tomorrowIso())).toBe(true)
  })

  it('valid_to = aujourd hui -> pas actif (comparaison stricte >, même frontière que la RPC)', () => {
    expect(isRoleActive(todayIso())).toBe(false)
  })

  it('valid_to dans le passé -> pas actif (mandat expiré)', () => {
    expect(isRoleActive(yesterdayIso())).toBe(false)
  })
})

describe('mapPersonRow — lignes DB (snake_case, roles imbriqués) vers le contrat du hook (camelCase)', () => {
  const baseRow: PersonRow = {
    id: 'person-1',
    first_name: 'Grégory',
    last_name: 'Lyonnet',
    date_of_birth: '1980-05-12',
    nationality: 'CH',
    roles: [],
  }

  it('mappe les champs identité un-à-un', () => {
    const mapped = mapPersonRow(baseRow)
    expect(mapped.id).toBe('person-1')
    expect(mapped.firstName).toBe('Grégory')
    expect(mapped.lastName).toBe('Lyonnet')
    expect(mapped.dateOfBirth).toBe('1980-05-12')
    expect(mapped.nationality).toBe('CH')
  })

  it('personne sans aucun rôle -> roles = []', () => {
    expect(mapPersonRow(baseRow).roles).toEqual([])
  })

  it('rôle actif (valid_to null) -> conservé et mappé', () => {
    const row: PersonRow = {
      ...baseRow,
      roles: [{
        id: 'role-1', role: 'signatory', signature_power: 'individual',
        ownership_pct: null, pep_self_declared: false, valid_to: null,
      }],
    }
    expect(mapPersonRow(row).roles).toEqual([
      { role: 'signatory', signaturePower: 'individual', ownershipPct: null, pepSelfDeclared: false },
    ])
  })

  it('rôle historisé (valid_to dans le passé) -> exclu, ce n est plus le rôle courant', () => {
    const row: PersonRow = {
      ...baseRow,
      roles: [{
        id: 'role-old', role: 'signatory', signature_power: 'individual',
        ownership_pct: null, pep_self_declared: false, valid_to: '2020-01-01',
      }],
    }
    expect(mapPersonRow(row).roles).toEqual([])
  })

  it('rôle avec valid_to dans le futur -> actif, conservé (même définition que la RPC submit_agency_identity, migration 20260727100000)', () => {
    // Revue tâche 3 : mapPersonRow ne gardait que valid_to strictement nul, plus étroit
    // que la RPC (valid_to is null OR valid_to > current_date). Un rôle à mandat futur
    // devenait invisible ici alors que la RPC le compte comme actif — savePerson en
    // insérait une seconde ligne active pour la même personne au lieu de réutiliser
    // celle-ci.
    const row: PersonRow = {
      ...baseRow,
      roles: [{
        id: 'role-future', role: 'signatory', signature_power: 'individual',
        ownership_pct: null, pep_self_declared: false, valid_to: tomorrowIso(),
      }],
    }
    expect(mapPersonRow(row).roles).toEqual([
      { role: 'signatory', signaturePower: 'individual', ownershipPct: null, pepSelfDeclared: false },
    ])
  })

  it('rôle expiré (valid_to hier) -> pas actif, exclu', () => {
    const row: PersonRow = {
      ...baseRow,
      roles: [{
        id: 'role-expired', role: 'signatory', signature_power: 'individual',
        ownership_pct: null, pep_self_declared: false, valid_to: yesterdayIso(),
      }],
    }
    expect(mapPersonRow(row).roles).toEqual([])
  })

  it('signataire ET bénéficiaire (deux rôles actifs sur la même personne) -> les deux conservés', () => {
    // Cas explicite du plan (tâche 5) : une même personne peut porter les deux
    // rôles dans une petite SA. Le mapper doit déjà le supporter sans perte.
    const row: PersonRow = {
      ...baseRow,
      roles: [
        { id: 'role-1', role: 'signatory', signature_power: 'joint', ownership_pct: null, pep_self_declared: false, valid_to: null },
        { id: 'role-2', role: 'ubo', signature_power: null, ownership_pct: 60, pep_self_declared: true, valid_to: null },
      ],
    }
    const mapped = mapPersonRow(row)
    expect(mapped.roles).toHaveLength(2)
    expect(mapped.roles).toEqual(expect.arrayContaining([
      { role: 'signatory', signaturePower: 'joint', ownershipPct: null, pepSelfDeclared: false },
      { role: 'ubo', signaturePower: null, ownershipPct: 60, pepSelfDeclared: true },
    ]))
  })
})

describe('buildPersonPayload — construit la ligne agency_related_persons à écrire', () => {
  it('rattache l agence appelante et convertit les clés en snake_case', () => {
    const payload = buildPersonPayload('agency-1', {
      id: null, firstName: 'Ada', lastName: 'Lovelace',
      dateOfBirth: '1990-01-01', nationality: 'GB',
    })
    expect(payload).toEqual({
      agency_id: 'agency-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      date_of_birth: '1990-01-01',
      nationality: 'GB',
    })
  })

  it('coupe les espaces superflus de prénom/nom (jamais de PII avec espaces parasites)', () => {
    const payload = buildPersonPayload('agency-1', {
      id: null, firstName: '  Ada  ', lastName: '  Lovelace  ',
      dateOfBirth: null, nationality: null,
    })
    expect(payload.first_name).toBe('Ada')
    expect(payload.last_name).toBe('Lovelace')
  })

  it('dateOfBirth et nationality nuls passent tels quels (colonnes nullable)', () => {
    const payload = buildPersonPayload('agency-1', {
      id: null, firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: null, nationality: null,
    })
    expect(payload.date_of_birth).toBeNull()
    expect(payload.nationality).toBeNull()
  })
})

describe('buildRolePayload — construit la ligne agency_person_roles à écrire', () => {
  it('mappe le pouvoir de signature et rattache la personne', () => {
    const payload = buildRolePayload('person-1', {
      role: 'signatory', signaturePower: 'individual', ownershipPct: null, pepSelfDeclared: false,
    })
    expect(payload).toEqual({
      related_person_id: 'person-1',
      role: 'signatory',
      signature_power: 'individual',
      ownership_pct: null,
      pep_self_declared: false,
      source: 'declared',
    })
  })

  it('source vaut toujours declared — l écriture vient du dirigeant lui-même, jamais du registre', () => {
    // 'declared' est FIGÉ par la fonction elle-même, pas transmis par l'appelant :
    // le contrat de useAgencyIdentity n'expose même pas de champ `source` en entrée.
    const payload = buildRolePayload('person-1', {
      role: 'ubo', signaturePower: null, ownershipPct: 33.33, pepSelfDeclared: true,
    })
    expect(payload.source).toBe('declared')
  })
})
