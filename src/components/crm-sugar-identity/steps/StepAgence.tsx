/**
 * Wizard « Identité légale » (KYB) — étape 2, l'agence.
 *
 * Saisit l'identité légale de l'agence elle-même (pays du siège, forme juridique,
 * raison sociale, nom commercial, numéro de registre, TVA, adresse, NPA, ville,
 * canton). Contrôlée par IdentityShell (value/onChange) : cette étape ne détient
 * aucun état propre et n'écrit rien elle-même — IdentityShell persiste le brouillon
 * via useAgencyIdentity().saveAgency() au changement d'étape (cf. son en-tête).
 *
 * Peau MEGGA X depuis la refonte visuelle de l'onboarding : plus aucun token Sugar
 * ici. Le gabarit est celui des écrans d'authentification de la vitrine
 * (`inner-container _634px center` > `card sign-in-card` > `pd---content-inside-card`,
 * cf. login.html / reset-password.html — les deux seules pages qui portent
 * `sign-in-card`), et les dix champs reprennent le couple `<label for>` + `.input`
 * de ces mêmes formulaires via MxField. Aucune valeur n'est posée en dur : la
 * coquille (IdentityShell) monte l'étape dans `<MeggaX>`, qui scope la feuille
 * `.megga-x`.
 *
 * Deux dépendances d'ordre, ni l'une ni l'autre cosmétique (cf. brief tâche 4) :
 * 1. Le pays du siège filtre la liste des formes juridiques (useLegalForms(country),
 *    déjà filtrée par pays). Changer le pays remet ICI à zéro une forme juridique
 *    devenue incohérente (legalFormIdAfterCountryChange, IdentityShell.tsx) — jamais
 *    laissée en place silencieusement, puisque chaque legal_forms.id n'appartient
 *    qu'à un seul pays.
 * 2. La catégorie de la forme choisie décide de l'affichage de l'étape 3 (tâche 5) :
 *    une raison individuelle n'a pas de bénéficiaire effectif tiers, le signataire
 *    EST l'entité. Cette étape n'implémente pas ce saut elle-même : elle se contente
 *    d'écrire `legalFormId` dans le brouillon via `onChange`. C'est IdentityShell.tsx
 *    qui décide, à partir de CE BROUILLON — jamais de `useAgencyIdentity().legalFormCategory`,
 *    qui ne reflète que l'agence persistée / le dernier `saveAgency()` résolu, jamais
 *    une frappe pas encore sauvegardée (cf. l'en-tête de useAgencyIdentity.ts). Les
 *    deux passent par la même dérivation, `useLegalFormCategory` (useAgencyIdentity.ts,
 *    correctif revue tâche 5) — voir son en-tête et celui d'IdentityShell.tsx.
 *
 * Champs à fournir avant de pouvoir avancer (gate : IdentityShell.isAgencyStepComplete) :
 * 9 des 10 champs ci-dessus, même logique tout-ou-rien que le signataire. Exception
 * décidée le 27.07.2026 : la TVA reste saisissable et, si renseignée, persistée
 * normalement — mais elle ne bloque plus l'avancement (seuil d'assujettissement
 * suisse, cf. le commentaire d'isAgencyStepComplete pour le détail). Seule indication
 * visuelle de ce caractère facultatif : l'aide MxField sous le champ, plus bas.
 */
import { useTranslation } from 'react-i18next'
import { MxField, MxInput, MxSelect } from '@/components/megga-x'
import { COUNTRIES } from '@/lib/countries'
import { CANTONS } from '@/lib/constants'
import { useLegalForms } from '@/hooks/useLegalForms'
import { legalFormIdAfterCountryChange, type AgencyDraft } from '../IdentityShell'

interface StepAgenceProps {
  value: AgencyDraft
  onChange: (patch: Partial<AgencyDraft>) => void
}

/**
 * Pays de siège pris en charge — les 3 juridictions couvertes par legal_forms
 * (migration 20260728100000 : Suisse/France/Liechtenstein). Sous-ensemble de
 * COUNTRIES (mêmes codes/libellés — même limitation « libellés français seulement »
 * déjà acceptée par le select nationalité de StepSignataire, pas un choix nouveau
 * pris ici) : présenter les 195 pays de COUNTRIES ferait retomber la quasi-totalité
 * des choix dans le repli « pays non reconnu » de useLegalForms (toutes les formes
 * mélangées, suffixées du code pays) — exactement l'ambiguïté que ce hook existe
 * pour éviter.
 */
const AGENCY_COUNTRIES = COUNTRIES.filter((c) => c.code === 'CH' || c.code === 'FR' || c.code === 'LI')

/** Étape 2 du wizard identité : formulaire de l'identité légale de l'agence. */
export function StepAgence({ value, onChange }: StepAgenceProps) {
  const { t } = useTranslation('onboarding')

  // Filtrée par le pays du siège COURANT du brouillon (pas encore persisté tant que
  // l'étape n'est pas complète) — c'est la dépendance d'ordre n°1 du brief.
  const { options: legalFormOptions, isLoading: legalFormsLoading } = useLegalForms(value.country)
  const legalFormDisabled = !value.country || legalFormsLoading

  const onCountryChange = (nextCountry: string) => {
    onChange({
      country: nextCountry,
      legalFormId: legalFormIdAfterCountryChange(value.country, nextCountry, value.legalFormId),
    })
  }

  // Le choix vide en tête n'est pas un placeholder HTML : `<select>` n'en a pas,
  // la vitrine fait de même (contact.html, « Choisissez un sujet… »).
  const countryOptions = [
    { value: '', label: t('wizard.agence.fields.countryPlaceholder') },
    ...AGENCY_COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
  ]
  const legalFormSelectOptions = [
    {
      value: '',
      label: value.country
        ? t('wizard.agence.fields.legalFormPlaceholder')
        : t('wizard.agence.fields.legalFormPlaceholderNoCountry'),
    },
    ...legalFormOptions.map((o) => ({ value: o.id, label: o.label })),
  ]
  const cantonOptions = [
    { value: '', label: t('wizard.agence.fields.cantonPlaceholder') },
    ...CANTONS.map((c) => ({ value: c, label: c })),
  ]

  return (
    <div className="inner-container _634px center">
      {/* Les marges du titre sont portées par le <h1> lui-même, jamais par un
          conteneur : la feuille de la vitrine donne 20 px / 10 px à tout h1, et la
          fusion des marges avale un `mg-top-*` posé sur un parent — la classe serait
          là sans rien produire. La vitrine pose donc elle aussi ses marges sur le
          heading (about.html, pricing.html : `<h1 class="mg-bottom-2x-extra-small">`). */}
      <h1 className="display-6 mg-top-4x-extra-small mg-bottom-4x-extra-small">
        {t('wizard.agence.title')}
      </h1>
      <p className="paragraph-large text-paragraph">{t('wizard.agence.subtitle')}</p>

      <div className="mg-top-regular">
        <div className="card sign-in-card">
          <div className="pd---content-inside-card">
            {/* Les rangées n'ont pas toutes le même nombre de colonnes, elles ne
                peuvent donc pas tenir dans une grille unique. C'est `grid-1-column`
                — l'empilement de champs de la vitrine elle-même (login.html) — qui
                porte l'écart entre elles, plutôt qu'une marge répétée sur chaque
                rangée : une classe au lieu de cinq, et le champ pleine largeur
                (adresse) n'a plus besoin d'un conteneur pour être espacé comme
                les autres. */}
            <div className="grid-1-column">
              <div className="grid-2-columns">
                <MxField label={t('wizard.agence.fields.country')}>
                  {(id) => (
                    <MxSelect
                      id={id}
                      options={countryOptions}
                      value={value.country}
                      onChange={(e) => onCountryChange(e.target.value)}
                    />
                  )}
                </MxField>
                <MxField label={t('wizard.agence.fields.legalFormId')}>
                  {(id) => (
                    <MxSelect
                      id={id}
                      options={legalFormSelectOptions}
                      value={value.legalFormId}
                      onChange={(e) => onChange({ legalFormId: e.target.value })}
                      disabled={legalFormDisabled}
                      // `w-input-disabled` est l'échappatoire prévue par la feuille de la
                      // vitrine : sans elle, la règle Webflow `[disabled]` repeindrait le
                      // select en #eee, un pavé clair au milieu d'une carte sombre. Le
                      // `cursor: not-allowed` de la règle voisine, lui, est conservé.
                      className={legalFormDisabled ? 'w-input-disabled' : undefined}
                    />
                  )}
                </MxField>
              </div>

              <div className="grid-2-columns">
                <MxField
                  label={t('wizard.agence.fields.legalName')}
                  help={t('wizard.agence.fields.legalNameHint')}
                >
                  {(id) => (
                    <MxInput
                      id={id}
                      value={value.legal}
                      onChange={(e) => onChange({ legal: e.target.value })}
                      autoFocus
                    />
                  )}
                </MxField>
                <MxField
                  label={t('wizard.agence.fields.tradeName')}
                  help={t('wizard.agence.fields.tradeNameHint')}
                >
                  {(id) => (
                    <MxInput
                      id={id}
                      value={value.tradeName}
                      onChange={(e) => onChange({ tradeName: e.target.value })}
                    />
                  )}
                </MxField>
              </div>

              <div className="grid-2-columns">
                <MxField label={t('wizard.agence.fields.businessRegistrationNumber')}>
                  {(id) => (
                    <MxInput
                      id={id}
                      value={value.businessRegistrationNumber}
                      onChange={(e) => onChange({ businessRegistrationNumber: e.target.value })}
                    />
                  )}
                </MxField>
                {/* Seul champ facultatif de l'étape (décision produit 27.07.2026) : ni le
                    libellé ni `.input` ne portent de marqueur « requis »/« facultatif »,
                    cette aide est donc la seule indication visuelle du caractère optionnel. */}
                <MxField
                  label={t('wizard.agence.fields.tva')}
                  help={t('wizard.agence.fields.tvaHint')}
                >
                  {(id) => (
                    <MxInput
                      id={id}
                      value={value.tva}
                      onChange={(e) => onChange({ tva: e.target.value })}
                    />
                  )}
                </MxField>
              </div>

              <MxField label={t('wizard.agence.fields.address')}>
                {(id) => (
                  <MxInput
                    id={id}
                    value={value.address}
                    onChange={(e) => onChange({ address: e.target.value })}
                  />
                )}
              </MxField>

              {/* `_1-col-tablet` fait retomber cette rangée sur une colonne au même
                  palier (991 px) que les `grid-2-columns` ci-dessus. Sans elle, la
                  seule rangée à trois colonnes resterait à trois entre 768 et 991 px
                  alors que toutes les autres seraient déjà dépliées. */}
              <div className="grid-3-columns _1-col-tablet">
                <MxField label={t('wizard.agence.fields.postal')}>
                  {(id) => (
                    <MxInput
                      id={id}
                      value={value.postal}
                      onChange={(e) => onChange({ postal: e.target.value })}
                    />
                  )}
                </MxField>
                <MxField label={t('wizard.agence.fields.city')}>
                  {(id) => (
                    <MxInput
                      id={id}
                      value={value.city}
                      onChange={(e) => onChange({ city: e.target.value })}
                    />
                  )}
                </MxField>
                <MxField label={t('wizard.agence.fields.canton')}>
                  {(id) => (
                    <MxSelect
                      id={id}
                      options={cantonOptions}
                      value={value.canton}
                      onChange={(e) => onChange({ canton: e.target.value })}
                    />
                  )}
                </MxField>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
