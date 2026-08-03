/**
 * Wizard « Identité légale » (KYB) — coquille, navigation, persistance, soumission.
 * Rendu par la route /dashboard/identite (src/pages/agent/IdentitySugarPage.tsx),
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
 * QUATRE étapes, toutes avec un écran réel : 0 (StepSignataire), 1 (StepAgence),
 * 2 (StepPieceIdentite) et 3 (StepRecapitulatif — relecture de tout ce qui a été
 * saisi, attestation d'exactitude, soumission finale). La soumission (handleSubmit,
 * plus bas) N'EST PAS un bloc de persistCurrentStep comme les précédents : c'est une
 * action explicite distincte, déclenchée par le bouton Soumettre du pied de page,
 * jamais par next()/prev()/goToStep() — voir le dernier cas de persistCurrentStep
 * (étape 3 : rien à y persister) et le commentaire d'en-tête de handleSubmit.
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
import { useNavigate } from 'react-router-dom'
import { SG_IDENTITY_STEPS } from './tokens'
import { switchLanguage } from '@/i18n'
import { MeggaX, MxButton, MxLink } from '@/components/megga-x'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgencyIdentity, useIdentityDocuments, validateIdentityDocumentFile,
  type IdentityDocumentSide,
} from '@/hooks/useAgencyIdentity'
import type { AgencySettingsData } from '@/hooks/useAgencySettings'
import { StepSignataire } from './steps/StepSignataire'
import { StepAgence } from './steps/StepAgence'
import { StepPieceIdentite } from './steps/StepPieceIdentite'
import { StepRecapitulatif } from './steps/StepRecapitulatif'

/** Brouillon local de l'étape 1, contrôlé par IdentityShell (cf. en-tête de StepSignataire). */
export interface SignataireDraft {
  firstName: string
  lastName: string
  dateOfBirth: string | null
  nationality: string | null
  signaturePower: 'individual' | 'joint' | null
}

/** Brouillon vide — état initial avant hydratation depuis une personne déjà persistée. */
// eslint-disable-next-line react-refresh/only-export-components -- constante partagée avec StepSignataire/les tests, même motif que useTheme.tsx.
export const EMPTY_SIGNATAIRE_DRAFT: SignataireDraft = {
  firstName: '',
  lastName: '',
  dateOfBirth: null,
  nationality: null,
  signaturePower: null,
}

/**
 * true si les 5 champs de l'étape signataire sont renseignés. Gate le bouton
 * Continuer ET la tentative de sauvegarde (persistCurrentStep) : les colonnes DB
 * sont nullable, mais un signataire sans pouvoir de signature ni date de
 * naissance n'est pas une saisie complète du point de vue du parcours KYB.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que useIdentityGate.ts.
export function isSignataireStepComplete(draft: SignataireDraft): boolean {
  return (
    draft.firstName.trim() !== ''
    && draft.lastName.trim() !== ''
    && draft.dateOfBirth != null
    && draft.nationality != null
    && draft.signaturePower != null
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
 * Brouillon local de l'étape 4 (tâche 6), contrôlé par IdentityShell comme les étapes
 * précédentes — mais ce n'est PAS un brouillon au même sens : `recto`/`verso` sont les
 * chemins Storage déjà téléversés (useIdentityDocuments), jamais une saisie en
 * attente. IdentityShell le reconstruit à chaque rendu depuis ce hook plutôt que de
 * porter un `useState` dédié : le fichier lui-même est la source de vérité, il n'y a
 * rien d'autre à mémoriser côté client (cf. en-tête de StepPieceIdentite.tsx).
 */
export interface PieceIdentiteDraft {
  recto: string | null
  verso: string | null
}

/** Brouillon vide — aucun des deux côtés encore téléversé. */
// eslint-disable-next-line react-refresh/only-export-components -- constante partagée avec les tests, même motif que EMPTY_SIGNATAIRE_DRAFT.
export const EMPTY_PIECE_IDENTITE_DRAFT: PieceIdentiteDraft = {
  recto: null,
  verso: null,
}

/**
 * true si RECTO ET VERSO sont tous deux téléversés : aucune valeur par défaut n'est
 * acceptable ici, l'étape existe précisément pour collecter les deux faces de la
 * pièce d'identité du signataire, et tant que l'une manque le dossier KYB reste
 * incomplet.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isAgencyStepComplete.
export function isPieceIdentiteStepComplete(draft: PieceIdentiteDraft): boolean {
  return draft.recto != null && draft.verso != null
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
 * true si l'étape `step` autorise une navigation avant (bouton Continuer du pied de
 * page). Les étapes 0 (StepSignataire), 1 (StepAgence) et 2 (StepPieceIdentite) ont un
 * écran réel — gate sur leur complétude respective. L'étape 3 (récapitulatif,
 * StepRecapitulatif) renvoie toujours `false` ici pour une raison différente : c'est la
 * DERNIÈRE étape, il n'existe pas de « suivante » vers laquelle avancer — le pied de
 * page n'y affiche d'ailleurs jamais de bouton Continuer (cf. le rendu du footer plus
 * bas), seulement Soumettre, qui gate sur l'attestation d'exactitude et non sur ce
 * booléen (canSubmitIdentity, plus bas).
 *
 * Revue tâche 3 : `canNext` valait `true` sans condition dès step > 0 — le bouton
 * Continuer du pied de page restait cliquable sur ces paliers vides jusqu'au
 * récapitulatif, sans que rien n'ait été renseigné. Le stepper du header respectait
 * déjà la règle (goToStep refuse toute cible > step, cf. plus bas), mais le rapport de
 * la tâche affirmait à tort que c'était vrai aussi du bouton du pied de page.
 *
 * `pieceIdentite` est un paramètre optionnel à défaut vide, pour que les appels
 * antérieurs restent valides sans le 4e argument — mais un brouillon vide y est
 * INCOMPLET (isPieceIdentiteStepComplete), jamais une réponse légitime : recto et verso
 * sont tous deux exigés pour avancer.
 *
 * L'étape « bénéficiaires effectifs » occupait l'index 2 jusqu'au 3 août 2026 ; les
 * indices 2 et 3 désignent depuis la pièce d'identité et le récapitulatif (cf. le
 * commentaire de SG_IDENTITY_STEPS, tokens.ts).
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete/clampIdentityStep.
export function canAdvanceFromIdentityStep(
  step: number,
  signataire: SignataireDraft,
  agency: AgencyDraft,
  pieceIdentite: PieceIdentiteDraft = EMPTY_PIECE_IDENTITE_DRAFT,
): boolean {
  if (step === 0) return isSignataireStepComplete(signataire)
  if (step === 1) return isAgencyStepComplete(agency)
  if (step === 2) return isPieceIdentiteStepComplete(pieceIdentite)
  return false
}

/**
 * Étape 4 (récapitulatif, tâche 7) : causes de refus reconnues dans le message brut
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
export type IdentityScreen = 'preparing' | 'welcome' | 'wizard'

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
): IdentityScreen {
  if (welcomeDecision === null) return 'preparing'
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

/** Coquille du wizard identité : chrome, navigation entre étapes, persistance au changement d'étape. */
export default function IdentityShell() {
  const { t } = useTranslation('onboarding')
  // Aucune lecture de `useTheme()` ici, et c'est délibéré : ce parcours porte la
  // peau de la vitrine, qui n'existe qu'en une polarité (fond #030303). Il ne
  // suit donc pas la préférence clair/sombre de l'agent — comme l'écran d'arrivée
  // et BootSplash, c'est un couloir d'entrée, pas une surface du CRM. Le CRM
  // reprend la main (et le thème) dès la soumission, au retour sur /dashboard.

  const { signOut } = useAuth()
  const navigate = useNavigate()
  /** LA sortie du parcours — en-tête ET écran d'attente. `/login` redirige vers la
   *  vitrine (VitrineLoginRedirect) : c'est le seul départ que le gate ne rattrape
   *  pas, rediriger vers /dashboard reproduirait la boucle P0 c830f9a9. */
  const handleLogout = () => { void signOut().then(() => navigate('/login')) }
  const {
    agency, agencyId, persons, isLoading, isRevalidating, savePerson, saveAgency, uploadIdentityDocument, submit,
  } = useAgencyIdentity()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Étape 4 (récapitulatif, tâche 7) : case d'attestation d'exactitude, contrôlée ici
  // comme tout autre brouillon de ce wizard — gate canSubmitIdentity (footer, plus bas).
  const [attestationChecked, setAttestationChecked] = useState(false)

  // Sortie de secours (tâche 8) : true -> <main>/<footer> affichent ExitPendingScreen
  // à la place du wizard, SANS jamais changer de route (cf. en-tête du fichier).
  const [showExitScreen, setShowExitScreen] = useState(false)

  // Bascule de langue en cours (WizardLanguagePicker). Ne devient un squelette
  // qu'au-delà du seuil : une langue déjà en cache bascule sans rien montrer.
  const [langueEnCours, setLangueEnCours] = useState(false)
  const squeletteLangue = useFlagRetarde(langueEnCours, LANGUAGE_SKELETON_DELAY_MS)

  // Écran d'arrivée : franchi par le bouton Commencer, et seulement pour la durée
  // de la visite. Rien n'est écrit en base pour s'en souvenir — c'est la présence
  // de données (personsCount) qui fait office de mémoire d'un parcours entamé,
  // cf. shouldShowIdentityWelcome.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  // Prise UNE fois, sur des données stabilisées, et jamais reposée : `persons`
  // repasse par une liste vide à chaque revalidation, et rejuger à chaque rendu
  // faisait réapparaître l'écran d'arrivée sous les doigts de l'utilisateur.
  const [welcomeDecision, setWelcomeDecision] = useState<boolean | null>(null)
  useEffect(() => {
    if (welcomeDecision !== null) return
    if (!shouldDecideIdentityWelcome(isLoading, isRevalidating)) return
    setWelcomeDecision(shouldShowIdentityWelcome(persons.length, isLoading, isRevalidating))
  }, [welcomeDecision, isLoading, isRevalidating, persons.length])
  const ecran = resolveIdentityScreen(welcomeDecision, welcomeDismissed, showExitScreen)

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
        signaturePower: existingSignatory.roles.find((r) => r.role === 'signatory')?.signaturePower ?? null,
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

  // Étape 4 (tâche 6) : signatoryId vient d'existingSignatory ci-dessus (la personne
  // enregistrée à l'étape 0 de CE wizard) — jamais un id choisi par l'utilisateur, il
  // n'y a qu'un seul signataire saisi par ce parcours. useIdentityDocuments lit
  // Storage directement (aucune colonne DB, cf. son en-tête dans useAgencyIdentity.ts) ;
  // `data` est undefined tant que la query n'a pas résolu, d'où le repli sur un
  // brouillon vide (jamais "complet" par défaut avant d'avoir vraiment vérifié).
  const signatoryId = existingSignatory?.id ?? null
  const {
    data: identityDocuments, isLoading: identityDocumentsLoading, error: identityDocumentsError,
  } = useIdentityDocuments(agencyId, signatoryId)
  const pieceIdentiteDraft: PieceIdentiteDraft = {
    recto: identityDocuments?.recto?.path ?? null,
    verso: identityDocuments?.verso?.path ?? null,
  }
  const [uploadingSide, setUploadingSide] = useState<IdentityDocumentSide | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  /**
   * Valide puis téléverse IMMÉDIATEMENT (cf. en-tête de StepPieceIdentite.tsx) — pas
   * de brouillon local intermédiaire : le fichier est la source de vérité, et
   * useIdentityDocuments se réinvalide tout seul (uploadIdentityDocument) une fois
   * résolu, ce qui repeuple recto/verso au prochain rendu.
   */
  const handleSelectIdentityFile = async (side: IdentityDocumentSide, file: File): Promise<void> => {
    if (!signatoryId) return
    const validationError = validateIdentityDocumentFile(file)
    if (validationError) {
      setUploadError(t(`wizard.pieceIdentite.errors.${validationError.type}`))
      return
    }
    setUploadingSide(side)
    setUploadError(null)
    try {
      await uploadIdentityDocument(signatoryId, side, file)
    } catch {
      // Correctif revue tâche 6, point 4 : ne JAMAIS afficher e.message brut (celui de
      // Supabase Storage arrive en anglais) dans une interface qui existe en 4 langues
      // — toujours le message générique déjà traduit, quelle que soit la forme de
      // l'erreur. L'ancien `e instanceof Error ? e.message : t(...)` affichait presque
      // toujours la branche anglaise non traduite : une erreur Storage EST une
      // instance d'Error, donc t('errors.generic') n'était en pratique jamais atteinte.
      setUploadError(t('wizard.pieceIdentite.errors.generic'))
    } finally {
      setUploadingSide(null)
    }
  }

  const canNext = canAdvanceFromIdentityStep(step, signataire, agencyDraft, pieceIdentiteDraft)

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
    if (step === 0) {
      if (!isSignataireStepComplete(signataire)) return false
      return runPersist(() => savePerson(
        {
          id: existingSignatory?.id ?? null,
          firstName: signataire.firstName,
          lastName: signataire.lastName,
          dateOfBirth: signataire.dateOfBirth,
          nationality: signataire.nationality,
        },
        [{
          role: 'signatory',
          signaturePower: signataire.signaturePower,
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
      return isPieceIdentiteStepComplete(pieceIdentiteDraft)
    }
    // Étape 4 (récapitulatif) : rien à persister en QUITTANT l'étape — l'attestation
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
  if (ecran === 'preparing') return <IdentityPreparingScreen />
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
            recto={identityDocuments?.recto ?? null}
            verso={identityDocuments?.verso ?? null}
            isLoading={identityDocumentsLoading}
            uploadingSide={uploadingSide}
            error={uploadError}
            loadError={!!identityDocumentsError}
            disabled={!signatoryId}
            onSelectFile={(side, file) => { void handleSelectIdentityFile(side, file) }}
          />
        ) : step === 3 ? (
          <StepRecapitulatif
            signataire={signataire}
            agencyDraft={agencyDraft}
            recto={identityDocuments?.recto ?? null}
            verso={identityDocuments?.verso ?? null}
            identityDocumentsLoading={identityDocumentsLoading}
            identityDocumentsError={!!identityDocumentsError}
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
