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
  resolveLegalFormCategory,
  agencyForLegalFormCategory,
  identityDocumentFolder,
  identityDocumentFileName,
  extensionOfFile,
  findIdentityDocumentPath,
  identityDocumentSidesFor,
  isIdentityDocumentType,
  isIdentityVerificationStatus,
  isIdentityVerificationSufficient,
  verificationNeedsManualFallback,
  IDENTITY_DOCUMENT_TYPES,
  validateIdentityDocumentFile,
  identityDocumentsQueryKey,
  buildSubmitAgencyIdentityArgs,
  type PersonRow,
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
    id_document_type: null,
    id_document_read: null,
    roles: [],
  }

  it('nature de la pièce : les trois valeurs du wizard passent, `other` et l\'inconnu retombent à null (pas de libellé pour elles)', () => {
    expect(mapPersonRow({ ...baseRow, id_document_type: 'passport' }).idDocumentType).toBe('passport')
    expect(mapPersonRow({ ...baseRow, id_document_type: 'id_card' }).idDocumentType).toBe('id_card')
    expect(mapPersonRow({ ...baseRow, id_document_type: 'residence_permit' }).idDocumentType).toBe('residence_permit')
    expect(mapPersonRow({ ...baseRow, id_document_type: 'other' }).idDocumentType).toBeNull()
    // Dossier soumis avant le 03.08.2026 : la colonne existait, rien ne l'écrivait.
    expect(mapPersonRow({ ...baseRow, id_document_type: null }).idDocumentType).toBeNull()
  })

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

  it('rôle avec valid_to dans le futur -> actif, conservé (même définition que la RPC submit_agency_identity, migration 20260728108000)', () => {
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

// ─── Tâche 6 : pièce d'identité — chemins Storage (bucket documents, préfixe réservé
// kyb-identity, migration 20260728109000) ────────────────────────────────────────────
describe('identityDocumentFolder — préfixe Storage réservé, isolé par agence ET par personne', () => {
  it('compose agencyId/kyb-identity/relatedPersonId', () => {
    expect(identityDocumentFolder('agency-1', 'person-1')).toBe('agency-1/kyb-identity/person-1')
  })

  it('deux personnes différentes de la même agence -> deux préfixes différents (jamais de collision de fichiers)', () => {
    expect(identityDocumentFolder('agency-1', 'person-1')).not.toBe(identityDocumentFolder('agency-1', 'person-2'))
  })
})

describe('identityDocumentFileName — nom de fichier stable par côté, l\'extension suit le fichier téléversé', () => {
  it('recto avec extension jpg', () => {
    expect(identityDocumentFileName('recto', 'jpg')).toBe('recto.jpg')
  })

  it('verso avec extension pdf', () => {
    expect(identityDocumentFileName('verso', 'pdf')).toBe('verso.pdf')
  })
})

describe('extensionOfFile — extension en minuscule, sans le point ; jamais une chaîne vide dans un chemin Storage', () => {
  it('extrait l\'extension telle quelle', () => {
    expect(extensionOfFile('carte-identite.jpg')).toBe('jpg')
  })

  it('normalise en minuscule (un fichier .JPG et un .jpg doivent produire le même chemin)', () => {
    expect(extensionOfFile('carte-identite.JPG')).toBe('jpg')
    expect(extensionOfFile('Scan.PDF')).toBe('pdf')
  })

  it('nom sans extension -> repli sur "bin", jamais une chaîne vide', () => {
    expect(extensionOfFile('sansextension')).toBe('bin')
  })
})

describe('identityDocumentSidesFor — combien de faces la nature déclarée exige (décision du 03.08.2026)', () => {
  it('passeport -> la page de données SEULE : un passeport n\'a pas de verso, l\'exiger faisait photographier une couverture vierge', () => {
    expect(identityDocumentSidesFor('passport')).toEqual(['recto'])
  })

  it('carte d\'identité -> les deux faces : sur la carte suisse, la date d\'expiration est au dos', () => {
    expect(identityDocumentSidesFor('id_card')).toEqual(['recto', 'verso'])
  })

  it('titre de séjour -> les deux faces', () => {
    expect(identityDocumentSidesFor('residence_permit')).toEqual(['recto', 'verso'])
  })

  it('aucune nature encore choisie -> les deux faces : jamais un dossier réputé complet parce que la question n\'a pas été posée', () => {
    expect(identityDocumentSidesFor(null)).toEqual(['recto', 'verso'])
  })

  it('chaque nature proposée par le wizard a une réponse non vide — aucune ne peut rendre une étape impossible à finir', () => {
    for (const type of IDENTITY_DOCUMENT_TYPES) {
      expect(identityDocumentSidesFor(type).length).toBeGreaterThan(0)
    }
  })
})

describe('isIdentityDocumentType — le CHECK en base accepte 4 valeurs, le wizard n\'en affiche que 3', () => {
  it('les trois natures proposées sont reconnues', () => {
    expect(isIdentityDocumentType('passport')).toBe(true)
    expect(isIdentityDocumentType('id_card')).toBe(true)
    expect(isIdentityDocumentType('residence_permit')).toBe(true)
  })

  it('`other` — 4e valeur du CHECK, qu\'aucun chemin n\'écrit — n\'est PAS affichable : sans libellé, elle se rendrait en code brut ou en option sélectionnée introuvable', () => {
    expect(isIdentityDocumentType('other')).toBe(false)
  })

  it('null (dossier soumis avant le 03.08.2026) et valeur inconnue -> false, jamais une correspondance approximative', () => {
    expect(isIdentityDocumentType(null)).toBe(false)
    expect(isIdentityDocumentType('passeport')).toBe(false)
    expect(isIdentityDocumentType('')).toBe(false)
  })
})

describe('isIdentityVerificationStatus / isIdentityVerificationSufficient — miroir client du CHECK de la colonne', () => {
  it('les quatre statuts Stripe sont reconnus', () => {
    for (const st of ['requires_input', 'processing', 'verified', 'canceled']) {
      expect(isIdentityVerificationStatus(st)).toBe(true)
    }
  })

  it('null (jamais lancée) et valeur inconnue -> refusés', () => {
    expect(isIdentityVerificationStatus(null)).toBe(false)
    expect(isIdentityVerificationStatus('succeeded')).toBe(false)
  })

  it('`verified` ET `processing` laissent avancer : bloquer sur un traitement asynchrone échouerait juste après que le dirigeant a tout fait', () => {
    expect(isIdentityVerificationSufficient('verified')).toBe(true)
    expect(isIdentityVerificationSufficient('processing')).toBe(true)
  })

  it('`requires_input`, `canceled` et l\'absence de vérification ne suffisent pas', () => {
    expect(isIdentityVerificationSufficient('requires_input')).toBe(false)
    expect(isIdentityVerificationSufficient('canceled')).toBe(false)
    expect(isIdentityVerificationSufficient(null)).toBe(false)
  })
})

describe('verificationNeedsManualFallback — quand insister chez le prestataire enfermerait l\'utilisateur', () => {
  it('les deux refus SANS RECOURS ouvrent le dépôt manuel', () => {
    // `country_not_supported` : la liste des pays émetteurs de Stripe compte 110
    // entrées, aucun réessai n'y ajoute le sien. `under_supported_age` : idem.
    expect(verificationNeedsManualFallback('country_not_supported')).toBe(true)
    expect(verificationNeedsManualFallback('under_supported_age')).toBe(true)
  })

  it('un refus REPRENABLE ne bascule pas : une photo floue ou un selfie raté se refont', () => {
    // ⛔ `consent_declined` est passé DE l'autre liste À celle-ci le 04.08.2026, après
    // vérification à la source : Stripe ne déclare aucun code de refus terminal (seul
    // `canceled` l'est, et c'est l'intégrateur qui le produit). Refuser le consentement
    // est un geste rejouable — le classer définitif retirait le bouton « Réessayer » à
    // quelqu'un dont c'était précisément le geste à refaire, et le poussait vers un
    // dépôt de pièce qu'il n'avait pas demandé.
    expect(verificationNeedsManualFallback('consent_declined')).toBe(false)
    expect(verificationNeedsManualFallback('document_unverified_other')).toBe(false)
    expect(verificationNeedsManualFallback('selfie_face_mismatch')).toBe(false)
    expect(verificationNeedsManualFallback(null)).toBe(false)
  })
})

describe('findIdentityDocumentPath — parmi les fichiers listés à ce préfixe, le chemin complet du côté demandé', () => {
  const folder = 'agency-1/kyb-identity/person-1'
  const files = [{ name: 'recto.jpg' }, { name: 'verso.pdf' }]

  it('recto présent -> chemin complet reconstruit', () => {
    expect(findIdentityDocumentPath(files, folder, 'recto')).toBe('agency-1/kyb-identity/person-1/recto.jpg')
  })

  it('verso présent avec une autre extension -> chemin complet avec CETTE extension', () => {
    expect(findIdentityDocumentPath(files, folder, 'verso')).toBe('agency-1/kyb-identity/person-1/verso.pdf')
  })

  it('côté absent de la liste -> null', () => {
    expect(findIdentityDocumentPath([{ name: 'recto.jpg' }], folder, 'verso')).toBeNull()
  })

  it('liste vide -> null pour les deux côtés', () => {
    expect(findIdentityDocumentPath([], folder, 'recto')).toBeNull()
    expect(findIdentityDocumentPath([], folder, 'verso')).toBeNull()
  })

  it('ne confond jamais recto et verso (préfixe strict "side.")', () => {
    // Un nom de fichier qui commencerait par "verso" sans le point (ex. un futur
    // "versoTemp.jpg" égaré) ne doit jamais matcher "verso" par un simple startsWith
    // sans séparateur — la garde `${side}.` en dépend.
    expect(findIdentityDocumentPath([{ name: 'versoTemp.jpg' }], folder, 'verso')).toBeNull()
  })
})

describe('identityDocumentsQueryKey — correctif revue tâche 6 (point mineur) : la clé porte le couple (agence, personne), pas la personne seule', () => {
  it('compose agencyId puis relatedPersonId, dans cet ordre', () => {
    expect(identityDocumentsQueryKey('agency-1', 'person-1')).toEqual(['agency-identity-documents', 'agency-1', 'person-1'])
  })

  it('deux agences différentes pour la même personne -> deux clés différentes (jamais de collision de cache inter-agence)', () => {
    // C'est exactement ce que la clé précédente (relatedPersonId seul) ne garantissait
    // pas : le dossier Storage lu dépend du couple, la clé de cache doit donc aussi.
    expect(identityDocumentsQueryKey('agency-1', 'person-1')).not.toEqual(identityDocumentsQueryKey('agency-2', 'person-1'))
  })

  it('agencyId ou relatedPersonId pas encore connu (null) -> conservé tel quel dans la clé', () => {
    expect(identityDocumentsQueryKey(null, 'person-1')).toEqual(['agency-identity-documents', null, 'person-1'])
    expect(identityDocumentsQueryKey('agency-1', null)).toEqual(['agency-identity-documents', 'agency-1', null])
  })
})

describe('validateIdentityDocumentFile — format et taille avant tout envoi réseau', () => {
  const withinLimit = (bytes: number) => new File([new Uint8Array(bytes)], 'piece.jpg', { type: 'image/jpeg' })

  it('image jpeg de taille raisonnable -> aucune erreur', () => {
    expect(validateIdentityDocumentFile(withinLimit(1024))).toBeNull()
  })

  it('png accepté', () => {
    expect(validateIdentityDocumentFile(new File([new Uint8Array(10)], 'piece.png', { type: 'image/png' }))).toBeNull()
  })

  it('pdf accepté (scan de passeport, pas seulement des photos)', () => {
    expect(validateIdentityDocumentFile(new File([new Uint8Array(10)], 'piece.pdf', { type: 'application/pdf' }))).toBeNull()
  })

  // Bug du 02.08.2026 : ce format était déjà accepté ici et proposé par l'input
  // (ACCEPTED_TYPES, StepPieceIdentite.tsx), mais REFUSÉ par `allowed_mime_types` du
  // bucket `documents` — validation client verte, téléversement en échec. Le côté
  // serveur a été aligné (20260802140000) ; c'est lui que garde le test backend
  // kyb-identity-documents-storage.spec.ts, celui-ci ne fixe que le contrat client.
  it('webp accepté — et le bucket `documents` l\'accepte aussi depuis 20260802140000', () => {
    expect(validateIdentityDocumentFile(new File([new Uint8Array(10)], 'piece.webp', { type: 'image/webp' }))).toBeNull()
  })

  it('format non accepté (ex. vidéo) -> erreur de format', () => {
    const file = new File([new Uint8Array(10)], 'piece.mov', { type: 'video/quicktime' })
    expect(validateIdentityDocumentFile(file)).toEqual({ type: 'format' })
  })

  it('fichier trop volumineux (> 8 Mo) -> erreur de taille', () => {
    const tooBig = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'piece.jpg', { type: 'image/jpeg' })
    expect(validateIdentityDocumentFile(tooBig)).toEqual({ type: 'size' })
  })

  it('exactement 8 Mo -> encore accepté (borne inclusive)', () => {
    const exactlyAtLimit = new File([new Uint8Array(8 * 1024 * 1024)], 'piece.jpg', { type: 'image/jpeg' })
    expect(validateIdentityDocumentFile(exactlyAtLimit)).toBeNull()
  })
})

describe('buildSubmitAgencyIdentityArgs — argument RPC de submit_agency_identity (tâche 7, câblage du dernier maillon)', () => {
  it('un id de personne -> { p_related_person_id } posé : c\'est ce qui déclenche la pose de la ligne de vérification côté RPC (20260728110000)', () => {
    expect(buildSubmitAgencyIdentityArgs('person-1')).toEqual({ p_related_person_id: 'person-1' })
  })

  it('aucun id (défensif, ne devrait pas arriver en pratique derrière canSubmitIdentity) -> objet vide, jamais { p_related_person_id: null } : le paramètre généré (database.ts) est optionnel mais pas nullable, seule l\'omission laisse jouer le défaut SQL (null)', () => {
    expect(buildSubmitAgencyIdentityArgs(null)).toEqual({})
  })
})
