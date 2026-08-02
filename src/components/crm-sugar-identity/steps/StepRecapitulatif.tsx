/**
 * Wizard « Identité légale » (KYB) — étape 5, le récapitulatif et la soumission.
 *
 * Peau MEGGA X depuis la refonte visuelle de l'onboarding : l'étape ne compose plus
 * qu'avec des classes de la vitrine (`card`, `pd---content-inside-card`, `display-*`,
 * `flex-horizontal space-between`, `grid-1-column gap-row-*`) et les composants
 * `@/components/megga-x`. Elle suppose donc d'être rendue à l'intérieur du conteneur
 * `<MeggaX>` de la coquille — hors de ce scope, aucune de ces classes ne s'applique.
 * Aucune valeur (couleur, taille, rayon, ombre) n'est posée en style inline : ce qui
 * n'existe pas dans la vitrine n'est pas inventé ici, il est signalé au handoff.
 *
 * Relit tout ce qui a été saisi aux quatre étapes précédentes, section par section,
 * avec un bouton « Modifier » vers chacune (onEditStep délègue à goToStep,
 * IdentityShell.tsx). Ce qui est affiché ici DOIT correspondre à ce qui part : les
 * valeurs viennent des MÊMES brouillons (signataire, agencyDraft, beneficiaires) que
 * ceux que persistCurrentStep a déjà écrits en base à chaque changement d'étape, jamais
 * un résumé recalculé séparément. Purement contrôlée par IdentityShell, comme les
 * quatre étapes précédentes : aucun accès Supabase direct ici, aucun état propre — y
 * compris la case d'attestation (attestationChecked/onAttestationChange), qui gate le
 * bouton Soumettre du pied de page (canSubmitIdentity, IdentityShell.tsx) tout en
 * vivant ici comme n'importe quel autre contrôle contrôlé.
 *
 * Le bouton Soumettre lui-même n'est PAS rendu ici : il vit dans le pied de page
 * partagé d'IdentityShell (comme le bouton Continuer des quatre étapes précédentes),
 * avec l'indicateur de sauvegarde et la bannière d'erreur déjà en place — cf. son
 * en-tête. Cette étape ne fait donc que relire et attester, jamais soumettre elle-même.
 *
 * Bénéficiaires effectifs : section ABSENTE (pas seulement vide) quand
 * `skipBeneficiaires` est vrai — même règle d'affichage que le stepper du header
 * (visibleIdentitySteps, IdentityShell.tsx) : une étape sautée ne doit jamais
 * réapparaître ici sous une forme quelconque, y compris un message « non applicable ».
 *
 * Pièce d'identité : ne réaffiche pas un formulaire de dépôt (le fichier est déjà
 * durablement dans Storage depuis l'étape précédente, cf. l'en-tête de
 * StepPieceIdentite.tsx) mais son statut — présent/manquant, avec un aperçu quand
 * disponible. `identityDocumentsLoading`/`identityDocumentsError` reprennent
 * exactement les mêmes signaux que StepPieceIdentite (useIdentityDocuments,
 * useAgencyIdentity.ts) : les trois états chargement/vide/erreur sont donc couverts
 * ici aussi, pas seulement à l'étape où le fichier a été déposé.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { MxButton, MxCheckbox } from '@/components/megga-x'
import { COUNTRIES } from '@/lib/countries'
import { useLegalForms } from '@/hooks/useLegalForms'
import type { IdentityDocumentPreview } from '@/hooks/useAgencyIdentity'
import type { SignataireDraft, AgencyDraft, BeneficiaireDraft } from '../IdentityShell'

interface StepRecapitulatifProps {
  signataire: SignataireDraft
  agencyDraft: AgencyDraft
  /** true si l'étape bénéficiaires a été sautée (raison individuelle) — la section correspondante n'est alors pas rendue du tout. */
  skipBeneficiaires: boolean
  beneficiaires: BeneficiaireDraft[]
  recto: IdentityDocumentPreview | null
  verso: IdentityDocumentPreview | null
  /** true tant que useIdentityDocuments() n'a pas encore résolu (même signal qu'à l'étape 4). */
  identityDocumentsLoading: boolean
  /** true si useIdentityDocuments() a échoué — état d'erreur dédié, jamais une absence de document affichée à tort. */
  identityDocumentsError: boolean
  attestationChecked: boolean
  onAttestationChange: (checked: boolean) => void
  /** Ramène au step index donné (0 signataire, 1 agence, 2 bénéficiaires, 3 pièce d'identité) — délègue à goToStep, IdentityShell.tsx. */
  onEditStep: (step: number) => void
}

/** Libellé français du code pays (COUNTRIES) — même limitation « FR seulement » déjà acceptée ailleurs dans ce wizard (cf. en-tête de StepAgence.tsx). Code vide/inconnu -> chaîne vide ou le code lui-même, jamais "undefined" affiché. */
function countryName(code: string | null): string {
  if (!code) return ''
  return COUNTRIES.find((c) => c.code === code)?.name ?? code
}

/** Étape 5 du wizard identité : relecture complète, attestation, préparation de la soumission. */
export function StepRecapitulatif({
  signataire, agencyDraft, skipBeneficiaires, beneficiaires,
  recto, verso, identityDocumentsLoading, identityDocumentsError,
  attestationChecked, onAttestationChange, onEditStep,
}: StepRecapitulatifProps) {
  const { t } = useTranslation('onboarding')
  // Même requête (clé ['legal-forms', code]) que StepAgence pour ce même pays — déjà
  // chargée par l'étape 2, donc résolue en pratique dès qu'on atteint le récapitulatif.
  const { options: legalFormOptions } = useLegalForms(agencyDraft.country)
  const legalFormLabel = legalFormOptions.find((o) => o.id === agencyDraft.legalFormId)?.label ?? agencyDraft.legalFormId

  return (
    <div className="inner-container _634px center">
      <h1 className="display-6 mg-top-4x-extra-small">{t('wizard.recap.title')}</h1>
      <div className="mg-top-4x-extra-small">
        <p className="paragraph-large text-paragraph">{t('wizard.recap.subtitle')}</p>
      </div>

      <div className="mg-top-medium grid-1-column gap-row-2x-extra-small">
        <RecapSection title={t('wizard.steps.signataire')} onEdit={() => onEditStep(0)}>
          <RecapRow label={t('wizard.signataire.fields.firstName')} value={signataire.firstName} />
          <RecapRow label={t('wizard.signataire.fields.lastName')} value={signataire.lastName} />
          <RecapRow label={t('wizard.signataire.fields.dateOfBirth')} value={signataire.dateOfBirth ?? ''} />
          <RecapRow label={t('wizard.signataire.fields.nationality')} value={countryName(signataire.nationality)} />
          <RecapRow
            label={t('wizard.signataire.fields.signaturePower')}
            value={signataire.signaturePower ? t(`wizard.signataire.signaturePower.${signataire.signaturePower}`) : ''}
          />
        </RecapSection>

        <RecapSection title={t('wizard.steps.agence')} onEdit={() => onEditStep(1)}>
          <RecapRow label={t('wizard.agence.fields.country')} value={countryName(agencyDraft.country)} />
          <RecapRow label={t('wizard.agence.fields.legalFormId')} value={legalFormLabel} />
          <RecapRow label={t('wizard.agence.fields.legalName')} value={agencyDraft.legal} />
          <RecapRow label={t('wizard.agence.fields.tradeName')} value={agencyDraft.tradeName} />
          <RecapRow label={t('wizard.agence.fields.businessRegistrationNumber')} value={agencyDraft.businessRegistrationNumber} />
          <RecapRow label={t('wizard.agence.fields.tva')} value={agencyDraft.tva.trim() || t('wizard.recap.notProvided')} />
          <RecapRow
            label={t('wizard.agence.fields.address')}
            value={`${agencyDraft.address}, ${agencyDraft.postal} ${agencyDraft.city}, ${agencyDraft.canton}`}
          />
        </RecapSection>

        {!skipBeneficiaires && (
          <RecapSection title={t('wizard.steps.beneficiaires')} onEdit={() => onEditStep(2)}>
            {beneficiaires.length === 0 ? (
              <p className="paragraph-small text-color-neutral-600">
                {t('wizard.recap.beneficiaires.empty')}
              </p>
            ) : (
              <div className="grid-1-column gap-row-2x-extra-small">
                {beneficiaires.map((b, index) => (
                  <div key={b.personId ?? `new-${index}`} className="grid-1-column gap-row-3x-extra-small">
                    {index > 0 && <div className="divider" />}
                    <RecapRow label={t('wizard.beneficiaires.fields.firstName')} value={`${b.firstName} ${b.lastName}`} />
                    <RecapRow label={t('wizard.beneficiaires.fields.nationality')} value={countryName(b.nationality)} />
                    <RecapRow
                      label={t('wizard.beneficiaires.fields.ownershipPct')}
                      value={t('wizard.recap.beneficiaires.ownership', { pct: b.ownershipPct ?? 0 })}
                    />
                    <RecapRow
                      label={t('wizard.beneficiaires.pep.label')}
                      value={b.pepSelfDeclared ? t('wizard.beneficiaires.pep.yes') : t('wizard.beneficiaires.pep.no')}
                    />
                  </div>
                ))}
              </div>
            )}
          </RecapSection>
        )}

        <RecapSection title={t('wizard.steps.pieceIdentite')} onEdit={() => onEditStep(3)}>
          {identityDocumentsLoading ? (
            // Texte seul, sans roue d'attente : la vitrine n'a aucun indicateur de
            // progression indéterminé, et son écran d'attente équivalent
            // (IdentityPreparingScreen) annonce lui aussi le chargement en toutes lettres.
            <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
              {t('wizard.recap.pieceIdentite.loading')}
            </p>
          ) : identityDocumentsError ? (
            <p className="paragraph-small mx-field__error" role="alert">
              {t('wizard.recap.pieceIdentite.loadFailed')}
            </p>
          ) : (
            <div className="flex align-top gap-small">
              <PieceIdentiteRecapRow label={t('wizard.pieceIdentite.sides.recto')} preview={recto} />
              <PieceIdentiteRecapRow label={t('wizard.pieceIdentite.sides.verso')} preview={verso} />
            </div>
          )}
        </RecapSection>

        <div className="card">
          <div className="pd---content-inside-card">
            <MxCheckbox
              className="paragraph-small"
              checked={attestationChecked}
              onCheckedChange={onAttestationChange}
              label={t('wizard.recap.attestation')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Carte d'une section relue — même gabarit que les cartes de la vitrine (`card` > `pd---content-inside-card`), avec un bouton Modifier vers l'étape source. */
function RecapSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useTranslation('onboarding')
  return (
    <section className="card">
      <div className="pd---content-inside-card">
        <div className="flex-horizontal space-between gap-16px">
          <h2 className="display-3 semi-bold">{title}</h2>
          {/* Le petit bouton secondaire est le seul bouton discret de la vitrine :
              elle n'a ni bouton fantôme ni lien-action. Reste un <button>, pas un
              <a href="#"> — l'action ne navigue pas, elle ramène à une étape. */}
          <MxButton type="button" variant="secondary" size="small" onClick={onEdit}>
            {t('common:actions.edit')}
          </MxButton>
        </div>
        <div className="mg-top-2x-extra-small grid-1-column gap-row-3x-extra-small">{children}</div>
      </div>
    </section>
  )
}

/** Une paire libellé/valeur en lecture seule — jamais un input, cette étape ne fait que relire. */
function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-horizontal space-between gap-16px">
      <span className="display-1 text-color-neutral-600">{label}</span>
      <span className="display-1 medium text-color-neutral-600">{value}</span>
    </div>
  )
}

/**
 * Statut d'un côté (recto/verso) de la pièce d'identité. L'aperçu n'est rendu que
 * pour une image : un PDF ou un côté manquant n'a pas de vignette de repli, faute
 * d'icône dont le glyphe soit attesté dans la vitrine — le statut en toutes lettres
 * porte alors seul l'information (défensif : isPieceIdentiteStepComplete a déjà
 * bloqué l'avancement si un côté manque).
 */
function PieceIdentiteRecapRow({ label, preview }: { label: string; preview: IdentityDocumentPreview | null }) {
  const { t } = useTranslation('onboarding')
  const isPdf = preview != null && preview.path.toLowerCase().endsWith('.pdf')

  return (
    <div className="grid-1-column gap-row-4x-extra-small">
      {preview != null && !isPdf && (
        <div className="card logo-icon-card">
          {/* `link-item-image _w-h-100` : sans elles l'image garde sa hauteur
              intrinsèque et déborde la tuile (128 px fixes), que `overflow:hidden`
              rognerait alors de façon différente pour le recto et le verso. */}
          <img className="link-item-image _w-h-100" src={preview.signedUrl} alt={label} />
        </div>
      )}
      <span className="display-1 medium text-color-neutral-600">{label}</span>
      <p className={cn('paragraph-small', preview ? 'text-color-neutral-600' : 'mx-field__error')}>
        {preview ? t('wizard.recap.pieceIdentite.uploaded') : t('wizard.recap.pieceIdentite.missing')}
      </p>
    </div>
  )
}
