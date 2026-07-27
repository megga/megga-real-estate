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
  EMPTY_SIGNATAIRE_DRAFT,
  EMPTY_AGENCY_DRAFT,
  type SignataireDraft,
  type AgencyDraft,
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

  it('les 10 champs renseignés -> complet', () => {
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

  it('numéro de registre ou TVA manquant -> incomplet', () => {
    expect(isAgencyStepComplete({ ...complete, businessRegistrationNumber: '' })).toBe(false)
    expect(isAgencyStepComplete({ ...complete, tva: '' })).toBe(false)
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

  it('étapes 2 à 4 (paliers "à venir", sans contenu réel) -> jamais navigables en avant, même avec des brouillons complets', () => {
    // Revue tâche 3 : le bouton Continuer du pied de page restait actif sur ces
    // paliers (canNext valait `true` sans condition dès step > 0) — on pouvait
    // avancer jusqu'au récapitulatif sans rien renseigner. SG_IDENTITY_STEPS.length
    // vaut 5 (indices 0 à 4) ; les indices 0 et 1 ont un écran réel depuis cette tâche.
    for (let step = 2; step < SG_IDENTITY_STEPS.length; step += 1) {
      expect(canAdvanceFromIdentityStep(step, completeSignataire, completeAgency)).toBe(false)
    }
  })
})
