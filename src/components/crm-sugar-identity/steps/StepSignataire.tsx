/**
 * Wizard « Identité légale » (KYB) — étape 1, la personne qui saisit le dossier.
 *
 * Saisit son identité (prénom, nom, date de naissance, nationalité) et son RÔLE dans
 * l'agence. Contrôlée par IdentityShell (value/onChange) : cette étape ne détient aucun
 * état propre et n'écrit rien elle-même — IdentityShell persiste le brouillon via
 * useAgencyIdentity().savePerson() au changement d'étape (cf. son en-tête).
 *
 * ⚠ « QUEL EST VOTRE RÔLE » A REMPLACÉ « POUVOIR DE SIGNATURE » le 4 août 2026
 * (décision client). Les deux questions ne se recouvrent pas : l'ancienne demandait si
 * la personne peut engager l'agence SEULE ou conjointement — un fait de conformité —,
 * la nouvelle demande sa place dans l'organisation, avec les quatre rôles que le CRM
 * connaît déjà (Réglages › Équipe). La qualité de signataire, elle, n'a pas disparu :
 * IdentityShell continue d'écrire le rôle de conformité `signatory`, que la RPC de
 * soumission exige, simplement sans pouvoir de signature (colonne déjà nullable).
 *
 * Le rôle choisi ici est appliqué au COMPTE (profiles.role) à la soumission du dossier,
 * jamais avant, et jamais s'il retirait à l'agence son dernier administrateur — les
 * trois raisons du délai et le garde-fou sont dans la migration 20260804170100. La carte
 * concernée porte cette réserve à l'écran (`lastAdminNotice`), au moment du choix : une
 * réserve découverte après coup serait une promesse trahie.
 *
 * Peau MEGGA X : l'étape ne pose aucun style, elle n'assemble que des classes de la
 * vitrine (`card sign-in-card`, `pd---content-inside-card`, `grid-2-columns`,
 * `mg-top-*` / `mg-bottom-*`) et les composants `Mx*`. Elle suppose donc d'être rendue à
 * l'intérieur du conteneur `.megga-x` que monte IdentityShell — hors de ce scope, aucune
 * de ces classes n'existe.
 *
 * Champs à fournir avant de pouvoir avancer (gate : IdentityShell.isSignataireStepComplete) :
 * prénom, nom, date de naissance, nationalité, rôle.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { MxDatePicker, MxField, MxInput, MxSelect, MxRadio } from '@/components/megga-x'
import { COUNTRIES } from '@/lib/countries'
import { AGENCY_DECLARED_ROLES, type AgencyDeclaredRole } from '@/hooks/useAgencyIdentity'
import { SG_IDENTITY_DATE_LABELS, identityMaxBirthDate } from '../tokens'
import type { SignataireDraft } from '../IdentityShell'

interface StepSignataireProps {
  value: SignataireDraft
  onChange: (patch: Partial<SignataireDraft>) => void
  /**
   * true si l'agence n'a pas d'AUTRE administrateur que la personne qui saisit — cas
   * de toute agence solo, donc de presque tout onboarding. Les rôles autres qu'Admin
   * portent alors une réserve : le dossier retiendra le rôle déclaré, le compte gardera
   * ses droits d'administrateur (garde-fou de submit_agency_identity).
   */
  isOnlyAdmin: boolean
}

/** Étape 1 du wizard identité : identité et rôle de la personne qui saisit le dossier. */
export function StepSignataire({ value, onChange, isOnlyAdmin }: StepSignataireProps) {
  const { t } = useTranslation('onboarding')

  // ~200 pays : sans mémoïsation la liste entière serait reconstruite à chaque
  // frappe dans les champs texte de l'étape.
  const nationalityOptions = useMemo(
    () => [
      { value: '', label: t('wizard.signataire.fields.nationalityPlaceholder') },
      ...COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
    ],
    [t],
  )

  return (
    <div className="inner-container _634px center">
      {/* Marges sur le <h1> lui-même, jamais sur un div qui l'enveloppe : la
          feuille de base donne au h1 un `margin: 20px 0 10px` que `.display-6`
          ne remet pas à zéro, et un wrapper sans bordure ni padding FUSIONNE
          avec ces marges au lieu de s'y ajouter (l'écart réel ne vaut alors pas
          ce que la classe annonce). Les utilitaires posés ici l'emportent —
          deux classes contre une classe + un type. C'est aussi l'idiome de la
          vitrine, qui écrit `<h1 class="mg-bottom-2x-extra-small">` dans ses
          sept hero (about.html, pricing.html…) : d'où les 16 px sous le titre. */}
      <h1 className="display-6 mg-top-3x-extra-small mg-bottom-2x-extra-small">
        {t('wizard.signataire.title')}
      </h1>
      <p className="paragraph-large text-paragraph">{t('wizard.signataire.subtitle')}</p>

      <div className="card sign-in-card mg-top-medium">
        <div className="pd---content-inside-card">
          <div className="grid-2-columns">
            <MxField label={t('wizard.signataire.fields.firstName')}>
              {(id) => (
                <MxInput
                  id={id}
                  value={value.firstName}
                  onChange={(e) => onChange({ firstName: e.target.value })}
                  autoFocus
                />
              )}
            </MxField>
            <MxField label={t('wizard.signataire.fields.lastName')}>
              {(id) => (
                <MxInput
                  id={id}
                  value={value.lastName}
                  onChange={(e) => onChange({ lastName: e.target.value })}
                />
              )}
            </MxField>
          </div>

          <div className="grid-2-columns mg-top-small">
            <MxField label={t('wizard.signataire.fields.dateOfBirth')}>
              {(id) => (
                // MxDatePicker et non `<MxInput type="date">` : ce dernier délègue
                // son calendrier au navigateur, donc à la DA de Chrome au milieu
                // du parcours (cf. l'en-tête de MxDatePicker.tsx). Le contrat de
                // valeur est identique — ISO ou null, la colonne étant nullable.
                <MxDatePicker
                  id={id}
                  value={value.dateOfBirth}
                  onChange={(iso) => onChange({ dateOfBirth: iso })}
                  max={identityMaxBirthDate()}
                  labels={SG_IDENTITY_DATE_LABELS}
                />
              )}
            </MxField>
            <MxField label={t('wizard.signataire.fields.nationality')}>
              {(id) => (
                <MxSelect
                  id={id}
                  options={nationalityOptions}
                  value={value.nationality ?? ''}
                  onChange={(e) => onChange({ nationality: e.target.value || null })}
                />
              )}
            </MxField>
          </div>

          {/* MxField en nœud simple, pas en fonction : le groupe porte son propre
              étiquetage (aria-label), un `for` unique n'aurait aucune cible.
              Quatre cartes sur `grid-2-columns` : deux rangées de deux, sans qu'aucune
              option ne se retrouve seule sur sa ligne. */}
          <MxField className="mg-top-small" label={t('wizard.signataire.fields.agencyRole')}>
            <div
              className="grid-2-columns"
              role="radiogroup"
              aria-label={t('wizard.signataire.fields.agencyRole')}
            >
              {AGENCY_DECLARED_ROLES.map((role) => (
                <AgencyRoleCard
                  key={role}
                  role={role}
                  selected={value.agencyRole === role}
                  label={t(`wizard.signataire.agencyRole.${role}`)}
                  hint={t(`wizard.signataire.agencyRole.${role}Hint`)}
                  // La réserve ne concerne QUE les rôles qui retireraient le dernier
                  // administrateur : la porter aussi sur la carte Admin ferait lire
                  // un avertissement à qui ne change rien.
                  notice={isOnlyAdmin && role !== 'admin' ? t('wizard.signataire.agencyRole.lastAdminNotice') : null}
                  onSelect={(next) => onChange({ agencyRole: next })}
                />
              ))}
            </div>
          </MxField>
        </div>
      </div>
    </div>
  )
}

/**
 * Un des quatre rôles d'agence, en carte.
 *
 * Radio réel et non bouton `aria-pressed` : le choix est exclusif, et seul un
 * groupe radio l'annonce comme tel (« 1 sur 4 ») et se parcourt aux flèches.
 *
 * L'état sélectionné se lit sur un LISERÉ d'accent qui ceint la carte entière
 * (`mx-choice-card--selected`), et sur lui seul : la pastille du radio est
 * masquée (demande du 3 août 2026), elle faisait doublon sur une option qui
 * tient en deux lignes. Masquage VISUEL uniquement — l'`<input type="radio">`
 * reste coché, groupé et navigable aux flèches ; c'est lui qui porte l'état pour
 * les lecteurs d'écran.
 *
 * Ce n'est pas pour autant une information portée par la seule COULEUR (WCAG
 * 1.4.1) : entre la bordure au repos (#181818) et le liseré (#424bfb) il y a un
 * écart de luminance de 3,07:1 — le trait reste donc lisible en niveaux de gris,
 * ce qu'un simple changement de teinte ne garantirait pas.
 *
 * Le focus clavier ne peut pas venir de la carte elle-même : MxRadio masque
 * l'input natif (`opacity: 0`) et la vitrine annule le halo Webflow
 * (`.radio-button.w--redirected-focus{box-shadow:none}`). Il vient du point 2 de
 * megga-x-additions.css, qui rend un `outline` sur la carte porteuse via
 * `:has(input[type="radio"]:focus-visible)` — un outline et non un box-shadow,
 * que l'`overflow: hidden` de la carte rognerait. Vérifié au clavier le
 * 03.08.2026 : anneau indigo de 2 px sur la carte tabulée.
 */
function AgencyRoleCard({
  role, selected, label, hint, notice, onSelect,
}: {
  role: AgencyDeclaredRole
  selected: boolean
  label: string
  hint: string
  /** Réserve du garde-fou « dernier administrateur », ou null quand elle ne s'applique pas. */
  notice: string | null
  onSelect: (role: AgencyDeclaredRole) => void
}) {
  return (
    // Classe explicite plutôt qu'un `:has(input:checked)` en CSS : une règle
    // structurelle attraperait toute carte contenant un radio coché, y compris
    // celles dont les radios ne sont PAS dans une sous-carte — le liseré s'y
    // poserait autour de la fiche entière dès qu'on répond à la question.
    <div className={cn('card mx-choice-card', selected && 'mx-choice-card--selected')}>
      <MxRadio
        className="pd---content-inside-card"
        name="agency-role"
        value={role}
        checked={selected}
        onSelect={() => onSelect(role)}
        // Titre, précision ET réserve dans le libellé : c'est le <label> du radio qui
        // rend la carte entière cliquable, en sortir un morceau le rendrait inerte.
        // La réserve est dans le libellé pour la même raison qu'elle est visible avant
        // le choix — un lecteur d'écran l'entend en parcourant les options, pas après.
        label={(
          <>
            <span className="display-2 semi-bold">{label}</span>
            <br />
            <span className="paragraph-small text-color-neutral-600">{hint}</span>
            {notice && (
              <>
                <br />
                <span className="paragraph-small text-color-neutral-600">{notice}</span>
              </>
            )}
          </>
        )}
      />
    </div>
  )
}
