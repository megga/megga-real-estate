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
 * Les cinq étapes ont désormais un écran réel : 0 (StepSignataire, tâche 3), 1
 * (StepAgence, tâche 4), 2 (StepBeneficiaires, tâche 5), 3 (StepPieceIdentite, tâche 6)
 * et 4 (StepRecapitulatif, tâche 7 — relecture de tout ce qui a été saisi, attestation
 * d'exactitude, soumission finale). La soumission (handleSubmit, plus bas) N'EST PAS un
 * bloc de persistCurrentStep comme les quatre précédents : c'est une action explicite
 * distincte, déclenchée par le bouton Soumettre du pied de page, jamais par
 * next()/prev()/goToStep() — voir le dernier cas de persistCurrentStep (étape 4 : rien
 * à y persister) et le commentaire d'en-tête de handleSubmit.
 *
 * L'étape 3 (tâche 6) diffère des trois précédentes sur un point : elle ne porte
 * AUCUN brouillon local à sauvegarder au clic sur Continuer. Le fichier recto/verso
 * est téléversé IMMÉDIATEMENT vers Storage dès sa sélection (cf. en-tête de
 * StepPieceIdentite.tsx) — persistCurrentStep n'y fait donc que vérifier la
 * complétude, jamais une écriture supplémentaire.
 *
 * L'étape 2 est en outre CONDITIONNELLE (tâche 5, point central de son brief) :
 * sautée quand la forme juridique choisie à l'étape 1 est une raison individuelle
 * (`legal_forms.category = 'sole_proprietorship'`) — le signataire EST l'entité,
 * aucun bénéficiaire effectif tiers à déclarer. « Sauter » veut dire : ni affichée
 * ni comptée par le stepper, dans les deux sens de navigation — voir
 * shouldSkipBeneficiairesStep/visibleIdentitySteps/nextIdentityStep/prevIdentityStep
 * plus bas, et leur usage dans le corps du composant.
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
import { MeggaX, MxButton, MxLink } from '@/components/megga-x'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  useAgencyIdentity, useLegalFormCategory, useIdentityDocuments, validateIdentityDocumentFile,
  ubosToRemove, ubosToRevoke, ubosToRevokeOnSkip, type IdentityRole, type IdentityDocumentSide,
} from '@/hooks/useAgencyIdentity'
import type { AgencySettingsData } from '@/hooks/useAgencySettings'
import type { LegalFormCategory } from '@/hooks/useLegalForms'
import { StepSignataire } from './steps/StepSignataire'
import { StepAgence } from './steps/StepAgence'
import { StepBeneficiaires } from './steps/StepBeneficiaires'
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
 */
export type AgencyDraft = Pick<
  AgencySettingsData,
  'country' | 'legalFormId' | 'legal' | 'tradeName' | 'businessRegistrationNumber' | 'tva' | 'address' | 'postal' | 'city' | 'canton'
>

/** Brouillon vide — état initial avant hydratation depuis une agence déjà persistée. */
// eslint-disable-next-line react-refresh/only-export-components -- constante partagée avec StepAgence/les tests, même motif que EMPTY_SIGNATAIRE_DRAFT.
export const EMPTY_AGENCY_DRAFT: AgencyDraft = {
  country: '',
  legalFormId: '',
  legal: '',
  tradeName: '',
  businessRegistrationNumber: '',
  tva: '',
  address: '',
  postal: '',
  city: '',
  canton: '',
}

/**
 * true si les 9 champs BLOQUANTS de l'étape agence sont renseignés. `tva` est
 * volontairement EXCLU de ce tout-ou-rien (décision produit du 27.07.2026) :
 * l'assujettissement à la TVA suisse n'est obligatoire qu'au-delà d'un seuil de
 * chiffre d'affaires, donc une raison individuelle parfaitement légitime peut n'avoir
 * aucun numéro de TVA — l'exiger la bloquerait sans raison et la renverrait au
 * support. Même principe que le reste du dispositif de vérification KYB
 * (docs/agency-kyb-verification.md) : un signal absent en est exclu plutôt que
 * pénalisé. `tva` reste un champ normal de AgencyDraft par ailleurs : saisi, il est
 * toujours persisté (persistCurrentStep étale tout le brouillon d'un coup) — seule sa
 * présence a cessé d'être une condition d'avancement.
 *
 * Comme isSignataireStepComplete : gate à la fois le bouton Continuer ET la tentative
 * de sauvegarde (persistCurrentStep) — tout ou rien sur les 9 champs restants, jamais
 * une écriture partielle de l'identité légale de l'agence.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete.
export function isAgencyStepComplete(draft: AgencyDraft): boolean {
  return (
    draft.country.trim() !== ''
    && draft.legalFormId.trim() !== ''
    && draft.legal.trim() !== ''
    && draft.tradeName.trim() !== ''
    && draft.businessRegistrationNumber.trim() !== ''
    && draft.address.trim() !== ''
    && draft.postal.trim() !== ''
    && draft.city.trim() !== ''
    && draft.canton.trim() !== ''
  )
}

/**
 * Un bénéficiaire effectif du brouillon local de l'étape 2 (tâche 5) — une liste, à la
 * différence des deux étapes précédentes qui portent une entité unique.
 * `personId` distingue une saisie neuve (`null`) d'une personne déjà persistée
 * (id réel) — c'est ce même id qui, lorsqu'il coïncide avec celui du signataire, fait
 * qu'un « second rôle » s'ajoute à une personne existante au lieu d'en dupliquer
 * l'identité (cf. brief tâche 5, StepBeneficiaires « reprendre le signataire »).
 * `pepSelfDeclared` est nullable ICI (contrairement à `IdentityRole.pepSelfDeclared`,
 * `boolean` non nullable) : `null` = pas encore répondu, pour ne jamais faire de
 * "false" un défaut silencieux sur une déclaration de conformité — même logique que
 * `signaturePower` côté signataire. Coercé en `boolean` uniquement à l'écriture
 * (persistCurrentStep), une fois la complétude de la ligne déjà vérifiée.
 */
export interface BeneficiaireDraft {
  personId: string | null
  firstName: string
  lastName: string
  dateOfBirth: string | null
  nationality: string | null
  ownershipPct: number | null
  pepSelfDeclared: boolean | null
}

/** Ligne vide — état initial d'une nouvelle entrée ajoutée dans StepBeneficiaires. */
// eslint-disable-next-line react-refresh/only-export-components -- constante partagée avec StepBeneficiaires/les tests, même motif que EMPTY_SIGNATAIRE_DRAFT.
export const EMPTY_BENEFICIAIRE_DRAFT: BeneficiaireDraft = {
  personId: null,
  firstName: '',
  lastName: '',
  dateOfBirth: null,
  nationality: null,
  ownershipPct: null,
  pepSelfDeclared: null,
}

/**
 * true si les 6 champs d'un bénéficiaire sont renseignés — même discipline tout-ou-rien
 * que isSignataireStepComplete/isAgencyStepComplete : jamais de ligne à moitié saisie
 * silencieusement acceptée. `ownershipPct` n'est PAS comparé au seuil GAFI de 25 % :
 * le brief est explicite, ce seuil est une aide à la saisie rappelée par l'interface,
 * jamais une règle de validation — 0 % (dilution) et null (pas répondu) sont les seules
 * valeurs distinguées ici, `!= null` couvre les deux sans confondre l'une avec l'autre.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete.
export function isBeneficiaireEntryComplete(entry: BeneficiaireDraft): boolean {
  return (
    entry.firstName.trim() !== ''
    && entry.lastName.trim() !== ''
    && entry.dateOfBirth != null
    && entry.nationality != null
    && entry.ownershipPct != null
    && entry.pepSelfDeclared != null
  )
}

/**
 * true si l'étape bénéficiaires effectifs peut être quittée en avançant. Une liste VIDE
 * est valide (contrairement au signataire et à l'agence, qui portent chacun une entité
 * BLOQUANTE) : aucune personne physique ne détenant seule 25 % ou plus est une réponse
 * légitime, et la RPC de soumission (submit_agency_identity, 20260728108000) n'exige
 * d'ailleurs aucun UBO pour accepter le dossier — seuls raison sociale, forme
 * juridique, pays et signataire actif y sont vérifiés. Ce qui n'est en revanche jamais
 * toléré, c'est une ligne commencée puis laissée incomplète (isBeneficiaireEntryComplete).
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isAgencyStepComplete.
export function isBeneficiairesStepComplete(entries: BeneficiaireDraft[]): boolean {
  return entries.every(isBeneficiaireEntryComplete)
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
 * true si RECTO ET VERSO sont tous deux téléversés — contrairement à
 * isBeneficiairesStepComplete (une liste vide est une réponse légitime), il n'y a ici
 * aucune valeur par défaut acceptable : l'étape existe précisément pour collecter les
 * deux faces de la pièce d'identité du signataire, tant que l'une manque le dossier
 * KYB reste incomplet.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isBeneficiairesStepComplete.
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
 * page). Les étapes 0 (StepSignataire), 1 (StepAgence) et 2 (StepBeneficiaires) ont un
 * écran réel — gate sur leur complétude respective. `beneficiaires` est optionnel
 * (défaut `[]`) : les appels antérieurs à la tâche 5 (tests des tâches 3/4) restent
 * valides sans le 4e argument, et une liste vide est de toute façon complète
 * (isBeneficiairesStepComplete). L'étape 3 (StepPieceIdentite) gate elle aussi sur sa
 * propre complétude, cf. le paragraphe `pieceIdentite` plus bas. L'étape 4
 * (récapitulatif, StepRecapitulatif, tâche 7) renvoie toujours `false` ici pour une
 * raison différente : c'est la DERNIÈRE étape, il n'existe pas de « suivante » vers
 * laquelle avancer — le pied de page n'y affiche d'ailleurs jamais de bouton Continuer
 * (cf. le rendu du footer plus bas), seulement Soumettre, qui gate sur l'attestation
 * d'exactitude et non sur ce booléen (canSubmitIdentity, plus bas).
 *
 * Revue tâche 3 : `canNext` valait `true` sans condition dès step > 0 — le bouton
 * Continuer du pied de page restait cliquable sur ces paliers vides jusqu'au
 * récapitulatif, sans que rien n'ait été renseigné. Le stepper du header respectait
 * déjà la règle (goToStep refuse toute cible > step, cf. plus bas), mais le rapport de
 * la tâche affirmait à tort que c'était vrai aussi du bouton du pied de page.
 *
 * `pieceIdentite` (tâche 6) suit le même motif que `beneficiaires` : paramètre
 * optionnel à défaut vide, pour que les appels antérieurs (tests des tâches 3 à 5)
 * restent valides sans le 5e argument — mais contrairement à `beneficiaires`, un
 * brouillon vide y est INCOMPLET (isPieceIdentiteStepComplete), jamais une réponse
 * légitime : recto et verso sont tous deux exigés pour avancer.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete/clampIdentityStep.
export function canAdvanceFromIdentityStep(
  step: number,
  signataire: SignataireDraft,
  agency: AgencyDraft,
  beneficiaires: BeneficiaireDraft[] = [],
  pieceIdentite: PieceIdentiteDraft = EMPTY_PIECE_IDENTITE_DRAFT,
): boolean {
  if (step === 0) return isSignataireStepComplete(signataire)
  if (step === 1) return isAgencyStepComplete(agency)
  if (step === 2) return isBeneficiairesStepComplete(beneficiaires)
  if (step === 3) return isPieceIdentiteStepComplete(pieceIdentite)
  return false
}

/**
 * Index fixe de l'étape bénéficiaires effectifs dans SG_IDENTITY_STEPS (voir tokens.ts
 * § Étapes du wizard : signataire=0, agence=1, bénéficiaires=2, pièce d'identité=3,
 * récapitulatif=4). La SEULE étape conditionnelle du parcours — pas de paramétrage
 * générique « quel index sauter » ici, ce serait de la généricité non demandée pour un
 * wizard qui n'a qu'un seul palier optionnel par construction.
 */
const BENEFICIAIRES_STEP_INDEX = 2

/**
 * true si l'étape bénéficiaires effectifs (index 2) doit être sautée : raison
 * individuelle, le signataire EST l'entité, aucun bénéficiaire effectif tiers à
 * déclarer (§4 de la spec de conception, rôle explicite de `legal_forms.category`).
 * `null` (catégorie pas encore connue, ex. aucune forme juridique choisie) -> PAS
 * sautée : tant qu'on ignore si l'étape s'applique, mieux vaut la montrer que la
 * masquer à tort et laisser filer un dossier KYB incomplet.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que isSignataireStepComplete.
export function shouldSkipBeneficiairesStep(category: LegalFormCategory | null): boolean {
  return category === 'sole_proprietorship'
}

/**
 * Indices d'étapes VISIBLES, dans l'ordre — exclut BENEFICIAIRES_STEP_INDEX quand
 * `skipBeneficiaires`. Alimente à la fois le rendu du stepper du header (qui ne doit
 * jamais compter une étape que l'utilisateur ne verra pas, cf. brief tâche 5) et
 * nextIdentityStep/prevIdentityStep ci-dessous — une seule source de vérité pour
 * « quelles étapes existent réellement pour cette agence ».
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que clampIdentityStep.
export function visibleIdentitySteps(stepCount: number, skipBeneficiaires: boolean): number[] {
  const all = Array.from({ length: stepCount }, (_, i) => i)
  return skipBeneficiaires ? all.filter((i) => i !== BENEFICIAIRES_STEP_INDEX) : all
}

/**
 * Étape suivante VISIBLE après `step` (jamais BENEFICIAIRES_STEP_INDEX quand sautée),
 * bornée à la dernière étape visible. Remplace un simple `clampIdentityStep(step + 1,
 * …)` dans next() : ce dernier ignore le saut et laisserait l'utilisateur atterrir sur
 * l'étape bénéficiaires même quand elle ne s'applique pas — exactement le bug que la
 * tâche 5 doit éviter dans les DEUX sens de navigation (voir prevIdentityStep).
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que clampIdentityStep.
export function nextIdentityStep(step: number, stepCount: number, skipBeneficiaires: boolean): number {
  const visible = visibleIdentitySteps(stepCount, skipBeneficiaires)
  const pos = visible.indexOf(step)
  return visible[pos === -1 ? 0 : Math.min(pos + 1, visible.length - 1)]
}

/** Symétrique de nextIdentityStep pour le bouton Précédent — même garde-fou, sens inverse. */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/identity-shell-navigation.spec.ts), même motif que nextIdentityStep.
export function prevIdentityStep(step: number, stepCount: number, skipBeneficiaires: boolean): number {
  const visible = visibleIdentitySteps(stepCount, skipBeneficiaires)
  const pos = visible.indexOf(step)
  return visible[pos === -1 ? 0 : Math.max(pos - 1, 0)]
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
      <div className="page-wrapper full-height-page">
        <div className="header pd-medium-top-and-bottom">
          <div className="container-default w-container">
            <div className="flex-horizontal">
              <div className="header-logo">
                <img src="/megga-logo.svg" alt="MEGGA" />
              </div>
            </div>
          </div>
        </div>
        <section className="section hero---br pd-top-64px---bottom-108p">
          <div className="container-default w-container">
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
      <div className="page-wrapper full-height-page">
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
        <section className="section hero---br pd-top-64px---bottom-108p">
          <div className="container-default position-relative---z-index-1 w-container">
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
                      <MxButton className="app-button" onClick={onStart}>
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
              <MxButton onClick={onResume}>{t('gate.pendingNotice.resumeButton')}</MxButton>
            </div>
            <div className="mg-top-2x-extra-small text-center">
              <MxButton variant="secondary" onClick={onLogout}>{t('common:nav.logout')}</MxButton>
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
    agency, agencyId, persons, isLoading, isRevalidating, savePerson, removePerson, revokeUboRole, saveAgency, uploadIdentityDocument, submit,
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
  // saisie (retour sur le wizard après une fermeture d'onglet). Les 10 colonnes de
  // cette étape sont écrites ENSEMBLE par persistCurrentStep (tout ou rien, comme le
  // signataire) : n'importe laquelle suffit comme déclencheur de l'hydratation ;
  // legalFormId est prise pour rester au plus près du motif existingSignatory?.id.
  useEffect(() => {
    if (agency.legalFormId) {
      setAgencyDraftRaw({
        country: agency.country,
        legalFormId: agency.legalFormId,
        legal: agency.legal,
        tradeName: agency.tradeName,
        businessRegistrationNumber: agency.businessRegistrationNumber,
        tva: agency.tva,
        address: agency.address,
        postal: agency.postal,
        city: agency.city,
        canton: agency.canton,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agency.legalFormId])

  // Décision de saut de l'étape bénéficiaires (tâche 5, point central du brief) —
  // dérivée du BROUILLON agence (agencyDraft) : c'est la SEULE façon de refléter un
  // changement de forme juridique PENDANT LA SAISIE, avant même un clic sur Continuer
  // (le stepper du header démasque/masque Bénéficiaires en direct, cf. son rendu plus
  // bas). useAgencyIdentity().legalFormCategory ne peut pas jouer ce rôle : même
  // redevenu fiable juste après un saveAgency() résolu (correctif revue tâche 5, cf.
  // l'en-tête de useAgencyIdentity.ts), il ne reflète par construction que ce qui a
  // été ENVOYÉ à saveAgency(), jamais une frappe pas encore sauvegardée.
  // useLegalFormCategory (useAgencyIdentity.ts) porte la SEULE implémentation de la
  // dérivation (useLegalForms + resolveLegalFormCategory) : IdentityShell et le hook
  // l'appellent chacun avec leur propre entrée légitime (le brouillon ici, le dernier
  // payload sauvegardé côté hook), mais plus jamais deux implémentations séparées de
  // la même logique. Coût : un appel de plus, mais la query est partagée par clé
  // (['legal-forms', code]) avec celles de StepAgence et du hook — pas de requête
  // réseau supplémentaire dès que le pays coïncide (cas normal ici).
  const skipBeneficiaires = shouldSkipBeneficiairesStep(
    useLegalFormCategory(agencyDraft.country, agencyDraft.legalFormId),
  )

  const existingBeneficiaires = useMemo(
    () => persons.filter((p) => p.roles.some((r) => r.role === 'ubo')),
    [persons],
  )
  const [beneficiaires, setBeneficiairesRaw] = useState<BeneficiaireDraft[]>([])
  const setBeneficiaires = (next: BeneficiaireDraft[]) => setBeneficiairesRaw(next)

  // Hydrate le brouillon depuis les UBO déjà persistés — UNIQUEMENT tant que le
  // brouillon local est encore vide (garde `prev.length > 0 ? prev : …`), jamais en
  // écrasant une saisie déjà en cours. Sans cette garde, le refetch que savePerson/
  // removePerson attendent tous deux avant de résoudre (cf. leur JSDoc) redéclencherait
  // cet effet PENDANT la boucle de sauvegarde de persistCurrentStep (step 2, plus bas)
  // et écraserait les lignes que la boucle n'a pas encore traitées — même risque que la
  // sur-hydratation évitée pour existingSignatory/agency.legalFormId ci-dessus, mais
  // plus aigu ici : une liste se modifie à chaque save, pas une entité unique.
  const existingBeneficiairesKey = existingBeneficiaires.map((p) => p.id).join(',')
  useEffect(() => {
    if (existingBeneficiaires.length === 0) return
    setBeneficiairesRaw((prev) => (prev.length > 0 ? prev : existingBeneficiaires.map((p) => ({
      personId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      nationality: p.nationality,
      ownershipPct: p.roles.find((r) => r.role === 'ubo')?.ownershipPct ?? null,
      pepSelfDeclared: p.roles.find((r) => r.role === 'ubo')?.pepSelfDeclared ?? false,
    }))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingBeneficiairesKey])

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

  const canNext = canAdvanceFromIdentityStep(step, signataire, agencyDraft, beneficiaires, pieceIdentiteDraft)

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
        // Nettoyage rétroactif (correctif revue tâche 5) : si la forme juridique tout
        // juste enregistrée fait basculer l'étape bénéficiaires en « sautée », l'écran
        // qui permettrait normalement de retirer un bénéficiaire un par un ne sera
        // plus jamais monté — tout rôle ubo déjà actif doit donc être révoqué ICI,
        // sinon le dossier soumis porte un bénéficiaire fantôme que l'écran ne montre
        // plus (la RPC de soumission ne vérifie pas cette cohérence). Jamais de
        // suppression : ubosToRevokeOnSkip ne renvoie que des ids à révoquer,
        // l'identité et un éventuel rôle signataire restent intacts.
        if (skipBeneficiaires) {
          for (const id of ubosToRevokeOnSkip(persons)) {
            await revokeUboRole(id)
          }
        }
      })
    }
    if (step === 2) {
      if (!isBeneficiairesStepComplete(beneficiaires)) return false
      return runPersist(async () => {
        // 1. Retire d'abord les UBO enlevés du brouillon — ubosToRemove protège déjà
        // toute personne qui porte un autre rôle actif (ex. le signataire réutilisé
        // comme bénéficiaire, cf. son en-tête dans useAgencyIdentity.ts) : jamais de
        // cascade destructive sur une identité encore nécessaire ailleurs.
        for (const id of ubosToRemove(persons, beneficiaires.map((b) => b.personId))) {
          await removePerson(id)
        }
        // 2. Révoque (sans supprimer) le rôle ubo des personnes protégées ci-dessus par
        // un autre rôle actif — correctif revue tâche 5 : ubosToRemove les excluait déjà
        // à raison de la suppression complète, mais rien ne révoquait leur rôle ubo, qui
        // restait actif en base indéfiniment après un retrait à l'écran. ubosToRevoke
        // est le complément exact de ubosToRemove ; revokeUboRole ne pose que valid_to
        // sur LEUR ligne agency_person_roles(role='ubo'), jamais agency_related_persons
        // ni un rôle signatory.
        for (const id of ubosToRevoke(persons, beneficiaires.map((b) => b.personId))) {
          await revokeUboRole(id)
        }
        // 3. (Ré)écrit chaque ligne du brouillon. `id: b.personId` fait toute la
        // différence entre "ajouter un second rôle" et "dupliquer l'identité" (cas
        // central du brief) : reprendre le signataire transmet SON id réel, savePerson
        // met alors à jour la personne existante au lieu d'en insérer une seconde.
        for (let i = 0; i < beneficiaires.length; i += 1) {
          const b = beneficiaires[i]
          const role: IdentityRole = {
            role: 'ubo',
            signaturePower: null,
            ownershipPct: b.ownershipPct,
            // Coercion sûre : isBeneficiairesStepComplete (garde ci-dessus) a déjà
            // vérifié pepSelfDeclared != null pour CHAQUE entrée avant d'arriver ici.
            pepSelfDeclared: b.pepSelfDeclared ?? false,
          }
          const savedId = await savePerson(
            { id: b.personId, firstName: b.firstName, lastName: b.lastName, dateOfBirth: b.dateOfBirth, nationality: b.nationality },
            [role],
          )
          // Patch synchrone du brouillon local pour une ligne neuve (personId était
          // null) : sans ça, un aller-retour prev()/next() sur cette même étape avant
          // qu'un futur refetch ne recharge `persons` réinsérerait cette personne une
          // seconde fois (personId resterait null) — cf. JSDoc de l'effet d'hydratation
          // ci-dessus, qui ne peut pas jouer ce rôle (garde "brouillon déjà non vide").
          if (b.personId == null) {
            const insertedIndex = i
            setBeneficiairesRaw((prev) => prev.map((x, idx) => (idx === insertedIndex ? { ...x, personId: savedId } : x)))
          }
        }
      })
    }
    if (step === 3) {
      // Rien à écrire ici (cf. en-tête de StepPieceIdentite.tsx) : le fichier est déjà
      // durablement dans Storage au moment où l'utilisateur clique Continuer — cette
      // étape ne fait que revérifier sa complétude, comme canNext l'a déjà fait pour
      // activer le bouton (garde défensive redondante, même style que les étapes 0 à 2).
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
    setStep((s) => nextIdentityStep(s, SG_IDENTITY_STEPS.length, skipBeneficiaires))
  }
  const prev = async () => {
    if (saving) return
    await persistCurrentStep()
    setStep((s) => prevIdentityStep(s, SG_IDENTITY_STEPS.length, skipBeneficiaires))
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
          une bande blanche sous le canvas — le noir vient du conteneur, pas du body. */}
      <div className="page-wrapper full-height-page">
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
            dix champs. Les deux modificateurs la ramènent à 64 px / 80 px. */}
        <section className="section pd-top-regular pd-bottom-medium mx-grow">
          <div className="container-default w-container">
            {/* visibleIdentitySteps exclut l'étape bénéficiaires quand elle est sautée : ni
                affichée ni comptée dans la numérotation (position + 1, pas i + 1) — c'est le
                volet "stepper" de l'exigence de saut propre (cf. en-tête du fichier). */}
            <nav className="mx-stepper" aria-label={t('wizard.steps.ariaLabel')}>
              {visibleIdentitySteps(SG_IDENTITY_STEPS.length, skipBeneficiaires).map((i, position) => {
                const s = SG_IDENTITY_STEPS[i]
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
                    {position + 1}. {s.label}
                  </button>
                )
              })}
            </nav>

            <main key={showExitScreen ? 'exit' : step} className="mg-top-medium">
              {isLoading ? (
                <div className="text-center" role="status" aria-live="polite">
                  <p className="paragraph-large">{t('gate.shell.preparing')}</p>
                </div>
              ) : showExitScreen ? (
          <ExitPendingScreen onResume={() => setShowExitScreen(false)} onLogout={handleLogout} />
        ) : step === 0 ? (
          <StepSignataire value={signataire} onChange={setSignataire} />
        ) : step === 1 ? (
          <StepAgence value={agencyDraft} onChange={setAgencyDraft} />
        ) : step === 2 ? (
          // N'est jamais atteinte quand skipBeneficiaires est vrai : nextIdentityStep/
          // prevIdentityStep ne renvoient jamais 2 dans ce cas (cf. leur JSDoc).
          <StepBeneficiaires
            value={beneficiaires}
            onChange={setBeneficiaires}
            signataire={existingSignatory && existingSignatory.id ? {
              // existingSignatory.id est `string | null` dans le type partagé
              // (IdentityPerson.id, null = pas encore enregistrée) mais vient ici
              // toujours d'une lecture DB (persons) : le garde ci-dessus le narrows en
              // `string` pour StepBeneficiaires, qui a besoin d'un id réel à réutiliser.
              personId: existingSignatory.id,
              firstName: existingSignatory.firstName,
              lastName: existingSignatory.lastName,
              dateOfBirth: existingSignatory.dateOfBirth,
              nationality: existingSignatory.nationality,
            } : null}
          />
        ) : step === 3 ? (
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
        ) : step === 4 ? (
          <StepRecapitulatif
            signataire={signataire}
            agencyDraft={agencyDraft}
            skipBeneficiaires={skipBeneficiaires}
            beneficiaires={beneficiaires}
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
              <div className="mx-actionbar mg-top-medium">
                {/* Aucun témoin de sauvegarde : la persistance à chaque changement
                    d'étape (persistCurrentStep, appelée par next/prev/goToStep) reste
                    entière, elle se fait simplement sans le dire. Un dirigeant qui
                    remplit un formulaire de conformité n'a pas à surveiller un voyant
                    vert ; ce qui compte est que fermer l'onglet ne perde rien, et ça
                    n'a pas changé. */}
                <div className="flex-horizontal gap-16px">
                  {step > 0 && (
                    <MxButton variant="secondary" size="small" onClick={() => { void prev() }} disabled={saving}>
                      {t('common:actions.previous')}
                    </MxButton>
                  )}
                </div>

                <div>
                  {step < SG_IDENTITY_STEPS.length - 1 ? (
                    <MxButton onClick={() => { void next() }} disabled={!canNext || saving}>
                      {saving ? t('wizard.footer.saving') : t('wizard.footer.continue')}
                    </MxButton>
                  ) : (
                    // Dernière étape (récapitulatif) : Soumettre remplace Continuer — gate
                    // sur l'attestation ET un signataire réellement désigné
                    // (canSubmitIdentity), jamais sur canNext (toujours false ici).
                    <MxButton onClick={() => { void handleSubmit() }} disabled={!canSubmitIdentity(attestationChecked, signatoryId) || saving}>
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
