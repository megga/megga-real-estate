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
  isPieceIdentiteStepComplete,
  isRendezVousStepComplete,
  identitySubmissionErrorCode,
  identitySubmissionErrorStep,
  canSubmitIdentity,
  shouldResetAttestationLeavingRecap,
  shouldShowIdentityWelcome,
  shouldDecideIdentityWelcome,
  resolveIdentityScreen,
  EMPTY_SIGNATAIRE_DRAFT,
  EMPTY_AGENCY_DRAFT,
  EMPTY_PIECE_IDENTITE_DRAFT,
  type SignataireDraft,
  type AgencyDraft,
  type PieceIdentiteDraft,
} from '@/components/crm-sugar-identity/IdentityShell'
import { SG_IDENTITY_STEPS } from '@/components/crm-sugar-identity/tokens'

describe('clampIdentityStep — borne la navigation à [0, nombre d étapes - 1]', () => {
  const COUNT = SG_IDENTITY_STEPS.length

  it('la coquille déclare bien les 5 étapes du parcours (signataire -> récapitulatif)', () => {
    // Cinq jusqu'au 03.08.2026 (retrait de « bénéficiaires effectifs »), quatre
    // ensuite, cinq de nouveau depuis le 04.08.2026 : l'étape « rendez-vous » a été
    // insérée en avant-dernière position, la réservation de l'appel d'accueil se
    // faisant jusque-là APRÈS la soumission, sur une route à part.
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
    agencyRole: 'admin',
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

  it('rôle dans l agence non choisi -> incomplet', () => {
    // Remplace le « pouvoir de signature » depuis le 04.08.2026 : la question porte
    // désormais sur la place dans l'organisation, pas sur la capacité à engager seul.
    expect(isSignataireStepComplete({ ...complete, agencyRole: null })).toBe(false)
  })
})

describe('isAgencyStepComplete — gate le bouton Continuer de l étape 2 (agence)', () => {
  const complete: AgencyDraft = {
    country: 'CH',
    legalFormId: 'legal-form-sa',
    legal: 'Régie Lyonnet SA',
    businessRegistrationNumber: 'CHE-123.456.789',
    address: 'Rue du Rhône 10',
    postal: '1204',
    city: 'Genève',
    canton: 'GE',
  }

  it('brouillon vide -> incomplet', () => {
    expect(isAgencyStepComplete(EMPTY_AGENCY_DRAFT)).toBe(false)
  })

  it('les 8 champs renseignés -> complet', () => {
    expect(isAgencyStepComplete(complete)).toBe(true)
  })

  it('raison sociale uniquement des espaces -> incomplet (pas de valeur vide déguisée)', () => {
    expect(isAgencyStepComplete({ ...complete, legal: '   ' })).toBe(false)
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

  // L'ancien cas « TVA facultative » (décision du 27.07.2026) est retiré avec le
  // champ lui-même : `tva` et `tradeName` ont quitté AgencyDraft le 03.08.2026
  // (décision client), donc les tester reviendrait à passer une propriété que le
  // type ne déclare plus. Ce qu'il reste à garder est ci-dessous : les 8 champs
  // sont bloquants, sans exception.

  it('canton exigé en SUISSE seulement — une agence française ne peut pas avoir de canton', () => {
    // Le canton était exigé de tous les pays, avec les 26 cantons suisses pour
    // seules options : une agence FR ou LI ne franchissait l'étape qu'en
    // s'attribuant un canton suisse. Ces deux cas gardent le correctif du
    // 03.08.2026 — le premier échouerait si l'on remettait une exigence
    // inconditionnelle, le second si l'on retirait l'exigence tout court.
    const francaise = { ...complete, country: 'FR', canton: '' }
    expect(isAgencyStepComplete(francaise)).toBe(true)
    expect(isAgencyStepComplete({ ...complete, country: 'LI', canton: '' })).toBe(true)
    expect(isAgencyStepComplete({ ...complete, country: 'CH', canton: '' })).toBe(false)
    expect(isAgencyStepComplete({ ...complete, country: 'CH', canton: '   ' })).toBe(false)
  })

  it('adresse, NPA ou ville manquant -> incomplet', () => {
    expect(isAgencyStepComplete({ ...complete, address: '' })).toBe(false)
    expect(isAgencyStepComplete({ ...complete, postal: '' })).toBe(false)
    expect(isAgencyStepComplete({ ...complete, city: '' })).toBe(false)
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
    agencyRole: 'admin',
  }
  const completeAgency: AgencyDraft = {
    country: 'CH',
    legalFormId: 'legal-form-sa',
    legal: 'Régie Lyonnet SA',
    businessRegistrationNumber: 'CHE-123.456.789',
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

  it('étape 1 (agence) à laquelle il manque le canton -> pas navigable en avant', () => {
    // Remplace l'ancien cas « complète sauf la TVA » : ce champ a quitté le
    // parcours le 03.08.2026 avec « Nom commercial ». Le canton le remplace ici
    // parce qu'il est le champ le plus récemment touché de cette étape (colonnes
    // réellement égales + remplissage par le registre d'adresses) : c'est celui
    // dont on veut savoir qu'il bloque toujours l'avancement.
    expect(canAdvanceFromIdentityStep(1, completeSignataire, { ...completeAgency, canton: '' })).toBe(false)
  })

  it('dernière étape (récapitulatif, indice 4) -> jamais navigable en avant, même avec des brouillons complets : il n\'existe pas d\'étape suivante', () => {
    // Revue tâche 3 : le bouton Continuer du pied de page restait actif sur ces
    // paliers (canNext valait `true` sans condition dès step > 0) — on pouvait
    // avancer jusqu'au récapitulatif sans rien renseigner. Depuis l'ajout de l'étape
    // rendez-vous (04.08.2026), SG_IDENTITY_STEPS.length vaut 5 : les indices 0 à 3
    // ont un écran réel dont la complétude est testée à part, l'indice 4 est le
    // récapitulatif, qui ne mène nulle part.
    expect(canAdvanceFromIdentityStep(4, completeSignataire, completeAgency)).toBe(false)
  })

  it('indice hors de SG_IDENTITY_STEPS -> false, jamais une navigation vers un palier qui n\'existe pas', () => {
    expect(canAdvanceFromIdentityStep(5, completeSignataire, completeAgency)).toBe(false)
  })
})

describe('isRendezVousStepComplete — gate le bouton Continuer de l\'étape 4 (rendez-vous)', () => {
  it('verdict pas encore rendu (lecture des créneaux en cours) -> incomplet', () => {
    // Une étape n'est jamais réputée franchie parce que la question n'a pas encore de
    // réponse. Même règle qu'à la pièce d'identité : on bloque, on ne laisse pas passer
    // par défaut le temps d'un aller-retour réseau.
    expect(isRendezVousStepComplete(null)).toBe(false)
  })

  it('rendez-vous pris -> complet', () => {
    expect(isRendezVousStepComplete({ booked: true, nothingToBook: false })).toBe(true)
  })

  it('rien réservé alors qu\'un créneau est disponible -> incomplet : c\'est une étape bloquante', () => {
    expect(isRendezVousStepComplete({ booked: false, nothingToBook: false })).toBe(false)
  })

  it('RIEN À RÉSERVER (aucun hôte actif, ou aucun créneau sur l\'horizon) -> franchissable', () => {
    // La réserve qui empêche l'étape d'être un cul-de-sac. Sans elle, l'exigence
    // enfermerait aujourd'hui même chaque nouvelle agence hors du CRM : la table
    // onboarding_hosts est vide en production et aucun agenda n'y est connecté.
    // L'exigence porte sur ce que le dirigeant PEUT faire, jamais sur ce que notre
    // configuration lui permet d'atteindre.
    expect(isRendezVousStepComplete({ booked: false, nothingToBook: true })).toBe(true)
  })

  it('branchée sur canAdvanceFromIdentityStep à l\'indice 3, et sur lui seul', () => {
    const nothing = { booked: false, nothingToBook: false }
    const booked = { booked: true, nothingToBook: false }
    expect(canAdvanceFromIdentityStep(3, EMPTY_SIGNATAIRE_DRAFT, EMPTY_AGENCY_DRAFT, EMPTY_PIECE_IDENTITE_DRAFT, false, nothing)).toBe(false)
    expect(canAdvanceFromIdentityStep(3, EMPTY_SIGNATAIRE_DRAFT, EMPTY_AGENCY_DRAFT, EMPTY_PIECE_IDENTITE_DRAFT, false, booked)).toBe(true)
    // Sans 6e argument, l'étape 3 reste bloquée : le défaut est `null`, jamais un
    // « franchissable » implicite pour les appelants qui ne le passent pas.
    expect(canAdvanceFromIdentityStep(3, EMPTY_SIGNATAIRE_DRAFT, EMPTY_AGENCY_DRAFT)).toBe(false)
    // Un rendez-vous pris ne débloque AUCUNE autre étape.
    expect(canAdvanceFromIdentityStep(0, EMPTY_SIGNATAIRE_DRAFT, EMPTY_AGENCY_DRAFT, EMPTY_PIECE_IDENTITE_DRAFT, false, booked)).toBe(false)
  })
})

describe('isPieceIdentiteStepComplete — gate le bouton Continuer de l\'étape 3 (pièce d\'identité)', () => {
  const RECTO = 'agency-1/kyb-identity/person-1/recto.jpg'
  const VERSO = 'agency-1/kyb-identity/person-1/verso.jpg'

  it('brouillon vide (aucune nature, rien téléversé) -> incomplet', () => {
    expect(isPieceIdentiteStepComplete(EMPTY_PIECE_IDENTITE_DRAFT)).toBe(false)
  })

  it('SORTIE DE SECOURS déclarée -> l\'étape est franchissable SANS aucun fichier', () => {
    // Le cœur du dispositif : un dirigeant que le prestataire ne peut pas vérifier
    // (pays émetteur hors liste, nationalité exclue par les conditions du prestataire,
    // pièce non reconnue) franchit l'étape sans rien déposer. Le dossier part en revue
    // humaine à la soumission — même ligne de check qu'un dépôt, sans que MEGGA
    // détienne la pièce. Sans cette sortie, ces dirigeants n'entrent JAMAIS dans le
    // CRM : le gate d'identité les renvoie indéfiniment sur cette étape.
    expect(isPieceIdentiteStepComplete(EMPTY_PIECE_IDENTITE_DRAFT, true)).toBe(true)
  })

  it('sans déclaration, un brouillon vide reste incomplet — la sortie n\'est jamais implicite', () => {
    // L'invariant inverse, et le seul qui rende le test précédent non creux : c'est la
    // DÉCLARATION qui ouvre l'étape, jamais l'absence de pièce. Passer `false` (ou rien)
    // doit laisser la garde exactement où elle était.
    expect(isPieceIdentiteStepComplete(EMPTY_PIECE_IDENTITE_DRAFT, false)).toBe(false)
  })

  it('les deux faces présentes mais AUCUNE nature déclarée -> incomplet : une étape n\'est jamais réputée finie parce qu\'une question n\'a pas été posée', () => {
    expect(isPieceIdentiteStepComplete({ verificationStatus: null, documentType: null, recto: RECTO, verso: VERSO })).toBe(false)
  })

  it('carte d\'identité, recto seul -> incomplet : les deux faces sont exigées', () => {
    expect(isPieceIdentiteStepComplete({ verificationStatus: null, documentType: 'id_card', recto: RECTO, verso: null })).toBe(false)
  })

  it('carte d\'identité, verso seul -> incomplet', () => {
    expect(isPieceIdentiteStepComplete({ verificationStatus: null, documentType: 'id_card', recto: null, verso: VERSO })).toBe(false)
  })

  it('carte d\'identité, recto ET verso -> complet', () => {
    const complete: PieceIdentiteDraft = { verificationStatus: null, documentType: 'id_card', recto: RECTO, verso: VERSO }
    expect(isPieceIdentiteStepComplete(complete)).toBe(true)
  })

  it('titre de séjour : même règle que la carte, les deux faces', () => {
    expect(isPieceIdentiteStepComplete({ verificationStatus: null, documentType: 'residence_permit', recto: RECTO, verso: null })).toBe(false)
    expect(isPieceIdentiteStepComplete({ verificationStatus: null, documentType: 'residence_permit', recto: RECTO, verso: VERSO })).toBe(true)
  })

  it('PASSEPORT, page de données seule -> COMPLET : c\'est tout le sujet du 3 août 2026, un passeport n\'a pas de verso', () => {
    expect(isPieceIdentiteStepComplete({ verificationStatus: null, documentType: 'passport', recto: RECTO, verso: null })).toBe(true)
  })

  it('passeport sans page de données -> incomplet : la face unique reste exigée', () => {
    expect(isPieceIdentiteStepComplete({ verificationStatus: null, documentType: 'passport', recto: null, verso: null })).toBe(false)
  })

  it('identité VÉRIFIÉE chez le prestataire -> complet sans aucun fichier : c\'est tout l\'intérêt du chemin Stripe, la pièce ne transite pas par MEGGA', () => {
    expect(isPieceIdentiteStepComplete({
      verificationStatus: 'verified', documentType: null, recto: null, verso: null,
    })).toBe(true)
  })

  it('vérification EN COURS DE TRAITEMENT -> complet : bloquer l\'onboarding sur un traitement asynchrone échouerait juste après que le dirigeant a tout fait, et le dossier part de toute façon en revue humaine', () => {
    expect(isPieceIdentiteStepComplete({
      verificationStatus: 'processing', documentType: null, recto: null, verso: null,
    })).toBe(true)
  })

  it('vérification à REPRENDRE ou ANNULÉE -> incomplet, et le chemin de secours reprend la main', () => {
    for (const status of ['requires_input', 'canceled'] as const) {
      expect(isPieceIdentiteStepComplete({
        verificationStatus: status, documentType: null, recto: null, verso: null,
      })).toBe(false)
      // Le dépôt manuel, lui, complète l'étape même après un refus du prestataire.
      expect(isPieceIdentiteStepComplete({
        verificationStatus: status, documentType: 'residence_permit', recto: RECTO, verso: VERSO,
      })).toBe(true)
    }
  })

  it('passeport avec un verso résiduel -> complet quand même : le verso n\'est pas REGARDÉ pour un passeport (il est retiré au changement de nature, cf. handleSelectIdentityType), sa présence ne doit ni bloquer ni être exigée', () => {
    expect(isPieceIdentiteStepComplete({ verificationStatus: null, documentType: 'passport', recto: RECTO, verso: VERSO })).toBe(true)
  })
})

describe('canAdvanceFromIdentityStep — étape 3 (pièce d\'identité, tâche 6) : gate sur sa propre complétude, comme les étapes précédentes', () => {
  const completeSignataire: SignataireDraft = {
    firstName: 'Grégory', lastName: 'Lyonnet', dateOfBirth: '1980-05-12', nationality: 'CH', agencyRole: 'admin',
  }
  const completeAgency: AgencyDraft = {
    country: 'CH', legalFormId: 'legal-form-sa', legal: 'Régie Lyonnet SA',
    businessRegistrationNumber: 'CHE-123.456.789', address: 'Rue du Rhône 10',
    postal: '1204', city: 'Genève', canton: 'GE',
  }
  const completePieceIdentite: PieceIdentiteDraft = {
    verificationStatus: null,
    documentType: 'id_card',
    recto: 'agency-1/kyb-identity/person-1/recto.jpg',
    verso: 'agency-1/kyb-identity/person-1/verso.jpg',
  }

  // ⚠ Ces quatre cas tapaient l'indice 3 (le RÉCAPITULATIF, qui rend false quoi qu'il
  // arrive) avec un `[]` en 4e argument, vestige de la signature d'avant le retrait de
  // l'étape bénéficiaires (03.08.2026). Ils passaient sans rien éprouver de la pièce
  // d'identité — et `tsc -b` ne couvrant que src/, l'argument surnuméraire ne levait
  // aucune erreur de type. Recalés sur l'indice 2, le vrai palier de cette étape.

  it('4e argument omis -> se comporte comme un brouillon vide, donc PAS navigable (une pièce d\'identité est toujours bloquante)', () => {
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency)).toBe(false)
  })

  it('aucune face téléversée -> pas navigable', () => {
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency, EMPTY_PIECE_IDENTITE_DRAFT)).toBe(false)
  })

  it('carte d\'identité, recto seul téléversé -> pas encore navigable', () => {
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency, { ...completePieceIdentite, verso: null })).toBe(false)
  })

  it('carte d\'identité, recto ET verso téléversés -> navigable', () => {
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency, completePieceIdentite)).toBe(true)
  })

  it('étape 2 — la sortie de secours déclarée ouvre le bouton Continuer sur un brouillon VIDE', () => {
    // Le pied de page doit suivre la même règle que la garde de complétude : sans ça, le
    // dirigeant lirait « demande enregistrée » à l'écran avec un bouton Continuer mort,
    // et resterait enfermé exactement comme avant.
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency, EMPTY_PIECE_IDENTITE_DRAFT, true)).toBe(true)
    // Non creux : le 5e argument à false laisse la garde inchangée.
    expect(canAdvanceFromIdentityStep(2, completeSignataire, completeAgency, EMPTY_PIECE_IDENTITE_DRAFT, false)).toBe(false)
  })

  it('passeport, page de données seule -> navigable : la garde suit la nature déclarée, comme l\'écran', () => {
    expect(canAdvanceFromIdentityStep(
      2, completeSignataire, completeAgency,
      { verificationStatus: null, documentType: 'passport', recto: completePieceIdentite.recto, verso: null },
    )).toBe(true)
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
  const COUNT = SG_IDENTITY_STEPS.length
  // Le récapitulatif est TOUJOURS la dernière étape : le désigner par COUNT - 1 plutôt
  // que par un index en dur, sans quoi chaque étape ajoutée au parcours (rendez-vous,
  // 04.08.2026) fait tomber ce bloc entier sur une constante périmée.
  const RECAP = COUNT - 1

  it('récapitulatif -> étape signataire (renvoi automatique après refus "signatory") -> reset', () => {
    expect(shouldResetAttestationLeavingRecap(RECAP, 0, COUNT)).toBe(true)
  })

  it('récapitulatif -> étape agence (renvoi automatique après refus "legalName"/"legalForm"/"country") -> reset', () => {
    expect(shouldResetAttestationLeavingRecap(RECAP, 1, COUNT)).toBe(true)
  })

  it('récapitulatif -> étape pièce d\'identité (bouton Précédent OU « Modifier » du récapitulatif, tous deux via goToStep) -> reset', () => {
    expect(shouldResetAttestationLeavingRecap(RECAP, 2, COUNT)).toBe(true)
  })

  it('récapitulatif -> étape rendez-vous (bouton Précédent, ou « Modifier » de la section rendez-vous) -> reset', () => {
    expect(shouldResetAttestationLeavingRecap(RECAP, 3, COUNT)).toBe(true)
  })

  it('re-clic sur le récapitulatif déjà actif (aucune navigation réelle) -> pas de reset', () => {
    expect(shouldResetAttestationLeavingRecap(RECAP, RECAP, COUNT)).toBe(false)
  })

  it('arrivée SUR le récapitulatif depuis l\'étape précédente -> pas de reset (rien à réinitialiser en y entrant)', () => {
    expect(shouldResetAttestationLeavingRecap(RECAP - 1, RECAP, COUNT)).toBe(false)
  })

  it('navigation entre deux étapes qui ne sont ni l\'une ni l\'autre le récapitulatif -> pas de reset', () => {
    expect(shouldResetAttestationLeavingRecap(0, 1, COUNT)).toBe(false)
    expect(shouldResetAttestationLeavingRecap(2, 1, COUNT)).toBe(false)
  })

  it('scénario complet de la revue : coche, soumission refusée (signataire manquant), retour étape 0, correction, ré-avance jusqu\'au récapitulatif -> l\'attestation est bien redemandée, jamais remise à true automatiquement', () => {
    let attestationChecked = true // l'utilisateur avait coché avant de soumettre
    let step = RECAP // au récapitulatif au moment du clic sur Soumettre

    // handleSubmit échoue avec la cause "signatory" -> identitySubmissionErrorStep renvoie 0.
    const targetStep = identitySubmissionErrorStep('signatory')
    expect(targetStep).not.toBeNull()
    if (shouldResetAttestationLeavingRecap(step, targetStep as number, COUNT)) attestationChecked = false
    step = targetStep as number

    expect(attestationChecked, 'déjà remise à zéro au moment du renvoi automatique').toBe(false)

    // L'utilisateur corrige puis clique Continuer à chaque étape (next()) jusqu'à
    // revenir au récapitulatif — rien ne doit jamais recocher l'attestation.
    for (let i = 0; i < COUNT - 1; i += 1) {
      // next() n'est plus qu'un bornage depuis le retrait de l'étape conditionnelle
      // (bénéficiaires, 03.08.2026) : plus de nextIdentityStep, plus de saut à gérer.
      const next = clampIdentityStep(step + 1, COUNT)
      if (shouldResetAttestationLeavingRecap(step, next, COUNT)) attestationChecked = false
      step = next
    }

    expect(step, 'de retour au récapitulatif').toBe(COUNT - 1)
    expect(attestationChecked, 'jamais remise à true automatiquement : l\'utilisateur doit la recocher').toBe(false)
  })
})

// Écran d'arrivée (1er août 2026). Le wizard s'ouvrait droit sur « Signataire » :
// un dirigeant qui venait d'activer son compte se voyait réclamer son identité
// sans savoir pourquoi ni pour combien de temps. La règle décide qui voit
// l'explication, et surtout qui ne la revoit pas.
describe('shouldShowIdentityWelcome - qui voit l\'écran d\'arrivée', () => {
  it('rien n\'a jamais été validé -> on explique avant de demander', () => {
    expect(shouldShowIdentityWelcome(0, false, false)).toBe(true)
  })

  it('une personne déjà enregistrée -> saisie entamée, on reprend où on en était', () => {
    expect(shouldShowIdentityWelcome(1, false, false)).toBe(false)
    expect(shouldShowIdentityWelcome(3, false, false)).toBe(false)
  })

  // LA régression du 01.08.2026 : React Query sert le cache AVANT de revalider,
  // donc `isLoading` est faux alors que la liste est encore celle de la visite
  // précédente. Trancher là-dessus faisait clignoter l'écran d'arrivée chez un
  // dirigeant qui avait déjà saisi son signataire.
  it('liste vide mais revalidation en cours -> on ne tranche pas', () => {
    expect(shouldShowIdentityWelcome(0, false, true)).toBe(false)
  })

  it('lecture en cours -> ni l\'écran d\'arrivée ni le wizard, la coquille tient son spinner', () => {
    // Sans cette garde, le compte de personnes vaut 0 le temps de la requête :
    // un dirigeant qui a déjà tout saisi verrait l\'écran de bienvenue clignoter
    // avant que ses données n\'arrivent - la même classe de faux positif que le
    // flash du CRM corrigé le même jour dans AgentSugarLayout.
    expect(shouldShowIdentityWelcome(0, true, false)).toBe(false)
    expect(shouldShowIdentityWelcome(2, true, false)).toBe(false)
  })
})

// Trois états mutuellement exclusifs, et surtout : une décision PRISE UNE FOIS.
// La suite E2E KYB est tombée trois fois de suite le 01.08.2026 non pas sur un
// mauvais sélecteur, mais parce que l'écran changeait sous elle — coquille, puis
// écran d'arrivée, puis coquille. Ces cas pinnent qu'aucun repère n'apparaît
// avant que la décision soit arrêtée.
describe('resolveIdentityScreen - ce que la route rend, sans clignotement', () => {
  it('décision non prise -> écran d\'attente, ni arrivée ni coquille', () => {
    expect(resolveIdentityScreen(null, false, false)).toBe('preparing')
    expect(resolveIdentityScreen(null, true, false)).toBe('preparing')
    expect(resolveIdentityScreen(null, false, true)).toBe('preparing')
  })

  it('rien de saisi et écran pas encore franchi -> écran d\'arrivée', () => {
    expect(resolveIdentityScreen(true, false, false)).toBe('welcome')
  })

  it('écran franchi -> le wizard, et on n\'y revient jamais', () => {
    expect(resolveIdentityScreen(true, true, false)).toBe('wizard')
  })

  it('sortie de secours -> le wizard (qui rend l\'écran d\'attente), jamais l\'arrivée', () => {
    expect(resolveIdentityScreen(true, false, true)).toBe('wizard')
  })

  it('saisie déjà entamée -> le wizard directement', () => {
    for (const dismissed of [false, true]) {
      expect(resolveIdentityScreen(false, dismissed, false)).toBe('wizard')
    }
  })

  // Retour du prestataire d'identité (?verification=done), 4ᵉ écran depuis le 09.08.2026.
  it('retour de vérification -> l\'écran de retour, quel que soit l\'état de l\'arrivée', () => {
    for (const decision of [true, false]) {
      for (const dismissed of [false, true]) {
        expect(resolveIdentityScreen(decision, dismissed, false, true)).toBe('verificationReturn')
      }
    }
  })

  it('retour de vérification JAMAIS avant que la décision soit prise', () => {
    // Même règle que l'écran d'arrivée : annoncer un verdict sur des données non
    // stabilisées, c'est le clignotement qui a fait tomber la suite E2E le 01.08.2026.
    expect(resolveIdentityScreen(null, false, false, true)).toBe('preparing')
  })

  it('la sortie de secours prime sur le retour de vérification', () => {
    // « Reprendre plus tard » est un geste EXPLICITE de l'utilisateur ; le retour, lui,
    // n'est qu'un paramètre d'URL. Le second ne doit pas défaire le premier.
    expect(resolveIdentityScreen(true, false, true, true)).toBe('wizard')
  })

  it('sans retour en cours, le quatrième argument ne change rien (défaut false)', () => {
    expect(resolveIdentityScreen(true, false, false, false)).toBe('welcome')
    expect(resolveIdentityScreen(true, false, false)).toBe('welcome')
  })
})

describe('shouldDecideIdentityWelcome - on ne tranche que sur des donnees stabilisees', () => {
  it('aucune lecture en cours -> on peut decider', () => {
    expect(shouldDecideIdentityWelcome(false, false)).toBe(true)
  })

  it('premier chargement ou revalidation -> on attend', () => {
    expect(shouldDecideIdentityWelcome(true, false)).toBe(false)
    expect(shouldDecideIdentityWelcome(false, true)).toBe(false)
    expect(shouldDecideIdentityWelcome(true, true)).toBe(false)
  })
})
