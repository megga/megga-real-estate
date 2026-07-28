// IdentityShell (étape 2 KYB, tâche 3) — navigation et gating, testés purs.
//
// Même motif que tests/unit/identity-gate.spec.ts : la coquille elle-même monte
// react-i18next/useTheme/useAgencyIdentity (non unit-testé ici, pas de rendu — ce
// dépôt n'a pas @testing-library/react), mais la décision "peut-on avancer /
// jusqu'où peut-on aller" est une fonction pure exportée, testée directement.

import { describe, it, expect } from 'vitest'
import {
  clampIdentityStep,
  isSignataireStepComplete,
  isAgencyStepComplete,
  legalFormIdAfterCountryChange,
  canAdvanceFromIdentityStep,
  shouldSkipBeneficiairesStep,
  visibleIdentitySteps,
  nextIdentityStep,
  prevIdentityStep,
  isBeneficiaireEntryComplete,
  isBeneficiairesStepComplete,
  isPieceIdentiteStepComplete,
  identitySubmissionErrorCode,
  identitySubmissionErrorStep,
  canSubmitIdentity,
  shouldResetAttestationLeavingRecap,
  EMPTY_SIGNATAIRE_DRAFT,
  EMPTY_AGENCY_DRAFT,
  EMPTY_BENEFICIAIRE_DRAFT,
  EMPTY_PIECE_IDENTITE_DRAFT,
  type SignataireDraft,
  type AgencyDraft,
  type BeneficiaireDraft,
  type PieceIdentiteDraft,
} from '@/components/crm-sugar-identity/IdentityShell'
import { SG_IDENTITY_STEPS } from '@/components/crm-sugar-identity/tokens'

describe('clampIdentityStep — borne la navigation à [0, nombre d étapes - 1]', () => {
  const COUNT = SG_IDENTITY_STEPS.length

  it('la coquille déclare bien les 5 étapes du plan (signataire -> récapitulatif)', () => {
    expect(COUNT).toBe(5)
  })

  it('un pas normal (avancer ou reculer) passe tel quel', () => {
    expect(clampIdentityStep(2, COUNT)).toBe(2)
    expect(clampIdentityStep(1, COUNT)).toBe(1)
  })

  it('ne descend jamais sous 0 (reculer depuis la première étape)', () => {
    expect(clampIdentityStep(-1, COUNT)).toBe(0)
  })

  it('ne dépasse jamais la dernière étape (avancer depuis le récapitulatif)', () => {
    expect(clampIdentityStep(COUNT, COUNT)).toBe(COUNT - 1)
    expect(clampIdentityStep(COUNT + 3, COUNT)).toBe(COUNT - 1)
  })
})

describe('isSignataireStepComplete — gate le bouton Continuer de l étape 1', () => {
  const complete: SignataireDraft = {
    firstName: 'Grégory',
    lastName: 'Lyonnet',
    dateOfBirth: '1980-05-12',
    nationality: 'CH',
    signaturePower: 'individual',
  }

  it('brouillon vide -> incomplet', () => {
    expect(isSignataireStepComplete(EMPTY_SIGNATAIRE_DRAFT)).toBe(false)
  })

  it('les 5 champs renseignés -> complet', () => {
    expect(isSignataireStepComplete(complete)).toBe(true)
  })

  it('prénom ou nom uniquement des espaces -> incomplet (pas de PII vide déguisée)', () => {
    expect(isSignataireStepComplete({ ...complete, firstName: '   ' })).toBe(false)
    expect(isSignataireStepComplete({ ...complete, lastName: '   ' })).toBe(false)
  })

  it('date de naissance manquante -> incomplet', () => {
    expect(isSignataireStepComplete({ ...complete, dateOfBirth: null })).toBe(false)
  })

  it('nationalité manquante -> incomplet', () => {
    expect(isSignataireStepComplete({ ...complete, nationality: null })).toBe(false)
  })

  it('pouvoir de signature non choisi -> incomplet', () => {
    expect(isSignataireStepComplete({ ...complete, signaturePower: null })).toBe(false)
  })
})

describe('isAgencyStepComplete — gate le bouton Continuer de l étape 2 (agence)', () => {
  const complete: AgencyDraft = {
    country: 'CH',
    legalFormId: 'legal-form-sa',
    legal: 'Régie Lyonnet SA',
    tradeName: 'Régie Lyonnet',
    businessRegistrationNumber: 'CHE-123.456.789',
    tva: 'CHE-123.456.789 TVA',
    address: 'Rue du Rhône 10',
    postal: '1204',
    city: 'Genève',
    canton: 'GE',
  }

  it('brouillon vide -> incomplet', () => {
    expect(isAgencyStepComplete(EMPTY_AGENCY_DRAFT)).toBe(false)
  })

  it('les 10 champs renseignés (TVA incluse) -> complet', () => {
    expect(isAgencyStepComplete(complete)).toBe(true)
  })

  it('raison sociale ou nom commercial uniquement des espaces -> incomplet (pas de valeur vide déguisée)', () => {
    expect(isAgencyStepComplete({ ...complete, legal: '   ' })).toBe(false)
    expect(isAgencyStepComplete({ ...complete, tradeName: '   ' })).toBe(false)
  })

  it('pays du siège manquant -> incomplet', () => {
    expect(isAgencyStepComplete({ ...complete, country: '' })).toBe(false)
  })

  it('forme juridique manquante -> incomplet', () => {
    expect(isAgencyStepComplete({ ...complete, legalFormId: '' })).toBe(false)
  })

  it('numéro de registre manquant -> incomplet', () => {
    expect(isAgencyStepComplete({ ...complete, businessRegistrationNumber: '' })).toBe(false)
  })

  it('TVA facultative (décision produit 27.07.2026) : absente ou juste des espaces -> reste complet', () => {
    // Seuil d'assujettissement suisse (cf. en-tête isAgencyStepComplete) : une petite
    // raison individuelle légitime peut n'avoir aucun numéro de TVA. Contrairement à
    // legal/tradeName ci-dessus, même une valeur "espaces uniquement" ne bloque plus
    // rien ici — le champ est sorti du tout-ou-rien, pas juste rendu moins strict.
    expect(isAgencyStepComplete({ ...complete, tva: '' })).toBe(true)
    expect(isAgencyStepComplete({ ...complete, tva: '   ' })).toBe(true)
  })

  it('adresse, NPA, ville ou canton manquant -> incomplet', () => {
    expect(isAgencyStepComplete({ ...complete, address: '' })).toBe(false)
    expect(isAgencyStepComplete({ ...complete, postal: '' })).toBe(false)
    expect(isAgencyStepComplete({ ...complete, city: '' })).toBe(false)
    expect(isAgencyStepComplete({ ...complete, canton: '' })).toBe(false)
  })
})

describe('legalFormIdAfterCountryChange — le pays du siège filtre les formes juridiques (dépendance d ordre tâche 4, pas cosmétique)', () => {
  it('pays inchangé -> conserve la forme juridique choisie', () => {
    expect(legalFormIdAfterCountryChange('CH', 'CH', 'legal-form-sa')).toBe('legal-form-sa')
  })

  it('pays changé -> remet à zéro la forme juridique choisie', () => {
    // Chaque legal_forms.id (uuid) appartient à un seul pays par construction (FK 1:1,
    // migration 20260728100000) : une forme choisie pour la Suisse ne peut donc JAMAIS
    // rester valide après un passage à la France — inutile d'attendre le rechargement
    // de useLegalForms(country) pour le savoir, la remise à zéro est inconditionnelle.
    expect(legalFormIdAfterCountryChange('CH', 'FR', 'legal-form-sa')).toBe('')
  })

  it('aucune forme encore choisie -> reste vide après un changement de pays', () => {
    expect(legalFormIdAfterCountryChange('CH', 'FR', '')).toBe('')
  })

  it('premier choix de pays (rien avant) -> forme vide reste vide, rien à remettre en cause', () => {
    expect(legalFormIdAfterCountryChange('', 'CH', '')).toBe('')
  })
})

describe('canAdvanceFromIdentityStep — gate le bouton Continuer du pied de page (pas seulement le stepper du header)', () => {
  const completeSignataire: SignataireDraft = {
    firstName: 'Grégory',
    lastName: 'Lyonnet',
    dateOfBirth: '1980-05-12',
    nationality: 'CH',
    signaturePower: 'individual',
  }
  const completeAgency: AgencyDraft = {
    country: 'CH',
    legalFormId: 'legal-form-sa',
    legal: 'Régie Lyonnet SA',
    tradeName: 'Régie Lyonnet',
    businessRegistrationNumber: 'CHE-123.456.789',
    tva: 'CHE-123.456.789 TVA',
    address: 'Rue du Rhône 10',
    postal: '1204',
    city: 'Genève',
    canton: 'GE',
  }

  it('étape 0 (signataire) incomplète -> pas navigable en avant', () => {
    expect(canAdvanceFromIdentityStep(0, EMPTY_SIGNATAIRE_DRAFT, EMPTY_AGENCY_DRAFT)).toBe(false)
  })

  it('étape 0 (signataire) complète -> navigable en avant', () => {
    expect(canAdvanceFromIdentityStep(0, completeSignataire, EMPTY_AGENCY_DRAFT)).toBe(true)
  })

  it('étape 1 (agence) incomplète -> pas navigable en avant, même avec un signataire complet', () => {
    expect(canAdvanceFromIdentityStep(1, completeSignataire, EMPTY_AGENCY_DRAFT)).toBe(false)
  })

  it('étape 1 (agence) complète -> navigable en avant', () => {
    expect(canAdvanceFromIdentityStep(1, completeSignataire, completeAgency)).toBe(true)
  })

  it('étape 1 (agence) complète SAUF la TVA -> navigable en avant quand même (décision produit 27.07.2026, TVA facultative)', () => {
    expect(canAdvanceFromIdentityStep(1, completeSignataire, { ...completeAgency, tva: '' })).toBe(true)
  })

  it('étape 4 (récapitulatif, palier "à venir", sans contenu réel) -> jamais navigable en avant, même avec des brouillons complets', () => {
    // Revue tâche 3 : le bouton Continuer du pied de page restait actif sur ces
    // paliers (canNext valait `true` sans condition dès step > 0) — on pouvait
    // avancer jusqu'au récapitulatif sans rien renseigner. SG_IDENTITY_STEPS.length
    // vaut 5 (indices 0 à 4) ; les indices 0 et 1 ont un écran réel depuis la tâche 3/4.
    // L'indice 2 (bénéficiaires, tâche 5) et l'indice 3 (pièce d'identité, tâche 6) en
    // ont un désormais et sortent donc de cette boucle générique — leur complétude a
    // son propre bloc de tests (4e et 5e arguments) plus bas.
    expect(canAdvanceFromIdentityStep(4, completeSignataire, completeAgency)).toBe(false)
  })
})

describe('shouldSkipBeneficiairesStep — sole_proprietorship = le signataire est l\'entité, pas de tiers à déclarer (point central de la tâche 5)', () => {
  it('sole_proprietorship -> sautée', () => {
    expect(shouldSkipBeneficiairesStep('sole_proprietorship')).toBe(true)
  })

  it('corporation -> pas sautée', () => {
    expect(shouldSkipBeneficiairesStep('corporation')).toBe(false)
  })

  it('partnership -> pas sautée', () => {
    expect(shouldSkipBeneficiairesStep('partnership')).toBe(false)
  })

  it('foundation_or_trust -> pas sautée (structure opaque, diligence renforcée, jamais moins de vigilance)', () => {
    expect(shouldSkipBeneficiairesStep('foundation_or_trust')).toBe(false)
  })

  it('catégorie pas encore connue (null) -> pas sautée par défaut : mieux vaut montrer l\'étape tant qu\'on ignore si elle s\'applique', () => {
    expect(shouldSkipBeneficiairesStep(null)).toBe(false)
  })
})

describe('visibleIdentitySteps — le stepper ne compte pas une étape que l\'utilisateur ne verra jamais', () => {
  it('les 5 étapes quand rien n\'est sauté', () => {
    expect(visibleIdentitySteps(5, false)).toEqual([0, 1, 2, 3, 4])
  })

  it('exclut l\'index 2 (bénéficiaires) quand sautée : il n\'en reste que 4', () => {
    expect(visibleIdentitySteps(5, true)).toEqual([0, 1, 3, 4])
  })
})

describe('nextIdentityStep — avance à l\'étape suivante VISIBLE, saute les bénéficiaires si non applicable', () => {
  it('sans saut : avance pas à pas, y compris jusqu\'à bénéficiaires', () => {
    expect(nextIdentityStep(0, 5, false)).toBe(1)
    expect(nextIdentityStep(1, 5, false)).toBe(2)
    expect(nextIdentityStep(2, 5, false)).toBe(3)
  })

  it('avec saut : depuis agence (1), passe direct à pièce d\'identité (3), jamais 2', () => {
    expect(nextIdentityStep(1, 5, true)).toBe(3)
  })

  it('ne dépasse jamais la dernière étape visible, saut ou non', () => {
    expect(nextIdentityStep(4, 5, false)).toBe(4)
    expect(nextIdentityStep(4, 5, true)).toBe(4)
    expect(nextIdentityStep(3, 5, true)).toBe(4)
  })
})

describe('prevIdentityStep — recule à l\'étape précédente VISIBLE, saute les bénéficiaires si non applicable', () => {
  it('sans saut : recule pas à pas, y compris jusqu\'à bénéficiaires', () => {
    expect(prevIdentityStep(3, 5, false)).toBe(2)
    expect(prevIdentityStep(2, 5, false)).toBe(1)
  })

  it('avec saut : depuis pièce d\'identité (3), revient direct à agence (1), jamais 2', () => {
    expect(prevIdentityStep(3, 5, true)).toBe(1)
  })

  it('ne descend jamais sous la première étape visible, saut ou non', () => {
    expect(prevIdentityStep(0, 5, false)).toBe(0)
    expect(prevIdentityStep(0, 5, true)).toBe(0)
    expect(prevIdentityStep(1, 5, true)).toBe(0)
  })
})

describe('isBeneficiaireEntryComplete — tout ou rien par personne, même discipline que le signataire', () => {
  const complete: BeneficiaireDraft = {
    personId: null,
    firstName: 'Sophie',
    lastName: 'Dupont',
    dateOfBirth: '1975-03-20',
    nationality: 'CH',
    ownershipPct: 60,
    pepSelfDeclared: false,
  }

  it('brouillon vide -> incomplet', () => {
    expect(isBeneficiaireEntryComplete(EMPTY_BENEFICIAIRE_DRAFT)).toBe(false)
  })

  it('les 6 champs renseignés -> complet', () => {
    expect(isBeneficiaireEntryComplete(complete)).toBe(true)
  })

  it('prénom ou nom uniquement des espaces -> incomplet (pas de PII vide déguisée, même règle que le signataire)', () => {
    expect(isBeneficiaireEntryComplete({ ...complete, firstName: '   ' })).toBe(false)
    expect(isBeneficiaireEntryComplete({ ...complete, lastName: '   ' })).toBe(false)
  })

  it('date de naissance manquante -> incomplet', () => {
    expect(isBeneficiaireEntryComplete({ ...complete, dateOfBirth: null })).toBe(false)
  })

  it('nationalité manquante -> incomplet', () => {
    expect(isBeneficiaireEntryComplete({ ...complete, nationality: null })).toBe(false)
  })

  it('pourcentage de détention manquant (null) -> incomplet ; 0 % explicite reste une réponse valide', () => {
    expect(isBeneficiaireEntryComplete({ ...complete, ownershipPct: null })).toBe(false)
    expect(isBeneficiaireEntryComplete({ ...complete, ownershipPct: 0 })).toBe(true)
  })

  it('sous le seuil GAFI de 25 % -> complet quand même : c\'est une aide à la saisie, pas une validation (brief tâche 5)', () => {
    expect(isBeneficiaireEntryComplete({ ...complete, ownershipPct: 5 })).toBe(true)
  })

  it('déclaration d\'exposition politique non répondue (null) -> incomplet : jamais de défaut silencieux sur un champ de conformité', () => {
    expect(isBeneficiaireEntryComplete({ ...complete, pepSelfDeclared: null })).toBe(false)
  })

  it('déclaration d\'exposition politique = false explicite -> complet (un "non" répondu n\'est pas une absence de réponse)', () => {
    expect(isBeneficiaireEntryComplete({ ...complete, pepSelfDeclared: false })).toBe(true)
  })
})

describe('isBeneficiairesStepComplete — gate le bouton Continuer de l\'étape 3 (bénéficiaires)', () => {
  const complete: BeneficiaireDraft = {
    personId: 'person-1',
    firstName: 'Sophie',
    lastName: 'Dupont',
    dateOfBirth: '1975-03-20',
    nationality: 'CH',
    ownershipPct: 60,
    pepSelfDeclared: false,
  }

  it('liste vide -> complet : 0 est une réponse légitime (aucune personne physique seule à 25 % ou plus) ; la RPC de soumission n\'exige d\'ailleurs aucun UBO (20260728108000)', () => {
    expect(isBeneficiairesStepComplete([])).toBe(true)
  })

  it('une entrée complète -> complet', () => {
    expect(isBeneficiairesStepComplete([complete])).toBe(true)
  })

  it('une entrée incomplète (même une seule sur plusieurs) -> incomplet : jamais de ligne à moitié saisie silencieusement acceptée', () => {
    expect(isBeneficiairesStepComplete([complete, EMPTY_BENEFICIAIRE_DRAFT])).toBe(false)
  })

  it('plusieurs entrées toutes complètes -> complet', () => {
    const second: BeneficiaireDraft = { ...complete, personId: 'person-2', firstName: 'Marc', ownershipPct: 40 }
    expect(isBeneficiairesStepComplete([complete, second])).toBe(true)
  })
})

describe('canAdvanceFromIdentityStep — étape 2 (bénéficiaires) : gate sur sa propre complétude, comme le signataire et l\'agence', () => {
  const completeSignataire: SignataireDraft = {
    firstName: 'Grégory', lastName: 'Lyonnet', dateOfBirth: '1980-05-12', nationality: 'CH', signaturePower: 'individual',
  }
  const completeAgency: AgencyDraft = {
    country: 'CH', legalFormId: 'legal-form-sa', legal: 'Régie Lyonnet SA', tradeName: 'Régie Lyonnet',
    businessRegistrationNumber: 'CHE-123.456.789', tva: 'CHE-123.456.789 TVA', address: 'Rue du Rhône 10',
    postal: '1204', city: 'Genève', canton: 'GE',
  }
  const completeBeneficiaire: BeneficiaireDraft = {
    personId: null, firstName: 'Sophie', lastName: 'Dupont', dateOfBirth: '1975-03-20',
    nationality: 'CH', ownershipPct: 60, pepSelfDeclared: false,
  }

  it('4e argument omis (compat. appels existants) -> se comporte comme une liste vide, donc navigable', () => {
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency)).toBe(true)
  })

  it('aucun bénéficiaire déclaré (liste vide explicite) -> navigable', () => {
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency, [])).toBe(true)
  })

  it('un bénéficiaire complet -> navigable', () => {
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency, [completeBeneficiaire])).toBe(true)
  })

  it('un bénéficiaire incomplet -> pas navigable', () => {
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency, [EMPTY_BENEFICIAIRE_DRAFT])).toBe(false)
  })
})

describe('isPieceIdentiteStepComplete — gate le bouton Continuer de l\'étape 4 (pièce d\'identité, tâche 6)', () => {
  it('brouillon vide (rien téléversé) -> incomplet', () => {
    expect(isPieceIdentiteStepComplete(EMPTY_PIECE_IDENTITE_DRAFT)).toBe(false)
  })

  it('recto seul (verso manquant) -> incomplet : recto et verso sont tous deux exigés', () => {
    expect(isPieceIdentiteStepComplete({ recto: 'agency-1/kyb-identity/person-1/recto.jpg', verso: null })).toBe(false)
  })

  it('verso seul (recto manquant) -> incomplet', () => {
    expect(isPieceIdentiteStepComplete({ recto: null, verso: 'agency-1/kyb-identity/person-1/verso.jpg' })).toBe(false)
  })

  it('recto ET verso présents -> complet', () => {
    const complete: PieceIdentiteDraft = {
      recto: 'agency-1/kyb-identity/person-1/recto.jpg',
      verso: 'agency-1/kyb-identity/person-1/verso.jpg',
    }
    expect(isPieceIdentiteStepComplete(complete)).toBe(true)
  })
})

describe('canAdvanceFromIdentityStep — étape 3 (pièce d\'identité, tâche 6) : gate sur sa propre complétude, comme les étapes précédentes', () => {
  const completeSignataire: SignataireDraft = {
    firstName: 'Grégory', lastName: 'Lyonnet', dateOfBirth: '1980-05-12', nationality: 'CH', signaturePower: 'individual',
  }
  const completeAgency: AgencyDraft = {
    country: 'CH', legalFormId: 'legal-form-sa', legal: 'Régie Lyonnet SA', tradeName: 'Régie Lyonnet',
    businessRegistrationNumber: 'CHE-123.456.789', tva: 'CHE-123.456.789 TVA', address: 'Rue du Rhône 10',
    postal: '1204', city: 'Genève', canton: 'GE',
  }
  const completePieceIdentite: PieceIdentiteDraft = {
    recto: 'agency-1/kyb-identity/person-1/recto.jpg',
    verso: 'agency-1/kyb-identity/person-1/verso.jpg',
  }

  it('5e argument omis (compat. appels existants) -> se comporte comme un brouillon vide, donc PAS navigable (contrairement aux bénéficiaires, recto/verso sont bloquants)', () => {
    expect(canAdvanceFromIdentityStep(3, completeSignataire, completeAgency, [])).toBe(false)
  })

  it('ni recto ni verso téléversés -> pas navigable', () => {
    expect(canAdvanceFromIdentityStep(3, completeSignataire, completeAgency, [], EMPTY_PIECE_IDENTITE_DRAFT)).toBe(false)
  })

  it('recto seul téléversé -> pas encore navigable', () => {
    expect(canAdvanceFromIdentityStep(3, completeSignataire, completeAgency, [], { recto: completePieceIdentite.recto, verso: null })).toBe(false)
  })

  it('recto ET verso téléversés -> navigable', () => {
    expect(canAdvanceFromIdentityStep(3, completeSignataire, completeAgency, [], completePieceIdentite)).toBe(true)
  })
})

describe('identitySubmissionErrorCode — reconnaît le message brut renvoyé par submit_agency_identity() (tâche 1, un message distinct par cause de refus)', () => {
  it('raison sociale manquante', () => {
    expect(identitySubmissionErrorCode('agency_identity_incomplete: legal_name')).toBe('legalName')
  })

  it('forme juridique manquante', () => {
    expect(identitySubmissionErrorCode('agency_identity_incomplete: legal_form')).toBe('legalForm')
  })

  it('pays du siège manquant', () => {
    expect(identitySubmissionErrorCode('agency_identity_incomplete: country')).toBe('country')
  })

  it('aucun signataire actif', () => {
    expect(identitySubmissionErrorCode('agency_identity_incomplete: signatory')).toBe('signatory')
  })

  it('message non reconnu (42501 forbidden, panne réseau...) -> null, jamais une correspondance approximative', () => {
    expect(identitySubmissionErrorCode('forbidden: agency_admin required')).toBeNull()
    expect(identitySubmissionErrorCode('forbidden: related person not in caller agency')).toBeNull()
    expect(identitySubmissionErrorCode('Failed to fetch')).toBeNull()
    expect(identitySubmissionErrorCode('')).toBeNull()
  })

  it('même motif que le test backend de la tâche 1 (.toContain, pas une égalité stricte) : un message qui CONTIENT la cause, pas seulement égal à elle, est reconnu', () => {
    // tests/backend/agency-identity-submit.spec.ts asserte le message de la RPC réelle
    // par `.toContain('legal_name')`, pas par égalité stricte — preuve que le message
    // observé peut porter plus que le seul texte posé par `raise exception`. Cette
    // fonction doit rester cohérente avec ce qui a été prouvé contre la base réelle.
    expect(identitySubmissionErrorCode('some prefix agency_identity_incomplete: country some suffix')).toBe('country')
  })
})

describe('identitySubmissionErrorStep — ramène l\'utilisateur à l\'étape fautive, une par cause de refus (brief tâche 7)', () => {
  it('signataire manquant -> étape 0 (StepSignataire)', () => {
    expect(identitySubmissionErrorStep('signatory')).toBe(0)
  })

  it('raison sociale, forme juridique ou pays manquant -> étape 1 (StepAgence), les trois vivent sur le même écran', () => {
    expect(identitySubmissionErrorStep('legalName')).toBe(1)
    expect(identitySubmissionErrorStep('legalForm')).toBe(1)
    expect(identitySubmissionErrorStep('country')).toBe(1)
  })

  it('code non reconnu (null, ex. 42501 ou panne réseau) -> aucune navigation forcée', () => {
    expect(identitySubmissionErrorStep(null)).toBeNull()
  })
})

describe('canSubmitIdentity — gate le bouton Soumettre de l\'étape 4 (récapitulatif)', () => {
  it('attestation non cochée -> jamais soumissible, même avec un signataire désigné', () => {
    expect(canSubmitIdentity(false, 'person-1')).toBe(false)
  })

  it('attestation cochée mais aucun signataire désigné -> jamais soumissible : la pièce déposée à l\'étape précédente resterait sans preuve, faute de p_related_person_id (brief tâche 7)', () => {
    expect(canSubmitIdentity(true, null)).toBe(false)
  })

  it('attestation cochée ET signataire désigné -> soumissible', () => {
    expect(canSubmitIdentity(true, 'person-1')).toBe(true)
  })

  it('ni l\'un ni l\'autre -> jamais soumissible', () => {
    expect(canSubmitIdentity(false, null)).toBe(false)
  })
})

describe('shouldResetAttestationLeavingRecap — un seul point de reset de l\'attestation, quel que soit le chemin de sortie du récapitulatif (revue tâche 7, point 1)', () => {
  const COUNT = SG_IDENTITY_STEPS.length // 5 -> récapitulatif = index 4 (COUNT - 1)

  it('récapitulatif -> étape signataire (renvoi automatique après refus "signatory") -> reset', () => {
    expect(shouldResetAttestationLeavingRecap(4, 0, COUNT)).toBe(true)
  })

  it('récapitulatif -> étape agence (renvoi automatique après refus "legalName"/"legalForm"/"country") -> reset', () => {
    expect(shouldResetAttestationLeavingRecap(4, 1, COUNT)).toBe(true)
  })

  it('récapitulatif -> étape bénéficiaires (bouton "Modifier" du récapitulatif OU stepper de l\'en-tête, tous deux via goToStep) -> reset', () => {
    expect(shouldResetAttestationLeavingRecap(4, 2, COUNT)).toBe(true)
  })

  it('récapitulatif -> étape pièce d\'identité (bouton Précédent) -> reset', () => {
    expect(shouldResetAttestationLeavingRecap(4, 3, COUNT)).toBe(true)
  })

  it('re-clic sur le récapitulatif déjà actif (aucune navigation réelle) -> pas de reset', () => {
    expect(shouldResetAttestationLeavingRecap(4, 4, COUNT)).toBe(false)
  })

  it('arrivée SUR le récapitulatif depuis l\'étape précédente -> pas de reset (rien à réinitialiser en y entrant)', () => {
    expect(shouldResetAttestationLeavingRecap(3, 4, COUNT)).toBe(false)
  })

  it('navigation entre deux étapes qui ne sont ni l\'une ni l\'autre le récapitulatif -> pas de reset', () => {
    expect(shouldResetAttestationLeavingRecap(0, 1, COUNT)).toBe(false)
    expect(shouldResetAttestationLeavingRecap(2, 1, COUNT)).toBe(false)
  })

  it('scénario complet de la revue : coche, soumission refusée (signataire manquant), retour étape 0, correction, ré-avance jusqu\'au récapitulatif -> l\'attestation est bien redemandée, jamais remise à true automatiquement', () => {
    let attestationChecked = true // l'utilisateur avait coché avant de soumettre
    let step = 4 // au récapitulatif au moment du clic sur Soumettre

    // handleSubmit échoue avec la cause "signatory" -> identitySubmissionErrorStep renvoie 0.
    const targetStep = identitySubmissionErrorStep('signatory')
    expect(targetStep).not.toBeNull()
    if (shouldResetAttestationLeavingRecap(step, targetStep as number, COUNT)) attestationChecked = false
    step = targetStep as number

    expect(attestationChecked, 'déjà remise à zéro au moment du renvoi automatique').toBe(false)

    // L'utilisateur corrige puis clique Continuer à chaque étape (next()) jusqu'à
    // revenir au récapitulatif — rien ne doit jamais recocher l'attestation.
    for (let i = 0; i < COUNT - 1; i += 1) {
      const next = nextIdentityStep(step, COUNT, false)
      if (shouldResetAttestationLeavingRecap(step, next, COUNT)) attestationChecked = false
      step = next
    }

    expect(step, 'de retour au récapitulatif').toBe(4)
    expect(attestationChecked, 'jamais remise à true automatiquement : l\'utilisateur doit la recocher').toBe(false)
  })
})
