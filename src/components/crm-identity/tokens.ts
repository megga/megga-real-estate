/**
 * Wizard « Identité légale » (KYB, route /dashboard/identite) — étapes du parcours.
 *
 * Ce fichier portait aussi la palette Sugar v2 (`WizardTokens`, `setWizardDark`) et un
 * jeu de keyframes. Les deux ont été retirés le 2 août 2026 avec le passage du
 * parcours à l'habillage MEGGA X : le wizard ne lit plus aucune couleur en JS, tout
 * vient des classes de la vitrine (`src/styles/megga-x.generated.css`), et il
 * n'a plus d'animation propre. Un module de thème dont personne ne lit plus les
 * couleurs n'est que du code mort, que le dépôt proscrit.
 *
 * ⚠ À ne pas confondre avec `crm-wizard/tokens.ts`, qui exporte un `WizardTokens`
 * HOMONYME et bien vivant : c'est celui du wizard « Créer un bien », resté en Sugar.
 * Les deux modules n'ont jamais été liés.
 */
import i18nIdentity from '@/i18n' // labels d'étapes i18n (getters IDENTITY_STEPS)
import type { MxAddressLabels, MxCompanyLabels, MxDatePickerLabels, MxFrenchCompanyLabels } from '@/components/megga-x'

// ─── Étapes du wizard ───────────────────────────────────────────────────
// CINQ étapes : signataire → agence → pièce d'identité → rendez-vous → récapitulatif.
//
// L'étape « rendez-vous » a été AJOUTÉE le 4 août 2026, en avant-dernière position.
// La réservation de l'appel d'accueil vivait jusque-là APRÈS la soumission, sur une
// route à part (/dashboard/rendez-vous-accueil) et en habillage CRM — donc au moment
// précis où le dirigeant croyait avoir terminé, dans une peau qu'il n'avait pas encore
// vue. Elle est maintenant relue avec le reste au récapitulatif, avant l'attestation.
// La route survit, pour ceux qui ont franchi le wizard avant que l'étape n'existe et
// pour toute reprise ultérieure (cf. l'en-tête de OnboardingCallPage.tsx).
// label en getter (i18n singleton) : traduit + réactif au changement de langue,
// même motif que WIZARD_STEPS dans crm-sugar-wizard/tokens.ts.
//
// L'étape « bénéficiaires effectifs » a été RETIRÉE du parcours le 3 août 2026
// (décision client). Elle occupait l'index 2 et était la seule étape
// CONDITIONNELLE du wizard — sautée pour une raison individuelle — ce qui
// justifiait à elle seule toute la machinerie de saut (shouldSkipBeneficiairesStep,
// visibleIdentitySteps, nextIdentityStep, prevIdentityStep). Cette machinerie part
// avec elle : sans étape conditionnelle, avancer et reculer redeviennent un simple
// clampIdentityStep(step ± 1).
//
// ⚠ PORTÉE DU RETRAIT : le WIZARD seulement. Le rôle `ubo` reste dans le schéma
// (agency_person_roles.role, CHECK inchangé), la console admin continue d'afficher
// les bénéficiaires d'un dossier, et le backend n'a pas bougé — le parcours peut
// donc être rétabli sans migration. Mesuré au moment du retrait : 0 ligne portant
// le rôle `ubo` en production, donc aucune donnée orpheline.
export const IDENTITY_STEPS = [
  { id: 'signataire', get label() { return i18nIdentity.t('onboarding:wizard.steps.signataire') } },
  { id: 'agence', get label() { return i18nIdentity.t('onboarding:wizard.steps.agence') } },
  { id: 'pieceIdentite', get label() { return i18nIdentity.t('onboarding:wizard.steps.pieceIdentite') } },
  { id: 'rendezVous', get label() { return i18nIdentity.t('onboarding:wizard.steps.rendezVous') } },
  { id: 'recapitulatif', get label() { return i18nIdentity.t('onboarding:wizard.steps.recapitulatif') } },
] as const

// ─── Champ date ─────────────────────────────────────────────────────────
/**
 * Libellés du calendrier (MxDatePicker), partagés par les deux étapes qui
 * demandent une date de naissance — le signataire et chaque bénéficiaire
 * effectif. Ici plutôt qu'en double dans les deux fichiers : sept clés
 * recopiées à deux endroits, ce sont sept occasions de dériver au premier
 * renommage.
 *
 * `MxDatePicker` ne lit aucune traduction lui-même (dossier megga-x = catalogue
 * d'atomes, cf. son en-tête) : c'est l'appelant qui les lui passe, comme
 * `closeLabel` de MxModal. Getters et non valeurs figées, même motif que
 * IDENTITY_STEPS : la coquille se re-rend à chaque bascule de langue et doit
 * relire, pas resservir ce qui a été capturé au chargement du module.
 */
export const IDENTITY_DATE_LABELS: MxDatePickerLabels = {
  get open() { return i18nIdentity.t('onboarding:wizard.date.open') },
  get placeholder() { return i18nIdentity.t('onboarding:wizard.date.placeholder') },
  get previousMonth() { return i18nIdentity.t('onboarding:wizard.date.previousMonth') },
  get nextMonth() { return i18nIdentity.t('onboarding:wizard.date.nextMonth') },
  get month() { return i18nIdentity.t('onboarding:wizard.date.month') },
  get year() { return i18nIdentity.t('onboarding:wizard.date.year') },
  get clear() { return i18nIdentity.t('onboarding:wizard.date.clear') },
}

/**
 * Libellés du champ d'adresse assistée (MxAddressAutocomplete), étape 2. Mêmes
 * raisons d'être ici que IDENTITY_DATE_LABELS ci-dessus : le dossier megga-x
 * ne lit aucune traduction, et les getters relisent à chaque bascule de langue.
 */
export const IDENTITY_ADDRESS_LABELS: MxAddressLabels = {
  get placeholder() { return i18nIdentity.t('onboarding:wizard.agence.address.placeholder') },
  get noResults() { return i18nIdentity.t('onboarding:wizard.agence.address.noResults') },
  get error() { return i18nIdentity.t('onboarding:wizard.agence.address.error') },
  get listLabel() { return i18nIdentity.t('onboarding:wizard.agence.address.listLabel') },
}

/**
 * Libellés de la recherche au registre du commerce (MxCompanySearch), étape 2.
 * Mêmes raisons d'être ici que les deux jeux ci-dessus.
 */
export const IDENTITY_COMPANY_LABELS: MxCompanyLabels = {
  get search() { return i18nIdentity.t('onboarding:wizard.agence.company.search') },
  get searching() { return i18nIdentity.t('onboarding:wizard.agence.company.searching') },
  get noResults() { return i18nIdentity.t('onboarding:wizard.agence.company.noResults') },
  get error() { return i18nIdentity.t('onboarding:wizard.agence.company.error') },
  get listLabel() { return i18nIdentity.t('onboarding:wizard.agence.company.listLabel') },
}

/**
 * Libellés de la recherche au registre FRANÇAIS (MxFrenchCompanyField).
 *
 * Les trois libellés communs sont ceux du suisse — « au registre du commerce »
 * vaut des deux côtés, et les dupliquer par pays ferait deux jeux à faire
 * dériver. Seul `inactive` est propre à la France : c'est la seule des deux
 * sources à rendre le statut actif/radié.
 */
export const IDENTITY_FR_COMPANY_LABELS: MxFrenchCompanyLabels = {
  get noResults() { return i18nIdentity.t('onboarding:wizard.agence.company.noResults') },
  get error() { return i18nIdentity.t('onboarding:wizard.agence.company.error') },
  get listLabel() { return i18nIdentity.t('onboarding:wizard.agence.company.listLabel') },
  get inactive() { return i18nIdentity.t('onboarding:wizard.agence.company.inactive') },
}

/**
 * Borne haute des dates de naissance : aujourd'hui. Calculée à l'appel et non
 * figée dans une constante de module — un onglet resté ouvert une nuit
 * proposerait sinon une borne périmée.
 *
 * Composantes LOCALES, jamais `toISOString()` : ce dernier convertit en UTC et
 * rend la VEILLE dès qu'on est à l'est de Greenwich, ce qui interdirait la date
 * du jour à un agent suisse chaque soir après minuit UTC.
 */
export function identityMaxBirthDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
