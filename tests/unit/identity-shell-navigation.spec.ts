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
  EMPTY_SIGNATAIRE_DRAFT,
  EMPTY_AGENCY_DRAFT,
  EMPTY_BENEFICIAIRE_DRAFT,
  type SignataireDraft,
  type AgencyDraft,
  type BeneficiaireDraft,
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
    // migration 20260726130000) : une forme choisie pour la Suisse ne peut donc JAMAIS
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

  it('étapes 3 et 4 (paliers "à venir", sans contenu réel) -> jamais navigables en avant, même avec des brouillons complets', () => {
    // Revue tâche 3 : le bouton Continuer du pied de page restait actif sur ces
    // paliers (canNext valait `true` sans condition dès step > 0) — on pouvait
    // avancer jusqu'au récapitulatif sans rien renseigner. SG_IDENTITY_STEPS.length
    // vaut 5 (indices 0 à 4) ; les indices 0 et 1 ont un écran réel depuis la tâche 3/4.
    // L'indice 2 (bénéficiaires) en a un depuis la tâche 5 et sort donc de cette boucle
    // générique — sa complétude a son propre bloc de tests plus bas (4e argument).
    for (let step = 3; step < SG_IDENTITY_STEPS.length; step += 1) {
      expect(canAdvanceFromIdentityStep(step, completeSignataire, completeAgency)).toBe(false)
    }
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

  it('liste vide -> complet : 0 est une réponse légitime (aucune personne physique seule à 25 % ou plus) ; la RPC de soumission n\'exige d\'ailleurs aucun UBO (20260727100000)', () => {
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
