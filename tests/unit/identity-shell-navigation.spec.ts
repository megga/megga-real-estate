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
  canAdvanceFromIdentityStep,
  EMPTY_SIGNATAIRE_DRAFT,
  type SignataireDraft,
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

describe('canAdvanceFromIdentityStep — gate le bouton Continuer du pied de page (pas seulement le stepper du header)', () => {
  const complete: SignataireDraft = {
    firstName: 'Grégory',
    lastName: 'Lyonnet',
    dateOfBirth: '1980-05-12',
    nationality: 'CH',
    signaturePower: 'individual',
  }

  it('étape 0 (signataire) incomplète -> pas navigable en avant', () => {
    expect(canAdvanceFromIdentityStep(0, EMPTY_SIGNATAIRE_DRAFT)).toBe(false)
  })

  it('étape 0 (signataire) complète -> navigable en avant', () => {
    expect(canAdvanceFromIdentityStep(0, complete)).toBe(true)
  })

  it('étapes 1 à 4 (paliers "à venir", sans contenu réel) -> jamais navigables en avant, même avec un brouillon signataire complet', () => {
    // Revue tâche 3 : le bouton Continuer du pied de page restait actif sur ces
    // paliers (canNext valait `true` sans condition dès step > 0) — on pouvait
    // avancer jusqu'au récapitulatif sans rien renseigner. SG_IDENTITY_STEPS.length
    // vaut 5 (indices 0 à 4) ; seul l'indice 0 a un écran réel à cette tâche.
    for (let step = 1; step < SG_IDENTITY_STEPS.length; step += 1) {
      expect(canAdvanceFromIdentityStep(step, complete)).toBe(false)
    }
  })
})
