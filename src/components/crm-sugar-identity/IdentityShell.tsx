/**
 * Wizard « Identité légale » (KYB) — coquille, navigation, persistance, soumission.
 * Rendu par la route /dashboard/identite (src/pages/agent/IdentityPage.tsx),
 * tant que useIdentityGate() renvoie 'required'.
 *
 * HABILLAGE : MEGGA X, la transcription verbatim de la vitrine megga.ch, et non
 * Sugar (bascule du 2 août 2026). Tout le parcours vit sous <MeggaX> et n'emploie
 * que des classes de `src/styles/megga-x.generated.css` ; les quatre ajouts que la
 * vitrine ne couvre pas (aide de champ, focus des choix, rail d'étapes, pied
 * d'actions) sont isolés dans `megga-x-additions.css`, qui dit pourquoi.
 *
 * Conséquence assumée : ce parcours ne suit PAS la préférence clair/sombre de
 * l'agent, la peau vitrine n'existant qu'en une polarité. C'est un couloir
 * d'entrée — l'agent vient de megga.ch — pas une surface du CRM ; le thème reprend
 * ses droits au retour sur /dashboard. Même raisonnement que l'écran d'arrivée
 * (IdentityWelcomeScreen) et que BootSplash.
 *
 * Persistance (règle du plan étape 2, § Parcours cible) : l'étape qu'on est en
 * train de QUITTER est sauvegardée dans persistCurrentStep(), appelée par next()
 * ET prev() — pas seulement à la soumission finale (tâche 7). Fermer l'onglet ne
 * perd donc jamais une étape déjà validée. Les tables KYB sont la source de
 * vérité ; aucun stockage local parallèle (le brouillon d'étape en cours vit en
 * mémoire React le temps de la saisie, rien d'autre).
 *
 * CINQ étapes, toutes avec un écran réel : 0 (StepSignataire), 1 (StepAgence),
 * 2 (StepPieceIdentite), 3 (StepRendezVous) et 4 (StepRecapitulatif — relecture de
 * tout ce qui a été saisi, attestation d'exactitude, soumission finale). La soumission
 * (handleSubmit, plus bas) N'EST PAS un bloc de persistCurrentStep comme les
 * précédents : c'est une action explicite distincte, déclenchée par le bouton Soumettre
 * du pied de page, jamais par next()/prev()/goToStep() — voir le dernier cas de
 * persistCurrentStep (étape 4 : rien à y persister) et le commentaire d'en-tête de
 * handleSubmit.
 *
 * ⚠ L'étape « rendez-vous » a été AJOUTÉE le 4 août 2026, en avant-dernière position.
 * Depuis le 15.08.2026 (décision client), elle ne RÉSERVE plus : elle RETIENT un
 * créneau (`rdvChoice`, un brouillon en mémoire de cette coquille), et c'est
 * handleSubmit qui réserve APRÈS le récapitulatif — le lien de visioconférence et
 * l'e-mail de confirmation n'existent donc qu'une fois le dossier soumis (cf.
 * l'en-tête d'OcBooking pour le renversement). Son franchissement dépend du créneau
 * retenu, d'un rendez-vous déjà en base (agence repassant par le wizard), ou de
 * l'absence de tout créneau à réserver (isRendezVousStepComplete). Le 4 août est
 * aussi le jour où la question du « pouvoir de signature » a laissé place à « quel
 * est votre rôle » à l'étape 0 (cf. SignataireDraft plus bas).
 *
 * L'étape 2 diffère des deux précédentes sur un point : elle ne porte AUCUN
 * brouillon local à sauvegarder au clic sur Continuer. Le fichier recto/verso est
 * téléversé IMMÉDIATEMENT vers Storage dès sa sélection (cf. en-tête de
 * StepPieceIdentite.tsx) — persistCurrentStep n'y fait donc que vérifier la
 * complétude, jamais une écriture supplémentaire.
 *
 * ⚠ L'étape « bénéficiaires effectifs » a été RETIRÉE du parcours le 3 août 2026
 * (décision client). Elle occupait l'index 2 et était la SEULE étape conditionnelle
 * du wizard — sautée pour une raison individuelle — ce qui justifiait à elle seule
 * toute la machinerie de saut (shouldSkipBeneficiairesStep, visibleIdentitySteps,
 * nextIdentityStep, prevIdentityStep), partie avec elle : avancer et reculer sont
 * redevenus un simple clampIdentityStep(step ± 1). Le retrait ne touche QUE le
 * wizard — le rôle `ubo` reste dans le schéma, la console admin continue d'afficher
 * les bénéficiaires d'un dossier, et le backend n'a pas bougé.
 *
 * Sortie de secours (tâche 8, « Reprendre plus tard ») : un dirigeant peut quitter
 * le wizard sans le terminer. `showExitScreen` (useState) fait basculer le contenu
 * de <main>/<footer> vers ExitPendingScreen SANS jamais changer de route — on reste
 * sur IDENTITY_GATE_ROUTE (/dashboard/identite), la SEULE route que
 * shouldRedirectToIdentityGate() exempte de redirection (garde-fou 2,
 * useIdentityGate.ts). Rediriger vers /dashboard depuis cette sortie reproduirait à
 * l'identique l'incident P0 c830f9a9 (« boucle onboarding », cf. l'en-tête de
 * useIdentityGate.ts) : le gate y renverrait aussitôt le dirigeant ici. C'est pour
 * cette raison que ExitPendingScreen est un ÉTAT LOCAL de ce composant, jamais une
 * page/route séparée. handleExit persiste au mieux l'étape en cours (même geste que
 * prev(), cf. persistCurrentStep) avant de basculer : le travail déjà VALIDÉ (un
 * Continuer déjà cliqué) est donc dans les tables KYB, qui en restent la source de
 * vérité — revenir (bouton Reprendre la saisie, ou une reconnexion ultérieure qui
 * rouvre ce wizard) relit ce qui a été persisté, rien n'est perdu.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { SG_IDENTITY_STEPS } from './tokens'
import { switchLanguage } from '@/i18n'
import { MeggaX, MxButton, MxLink } from '@/components/megga-x'
import LabGuardBanner from '@/components/layout/LabGuardBanner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgencyIdentity, identityDocumentSidesFor,
  isIdentityVerificationSufficient, verificationNeedsManualFallback,
  type AgencyDeclaredRole, type IdentityDocumentType, type IdentityVerificationStatus,
  type VerificationStartFailure,
} from '@/hooks/useAgencyIdentity'
import { useMyOnboardingCall, useBookOnboardingCall, browserTimezone } from '@/hooks/useOnboardingCall'
import type { OcBookingChoice, OcBookingState } from '@/components/onboarding-call/OcBooking'
import type { AgencySettingsData } from '@/hooks/useAgencySettings'
import IdentitySubmittedScreen from './IdentitySubmittedScreen'
import IdentityVerificationReturnScreen from './IdentityVerificationReturnScreen'
import { StepSignataire } from './steps/StepSignataire'
import { StepAgence } from './steps/StepAgence'
import { StepPieceIdentite } from './steps/StepPieceIdentite'
import { StepRendezVous } from './steps/StepRendezVous'
import { StepRecapitulatif } from './steps/StepRecapitulatif'

/**
 * Brouillon local de l'étape 1, contrôlé par IdentityShell (cf. en-tête de StepSignataire).
 *
 * ⚠ `signaturePower` a été REMPLACÉ par `agencyRole` le 4 août 2026 (décision client).
 * Les deux ne disent pas la même chose : le premier était un fait de conformité — cette
 * personne engage-t-elle l'agence seule ou conjointement —, le second est sa place dans
 * l'organisation, prise dans les quatre rôles que le CRM connaît déjà. La colonne
 * `agency_person_roles.signature_power` n'est pas supprimée pour autant : le wizard
 * cesse de la renseigner, la console admin continue de la relire sur les dossiers
 * antérieurs (cf. migration 20260804170000).
 */
export interface SignataireDraft {
  firstName: string
  lastName: string
  dateOfBirth: string | null
  nationality: string | null
  agencyRole: AgencyDeclaredRole | null
}

/** Brouillon vide — état initial avant hydratation depuis une personne déjà persistée. */
// eslint-disable-next-line react-refresh/only-export-components -- constante partagée avec StepSignataire/les tests, même motif que useTheme.tsx.
export const EMPTY_SIGNATAIRE_DRAFT: SignataireDraft = {
  firstName: '',
  lastName: '',
  dateOfBirth: null,
  nationality: null,
  agencyRole: null,
}

/**
 * true si les 5 champs de l'étape signataire sont renseignés. Gate le bouton
 * Continuer ET la tentative de sauvegarde (persistCurrentStep) : les colonnes DB
 * sont nullable, mais une personne sans rôle ni date de naissance n'est pas une
 * saisie complète du point de vue du parcours KYB.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que useIdentityGate.ts.
export function isSignataireStepComplete(draft: SignataireDraft): boolean {
  return (
    draft.firstName.trim() !== ''
    && draft.lastName.trim() !== ''
    && draft.dateOfBirth != null
    && draft.nationality != null
    && draft.agencyRole != null
  )
}

/**
 * Brouillon local de l'étape 2, contrôlé par IdentityShell (cf. en-tête de
 * StepAgence). Reprend délibérément les noms de champs de AgencySettingsData
 * (`legal` = raison sociale, `postal` = NPA) plutôt que des alias plus verbeux : la
 * persistance (persistCurrentStep) étale ce brouillon directement sur `agency`
 * chargé, sans aucun remappage. Nommé `AgencyDraft` (anglais), pas `AgenceDraft`
 * (français, comme SignataireDraft) : à un caractère de distance de `agency`
 * (AgencySettingsData renvoyée par le hook), une paire agence/agency aurait été un
 * copier-coller-typo attendant de se produire dans ce fichier précis.
 *
 * `tradeName` et `tva` ont été RETIRÉS de ce brouillon le 3 août 2026 (décision
 * client : ni l'un ni l'autre ne sert au dossier KYB). Retirés du TYPE, et pas
 * seulement de l'écran : le brouillon est étalé tel quel sur l'agence chargée
 * (`{ ...agency, ...agencyDraft }`), donc les garder ici à vide aurait ÉCRASÉ
 * `trade_name` et `vat` en base pour une agence qui les avait déjà renseignés
 * ailleurs (Réglages › Agence). Absents du type, les deux colonnes ne sont plus
 * touchées du tout par ce parcours.
 */
export type AgencyDraft = Pick<
  AgencySettingsData,
  'country' | 'legalFormId' | 'legal' | 'businessRegistrationNumber' | 'address' | 'postal' | 'city' | 'canton'
>

/** Brouillon vide — état initial avant hydratation depuis une agence déjà persistée. */
// eslint-disable-next-line react-refresh/only-export-components -- constante partagée avec StepAgence/les tests, même motif que EMPTY_SIGNATAIRE_DRAFT.
export const EMPTY_AGENCY_DRAFT: AgencyDraft = {
  country: '',
  legalFormId: '',
  legal: '',
  businessRegistrationNumber: '',
  address: '',
  postal: '',
  city: '',
  canton: '',
}

/**
 * true si l'étape agence est renseignée. Sept champs pour tout le monde, plus le
 * canton EN SUISSE SEULEMENT.
 *
 * ⚠ Le canton était exigé de TOUS les pays, avec les 26 cantons suisses pour
 * seules options : une agence française ou liechtensteinoise ne pouvait donc pas
 * franchir l'étape sans s'attribuer un canton suisse — un blocage pur, sur un
 * sélecteur de pays qui propose ces trois juridictions depuis l'origine. Défaut
 * relevé le 03.08.2026 en ouvrant l'étape aux registres français. Ni la France ni
 * le Liechtenstein n'ont de canton, leur découpage tenant dans le code postal.
 *
 * `tradeName` et `tva` ont par ailleurs quitté le parcours le même jour
 * (cf. AgencyDraft) ; l'ancienne exception de la TVA facultative (27.07.2026) a
 * disparu avec le champ.
 *
 * Comme isSignataireStepComplete : gate à la fois le bouton Continuer ET la tentative
 * de sauvegarde (persistCurrentStep) — tout ou rien, jamais une écriture partielle
 * de l'identité légale de l'agence.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete.
export function isAgencyStepComplete(draft: AgencyDraft): boolean {
  const cantonRequis = draft.country.trim() === 'CH'
  return (
    draft.country.trim() !== ''
    && draft.legalFormId.trim() !== ''
    && draft.legal.trim() !== ''
    && draft.businessRegistrationNumber.trim() !== ''
    && draft.address.trim() !== ''
    && draft.postal.trim() !== ''
    && draft.city.trim() !== ''
    && (!cantonRequis || draft.canton.trim() !== '')
  )
}

/**
 * Brouillon local de l'étape 3 (tâche 6), contrôlé par IdentityShell comme les étapes
 * précédentes — mais ce n'est PAS un brouillon au même sens : `recto`/`verso` sont les
 * chemins Storage déjà téléversés (useIdentityDocuments), jamais une saisie en
 * attente. IdentityShell le reconstruit à chaque rendu depuis ce hook plutôt que de
 * porter un `useState` dédié : le fichier lui-même est la source de vérité, il n'y a
 * rien d'autre à mémoriser côté client (cf. en-tête de StepPieceIdentite.tsx).
 */
export interface PieceIdentiteDraft {
  /**
   * Statut de la vérification Stripe Identity — le chemin PRINCIPAL depuis le 3 août
   * 2026. Quand il suffit, aucun fichier n'est demandé : la pièce ne transite pas par
   * MEGGA, et c'est tout l'intérêt.
   */
  verificationStatus: IdentityVerificationStatus | null
  /** Nature déclarée de la pièce — décide combien de faces exige le chemin de SECOURS. */
  documentType: IdentityDocumentType | null
  recto: string | null
  verso: string | null
}

/** Brouillon vide — aucune vérification, aucune nature choisie, aucun côté téléversé. */
// eslint-disable-next-line react-refresh/only-export-components -- constante partagée avec les tests, même motif que EMPTY_SIGNATAIRE_DRAFT.
export const EMPTY_PIECE_IDENTITE_DRAFT: PieceIdentiteDraft = {
  verificationStatus: null,
  documentType: null,
  recto: null,
  verso: null,
}

/**
 * true si toutes les faces exigées par la nature déclarée sont téléversées.
 *
 * Aucune valeur par défaut n'est acceptable ici — l'étape existe précisément pour
 * collecter la pièce du signataire, et tant qu'une face manque le dossier KYB reste
 * incomplet. Mais « les deux faces » n'était pas la bonne règle : un passeport n'a
 * qu'une page de données, et l'exiger quand même faisait photographier une
 * couverture vierge. C'est identityDocumentSidesFor (useAgencyIdentity.ts) qui
 * tranche, une seule fois, pour cet écran ET pour cette garde.
 *
 * Tant qu'aucune nature n'est déclarée, la liste rendue est complète (recto+verso) :
 * une étape n'est jamais réputée finie parce qu'une question n'a pas été posée.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isAgencyStepComplete.
export function isPieceIdentiteStepComplete(draft: PieceIdentiteDraft, blockedDeclared = false): boolean {
  // SORTIE DE SECOURS — le dirigeant a déclaré que sa pièce ne peut pas être vérifiée
  // en ligne (pays émetteur hors liste, nationalité que les conditions du prestataire
  // excluent, pièce non reconnue). L'étape est franchissable SANS aucun fichier : le
  // dossier part en revue humaine à la soumission, avec la même ligne de check qu'un
  // dépôt aurait produite — mais MEGGA ne détient rien. Sans cette sortie, ces
  // dirigeants ne sont pas bloqués sur l'étape : le gate d'identité les y renvoie
  // indéfiniment, donc ils n'entrent JAMAIS dans le CRM.
  if (blockedDeclared) return true
  return isPieceIdentiteStepCompleteFromDocuments(draft)
}

/** La complétude par la vérification ou par les fichiers — inchangée, isolée pour la lisibilité. */
function isPieceIdentiteStepCompleteFromDocuments(draft: PieceIdentiteDraft): boolean {
  // Chemin PRINCIPAL — la vérification par le prestataire. Elle se suffit à elle-même :
  // le document a été présenté, authentifié et confronté à un selfie chez Stripe, et
  // rien n'a été déposé ici. Demander un fichier en plus reviendrait à réintroduire
  // exactement la copie qu'on cherche à ne plus détenir.
  if (isIdentityVerificationSufficient(draft.verificationStatus)) return true

  // Chemin de SECOURS — le dépôt manuel, pour les cas que Stripe ne sait pas traiter
  // (titre de séjour, consentement refusé, pays non couvert).
  if (draft.documentType == null) return false
  return identityDocumentSidesFor(draft.documentType).every((side) => draft[side] != null)
}

/**
 * Recalcule le `legalFormId` à conserver après un changement du pays du siège
 * (dépendance d'ordre du brief tâche 4, explicitement pas cosmétique). Chaque
 * `legal_forms.id` appartient à EXACTEMENT un pays par construction (colonne
 * `country`, pas de partage entre juridictions — migration 20260728100000) : tout
 * changement de pays invalide donc systématiquement la forme choisie, jamais
 * seulement "parfois" — inutile d'attendre le rechargement de useLegalForms(country)
 * pour le savoir. Une forme juridique désormais incohérente avec le pays affiché
 * n'est donc jamais laissée en place silencieusement.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isAgencyStepComplete.
export function legalFormIdAfterCountryChange(previousCountry: string, nextCountry: string, currentLegalFormId: string): string {
  return previousCountry === nextCountry ? currentLegalFormId : ''
}

/** Borne `step` à [0, stepCount - 1] — jamais un index hors de SG_IDENTITY_STEPS. */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que useIdentityGate.ts.
export function clampIdentityStep(step: number, stepCount: number): number {
  return Math.min(Math.max(step, 0), stepCount - 1)
}

/**
 * L'étape « rendez-vous » (index 3) est-elle franchissable ?
 *
 * BLOQUANTE PAR DÉFAUT (décision client du 4 août 2026) : on n'avance qu'avec un
 * créneau RETENU (`choice` — depuis le 15.08.2026 l'étape ne réserve plus, cf.
 * l'en-tête du fichier) ou un rendez-vous déjà EN BASE (`state.booked`, agence
 * repassant par le wizard après une réservation). Mais jamais un CUL-DE-SAC : quand il
 * n'y a rien à réserver — aucun hôte actif dans le pool, ou plus aucun créneau libre
 * sur l'horizon — l'exigence tombe. Sans cette réserve, l'étape enfermerait chaque
 * nouvelle agence hors du CRM dès que le pool est vide. L'exigence porte sur ce que le
 * dirigeant PEUT faire, jamais sur ce que notre configuration lui permet d'atteindre.
 *
 * `state` à `null` = l'écran n'a pas encore rendu son verdict (première lecture des
 * créneaux en cours). Sans créneau retenu, on bloque alors, plutôt que de laisser
 * passer par défaut : une étape ne doit pas être réputée franchie parce que la question
 * n'a pas encore de réponse — même règle qu'à la pièce d'identité.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete.
export function isRendezVousStepComplete(
  state: OcBookingState | null,
  choice: OcBookingChoice | null = null,
): boolean {
  if (choice != null) return true
  if (state == null) return false
  return state.booked || state.nothingToBook
}

/**
 * true si l'étape `step` autorise une navigation avant (bouton Continuer du pied de
 * page). Les étapes 0 (StepSignataire), 1 (StepAgence), 2 (StepPieceIdentite) et 3
 * (StepRendezVous) ont un écran réel — gate sur leur complétude respective. L'étape 4
 * (récapitulatif, StepRecapitulatif) renvoie toujours `false` ici pour une raison
 * différente : c'est la DERNIÈRE étape, il n'existe pas de « suivante » vers laquelle
 * avancer — le pied de page n'y affiche d'ailleurs jamais de bouton Continuer (cf. le
 * rendu du footer plus bas), seulement Soumettre, qui gate sur l'attestation
 * d'exactitude et non sur ce booléen (canSubmitIdentity, plus bas).
 *
 * Revue tâche 3 : `canNext` valait `true` sans condition dès step > 0 — le bouton
 * Continuer du pied de page restait cliquable sur ces paliers vides jusqu'au
 * récapitulatif, sans que rien n'ait été renseigné. Le stepper du header respectait
 * déjà la règle (goToStep refuse toute cible > step, cf. plus bas), mais le rapport de
 * la tâche affirmait à tort que c'était vrai aussi du bouton du pied de page.
 *
 * `pieceIdentite` et `rendezVous` sont des paramètres optionnels à défaut vide/nul, pour
 * que les appels antérieurs restent valides — mais un brouillon vide y est INCOMPLET,
 * jamais une réponse légitime.
 *
 * L'étape « bénéficiaires effectifs » occupait l'index 2 jusqu'au 3 août 2026, et
 * l'étape « rendez-vous » a été insérée en index 3 le 4 août 2026 : les indices 2, 3 et
 * 4 désignent depuis la pièce d'identité, le rendez-vous et le récapitulatif (cf. le
 * commentaire de SG_IDENTITY_STEPS, tokens.ts).
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete/clampIdentityStep.
export function canAdvanceFromIdentityStep(
  step: number,
  signataire: SignataireDraft,
  agency: AgencyDraft,
  pieceIdentite: PieceIdentiteDraft = EMPTY_PIECE_IDENTITE_DRAFT,
  blockedDeclared = false,
  rendezVous: OcBookingState | null = null,
  rendezVousChoice: OcBookingChoice | null = null,
): boolean {
  if (step === 0) return isSignataireStepComplete(signataire)
  if (step === 1) return isAgencyStepComplete(agency)
  if (step === 2) return isPieceIdentiteStepComplete(pieceIdentite, blockedDeclared)
  if (step === 3) return isRendezVousStepComplete(rendezVous, rendezVousChoice)
  return false
}

/**
 * Étape 5 (récapitulatif, tâche 7) : causes de refus reconnues dans le message brut
 * renvoyé par submit_agency_identity() (`raise exception '%', v_error`, un texte
 * distinct par cause — migration 20260728108000). Repris en camelCase : `legalName`
 * désigne la CAUSE de refus (raison sociale manquante), à ne pas confondre avec `legal`,
 * le nom du champ correspondant dans AgencyDraft ci-dessus.
 */
export type IdentitySubmissionErrorCode = 'legalName' | 'legalForm' | 'country' | 'signatory'

/**
 * Reconnaît le message brut de submit_agency_identity() et en extrait la cause de
 * refus, ou null si le message ne correspond à aucun des 4 cas de complétude connus
 * (ex. 42501 « forbidden », panne réseau) — jamais une correspondance approximative.
 * `.includes()` et non `===` : le test backend de la tâche 1
 * (tests/backend/agency-identity-submit.spec.ts) vérifie lui-même la présence de la
 * cause par `.toContain(...)` contre la RPC réelle, pas une égalité stricte — signe que
 * le message effectivement observé peut porter plus que le seul texte posé par `raise
 * exception`. Les 4 préfixes sont mutuellement exclusifs ; l'ordre des `if` est gardé
 * identique à l'ordre de vérification du serveur pour la lisibilité, sans incidence sur
 * le résultat.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete.
export function identitySubmissionErrorCode(message: string): IdentitySubmissionErrorCode | null {
  if (message.includes('agency_identity_incomplete: legal_name')) return 'legalName'
  if (message.includes('agency_identity_incomplete: legal_form')) return 'legalForm'
  if (message.includes('agency_identity_incomplete: country')) return 'country'
  if (message.includes('agency_identity_incomplete: signatory')) return 'signatory'
  return null
}

/**
 * Étape à laquelle ramener l'utilisateur pour CHAQUE cause de refus reconnue — raison
 * sociale, forme juridique et pays vivent tous les trois sur l'écran agence (index 1,
 * StepAgence) ; signataire actif sur l'écran signataire (index 0, StepSignataire). null
 * pour un code non reconnu : jamais de navigation vers une étape au hasard sur une
 * erreur qu'on ne comprend pas (42501, panne réseau) — handleSubmit affiche alors
 * seulement le message générique, sans déplacer l'utilisateur.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete.
export function identitySubmissionErrorStep(code: IdentitySubmissionErrorCode | null): number | null {
  if (code === 'signatory') return 0
  if (code === 'legalName' || code === 'legalForm' || code === 'country') return 1
  return null
}

/**
 * true si le bouton Soumettre (étape 4, récapitulatif) doit être actif : l'attestation
 * d'exactitude cochée ET un signataire réellement désigné. Ce second critère n'est pas
 * redondant avec la garde de complétude de la RPC (qui exige déjà un signataire actif
 * en base pour accepter le dossier) : sans lui, un signatoryId nul soumettrait quand
 * même le dossier avec succès, mais SANS jamais transmettre p_related_person_id — la
 * pièce d'identité déposée à l'étape précédente resterait alors sans ligne de
 * vérification (agency_person_verification_checks), exactement le trou signalé en revue
 * de la tâche 6 (cf. le commentaire « Point d'extension » de submit_agency_identity,
 * migration 20260728110000) que cette tâche comble.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete.
export function canSubmitIdentity(attestationChecked: boolean, signatoryId: string | null): boolean {
  return attestationChecked && signatoryId != null
}

/**
 * Correctif revue tâche 7, point 1 : true si le passage de `previousStep` à `nextStep`
 * QUITTE le récapitulatif (dernière étape, index `stepCount - 1`) — c'est le SEUL
 * moment où l'attestation d'exactitude doit être réinitialisée, quel que soit le
 * chemin de sortie : bouton Précédent, "Modifier" du récapitulatif ET stepper de
 * l'en-tête (les deux via goToStep), ou le renvoi automatique après un refus de la RPC
 * dans handleSubmit. Voir l'effet qui utilise cette fonction plus bas dans le
 * composant, seul point d'appel de setAttestationChecked(false) — une attestation qui
 * survit à un aller-retour viderait la déclaration de sa portée : l'utilisateur
 * pourrait corriger des données puis soumettre à nouveau sans avoir consciemment
 * réattesté les valeurs modifiées. Rester sur place (previousStep === nextStep, ex.
 * re-clic sur l'étape déjà active) ou naviguer entre deux étapes qui ne sont NI L'UNE
 * NI L'AUTRE le récapitulatif ne doit jamais y toucher : il n'y a alors rien à
 * réinitialiser.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que canSubmitIdentity.
export function shouldResetAttestationLeavingRecap(previousStep: number, nextStep: number, stepCount: number): boolean {
  const recapStep = stepCount - 1
  return previousStep === recapStep && nextStep !== recapStep
}

/**
 * Écran d'arrivée : ce wizard s'ouvre-t-il sur une explication, ou droit sur la
 * première étape ?
 *
 * Le dirigeant qui vient d'activer son compte tombait sur « Signataire » sans un
 * mot : ni pourquoi on lui demande son identité avant de lui ouvrir le CRM, ni
 * combien de temps ça prend, ni qu'une pièce d'identité lui sera réclamée en
 * cours de route. Un mur se traverse mieux quand il annonce ce qu'il y a
 * derrière.
 *
 * `personsCount` est le signal de fraîcheur : l'étape 0 écrit dans
 * `agency_related_persons`, donc zéro personne veut dire que rien n'a jamais été
 * validé. Un dirigeant qui revient reprendre sa saisie a déjà lu l'écran et a des
 * données : on ne le lui remontre pas. Celui qui est reparti avant d'avoir rien
 * saisi le revoit, ce qui est juste puisqu'il n'a jamais commencé.
 *
 * ⚠ `isRevalidating` n'est pas une redondance d'`isLoading`. React Query sert
 * d'abord le CACHE — `isLoading` faux, liste encore vide de la visite précédente
 * — puis revalide. Sans cette seconde garde, un dirigeant qui a déjà saisi son
 * signataire, quitte le wizard et revient, revoyait l'écran d'arrivée le temps
 * d'un aller-retour réseau. Attrapé par la suite E2E KYB le 01.08.2026 : elle
 * voyait le bouton « Identifier mon agence », le perdait avant de pouvoir
 * cliquer, et n'avait plus ni écran d'arrivée ni coquille sous la main. C'est
 * exactement le flash qu'on est venu corriger sur le tableau de bord, à un autre
 * étage.
 *
 * Pur (pas de React) pour la même raison que les autres règles de ce fichier :
 * la décision se teste sans monter la coquille.
 */
/**
 * Ce que la route rend, en TROIS états mutuellement exclusifs.
 *
 * `welcomeDecision` vaut `null` tant que la question « ce dirigeant a-t-il déjà
 * saisi quelque chose ? » n'a pas de réponse arrêtée. Elle se pose UNE fois, sur
 * des données stabilisées, et ne se repose jamais.
 *
 * Pourquoi trois états et pas deux : tant qu'on n'a pas décidé, il ne faut rendre
 * NI l'écran d'arrivée NI la coquille. Rendre la coquille « en attendant » la
 * faisait remplacer par l'écran d'arrivée une fraction de seconde plus tard —
 * c'est ce clignotement, et non un mauvais sélecteur, qui a fait tomber la suite
 * E2E KYB trois fois de suite le 01.08.2026 : elle attrapait un repère qui
 * disparaissait sous elle. Un écran d'attente neutre ne porte aucun des deux
 * repères, donc rien à attraper trop tôt.
 */
export type IdentityScreen = 'preparing' | 'welcome' | 'wizard' | 'verificationReturn' | 'submitted'

/**
 * La question est-elle seulement posable ? Tant qu'une lecture est en cours —
 * premier chargement (`isLoading`) ou revalidation d'un cache déjà servi
 * (`isRevalidating`) — la liste des personnes n'est pas un verdict, et trancher
 * dessus revient à décider sur un état qui va changer.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que shouldShowIdentityWelcome.
export function shouldDecideIdentityWelcome(isLoading: boolean, isRevalidating: boolean): boolean {
  return !isLoading && !isRevalidating
}

// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que shouldShowIdentityWelcome.
export function resolveIdentityScreen(
  welcomeDecision: boolean | null,
  welcomeDismissed: boolean,
  showExitScreen: boolean,
  /**
   * Le dirigeant revient de chez le prestataire (`?verification=done`) et n'a pas
   * encore quitté cet écran. Optionnel : le seul appelant le passe, et les cas d'avant
   * le 9 août 2026 se relisent tels quels — l'omettre, c'est « pas de retour en cours »,
   * ce qui est l'état de tout chargement ordinaire de la route.
   */
  showVerificationReturn = false,
  /**
   * Le dossier vient d'être soumis. TERMINAL : passe avant tout le reste, y compris
   * l'écran d'attente — une fois la RPC acquittée, plus aucune donnée en cours de
   * chargement ne peut remettre le parcours en question.
   */
  submitted = false,
): IdentityScreen {
  if (submitted) return 'submitted'
  // AVANT l'arrivée, APRÈS l'attente. L'ordre est le fond de la règle : on ne peut pas
  // annoncer un verdict tant que la décision d'écran n'est pas prise (mêmes données non
  // stabilisées, même clignotement que l'incident du 01.08.2026), mais quelqu'un qui
  // revient de chez le prestataire ne doit jamais retomber sur l'écran d'arrivée, qui
  // lui proposerait de commencer ce qu'il vient de faire.
  if (welcomeDecision === null) return 'preparing'
  if (showVerificationReturn && !showExitScreen) return 'verificationReturn'
  if (welcomeDecision && !welcomeDismissed && !showExitScreen) return 'welcome'
  return 'wizard'
}

// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que shouldResetAttestationLeavingRecap.
export function shouldShowIdentityWelcome(
  personsCount: number,
  isLoading: boolean,
  isRevalidating: boolean,
): boolean {
  return !isLoading && !isRevalidating && personsCount === 0
}

/**
 * Écran d'arrivée, rendu À LA PLACE de toute la coquille Sugar tant qu'il n'a pas
 * été franchi (cf. son point d'appel dans IdentityShell). Jamais une route : la
 * route du gate est la seule que shouldRedirectToIdentityGate exempte, en sortir
 * renverrait ici (incident P0 c830f9a9). Même statut qu'ExitPendingScreen, donc,
 * mais pas la même peau.
 *
 * Habillé en MEGGA X, pas en Sugar, et c'est délibéré : l'agent vient de
 * megga.ch, il a lu « Compte créé » sur la vitrine, il a cliqué un lien reçu par
 * e-mail. Cet écran est le dernier de ce parcours-là, pas le premier du CRM —
 * il en garde donc la peau, et la bascule vers Sugar se fait au clic sur
 * Commencer, quand le wizard commence vraiment. Même raisonnement que BootSplash,
 * qui porte lui aussi l'habillage de la vitrine.
 *
 * Rien n'est réinventé : le gabarit est celui des écrans d'authentification de la
 * vitrine (`card sign-in-card` > `pd---content-inside-card` > `inner-container
 * _464px center`), la pastille de validation est la même que « Lien envoyé » de
 * la modale mot de passe oublié (`success-message-icon-top` + le glyphe U+E805 de
 * la police Mega Custom Icons), et les boutons sont les composants MEGGA X.
 * La feuille est la transcription verbatim de la vitrine, scopée `.megga-x`.
 */
/**
 * Écran d'attente, rendu tant que la décision n'est pas prise (cf.
 * resolveIdentityScreen). Ne porte AUCUN des repères des deux autres écrans —
 * c'est tout son intérêt : rien ne peut y être attrapé trop tôt, ni par un
 * utilisateur ni par un test. Même habillage que l'écran d'arrivée, pour que la
 * bascule ne se voie pas.
 */
function IdentityPreparingScreen() {
  const { t } = useTranslation('onboarding')
  return (
    <MeggaX>
      <div className="page-wrapper full-height-page mx-appshell">
        <div className="header pd-medium-top-and-bottom">
          <div className="container-default w-container">
            <div className="flex-horizontal">
              <div className="header-logo">
                <img src="/megga-logo.svg" alt="MEGGA" />
              </div>
            </div>
          </div>
        </div>
        {/* Mêmes classes de gabarit que l'écran d'arrivée, pour que la bascule de
            l'un à l'autre ne déplace rien : la respiration vient du centrage dans
            la hauteur restante, pas des 64/108 px fixes de la section vitrine. */}
        <section className="section hero---br pd-top-0 pd-bottom-0 mx-grow mx-shellbody">
          <div className="container-default w-container mx-scrollarea mx-scrollarea--center">
            <div className="inner-container _506px center">
              <div className="text-center" role="status" aria-live="polite">
                <p className="paragraph-large">{t('gate.shell.preparing')}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MeggaX>
  )
}

function IdentityWelcomeScreen({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const { t } = useTranslation('onboarding')
  return (
    <MeggaX>
      {/* `mx-appshell` : cet écran-ci débordait de 69 px à 1280×720 — une carte,
          un bouton, et il fallait dérouler. La coquille tient maintenant dans la
          fenêtre et la carte se centre dans ce qui reste. */}
      <div className="page-wrapper full-height-page mx-appshell">
        {/* Même en-tête que signup.html / login.html, sans lien : l'agent est
            déjà connecté, le logo n'est plus une porte vers la vitrine. */}
        <div className="header pd-medium-top-and-bottom">
          <div className="container-default w-container">
            <div className="flex-horizontal">
              {/* `.header-logo img` porte le `filter: brightness(0) invert(1)` de la
                  vitrine, qui blanchit le tracé noir sur fond sombre, et sa taille.
                  Un <div> plutôt qu'un <a> : l'agent est connecté, le logo ne
                  ramène nulle part. */}
              <div className="header-logo">
                <img src="/megga-logo.svg" alt="MEGGA" />
              </div>
            </div>
          </div>
        </div>
        <section className="section hero---br pd-top-0 pd-bottom-0 mx-grow mx-shellbody">
          <div className="container-default position-relative---z-index-1 w-container mx-scrollarea mx-scrollarea--center">
            <div className="inner-container _634px center">
              <div className="card sign-in-card">
                <div className="pd---content-inside-card pd---vertical-side-104px">
                  <div className="inner-container _464px center">
                    <div className="text-center">
                      {/* Glyphe de la police Mega Custom Icons, comme dans la vitrine :
                          la classe porte déjà la pastille dégradée et la font-family. */}
                      <div className="success-message-icon-top">{''}</div>
                      <h1 className="display-6">{t('gate.welcome.title')}</h1>
                      <div className="mg-top-4x-extra-small">
                        <p className="paragraph-large">{t('gate.welcome.body')}</p>
                      </div>
                    </div>
                    <div className="mg-top-large text-center">
                      {/* `type="button"` explicite, comme aux étapes 3/4/5 : MxButton n'en
                          pose aucun, donc son défaut HTML est `submit`. Aucun de ces
                          boutons ne soumet quoi que ce soit — la coquille Sugar les
                          écrivait déjà tous en `type="button"`, la peau MEGGA X l'avait
                          perdu au passage. Inerte tant qu'aucun <form> ne les enveloppe,
                          mais c'est exactement le genre de déclaration fausse qu'on ne
                          laisse pas traîner (même raison que MxLink sans href). */}
                      <MxButton type="button" className="app-button" onClick={onStart}>
                        {t('gate.welcome.startButton')}
                      </MxButton>
                    </div>
                    <div className="mg-top-small">
                      <div className="text-center">
                        <MxLink onClick={onLater}>
                          {t('wizard.footer.exit')}
                        </MxLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MeggaX>
  )
}

/**
 * Langues du produit, nommées dans leur propre langue.
 *
 * Des endonymes, jamais des exonymes : « Deutsch » se lit de la même façon sur
 * un wizard français ou italien, là où « Allemand » suppose de comprendre le
 * français pour retrouver l'allemand — exactement la personne qu'on cherche à
 * dépanner. Ils ne passent donc pas par les fichiers de traduction.
 */
const LANGUES_WIZARD = [
  { code: 'fr', nom: 'Français' },
  { code: 'de', nom: 'Deutsch' },
  { code: 'en', nom: 'English' },
  { code: 'it', nom: 'Italiano' },
]

/**
 * Sélecteur de langue du wizard d'onboarding.
 *
 * POURQUOI IL EXISTE. Ce wizard est le premier écran d'un nouvel agent, et il
 * se trouve derrière le gate d'identité : les Réglages, qui portent l'autre
 * sélecteur, ne sont pas atteignables tant qu'il n'est pas terminé. Tant que la
 * langue ne pouvait venir que d'un choix explicite, cette impasse restait
 * théorique. Depuis que le pays du visiteur peut la deviner
 * (`src/lib/geoLanguage.ts`, chantier langue-par-géolocalisation), elle ne
 * l'est plus : une déduction fausse — un Genevois derrière la sortie zurichoise
 * d'un VPN d'entreprise, cas banal — enfermerait quelqu'un dans un parcours de
 * conformité en allemand, sans issue.
 *
 * Le `<select>` natif est un choix, pas un repli : navigable au clavier,
 * annoncé par les lecteurs d'écran et rendu par le sélecteur du système sur
 * mobile, sans qu'on ait à le réimplémenter.
 *
 * (Ré-application du 2 août 2026 : ce composant venait de la branche
 * langue-par-géolocalisation, écrite contre l'ancien header Sugar ; #1069 a
 * réécrit le header en MEGGA X sans lui. Logique et documentation reprises
 * telles quelles, seul le style passe de SugarV2 — retiré — à `.mx-langpicker`,
 * cf. megga-x-additions.css.)
 *
 * `switchLanguage` et non `i18n.changeLanguage` : ce dernier bascule AVANT que
 * le bundle de la langue existe, ce qui repassait l'écran par le français le
 * temps du téléchargement puis le re-rendait une seconde fois (voir sa JSDoc
 * dans src/i18n/index.ts pour le déroulé mesuré). `onPending` remonte l'attente
 * à la coquille, qui en fait un squelette — le sélecteur ne pilote pas
 * l'affichage du parcours lui-même.
 */
function WizardLanguagePicker({ onPending }: { onPending: (pending: boolean) => void }) {
  const { t, i18n } = useTranslation('onboarding')
  const handleChange = async (lng: string) => {
    onPending(true)
    try {
      await switchLanguage(lng)
    } finally {
      onPending(false)
    }
  }
  return (
    <select
      className="mx-langpicker"
      value={i18n.language.slice(0, 2)}
      onChange={(e) => { void handleChange(e.target.value) }}
      aria-label={t('wizard.header.language')}
      title={t('wizard.header.language')}
    >
      {LANGUES_WIZARD.map((l) => (
        <option key={l.code} value={l.code}>{l.nom}</option>
      ))}
    </select>
  )
}

/**
 * Seuil au-delà duquel une bascule de langue mérite un squelette.
 *
 * En dessous, la langue est déjà en cache (second passage par une langue, ou le
 * français toujours bundlé) et la bascule est quasi instantanée : afficher un
 * squelette y produirait un CLIGNOTEMENT, c'est-à-dire précisément le défaut
 * qu'on cherche à retirer. Au-delà, il y a un vrai téléchargement (13 imports
 * dynamiques, ~140 Ko) et le silence deviendrait une panne apparente.
 */
const LANGUAGE_SKELETON_DELAY_MS = 120

/**
 * Reprend `actif`, mais seulement s'il dure plus de `delaiMs` — et le relâche
 * immédiatement. Retarder l'apparition, jamais la disparition : c'est ce qui
 * distingue un squelette d'un voile de chargement.
 *
 * Le retour est DÉRIVÉ (`actif && ecoule`) plutôt que porté par le seul état :
 * c'est ce qui rend la disparition instantanée — dès qu'`actif` retombe, le
 * rendu courant vaut déjà faux, sans attendre que l'effet de nettoyage passe.
 * L'état ne se remet à faux que dans ce nettoyage, jamais dans le corps de
 * l'effet, qui déclencherait un rendu en cascade (react-hooks/set-state-in-effect).
 */
function useFlagRetarde(actif: boolean, delaiMs: number): boolean {
  const [ecoule, setEcoule] = useState(false)
  useEffect(() => {
    if (!actif) return
    const id = window.setTimeout(() => setEcoule(true), delaiMs)
    return () => { window.clearTimeout(id); setEcoule(false) }
  }, [actif, delaiMs])
  return actif && ecoule
}

/**
 * Squelette de l'étape, affiché à la place de son contenu pendant qu'une langue
 * se télécharge.
 *
 * Il ne remplace QUE `<main>`. La coquille — logo, sélecteur, rail d'étapes,
 * pied d'actions — reste en place et garde sa langue courante : ses libellés
 * sont courts, ils se substituent sans que l'œil accroche, et les figer aurait
 * fait disparaître les repères que le correctif de gabarit vient justement de
 * clouer à l'écran.
 *
 * Les proportions sont celles d'une étape réelle (titre, deux lignes de
 * sous-titre, carte de champs par paires) : le bloc garde sa hauteur, donc la
 * zone de défilement ne saute pas au retour du texte.
 *
 * `aria-hidden` + `role="status"` sur le libellé : un lecteur d'écran entend
 * « chargement », jamais la douzaine de barres grises.
 */
function StepSkeleton({ label }: { label: string }) {
  return (
    <div className="inner-container _634px center">
      <p className="mx-visually-hidden" role="status" aria-live="polite">{label}</p>
      <div aria-hidden="true">
        <div className="mx-skeleton mx-skeleton--title" />
        <div className="mg-top-4x-extra-small">
          <div className="mx-skeleton mx-skeleton--line" />
          <div className="mx-skeleton mx-skeleton--line mx-skeleton--short mg-top-5x-extra-small" />
        </div>
        <div className="card sign-in-card mg-top-medium">
          <div className="pd---content-inside-card">
            {[0, 1, 2].map((row) => (
              <div key={row} className={cn('grid-2-columns', row > 0 && 'mg-top-small')}>
                <div>
                  <div className="mx-skeleton mx-skeleton--label" />
                  <div className="mx-skeleton mx-skeleton--field mg-top-5x-extra-small" />
                </div>
                <div>
                  <div className="mx-skeleton mx-skeleton--label" />
                  <div className="mx-skeleton mx-skeleton--field mg-top-5x-extra-small" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Sortie de secours (tâche 8) : écran d'attente affiché à la place du contenu du
 * wizard quand `showExitScreen` vaut vrai (cf. son point d'appel dans IdentityShell,
 * plus bas) — jamais un composant monté par une route séparée, voir l'en-tête du
 * fichier pour pourquoi (garde-fou anti-boucle). Purement local, non exporté : ce
 * n'est pas une étape du parcours (SG_IDENTITY_STEPS), seulement un état de la
 * coquille, au même titre que le spinner de chargement déjà inline dans <main>.
 */
function ExitPendingScreen({ onResume, onLogout }: { onResume: () => void; onLogout: () => void }) {
  const { t } = useTranslation('onboarding')
  return (
    <div className="inner-container _634px center">
      <div className="card sign-in-card">
        <div className="pd---content-inside-card">
          <div className="inner-container _464px center">
            <div className="text-center">
              {/* Le sur-titre en majuscules de la coquille Sugar est retiré : la
                  vitrine n'a pas ce registre, ses cartes ouvrent sur le titre. */}
              <h1 className="display-6">{t('gate.pendingNotice.title')}</h1>
              <div className="mg-top-4x-extra-small">
                <p className="paragraph-large">{t('gate.pendingNotice.body')}</p>
              </div>
            </div>
            {/* Deux sorties, hiérarchisées : reprendre (primaire) ou partir
                vraiment (secondaire). La déconnexion est la SEULE vraie sortie de
                ce parcours — rediriger vers /dashboard reproduirait la boucle de
                l'incident P0 c830f9a9 (cf. en-tête du fichier), le gate y
                renverrait aussitôt. Même geste que « Se déconnecter » de
                l'en-tête (handleLogout), pas un chemin parallèle. */}
            <div className="mg-top-medium text-center">
              <MxButton type="button" onClick={onResume}>{t('gate.pendingNotice.resumeButton')}</MxButton>
            </div>
            <div className="mg-top-2x-extra-small text-center">
              <MxButton type="button" variant="secondary" onClick={onLogout}>{t('common:nav.logout')}</MxButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Réglages d'APERÇU, passés par le seul appelant qui en pose : la page de
 * prévisualisation dev (`src/pages/dev/OnboardingPreviewPage.tsx`), dont la route
 * n'est enregistrée que sous `import.meta.env.DEV`. En production, `preview` est
 * toujours `undefined` et pas une ligne de ce fichier ne change de comportement.
 *
 * Elle existe parce que ce parcours est autrement inatteignable pour retoucher son
 * front : il vit derrière ProtectedRoute, useIdentityGate() EXEMPTE les super-admins
 * (le seul rôle qu'ait le compte de l'équipe), et il ne se franchit qu'une fois —
 * `identity_submitted_at` posé, le gate rend 'done' pour toujours et aucun de ces
 * écrans ne se rouvre. Trois écrans (attente, arrivée, sortie de secours) ne sont par
 * ailleurs pas des routes : ce sont des états locaux de cette coquille, qu'aucune URL
 * ne désigne.
 */
export interface IdentityShellPreview {
  /** Écran ouvert au montage. Sans lui, la décision se prend normalement (persons). */
  screen?: IdentityScreen | 'exit'
  /** Étape ouverte au montage quand `screen` vaut 'wizard'. */
  step?: number
  /**
   * N'écrit rien en base au changement d'étape. Indispensable, pas confortable :
   * persistCurrentStep() échoue faute de session, et next() refuse d'avancer sur un
   * échec de persistance — l'aperçu resterait cloué à l'étape 0.
   */
  skipPersist?: boolean
}

/**
 * Les deux étapes que l'écran de retour sait rouvrir, nommées plutôt que comptées.
 * `SG_IDENTITY_STEPS` en est la source : un jour où l'ordre bouge, c'est ici que ça se
 * lit, pas dans un `setStep(3)` perdu au milieu d'un JSX.
 */
const INDEX_ETAPE_PIECE_IDENTITE = SG_IDENTITY_STEPS.findIndex((s) => s.id === 'pieceIdentite')
const INDEX_ETAPE_RENDEZ_VOUS = SG_IDENTITY_STEPS.findIndex((s) => s.id === 'rendezVous')

/**
 * Cadence et plafond du rappel de statut sur l'écran de retour.
 *
 * Le verdict du prestataire arrive par WEBHOOK, pas dans la réponse au navigateur :
 * l'onglet revient donc presque toujours avant lui, sur un statut `processing`. Sans ce
 * rappel, le dirigeant resterait sur « vérification en cours » jusqu'à ce qu'il pense à
 * recharger — sur l'écran précis où il vient chercher une confirmation.
 *
 * Borné, et c'est le point : passé une trentaine de secondes, on cesse d'interroger et
 * l'écran assume l'attente. Un sondage sans fin sur une route où l'on peut rester
 * ouvert des minutes coûterait une requête toutes les trois secondes pour rien.
 */
const RETOUR_SONDAGE_MS = 3_000
const RETOUR_SONDAGE_MAX = 10

/** Coquille du wizard identité : chrome, navigation entre étapes, persistance au changement d'étape. */
export default function IdentityShell({ preview }: { preview?: IdentityShellPreview } = {}) {
  const { t } = useTranslation('onboarding')
  // Aucune lecture de `useTheme()` ici, et c'est délibéré : ce parcours porte la
  // peau de la vitrine, qui n'existe qu'en une polarité (fond #030303). Il ne
  // suit donc pas la préférence clair/sombre de l'agent — comme l'écran d'arrivée
  // et BootSplash, c'est un couloir d'entrée, pas une surface du CRM. Le CRM
  // reprend la main (et le thème) dès la soumission, au retour sur /dashboard.

  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  /** LA sortie du parcours — en-tête ET écran d'attente. `/login` redirige vers la
   *  vitrine (VitrineLoginRedirect) : c'est le seul départ que le gate ne rattrape
   *  pas, rediriger vers /dashboard reproduirait la boucle P0 c830f9a9. */
  const handleLogout = () => { void signOut().then(() => navigate('/login')) }
  const {
    agency, agencyId, persons, isLoading, isRevalidating, savePerson, saveAgency,
    startIdentityVerification, submit,
  } = useAgencyIdentity()

  const [step, setStep] = useState(preview?.step ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Étape 4 (récapitulatif, tâche 7) : case d'attestation d'exactitude, contrôlée ici
  // comme tout autre brouillon de ce wizard — gate canSubmitIdentity (footer, plus bas).
  const [attestationChecked, setAttestationChecked] = useState(false)

  // Sortie de secours (tâche 8) : true -> <main>/<footer> affichent ExitPendingScreen
  // à la place du wizard, SANS jamais changer de route (cf. en-tête du fichier).
  const [showExitScreen, setShowExitScreen] = useState(preview?.screen === 'exit')

  // Bascule de langue en cours (WizardLanguagePicker). Ne devient un squelette
  // qu'au-delà du seuil : une langue déjà en cache bascule sans rien montrer.
  const [langueEnCours, setLangueEnCours] = useState(false)
  const squeletteLangue = useFlagRetarde(langueEnCours, LANGUAGE_SKELETON_DELAY_MS)

  // Écran d'arrivée : franchi par le bouton Commencer, et seulement pour la durée
  // de la visite. Rien n'est écrit en base pour s'en souvenir — c'est la présence
  // de données (personsCount) qui fait office de mémoire d'un parcours entamé,
  // cf. shouldShowIdentityWelcome.
  const [welcomeDismissed, setWelcomeDismissed] = useState(preview?.screen != null && preview.screen !== 'welcome')
  // Prise UNE fois, sur des données stabilisées, et jamais reposée : `persons`
  // repasse par une liste vide à chaque revalidation, et rejuger à chaque rendu
  // faisait réapparaître l'écran d'arrivée sous les doigts de l'utilisateur.
  // Un aperçu qui NOMME son écran a déjà tranché : 'preparing' veut précisément la
  // décision non prise (null), les autres l'imposent. L'effet ci-dessous s'abstient
  // alors, sans quoi il rejugerait aussitôt sur `persons` et écraserait la consigne.
  const [welcomeDecision, setWelcomeDecision] = useState<boolean | null>(
    preview?.screen == null || preview.screen === 'preparing' ? null : preview.screen === 'welcome',
  )
  useEffect(() => {
    if (preview?.screen) return
    if (welcomeDecision !== null) return
    if (!shouldDecideIdentityWelcome(isLoading, isRevalidating)) return
    setWelcomeDecision(shouldShowIdentityWelcome(persons.length, isLoading, isRevalidating))
  }, [preview?.screen, welcomeDecision, isLoading, isRevalidating, persons.length])
  /**
   * Retour du prestataire d'identité. Le paramètre est POSÉ PAR L'EDGE FUNCTION, pas
   * par nous : `kyb-identity-verify` envoie Stripe sur `${origin}/dashboard/identite?
   * verification=done` (sa constante RETURN_PATH). Il existait donc avant cet écran, et
   * personne ne le lisait.
   *
   * `retourConsomme` le referme dès qu'on en part : sans lui, un F5 après avoir cliqué
   * « Réserver un créneau » ramènerait l'écran de retour à la place de l'étape qu'on
   * vient d'ouvrir. Le paramètre est aussi effacé de l'URL (`replace`), pour que
   * l'historique n'en garde pas trace.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const [retourConsomme, setRetourConsomme] = useState(false)
  /** Le dossier est parti. État local et non une route : sortir d'ici rejouerait la boucle P0. */
  const [soumis, setSoumis] = useState(false)
  const retourVerification = (searchParams.get('verification') === 'done' || preview?.screen === 'verificationReturn')
    && !retourConsomme
  const soumisAffiche = soumis || preview?.screen === 'submitted'
  const quitterRetour = (target: number) => {
    setRetourConsomme(true)
    setSearchParams({}, { replace: true })
    setStep(clampIdentityStep(target, SG_IDENTITY_STEPS.length))
  }

  const ecran = resolveIdentityScreen(welcomeDecision, welcomeDismissed, showExitScreen, retourVerification, soumisAffiche)

  // Rappel borné du statut tant qu'on attend le webhook (cf. RETOUR_SONDAGE_MS).
  // `invalidateQueries` plutôt qu'un refetch exposé par le hook : la clé est déjà
  // publique (`agencyId` l'est aussi), et le contrat de useAgencyIdentity n'a pas à
  // grandir pour un écran. La boucle s'arrête d'elle-même dès que le statut quitte
  // `processing`, la condition étant relue à chaque rendu.
  const statutVerification = persons.find((p) => p.roles.some((r) => r.role === 'signatory'))?.verificationStatus ?? null
  const [sondages, setSondages] = useState(0)
  useEffect(() => {
    if (ecran !== 'verificationReturn') return
    if (statutVerification !== 'processing' && statutVerification !== null) return
    if (sondages >= RETOUR_SONDAGE_MAX) return
    const id = setTimeout(() => {
      setSondages((n) => n + 1)
      void queryClient.invalidateQueries({ queryKey: ['agency-identity-persons', agencyId] })
    }, RETOUR_SONDAGE_MS)
    return () => { clearTimeout(id) }
  }, [ecran, statutVerification, sondages, queryClient, agencyId])

  // Correctif revue tâche 7, point 1 : réinitialise l'attestation dès qu'on QUITTE le
  // récapitulatif, quel que soit le chemin (goToStep — bouton "Modifier" ET stepper de
  // l'en-tête, prev() — bouton Précédent, ou le setStep de handleSubmit après un refus
  // de la RPC) — UN SEUL point de reset plutôt que de dupliquer
  // setAttestationChecked(false) dans chacun de ces appelants (cf. JSDoc de
  // shouldResetAttestationLeavingRecap ci-dessus). previousStepRef porte la valeur de
  // `step` d'AVANT la transition en cours : un useState seul ne connaît que la valeur
  // courante, incapable à lui seul de détecter qu'on est en train de QUITTER l'étape 4.
  const previousStepRef = useRef(step)
  useEffect(() => {
    if (shouldResetAttestationLeavingRecap(previousStepRef.current, step, SG_IDENTITY_STEPS.length)) {
      setAttestationChecked(false)
    }
    previousStepRef.current = step
  }, [step])

  const existingSignatory = useMemo(
    () => persons.find((p) => p.roles.some((r) => r.role === 'signatory')) ?? null,
    [persons],
  )

  // La composition de l'équipe (useTeamMembers) était lue ici pour une seule chose :
  // avertir un dirigeant SEUL que se déclarer autre qu'admin ne retirerait pas ses
  // droits (garde-fou de submit_agency_identity). La réserve a été retirée de l'écran
  // le 9 août 2026 (cf. l'en-tête de StepSignataire), et la lecture avec elle — la
  // garder aurait fait une requête par ouverture du wizard pour une valeur que plus
  // personne n'affiche.

  const [signataire, setSignataireRaw] = useState<SignataireDraft>(EMPTY_SIGNATAIRE_DRAFT)
  const setSignataire = (patch: Partial<SignataireDraft>) => setSignataireRaw((prev) => ({ ...prev, ...patch }))

  // Hydrate le brouillon dès que la personne persistée est connue (chargement
  // initial, ou retour sur le wizard après une fermeture d'onglet — cf. en-tête).
  // Ne se redéclenche que si l'id change : ne doit jamais écraser une saisie en
  // cours avec la même valeur déjà chargée.
  useEffect(() => {
    if (existingSignatory) {
      setSignataireRaw({
        firstName: existingSignatory.firstName,
        lastName: existingSignatory.lastName,
        dateOfBirth: existingSignatory.dateOfBirth,
        nationality: existingSignatory.nationality,
        // Relu depuis la PERSONNE et non depuis son rôle de conformité : le rôle
        // d'organisation vit sur agency_related_persons, pas sur agency_person_roles
        // (cf. migration 20260804170000). Un dossier saisi avant le 4 août 2026 le
        // porte vide et se relit donc sans rôle — l'étape redemande alors la question,
        // ce qui est juste puisqu'elle n'a jamais été posée.
        agencyRole: existingSignatory.agencyRole,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSignatory?.id])

  const [agencyDraft, setAgencyDraftRaw] = useState<AgencyDraft>(EMPTY_AGENCY_DRAFT)
  const setAgencyDraft = (patch: Partial<AgencyDraft>) => setAgencyDraftRaw((prev) => ({ ...prev, ...patch }))

  // Hydrate le brouillon dès que l'agence chargée porte une identité légale déjà
  // saisie (retour sur le wizard après une fermeture d'onglet). Les 8 colonnes de
  // cette étape sont écrites ENSEMBLE par persistCurrentStep (tout ou rien, comme le
  // signataire) : n'importe laquelle suffit comme déclencheur de l'hydratation ;
  // legalFormId est prise pour rester au plus près du motif existingSignatory?.id.
  // `tradeName`/`tva` ne sont volontairement PAS relus : hors du brouillon, ils sont
  // hors de ce parcours (cf. AgencyDraft).
  useEffect(() => {
    if (agency.legalFormId) {
      setAgencyDraftRaw({
        country: agency.country,
        legalFormId: agency.legalFormId,
        legal: agency.legal,
        businessRegistrationNumber: agency.businessRegistrationNumber,
        address: agency.address,
        postal: agency.postal,
        city: agency.city,
        canton: agency.canton,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agency.legalFormId])

  // Étape 3 (tâche 6) : signatoryId vient d'existingSignatory ci-dessus (la personne
  // enregistrée à l'étape 0 de CE wizard) — jamais un id choisi par l'utilisateur, il
  // n'y a qu'un seul signataire saisi par ce parcours. useIdentityDocuments lit
  // Storage directement (aucune colonne DB, cf. son en-tête dans useAgencyIdentity.ts) ;
  // `data` est undefined tant que la query n'a pas résolu, d'où le repli sur un
  // brouillon vide (jamais "complet" par défaut avant d'avoir vraiment vérifié).
  const signatoryId = existingSignatory?.id ?? null
  const [startingVerification, setStartingVerification] = useState(false)
  /**
   * Le dirigeant a déclaré que sa pièce ne peut pas être vérifiée en ligne. Un état
   * local et non une colonne : ce n'est pas un verdict sur son identité, seulement le
   * chemin qu'il emprunte pour cette visite. Ce que la base retiendra, c'est la ligne
   * de check `pending_manual_review` posée à la soumission — la même que le dépôt
   * aurait produite, sans la pièce.
   */
  const [blockedDeclared, setBlockedDeclared] = useState(false)
  /**
   * Pourquoi la vérification n'a pas pu s'ouvrir, quand c'est un ÉCHEC qui a produit la
   * bascule et non le choix du dirigeant. `null` sur un passage volontaire au dépôt :
   * il n'y a alors rien à expliquer. Effacé au retour vers la carte, sinon la phrase
   * survivrait à la situation qu'elle décrit.
   */
  const [startFailure, setStartFailure] = useState<VerificationStartFailure | null>(null)

  const pieceIdentiteDraft: PieceIdentiteDraft = {
    verificationStatus: existingSignatory?.verificationStatus ?? null,
    documentType: null,
    recto: null,
    verso: null,
  }

  /**
   * Ouvre la vérification d'identité chez Stripe et y envoie le dirigeant.
   *
   * La navigation est un `location.href` et non un `navigate()` : la cible est un
   * domaine Stripe, pas une route de l'app. Le retour se fait par `return_url`, et le
   * VERDICT par webhook — l'utilisateur peut abandonner en route sans rien casser.
   *
   * Un échec ne rend pas d'erreur rouge : il bascule sur le dépôt manuel, qui existe
   * précisément pour les cas que le prestataire ne sait pas traiter. Un bouton mort
   * serait pire qu'un chemin plus long.
   *
   * ⚠ Mais la bascule ne se fait plus en SILENCE. Sans un mot, l'écran remplace le
   * bouton qu'on vient d'actionner par un formulaire de fichier, et le dirigeant en
   * conclut que la vérification n'existe pas — constaté le 04.08.2026, sur un échec
   * réseau qui n'avait rien à voir avec le produit. La cause est donc mémorisée
   * (`startFailure`), dite à l'écran, et le retour vers la carte reste ouvert.
   */
  const handleStartVerification = async (): Promise<void> => {
    if (!signatoryId) return
    setStartingVerification(true)
    try {
      const started = await startIdentityVerification(signatoryId)
      if (started.url) { window.location.href = started.url; return }
      setStartFailure(started.failure)
    } catch {
      // Rejet imprévu (hors du contrat du hook) : même traitement que la requête qui
      // n'est jamais partie, c'est ce que l'utilisateur constate de toute façon.
      setStartFailure('unexpected')
    } finally {
      setStartingVerification(false)
    }
  }




  /**
   * Verdict de l'étape rendez-vous, remonté par OcBooking : un rendez-vous est-il pris,
   * et y a-t-il seulement quelque chose à réserver ? `null` tant que l'étape n'a pas
   * rendu (première lecture des créneaux en cours) — l'avancement est alors bloqué,
   * cf. isRendezVousStepComplete.
   *
   * Un état de la COQUILLE et non de l'étape, pour la même raison que tous les autres
   * brouillons de ce fichier : c'est lui qui gate le bouton Continuer du pied de page,
   * lequel vit ici. L'étape, elle, ne détient rien.
   */
  const [rendezVous, setRendezVous] = useState<OcBookingState | null>(null)

  /**
   * Le créneau RETENU à l'étape 4 — un brouillon en MÉMOIRE, jamais en base : la
   * réservation n'existe qu'à la soumission (décision client du 15.08.2026, cf.
   * l'en-tête du fichier). Fermer l'onglet le perd, et c'est acceptable : rechoisir
   * un créneau prend dix secondes, tandis qu'une réservation orpheline (dossier
   * jamais soumis) engageait un hôte, un e-mail et un lien de visioconférence.
   */
  const [rdvChoice, setRdvChoice] = useState<OcBookingChoice | null>(null)
  const bookOnSubmit = useBookOnboardingCall()
  /** La réservation faite PAR la soumission — l'écran de sortie la lit en direct,
   *  sans attendre le refetch de la query ['onboarding-call']. */
  const [reservationSoumise, setReservationSoumise] = useState<{ scheduled_at: string; meeting_url: string | null } | null>(null)
  /** Le créneau retenu n'a pas pu être réservé à la soumission (pris entre-temps,
   *  ou edge injoignable) : le dossier, lui, est parti — l'écran de sortie le dit. */
  const [reservationEchouee, setReservationEchouee] = useState(false)

  // Le rendez-vous tel qu'il est EN BASE, pour la relecture du récapitulatif. Distinct
  // de `rendezVous` ci-dessus, qui n'est qu'un verdict de franchissement : ici il faut
  // la date, la durée et l'hôte. Même requête (clé ['onboarding-call', agencyId]) que
  // celle d'OcBooking à l'étape 3, donc servie par le cache et déjà à jour au moment où
  // le récapitulatif s'affiche — la réservation invalide cette clé.
  const bookedCall = useMyOnboardingCall()
  const rendezVousTimezone = useMemo(() => browserTimezone(), [])

  const canNext = canAdvanceFromIdentityStep(step, signataire, agencyDraft, pieceIdentiteDraft, blockedDeclared, rendezVous, rdvChoice)

  /** Enveloppe commune à chaque étape persistable : bascule saving/error autour de
   *  l'opération d'écriture réelle (savePerson ou saveAgency selon l'étape).
   *  Extrait de l'ancien corps inline de persistCurrentStep pour éviter de dupliquer
   *  ce triptyque try/catch/finally à chaque étape persistable ajoutée par les
   *  tâches 4 à 7 — comportement inchangé pour l'étape 0. Le succès n'allume plus
   *  aucun témoin (retiré le 02.08.2026) : il fait avancer l'étape, ce qui EST le
   *  signal. */
  const runPersist = async (save: () => Promise<unknown>): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      await save()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : t('wizard.footer.unknownError'))
      return false
    } finally {
      setSaving(false)
    }
  }

  /**
   * Persiste l'étape qu'on est en train de QUITTER (appelée par next(), prev() ET
   * le clic sur un palier du header) — c'est ce qui garantit qu'aucune étape
   * validée n'est perdue à la fermeture de l'onglet. Renvoie false si l'étape est
   * incomplète (bloque next(), n'empêche jamais prev()).
   */
  const persistCurrentStep = async (): Promise<boolean> => {
    // Aperçu dev : rien à écrire, et surtout rien à faire échouer (cf. IdentityShellPreview).
    if (preview?.skipPersist) return true
    if (step === 0) {
      if (!isSignataireStepComplete(signataire)) return false
      return runPersist(() => savePerson(
        {
          id: existingSignatory?.id ?? null,
          firstName: signataire.firstName,
          lastName: signataire.lastName,
          dateOfBirth: signataire.dateOfBirth,
          nationality: signataire.nationality,
          agencyRole: signataire.agencyRole,
        },
        [{
          role: 'signatory',
          // Le rôle de CONFORMITÉ reste écrit — la RPC de soumission exige un
          // signataire actif — mais sans pouvoir de signature depuis le 4 août 2026 :
          // la question n'est plus posée, et la colonne est nullable. Écrire `null`
          // plutôt que d'omettre la clé est délibéré : buildRolePayload étale le
          // payload sur la ligne existante, donc une clé absente laisserait en place
          // un pouvoir saisi lors d'un passage antérieur, que plus aucun écran
          // n'affiche ni ne permet de corriger.
          signaturePower: null,
          ownershipPct: null,
          // Non demandé à cette étape (le PEP se déclare pour les bénéficiaires
          // effectifs, étape 3 / tâche 5) — la colonne défaut déjà à false.
          pepSelfDeclared: false,
        }],
      ))
    }
    if (step === 1) {
      if (!isAgencyStepComplete(agencyDraft)) return false
      return runPersist(async () => {
        // Étale le brouillon sur `agency` chargé : les champs hors étape 2 (name,
        // phone, email, website, logoUrl, foundedYear, aboutShort) ne sont jamais
        // touchés par ce wizard, save() les réécrit pourtant tous à chaque appel
        // (contrat de useAgencySettings) — d'où l'étalement plutôt qu'un patch.
        await saveAgency({ ...agency, ...agencyDraft })
      })
    }
    if (step === 2) {
      // Rien à écrire ici (cf. en-tête de StepPieceIdentite.tsx) : le fichier est déjà
      // durablement dans Storage au moment où l'utilisateur clique Continuer — cette
      // étape ne fait que revérifier sa complétude, comme canNext l'a déjà fait pour
      // activer le bouton (garde défensive redondante, même style que les étapes 0 et 1).
      return isPieceIdentiteStepComplete(pieceIdentiteDraft, blockedDeclared)
    }
    if (step === 3) {
      // Rien à écrire ici : le créneau retenu (`rdvChoice`) est un brouillon en
      // MÉMOIRE de cette coquille, par conception — la base ne connaît la réservation
      // qu'à la soumission (cf. handleSubmit). Garde défensive redondante avec
      // canNext, même style que l'étape 2.
      return isRendezVousStepComplete(rendezVous, rdvChoice)
    }
    // Étape 5 (récapitulatif) : rien à persister en QUITTANT l'étape — l'attestation
    // n'est pas un brouillon à écrire en base, et la soumission elle-même est une
    // action explicite distincte (handleSubmit, plus bas), jamais déclenchée par
    // next()/prev()/goToStep(). C'est pourquoi prev() depuis le récapitulatif n'envoie
    // jamais rien à submit_agency_identity() : seul un clic sur Soumettre le fait.
    return true
  }

  /**
   * Sortie de secours (tâche 8) — « Reprendre plus tard ». Persiste au mieux l'étape
   * courante, même geste que prev() (résultat ignoré : une étape incomplète n'est de
   * toute façon jamais écrite partiellement, cf. persistCurrentStep ci-dessus), efface
   * une éventuelle bannière d'erreur devenue hors-sujet, puis bascule sur l'écran
   * d'attente — SANS jamais naviguer (cf. en-tête du fichier pour la raison).
   */
  const handleExit = async (): Promise<void> => {
    if (saving) return
    await persistCurrentStep()
    setError(null)
    setShowExitScreen(true)
  }

  /**
   * Soumission finale (étape 4, récapitulatif) — jamais via persistCurrentStep/
   * runPersist : contrairement aux étapes 0 à 3, un refus ici doit (1) ramener
   * l'utilisateur à l'étape fautive (identitySubmissionErrorStep, un message Postgres
   * distinct par cause posé par la RPC — 20260728108000) et (2) ne JAMAIS afficher ce
   * message brut à l'écran (règle du projet) — toujours une traduction dédiée par
   * cause, jamais le message générique de runPersist qui propagerait e.message tel quel.
   *
   * p_related_person_id = signatoryId : LE signataire dont la pièce d'identité a été
   * déposée à l'étape précédente (même id que celui déjà utilisé pour le
   * téléversement/la lecture via useIdentityDocuments, plus haut) — jamais une
   * redérivation implicite depuis `persons`, qui pourrait désigner une autre personne si
   * plusieurs portent un rôle signatory actif (signature_power='joint', cf. le
   * commentaire de la RPC). Sans cet argument, la RPC soumettrait quand même le dossier
   * mais ne poserait jamais la ligne de vérification de la pièce déposée — c'est
   * précisément ce que cette tâche câble (cf. l'en-tête du fichier).
   */
  const handleSubmit = async (): Promise<void> => {
    if (!canSubmitIdentity(attestationChecked, signatoryId) || saving) return
    setSaving(true)
    setError(null)
    try {
      await submit(signatoryId)
      // La réservation part MAINTENANT, après le dossier — jamais avant (décision
      // client du 15.08.2026) : le lien de visioconférence et l'e-mail de confirmation
      // n'existent que pour un dossier soumis. Dans un try/catch À PART : le dossier
      // est déjà parti, un créneau pris entre-temps ou une edge injoignable ne doit
      // pas se présenter comme un échec de soumission ni rejouer submit() — l'écran
      // de sortie le dit, et l'écran /dashboard/rendez-vous-accueil sert à rechoisir.
      if (rdvChoice && !bookedCall.data) {
        try {
          const reservation = await bookOnSubmit.mutateAsync({
            slot: rdvChoice.slot,
            phone: rdvChoice.phone,
            note: rdvChoice.note,
            answers: rdvChoice.answers,
          })
          setReservationSoumise({ scheduled_at: reservation.scheduled_at, meeting_url: reservation.meeting_url })
        } catch {
          setReservationEchouee(true)
        }
      }
      // Le parcours se ferme sur un écran, plus sur une redirection muette vers
      // /dashboard (choix du 04.08.2026, renversé le 10.08). Le dirigeant vient de
      // soumettre un dossier de conformité : lui dire ce qu'il devient, et où a lieu
      // son rendez-vous, vaut mieux que de l'éjecter dans un CRM vide.
      setSoumis(true)
      return
      // Le dashboard, désormais — et non plus l'écran de réservation. Ce détour
      // existait parce qu'une agence qui venait de soumettre son dossier atterrissait
      // dans un CRM vide sans que personne chez MEGGA ne la contacte ; depuis le 4 août
      // 2026 le rendez-vous est une ÉTAPE du parcours (index 3), pris avant le
      // récapitulatif et relu dedans. Y renvoyer après coup ferait redemander ce qui
      // vient d'être fait. La route survit pour les agences passées avant, cf. l'en-tête
      // de OnboardingCallPage.tsx.
      navigate('/dashboard')
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : ''
      const code = identitySubmissionErrorCode(rawMessage)
      const targetStep = identitySubmissionErrorStep(code)
      if (targetStep != null) setStep(targetStep)
      setError(t(`wizard.recap.errors.${code ?? 'generic'}`))
    } finally {
      // Revue finale (lot 4) : sans ce finally, setSaving(false) ne vivait que dans le
      // catch. Sans effet aujourd'hui (le succès démonte le composant via navigate()
      // avant qu'un futur rendu ne lise `saving`), mais une régression qui ajouterait un
      // chemin de sortie sans erreur laisserait le bouton Soumettre désactivé
      // indéfiniment. Même triptyque try/catch/finally que runPersist ci-dessus.
      setSaving(false)
    }
  }

  const next = async () => {
    if (!canNext || saving) return
    if (!(await persistCurrentStep())) return
    setStep((s) => clampIdentityStep(s + 1, SG_IDENTITY_STEPS.length))
  }
  const prev = async () => {
    if (saving) return
    await persistCurrentStep()
    setStep((s) => clampIdentityStep(s - 1, SG_IDENTITY_STEPS.length))
  }
  const goToStep = async (target: number) => {
    if (target === step || target > step || saving) return // seuls les paliers déjà visités sont accessibles
    await persistCurrentStep()
    setStep(clampIdentityStep(target, SG_IDENTITY_STEPS.length))
  }

  // L'écran d'arrivée remplace la coquille ENTIÈRE : ni stepper, ni pied de page,
  // ni fond Sugar. Il porte la peau de la vitrine (cf. son en-tête), et la bascule
  // vers Sugar se fait au clic sur Commencer. Placé APRÈS tous les hooks — un
  // retour anticipé au-dessus d'eux changerait leur ordre d'un rendu à l'autre.
  if (ecran === 'submitted') {
    return (
      <IdentitySubmittedScreen
        // La réservation faite par la soumission d'abord (lecture directe, sans
        // attendre le refetch), sinon un rendez-vous antérieur en base (agence
        // repassée par le wizard), sinon rien.
        rendezVous={reservationSoumise ?? bookedCall.data ?? null}
        bookingFailed={reservationEchouee}
        timezone={rendezVousTimezone}
        onEnter={() => navigate('/dashboard')}
      />
    )
  }
  if (ecran === 'preparing') return <IdentityPreparingScreen />
  if (ecran === 'verificationReturn') {
    return (
      <IdentityVerificationReturnScreen
        status={existingSignatory?.verificationStatus ?? null}
        // Le nom DÉCLARÉ, jamais celui lu par le prestataire : il ne nous en reste
        // aucune trace stockable (cf. l'en-tête de l'écran). Repli sur l'e-mail du
        // compte plutôt qu'une ligne vide — mieux vaut une adresse qu'un sceau posé
        // sur rien, sur l'écran qui doit nommer la personne vérifiée.
        fullName={[existingSignatory?.firstName, existingSignatory?.lastName]
          .filter(Boolean).join(' ').trim() || (user?.email ?? '')}
        onBook={() => quitterRetour(INDEX_ETAPE_RENDEZ_VOUS)}
        onRetryDocument={() => quitterRetour(INDEX_ETAPE_PIECE_IDENTITE)}
      />
    )
  }
  if (ecran === 'welcome') {
    return (
      <IdentityWelcomeScreen
        onStart={() => setWelcomeDismissed(true)}
        onLater={() => setShowExitScreen(true)}
      />
    )
  }

  return (
    <MeggaX>
      {/* `full-height-page` : sans elle, un contenu court (écran d'attente) laisse
          une bande blanche sous le canvas — le noir vient du conteneur, pas du body.
          `mx-appshell` la PLAFONNE à la hauteur de la fenêtre (elle n'en pose que le
          plancher) : en-tête, rail d'étapes et pied d'actions cessent de défiler,
          seule la zone d'étape le fait. Voir le point 7 de megga-x-additions.css
          pour les mesures qui l'ont motivé. */}
      <div className="page-wrapper full-height-page mx-appshell">
        {/* L'état du dossier EN PREMIER, au-dessus même du logo : c'est la première
            chose qu'un dirigeant doit lire quand son dossier lui revient corrigé, avant
            de chercher où reprendre. Sous l'en-tête, il se lisait comme un sous-titre du
            parcours ; au-dessus, il le qualifie.

            Et toujours DANS la coquille, jamais par-dessus : `.mx-appshell` réclame
            `100dvh`, donc tout ce qui s'empile au-dessus d'elle pousse le pied d'actions
            sous le bord de la fenêtre — c'est le défaut du 04.08.2026. Ici le bandeau
            partage cette hauteur au lieu de s'y ajouter.

            Rend `null` dans le cas courant : une agence dont le dossier n'est pas bloqué
            ne voit rien du tout. */}
        <LabGuardBanner />

        {/* Même en-tête que l'écran d'arrivée et que les pages d'authentification de
            la vitrine : l'agent ne doit pas sentir de rupture entre le lien reçu par
            e-mail et la saisie. Logo non cliquable — il est connecté, la vitrine
            n'est plus une destination. */}
        <div className="header pd-medium-top-and-bottom">
          <div className="container-default w-container">
            <div className="flex-horizontal space-between">
              <div className="header-logo">
                <img src="/megga-logo.svg" alt="MEGGA" />
              </div>
              <div className="flex-horizontal gap-24px---wrap-down">
                {/* Toujours visible, y compris sur l'écran d'attente : c'est la seule
                    sortie de langue du parcours (les Réglages sont derrière ce gate). */}
                <WizardLanguagePicker onPending={setLangueEnCours} />
                {/* Sortie de secours : masquée sur l'écran d'attente lui-même — on y est
                    déjà « sorti », son bouton principal est Reprendre la saisie. */}
                {!showExitScreen && (
                  <MxLink onClick={() => { if (!saving) void handleExit() }} disabled={saving}>
                    {t('wizard.footer.exit')}
                  </MxLink>
                )}
                {/* `common:nav.logout` et non `common:logout` : la clé racine n'existe
                    pas, l'ancien appel affichait le mot « logout » en clair. */}
                <MxLink onClick={handleLogout}>
                  {t('common:nav.logout')}
                </MxLink>
              </div>
            </div>
          </div>
        </div>

        {/* `.section` seule vaut 200 px de respiration haut et bas : c'est le
            gabarit des sections marketing de la vitrine, pas d'un formulaire de
            dix champs. Les deux paddings tombent à 0 depuis que la coquille est
            plafonnée : dans une page qui défile ils ne coûtaient qu'un peu de
            déroulé, dans une fenêtre ils prennent 144 px À L'ÉTAPE, la seule
            chose ici dont la place manque. La respiration vient de ce que
            l'en-tête et le pied portent déjà (40 px sous le logo, 24 px autour
            des boutons). `mx-shellbody` fait de cette section, et de son
            conteneur, la colonne qui se partage la hauteur restante. */}
        <section className="section pd-top-0 pd-bottom-0 mx-grow mx-shellbody">
          <div className="container-default w-container">
            {/* Numérotation directe depuis SG_IDENTITY_STEPS : le rail n'a plus de
                palier à masquer depuis le retrait de l'étape bénéficiaires, seule
                étape conditionnelle qu'ait connue ce parcours (cf. tokens.ts). */}
            <nav className="mx-stepper" aria-label={t('wizard.steps.ariaLabel')}>
              {SG_IDENTITY_STEPS.map((s, i) => {
                // !showExitScreen : un palier ne doit jamais paraître cliquable pendant que
                // l'écran d'attente (sortie de secours, tâche 8) est affiché — sinon un clic
                // changerait `step` sans jamais faire réapparaître le wizard (ExitPendingScreen
                // reste rendu tant que showExitScreen n'est pas remis à faux), interaction morte.
                const clickable = i < step && !saving && !showExitScreen
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { if (clickable) void goToStep(i) }}
                    disabled={!clickable}
                    aria-current={i === step ? 'step' : undefined}
                    className={cn(
                      'mx-stepper__step',
                      i === step && 'mx-stepper__step--current',
                      clickable && 'mx-stepper__step--done',
                    )}
                  >
                    {i + 1}. {s.label}
                  </button>
                )
              })}
            </nav>

            {/* Le SEUL élément qui défile du parcours (`mx-scrollarea`) : le rail
                d'étapes au-dessus et le pied d'actions en dessous restent à
                l'écran quelle que soit la longueur de l'étape.
                Le `key` porte ici une seconde charge, en plus de repartir d'un
                sous-arbre neuf : c'est lui qui remet le défilement en haut à
                chaque changement d'étape — un nœud remonté naît à scrollTop 0.
                Tant que le défilement vivait sur la FENÊTRE, rien ne le
                ramenait, et quitter une étape déroulée jusqu'en bas faisait
                atterrir au milieu de la suivante. Le retirer réintroduirait ce
                défaut : aucun effet ne le rattrape ailleurs. */}
            <main key={showExitScreen ? 'exit' : step} className="mg-top-medium mx-scrollarea">
              {isLoading ? (
                <div className="text-center" role="status" aria-live="polite">
                  <p className="paragraph-large">{t('gate.shell.preparing')}</p>
                </div>
              ) : squeletteLangue ? (
                // AVANT les étapes, APRÈS le chargement initial : une bascule de
                // langue ne doit pas effacer l'écran d'attente du premier
                // chargement, qui dit autre chose. Le brouillon de l'étape vit
                // dans IdentityShell, pas dans l'étape démontée ici : rien de
                // saisi ne se perd le temps du squelette.
                <StepSkeleton label={t('wizard.header.languageLoading')} />
              ) : showExitScreen ? (
          <ExitPendingScreen onResume={() => setShowExitScreen(false)} onLogout={handleLogout} />
        ) : step === 0 ? (
          <StepSignataire value={signataire} onChange={setSignataire} />
        ) : step === 1 ? (
          <StepAgence value={agencyDraft} onChange={setAgencyDraft} />
        ) : step === 2 ? (
          <StepPieceIdentite
            verificationStatus={pieceIdentiteDraft.verificationStatus}
            verificationErrorCode={existingSignatory?.verificationErrorCode ?? null}
            startingVerification={startingVerification}
            startFailure={startFailure}
            // Un refus SANS RECOURS ouvre la sortie de lui-même : réessayer chez le
            // prestataire rendrait le même refus, et attendre que le dirigeant déclare
            // ce que le système sait déjà ferait de l'étape un cul-de-sac.
            blockedDeclared={blockedDeclared
              || verificationNeedsManualFallback(existingSignatory?.verificationErrorCode ?? null)}
            disabled={!signatoryId}
            onStartVerification={() => { void handleStartVerification() }}
            // Un refus SANS RECOURS ouvre la sortie tout seul : réessayer chez le
            // prestataire rendrait le même refus, et laisser l'écran inchangé ferait
            // de l'étape un cul-de-sac. Le dirigeant n'a pas à deviner qu'il doit
            // déclarer lui-même ce que le système sait déjà.
            onDeclareBlocked={() => setBlockedDeclared(true)}
            onUndeclareBlocked={() => setBlockedDeclared(false)}
          />
        ) : step === 3 ? (
          // `setRendezVous`/`setRdvChoice` sont stables (setters de useState) : OcBooking peut donc
          // les appeler dans un effet sans risque de boucle, cf. son en-tête.
          <StepRendezVous onStateChange={setRendezVous} choice={rdvChoice} onChoiceChange={setRdvChoice} />
        ) : step === 4 ? (
          <StepRecapitulatif
            signataire={signataire}
            agencyDraft={agencyDraft}
            documentType={null}
            verificationStatus={pieceIdentiteDraft.verificationStatus}
            // Ce que le PRESTATAIRE a établi, relu depuis la personne : la nature de la
            // pièce qu'il a lue et l'instant du verdict. Ni l'une ni l'autre n'est
            // déclarée — c'est ce qui les rend dignes d'une relecture de conformité.
            verifiedDocumentType={existingSignatory?.idDocumentType ?? null}
            verifiedAt={existingSignatory?.verifiedAt ?? null}
            recto={null}
            verso={null}
            identityRead={existingSignatory?.idDocumentRead ?? null}
            identityDocumentsLoading={false}
            identityDocumentsError={false}
            // Un rendez-vous EN BASE (agence repassée par le wizard après une
            // réservation) l'emporte sur le créneau seulement retenu : c'est la
            // réalité contre l'intention. Le créneau retenu, lui, vit en mémoire —
            // la base ne le connaîtra qu'à la soumission (cf. handleSubmit).
            rendezVous={bookedCall.data ?? null}
            rendezVousChoisi={rdvChoice}
            rendezVousTimezone={rendezVousTimezone}
            attestationChecked={attestationChecked}
            onAttestationChange={setAttestationChecked}
            onEditStep={(target) => { void goToStep(target) }}
          />
              ) : null}
            </main>

            {/* Bannière d'erreur : au-dessus du pied d'actions, pas en surimpression
                flottante — c'est la place que lui donne la vitrine (`.error-message`,
                pavé rouge plein), et elle pousse le contenu au lieu de le masquer. */}
            {error && (
              <div className="mg-top-small">
                <div className="error-message" role="alert">{error}</div>
              </div>
            )}

            {/* Sortie de secours (tâche 8) : le pied d'actions (Continuer/Précédent/
                Soumettre) n'a aucun sens pendant l'écran d'attente — ExitPendingScreen
                porte son propre bouton principal (Reprendre la saisie). L'en-tête reste
                en revanche affiché dans les deux cas. */}
            {!showExitScreen && (
              <div className="mx-actionbar mg-top-small">
                {/* Aucun témoin de sauvegarde : la persistance à chaque changement
                    d'étape (persistCurrentStep, appelée par next/prev/goToStep) reste
                    entière, elle se fait simplement sans le dire. Un dirigeant qui
                    remplit un formulaire de conformité n'a pas à surveiller un voyant
                    vert ; ce qui compte est que fermer l'onglet ne perde rien, et ça
                    n'a pas changé. */}
                <div className="flex-horizontal gap-16px">
                  {step > 0 && (
                    <MxButton type="button" variant="secondary" size="small" onClick={() => { void prev() }} disabled={saving}>
                      {t('common:actions.previous')}
                    </MxButton>
                  )}
                </div>

                <div>
                  {step < SG_IDENTITY_STEPS.length - 1 ? (
                    <MxButton type="button" onClick={() => { void next() }} disabled={!canNext || saving}>
                      {saving ? t('wizard.footer.saving') : t('wizard.footer.continue')}
                    </MxButton>
                  ) : (
                    // Dernière étape (récapitulatif) : Soumettre remplace Continuer — gate
                    // sur l'attestation ET un signataire réellement désigné
                    // (canSubmitIdentity), jamais sur canNext (toujours false ici).
                    <MxButton type="button" onClick={() => { void handleSubmit() }} disabled={!canSubmitIdentity(attestationChecked, signatoryId) || saving}>
                      {saving ? t('wizard.footer.submitting') : t('wizard.footer.submit')}
                    </MxButton>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </MeggaX>
  )
}
