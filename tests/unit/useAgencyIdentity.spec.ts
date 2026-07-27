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
  type PersonRow,
} from '@/hooks/useAgencyIdentity'

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
