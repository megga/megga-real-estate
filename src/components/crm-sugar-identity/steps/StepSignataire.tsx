/**
 * Wizard « Identité légale » (KYB) — étape 1, le signataire.
 *
 * Saisit l'identité de la personne autorisée à engager l'agence (prénom, nom,
 * date de naissance, nationalité) et son pouvoir de signature. Contrôlée par
 * IdentityShell (value/onChange) : cette étape ne détient aucun état propre et
 * n'écrit rien elle-même — IdentityShell persiste le brouillon via
 * useAgencyIdentity().savePerson() au changement d'étape (cf. son en-tête).
 *
 * Peau MEGGA X (et non plus Sugar v2) : l'étape ne pose plus aucun style, elle
 * n'assemble que des classes de la vitrine (`card sign-in-card`,
 * `pd---content-inside-card`, `grid-2-columns`, `mg-top-*` / `mg-bottom-*`) et
 * les composants `Mx*`. Elle suppose donc d'être rendue à l'intérieur du
 * conteneur `.megga-x` que monte IdentityShell — hors de ce scope, aucune de
 * ces classes n'existe.
 *
 * Champs à fournir avant de pouvoir avancer (gate : IdentityShell.isSignataireStepComplete) :
 * prénom, nom, date de naissance, nationalité, pouvoir de signature.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { MxDatePicker, MxField, MxInput, MxSelect, MxRadio } from '@/components/megga-x'
import { COUNTRIES } from '@/lib/countries'
import { SG_IDENTITY_DATE_LABELS, identityMaxBirthDate } from '../tokens'
import type { SignataireDraft } from '../IdentityShell'

interface StepSignataireProps {
  value: SignataireDraft
  onChange: (patch: Partial<SignataireDraft>) => void
}

/** Les deux pouvoirs de signature possibles, dérivés du brouillon pour ne pas les redéclarer. */
type SignaturePower = NonNullable<SignataireDraft['signaturePower']>

/** Étape 1 du wizard identité : formulaire du signataire autorisé. */
export function StepSignataire({ value, onChange }: StepSignataireProps) {
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
              étiquetage (aria-label), un `for` unique n'aurait aucune cible. */}
          <MxField className="mg-top-small" label={t('wizard.signataire.fields.signaturePower')}>
            <div
              className="grid-2-columns"
              role="radiogroup"
              aria-label={t('wizard.signataire.fields.signaturePower')}
            >
              <SignaturePowerCard
                power="individual"
                selected={value.signaturePower === 'individual'}
                label={t('wizard.signataire.signaturePower.individual')}
                hint={t('wizard.signataire.signaturePower.individualHint')}
                onSelect={(power) => onChange({ signaturePower: power })}
              />
              <SignaturePowerCard
                power="joint"
                selected={value.signaturePower === 'joint'}
                label={t('wizard.signataire.signaturePower.joint')}
                hint={t('wizard.signataire.signaturePower.jointHint')}
                onSelect={(power) => onChange({ signaturePower: power })}
              />
            </div>
          </MxField>
        </div>
      </div>
    </div>
  )
}

/**
 * Une des deux options de pouvoir de signature, en carte.
 *
 * Radio réel et non bouton `aria-pressed` : le choix est exclusif, et seul un
 * groupe radio l'annonce comme tel (« 1 sur 2 ») et se parcourt aux flèches.
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
function SignaturePowerCard({
  power, selected, label, hint, onSelect,
}: {
  power: SignaturePower
  selected: boolean
  label: string
  hint: string
  onSelect: (power: SignaturePower) => void
}) {
  return (
    // Classe explicite plutôt qu'un `:has(input:checked)` en CSS : une règle
    // structurelle attraperait aussi la carte du bénéficiaire de l'étape 3, dont
    // les radios PEP ne sont PAS dans une sous-carte — le liseré s'y poserait
    // autour de la fiche entière dès qu'on répond à la question.
    <div className={cn('card mx-choice-card', selected && 'mx-choice-card--selected')}>
      <MxRadio
        className="pd---content-inside-card"
        name="signature-power"
        value={power}
        checked={selected}
        onSelect={() => onSelect(power)}
        // Titre ET précision dans le libellé : c'est le <label> du radio qui rend
        // la carte entière cliquable, sortir la précision la réduirait au titre.
        label={(
          <>
            <span className="display-2 semi-bold">{label}</span>
            <br />
            <span className="paragraph-small text-color-neutral-600">{hint}</span>
          </>
        )}
      />
    </div>
  )
}
