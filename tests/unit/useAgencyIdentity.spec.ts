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
  buildRoleRevocationPayload,
  isRoleActive,
  resolveLegalFormCategory,
  agencyForLegalFormCategory,
  ubosToRemove,
  ubosToRevoke,
  ubosToRevokeOnSkip,
  type PersonRow,
  type IdentityPersonWithRoles,
  type AgencyLegalFormFields,
} from '@/hooks/useAgencyIdentity'
import type { LegalFormOption } from '@/hooks/useLegalForms'

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

describe('buildRoleRevocationPayload — correctif revue tâche 5 : ligne de mise à jour pour révoquer (historiser) un rôle, jamais une autre colonne', () => {
  it('ne pose que valid_to, à la date fournie', () => {
    expect(buildRoleRevocationPayload('2026-07-27')).toEqual({ valid_to: '2026-07-27' })
  })

  it('sans date fournie -> aujourd\'hui (même paramètre injectable que isRoleActive)', () => {
    expect(buildRoleRevocationPayload()).toEqual({ valid_to: todayIso() })
  })
})

describe('resolveLegalFormCategory — dérive la catégorie de la forme juridique choisie (tâche 4 : info exposée pour l étape bénéficiaires effectifs de la tâche 5)', () => {
  const options: LegalFormOption[] = [
    { id: 'legal-form-sa', label: 'Société anonyme (SA)', category: 'corporation' },
    { id: 'legal-form-ri', label: 'Raison individuelle', category: 'sole_proprietorship' },
    { id: 'legal-form-fond', label: 'Fondation', category: 'foundation_or_trust' },
  ]

  it('id présent dans les options -> renvoie sa catégorie', () => {
    expect(resolveLegalFormCategory('legal-form-sa', options)).toBe('corporation')
  })

  it('raison individuelle -> sole_proprietorship (le signataire est l entité, pas d UBO tiers — cf. commentaire DB legal_forms.category)', () => {
    expect(resolveLegalFormCategory('legal-form-ri', options)).toBe('sole_proprietorship')
  })

  it('id vide (aucune forme choisie) -> null', () => {
    expect(resolveLegalFormCategory('', options)).toBeNull()
  })

  it('id absent des options (ex. pays changé, options pas encore rechargées) -> null, jamais une erreur', () => {
    expect(resolveLegalFormCategory('legal-form-inconnu', options)).toBeNull()
  })
})

describe('agencyForLegalFormCategory — correctif revue tâche 5 : legalFormCategory ne doit plus être périmée juste après un saveAgency() résolu', () => {
  const persistedStale: AgencyLegalFormFields = { country: 'CH', legalFormId: 'legal-form-sa' }

  it('aucun saveAgency() encore résolu dans cette instance du hook (lastSavedAgency = null) -> utilise l\'agence persistée, seule source disponible', () => {
    expect(agencyForLegalFormCategory(persistedStale, null)).toEqual(persistedStale)
  })

  it('un saveAgency() a résolu -> utilise le DERNIER payload envoyé, même si l\'agence persistée (cache React Query de useAgencySettings) ne l\'a pas encore rattrapé', () => {
    const justSaved: AgencyLegalFormFields = { country: 'CH', legalFormId: 'legal-form-ri' }
    expect(agencyForLegalFormCategory(persistedStale, justSaved)).toEqual(justSaved)
  })

  it('bout en bout avec resolveLegalFormCategory : la catégorie dérivée après le saveAgency() est la NOUVELLE (sole_proprietorship), pas l\'ancienne (corporation) que l\'agence persistée reflète encore — exactement le bug relevé en revue', () => {
    const options: LegalFormOption[] = [
      { id: 'legal-form-sa', label: 'Société anonyme (SA)', category: 'corporation' },
      { id: 'legal-form-ri', label: 'Raison individuelle', category: 'sole_proprietorship' },
    ]
    const justSaved: AgencyLegalFormFields = { country: 'CH', legalFormId: 'legal-form-ri' }
    const effective = agencyForLegalFormCategory(persistedStale, justSaved)
    expect(resolveLegalFormCategory(effective.legalFormId, options)).toBe('sole_proprietorship')
  })
})

describe('ubosToRemove — tâche 5 : quels UBO retirés du brouillon supprimer, sans jamais toucher une personne qui porte un autre rôle actif', () => {
  const uboOnly: IdentityPersonWithRoles = {
    id: 'p-ubo',
    firstName: 'Alice',
    lastName: 'Martin',
    dateOfBirth: '1970-01-01',
    nationality: 'CH',
    roles: [{ role: 'ubo', signaturePower: null, ownershipPct: 40, pepSelfDeclared: false }],
  }
  // Le cas qui justifie tout le découpage du schéma (brief tâche 5) : le fondateur
  // administrateur ET actionnaire majoritaire, DEUX rôles actifs sur la MÊME personne.
  const sharedSignatoryAndUbo: IdentityPersonWithRoles = {
    id: 'p-shared',
    firstName: 'Grégory',
    lastName: 'Lyonnet',
    dateOfBirth: '1980-05-12',
    nationality: 'CH',
    roles: [
      { role: 'signatory', signaturePower: 'individual', ownershipPct: null, pepSelfDeclared: false },
      { role: 'ubo', signaturePower: null, ownershipPct: 60, pepSelfDeclared: true },
    ],
  }
  const signatoryOnly: IdentityPersonWithRoles = {
    id: 'p-sig',
    firstName: 'Autre',
    lastName: 'Signataire',
    dateOfBirth: '1985-06-15',
    nationality: 'FR',
    roles: [{ role: 'signatory', signaturePower: 'joint', ownershipPct: null, pepSelfDeclared: false }],
  }

  it('UBO seul absent du brouillon courant -> à supprimer', () => {
    expect(ubosToRemove([uboOnly], [])).toEqual(['p-ubo'])
  })

  it('UBO seul toujours présent dans le brouillon (son id est gardé) -> conservé', () => {
    expect(ubosToRemove([uboOnly], ['p-ubo'])).toEqual([])
  })

  it('personne signataire ET UBO, retirée du brouillon bénéficiaires -> JAMAIS supprimée : la suppression cascaderait sur son rôle de signataire (on delete cascade, 20260726130200)', () => {
    expect(ubosToRemove([sharedSignatoryAndUbo], [])).toEqual([])
  })

  it('mélange : le UBO seul part, la personne partagée signataire+UBO reste protégée', () => {
    expect(ubosToRemove([uboOnly, sharedSignatoryAndUbo], [])).toEqual(['p-ubo'])
  })

  it('personne sans rôle ubo actif (signataire seul) -> jamais renvoyée, rien à voir avec cette étape', () => {
    expect(ubosToRemove([signatoryOnly], [])).toEqual([])
  })

  it('draftPersonIds contient des null (lignes neuves pas encore enregistrées) -> ignorés, ne protègent aucun id existant', () => {
    expect(ubosToRemove([uboOnly], [null, null])).toEqual(['p-ubo'])
  })
})

describe('ubosToRevoke — correctif revue tâche 5 : complément exact de ubosToRemove, révoque (sans jamais supprimer) le rôle ubo d\'une personne protégée par un autre rôle actif', () => {
  const uboOnly: IdentityPersonWithRoles = {
    id: 'p-ubo',
    firstName: 'Alice',
    lastName: 'Martin',
    dateOfBirth: '1970-01-01',
    nationality: 'CH',
    roles: [{ role: 'ubo', signaturePower: null, ownershipPct: 40, pepSelfDeclared: false }],
  }
  const sharedSignatoryAndUbo: IdentityPersonWithRoles = {
    id: 'p-shared',
    firstName: 'Grégory',
    lastName: 'Lyonnet',
    dateOfBirth: '1980-05-12',
    nationality: 'CH',
    roles: [
      { role: 'signatory', signaturePower: 'individual', ownershipPct: null, pepSelfDeclared: false },
      { role: 'ubo', signaturePower: null, ownershipPct: 60, pepSelfDeclared: true },
    ],
  }
  const signatoryOnly: IdentityPersonWithRoles = {
    id: 'p-sig',
    firstName: 'Autre',
    lastName: 'Signataire',
    dateOfBirth: '1985-06-15',
    nationality: 'FR',
    roles: [{ role: 'signatory', signaturePower: 'joint', ownershipPct: null, pepSelfDeclared: false }],
  }

  it('UBO seul retiré du brouillon -> PAS dans ubosToRevoke (ubosToRemove le supprime déjà en entier, rien à révoquer en plus)', () => {
    expect(ubosToRevoke([uboOnly], [])).toEqual([])
  })

  it('personne signataire ET UBO, retirée du brouillon bénéficiaires -> son id apparaît dans ubosToRevoke : c\'est le trou relevé en revue, son rôle ubo restait actif en base indéfiniment alors que ubosToRemove la protège déjà de la suppression', () => {
    expect(ubosToRevoke([sharedSignatoryAndUbo], [])).toEqual(['p-shared'])
  })

  it('personne signataire ET UBO, toujours présente dans le brouillon (son id est gardé) -> rien à révoquer', () => {
    expect(ubosToRevoke([sharedSignatoryAndUbo], ['p-shared'])).toEqual([])
  })

  it('personne sans rôle ubo actif (signataire seul) -> jamais renvoyée, rien à voir avec cette étape', () => {
    expect(ubosToRevoke([signatoryOnly], [])).toEqual([])
  })

  it('mélange : le UBO seul est ignoré ici (ubosToRemove le supprime), seule la personne partagée signataire+UBO est renvoyée pour révocation ciblée — jamais les deux fonctions pour la même personne', () => {
    expect(ubosToRevoke([uboOnly, sharedSignatoryAndUbo], [])).toEqual(['p-shared'])
  })

  it('draftPersonIds contient des null (lignes neuves pas encore enregistrées) -> ignorés, ne protègent aucun id existant', () => {
    expect(ubosToRevoke([sharedSignatoryAndUbo], [null, null])).toEqual(['p-shared'])
  })
})

describe('ubosToRevokeOnSkip — correctif revue tâche 5 : nettoyage rétroactif quand l\'étape bénéficiaires bascule en sautée (raison individuelle choisie à l\'étape agence)', () => {
  const uboOnly: IdentityPersonWithRoles = {
    id: 'p-ubo',
    firstName: 'Alice',
    lastName: 'Martin',
    dateOfBirth: '1970-01-01',
    nationality: 'CH',
    roles: [{ role: 'ubo', signaturePower: null, ownershipPct: 40, pepSelfDeclared: false }],
  }
  const sharedSignatoryAndUbo: IdentityPersonWithRoles = {
    id: 'p-shared',
    firstName: 'Grégory',
    lastName: 'Lyonnet',
    dateOfBirth: '1980-05-12',
    nationality: 'CH',
    roles: [
      { role: 'signatory', signaturePower: 'individual', ownershipPct: null, pepSelfDeclared: false },
      { role: 'ubo', signaturePower: null, ownershipPct: 60, pepSelfDeclared: true },
    ],
  }
  const signatoryOnly: IdentityPersonWithRoles = {
    id: 'p-sig',
    firstName: 'Autre',
    lastName: 'Signataire',
    dateOfBirth: '1985-06-15',
    nationality: 'FR',
    roles: [{ role: 'signatory', signaturePower: 'joint', ownershipPct: null, pepSelfDeclared: false }],
  }

  it('personne UBO seule -> révoquée, sans condition de brouillon (ce chemin ne lit même pas le brouillon : l\'écran qui le porte n\'est plus jamais monté)', () => {
    expect(ubosToRevokeOnSkip([uboOnly])).toEqual(['p-ubo'])
  })

  it('personne signataire ET UBO -> révoquée aussi, mais SEUL son rôle ubo : cas central de la revue, son rôle signataire doit rester intact (revokeUboRole ne touche jamais agency_related_persons ni un rôle signatory, cf. useAgencyIdentity.ts)', () => {
    expect(ubosToRevokeOnSkip([sharedSignatoryAndUbo])).toEqual(['p-shared'])
  })

  it('personne signataire seule (jamais UBO) -> jamais renvoyée', () => {
    expect(ubosToRevokeOnSkip([signatoryOnly])).toEqual([])
  })

  it('aucun bénéficiaire jamais déclaré -> liste vide', () => {
    expect(ubosToRevokeOnSkip([])).toEqual([])
  })

  it('mélange : toutes les personnes qui portent un rôle ubo actif sont renvoyées, qu\'elles portent un autre rôle ou non — au contraire de ubosToRevoke, aucune n\'est exclue', () => {
    expect(ubosToRevokeOnSkip([uboOnly, sharedSignatoryAndUbo, signatoryOnly])).toEqual(['p-ubo', 'p-shared'])
  })
})
