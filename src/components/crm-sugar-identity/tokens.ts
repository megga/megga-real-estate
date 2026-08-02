/**
 * Wizard « Identité légale » (KYB, route /dashboard/identite) — étapes du parcours.
 *
 * Ce fichier portait aussi la palette Sugar v2 (`SugarV2`, `setSugarV2Dark`) et un
 * jeu de keyframes. Les deux ont été retirés le 2 août 2026 avec le passage du
 * parcours à l'habillage MEGGA X : le wizard ne lit plus aucune couleur en JS, tout
 * vient des classes de la vitrine (`src/styles/megga-x.generated.css`), et il
 * n'a plus d'animation propre. Un module de thème dont personne ne lit plus les
 * couleurs n'est que du code mort, que le dépôt proscrit.
 *
 * ⚠ À ne pas confondre avec `crm-sugar-wizard/tokens.ts`, qui exporte un `SugarV2`
 * HOMONYME et bien vivant : c'est celui du wizard « Créer un bien », resté en Sugar.
 * Les deux modules n'ont jamais été liés.
 */
import i18nIdentity from '@/i18n' // labels d'étapes i18n (getters SG_IDENTITY_STEPS)

// ─── Étapes du wizard ───────────────────────────────────────────────────
// Cinq étapes fixées par le plan (§ Parcours cible de la spec de conception) :
// signataire → agence → bénéficiaires effectifs → pièce d'identité → récapitulatif.
// label en getter (i18n singleton) : traduit + réactif au changement de langue,
// même motif que SG_STEPS dans crm-sugar-wizard/tokens.ts.
export const SG_IDENTITY_STEPS = [
  { id: 'signataire', get label() { return i18nIdentity.t('onboarding:wizard.steps.signataire') } },
  { id: 'agence', get label() { return i18nIdentity.t('onboarding:wizard.steps.agence') } },
  { id: 'beneficiaires', get label() { return i18nIdentity.t('onboarding:wizard.steps.beneficiaires') } },
  { id: 'pieceIdentite', get label() { return i18nIdentity.t('onboarding:wizard.steps.pieceIdentite') } },
  { id: 'recapitulatif', get label() { return i18nIdentity.t('onboarding:wizard.steps.recapitulatif') } },
] as const
