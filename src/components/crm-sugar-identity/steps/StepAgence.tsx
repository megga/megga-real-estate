/**
 * Wizard « Identité légale » (KYB) — étape 2, l'agence.
 *
 * Saisit l'identité légale de l'agence elle-même (pays du siège, forme juridique,
 * raison sociale, numéro de registre, adresse, NPA, ville, canton — huit champs
 * depuis que « Nom commercial » et « Numéro de TVA » ont quitté le parcours le
 * 03.08.2026, décision client). Contrôlée par IdentityShell (value/onChange) : cette étape ne détient
 * aucun état propre et n'écrit rien elle-même — IdentityShell persiste le brouillon
 * via useAgencyIdentity().saveAgency() au changement d'étape (cf. son en-tête).
 *
 * Peau MEGGA X depuis la refonte visuelle de l'onboarding : plus aucun token Sugar
 * ici. Le gabarit est celui des écrans d'authentification de la vitrine
 * (`inner-container _634px center` > `card sign-in-card` > `pd---content-inside-card`,
 * cf. login.html / reset-password.html — les deux seules pages qui portent
 * `sign-in-card`), et les champs reprennent le couple `<label for>` + `.input`
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
 * les huit, sans exception — même logique tout-ou-rien que le signataire. L'ancienne
 * exception (la TVA facultative, 27.07.2026) a disparu avec le champ lui-même.
 *
 * Deux champs sont assistés par un registre public, chacun avec sa mécanique parce
 * que leurs latences n'ont rien à voir :
 *  - ADRESSE : geo.admin.ch, ~300 ms, suggestions À LA FRAPPE ; un choix remplit
 *    aussi NPA, ville et canton (MxAddressAutocomplete) ;
 *  - RAISON SOCIALE : registre du commerce par LINDAS, 1,3 à 5,2 s, recherche SUR
 *    GESTE ; un choix remplit aussi le numéro de registre (MxCompanySearch).
 * Les deux restent saisissables à la main : un registre ne couvre jamais tout.
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  MxAddressAutocomplete, MxCompanySearch, MxField, MxFrenchAddressField, MxFrenchCompanyField,
  MxInput, MxSelect,
} from '@/components/megga-x'
import { countriesInLanguage } from '@/lib/countries'
import { CANTONS } from '@/lib/constants'
import { useLegalForms } from '@/hooks/useLegalForms'
import { SG_IDENTITY_ADDRESS_LABELS, SG_IDENTITY_COMPANY_LABELS, SG_IDENTITY_FR_COMPANY_LABELS } from '../tokens'
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
const AGENCY_COUNTRY_CODES = ['CH', 'FR', 'LI']

/** Étape 2 du wizard identité : formulaire de l'identité légale de l'agence. */
export function StepAgence({ value, onChange }: StepAgenceProps) {
  const { t, i18n } = useTranslation('onboarding')

  // Filtrée par le pays du siège COURANT du brouillon (pas encore persisté tant que
  // l'étape n'est pas complète) — c'est la dépendance d'ordre n°1 du brief.
  const { options: legalFormOptions, isLoading: legalFormsLoading } = useLegalForms(value.country)
  const legalFormDisabled = !value.country || legalFormsLoading

  // Le pays du siège ne filtre plus seulement les formes juridiques : il décide
  // aussi QUELS registres publics assistent la saisie, et si la colonne Canton
  // existe. Trois juridictions au sélecteur, deux outillées à ce jour.
  const estSuisse = value.country === 'CH'
  const estFrance = value.country === 'FR'

  /**
   * Le registre fédéral suisse des adresses COUVRE le Liechtenstein — union
   * douanière et postale, les NPA 9485-9499 y sont. Vérifié le 03.08.2026 :
   * « Städtle 1 · 9490 Vaduz » revient en 138 ms de geo.admin.ch. L'adresse d'une
   * agence liechtensteinoise est donc assistée exactement comme une suisse.
   *
   * ⚠ Le canton, lui, ne l'est pas : le `detail` d'une adresse FL se termine par
   * « ch » sans code cantonal, et le parseur en tirerait « CH » — que le garde
   * `CANTONS.includes()` du `onSelect` rejette. Sans conséquence ici puisque la
   * colonne Canton est masquée hors de Suisse, mais c'est ce garde qui l'empêche
   * d'écrire un canton inexistant.
   *
   * Le REGISTRE DU COMMERCE, lui, reste en saisie libre : LINDAS ne porte aucune
   * société liechtensteinoise (0 résultat sur les identifiants `FL`, mesuré), et
   * le registre officiel (oera.li) refuse les appels du navigateur — c'est un
   * formulaire HTML, pas une API. D'où le découplage ci-dessous entre l'adresse
   * (CH + LI) et la raison sociale (CH seul).
   */
  const adresseSuisseOuLi = estSuisse || value.country === 'LI'

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
    ...countriesInLanguage(i18n.language).filter((c) => AGENCY_COUNTRY_CODES.includes(c.code)).map((c) => ({ value: c.code, label: c.name })),
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
        {/* `mx-hasoverlay` lève l'`overflow: hidden` de `.card` : sans elle, la
            liste de suggestions d'adresse serait coupée net dès qu'elle dépasse
            le bas de la carte (point 12 de megga-x-additions.css). */}
        <div className="card sign-in-card mx-hasoverlay">
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

              {/* Raison sociale et numéro de registre sur la même rangée : « Nom
                  commercial » et « Numéro de TVA » ont quitté l'étape le 3 août 2026
                  (décision client — ni l'un ni l'autre ne sert au dossier KYB), ce qui
                  laissait deux rangées à un seul champ. */}
              <div className="grid-2-columns">
                {/* Raison sociale cherchable au registre du commerce (LINDAS /
                    graphe Zefix). Un résultat retenu remplit AUSSI le numéro de
                    registre : c'est le couple que l'étape doit établir, et le
                    faire saisir deux fois à la main, c'est deux occasions de se
                    tromper sur une donnée que le registre détient.

                    ⚠ Recherche sur GESTE et non à la frappe : le registre met
                    1,3 à 5,2 s à répondre à une recherche par nom, et le cas le
                    plus courant est le plus lent (cf. l'en-tête de
                    useZefixCompany.ts). La saisie libre reste première — une
                    entité non inscrite n'y figure pas. */}
                <MxField label={t('wizard.agence.fields.legalName')}>
                  {(id) => (
                    estFrance ? (
                      // France : l'API Recherche d'entreprises (DINUM) répond en
                      // 150-770 ms sans se dégrader quand on précise, donc à la
                      // frappe. Elle rend aussi le statut actif/radié, que le
                      // registre suisse ne porte pas.
                      <MxFrenchCompanyField
                        id={id}
                        value={value.legal}
                        onChange={(legal) => onChange({ legal })}
                        onSelect={(c) => onChange({
                          legal: c.name,
                          businessRegistrationNumber: c.sirenFormatted,
                        })}
                        labels={SG_IDENTITY_FR_COMPANY_LABELS}
                      />
                    ) : estSuisse ? (
                      <MxCompanySearch
                        id={id}
                        value={value.legal}
                        onChange={(legal) => onChange({ legal })}
                        onSelect={(c) => onChange({
                          legal: c.name,
                          businessRegistrationNumber: c.uidFormatted,
                        })}
                        labels={SG_IDENTITY_COMPANY_LABELS}
                      />
                    ) : (
                      // Liechtenstein, ou pays pas encore choisi : aucun registre
                      // ouvert n'a été éprouvé pour lui, et proposer une recherche
                      // qui ne trouverait jamais rien vaudrait moins que rien.
                      <MxInput
                        id={id}
                        value={value.legal}
                        onChange={(e) => onChange({ legal: e.target.value })}
                      />
                    )
                  )}
                </MxField>
                <MxField label={t('wizard.agence.fields.businessRegistrationNumber')}>
                  {(id) => (
                    <MxInput
                      id={id}
                      value={value.businessRegistrationNumber}
                      onChange={(e) => onChange({ businessRegistrationNumber: e.target.value })}
                    />
                  )}
                </MxField>
              </div>

              {/* Adresse : saisie assistée par le registre fédéral des adresses
                  (geo.admin.ch). Choisir une suggestion remplit d'un coup les trois
                  champs de la rangée suivante — c'est tout l'intérêt, un NPA et un
                  canton saisis à la main sont deux occasions de se tromper sur une
                  donnée que le registre connaît. La frappe libre reste possible : le
                  service peut être indisponible, et une adresse trop récente peut
                  manquer au registre. */}
              <MxField label={t('wizard.agence.fields.address')}>
                {(id) => (
                  estFrance ? (
                    // Base Adresse Nationale, ~200 ms. Remplit code postal et
                    // commune ; pas de canton, la France n'en a pas.
                    <MxFrenchAddressField
                      id={id}
                      value={value.address}
                      onChange={(address) => onChange({ address })}
                      onSelect={(s) => onChange({
                        address: s.street,
                        postal: s.postalCode,
                        city: s.city,
                      })}
                      labels={SG_IDENTITY_ADDRESS_LABELS}
                    />
                  ) : adresseSuisseOuLi ? (
                    <MxAddressAutocomplete
                      id={id}
                      value={value.address}
                      onChange={(address) => onChange({ address })}
                      onSelect={(s) => onChange({
                        address: s.street,
                        postal: s.postalCode,
                        city: s.city,
                        // Élargi en `readonly string[]` : `CANTONS` est un tuple de
                        // littéraux, donc son `includes` refuserait par principe toute
                        // chaîne venue du dehors — or c'est précisément ce qu'on vient
                        // vérifier. Le garde reste réel, seul le type est relâché.
                        canton: (CANTONS as readonly string[]).includes(s.canton) ? s.canton : '',
                      })}
                      labels={SG_IDENTITY_ADDRESS_LABELS}
                    />
                  ) : (
                    <MxInput
                      id={id}
                      value={value.address}
                      onChange={(e) => onChange({ address: e.target.value })}
                    />
                  )
                )}
              </MxField>

              {/* `_1-col-tablet` fait retomber cette rangée sur une colonne au même
                  palier (991 px) que les `grid-2-columns` ci-dessus. Sans elle, la
                  seule rangée à trois colonnes resterait à trois entre 768 et 991 px
                  alors que toutes les autres seraient déjà dépliées.

                  `mx-equal-columns` : sans elle, les colonnes se résolvaient à
                  238,5 / 238,5 / 58 px au lieu de trois parts égales — un `<input>`
                  porte une largeur intrinsèque minimale (~190 px) que `1fr`, qui vaut
                  `minmax(auto, 1fr)`, honore ; les deux champs texte prenaient donc
                  leur dû et le select canton tombait à 8 px utiles, réduit à son
                  chevron. Voir le point 13 de megga-x-additions.css. */}
              <div className={cn(
                estSuisse ? 'grid-3-columns' : 'grid-2-columns',
                '_1-col-tablet mx-equal-columns',
              )}>
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
                {/* Canton : SUISSE UNIQUEMENT. Il était demandé pour tous les pays,
                    avec les 26 cantons suisses pour seules options et une exigence
                    inconditionnelle dans isAgencyStepComplete — une agence française
                    ou liechtensteinoise ne pouvait donc pas terminer l'étape sans
                    s'attribuer un canton suisse. Défaut relevé le 03.08.2026 en
                    ouvrant l'étape à la France. Ni la France ni le Liechtenstein n'ont
                    de canton ; leur découpage tient déjà dans le code postal. */}
                {estSuisse && (
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
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
