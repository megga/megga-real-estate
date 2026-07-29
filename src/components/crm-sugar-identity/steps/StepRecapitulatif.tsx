/**
 * Wizard « Identité légale » (KYB) — étape 5, le récapitulatif et la soumission.
 *
 * Relit tout ce qui a été saisi aux quatre étapes précédentes, section par section,
 * avec un lien « Modifier » vers chacune (onEditStep délègue à goToStep,
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
import { SugarV2 } from '../tokens'
import { SgIcon } from '@/components/crm-sugar-wizard/primitives'
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
    <div style={{ maxWidth: 720, margin: '0 auto', animation: 'sgPage .45s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{t('wizard.recap.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 32, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.6, lineHeight: 1.15,
        }}>{t('wizard.recap.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {t('wizard.recap.subtitle')}
        </p>
      </div>

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
            <p style={{ margin: 0, fontSize: 13, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.5 }}>
              {t('wizard.recap.beneficiaires.empty')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {beneficiaires.map((b, index) => (
                <div key={b.personId ?? `new-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {index > 0 && <div style={{ height: 1, background: SugarV2.line, margin: '2px 0 8px' }} />}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: SugarV2.muted, fontWeight: 500 }}>
            <span style={{
              width: 13, height: 13, borderRadius: 999, flexShrink: 0,
              border: `2px solid ${SugarV2.line}`, borderTopColor: SugarV2.ink,
              animation: 'sgSpin .8s linear infinite',
            }} />
            {t('wizard.recap.pieceIdentite.loading')}
          </div>
        ) : identityDocumentsError ? (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: SugarV2.err, fontWeight: 500, lineHeight: 1.5 }}>
            {t('wizard.recap.pieceIdentite.loadFailed')}
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 20 }}>
            <PieceIdentiteRecapRow label={t('wizard.pieceIdentite.sides.recto')} preview={recto} />
            <PieceIdentiteRecapRow label={t('wizard.pieceIdentite.sides.verso')} preview={verso} />
          </div>
        )}
      </RecapSection>

      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
        padding: '18px 20px', borderRadius: 16, background: SugarV2.cardSubtle, marginTop: 8,
      }}>
        <input
          type="checkbox"
          checked={attestationChecked}
          onChange={(e) => onAttestationChange(e.target.checked)}
          style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0, accentColor: SugarV2.ink, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13.5, fontWeight: 500, color: SugarV2.inkSoft, lineHeight: 1.5 }}>
          {t('wizard.recap.attestation')}
        </span>
      </label>
    </div>
  )
}

/** Bento d'une section relue — même grammaire que les cartes des étapes précédentes (SugarV2.shadow), avec un lien Modifier vers l'étape source. */
function RecapSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useTranslation('onboarding')
  return (
    <div style={{
      position: 'relative', background: SugarV2.card, borderRadius: 24, padding: 24,
      boxShadow: SugarV2.shadow, display: 'flex', flexDirection: 'column', gap: 12,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: SugarV2.ink }}>{title}</div>
        <button
          type="button"
          onClick={onEdit}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: SugarV2.inkSoft,
          }}
        >
          <SgIcon name="edit" size={13} stroke={SugarV2.inkSoft} />
          {t('common:actions.edit')}
        </button>
      </div>
      {children}
    </div>
  )
}

/** Une paire libellé/valeur en lecture seule — jamais un input, cette étape ne fait que relire. */
function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13.5 }}>
      <span style={{ color: SugarV2.muted, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ color: SugarV2.ink, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

/** Statut d'un côté (recto/verso) de la pièce d'identité — aperçu si l'image est disponible, icône de repli pour un PDF ou un côté manquant (défensif : ne devrait pas arriver, isPieceIdentiteStepComplete a déjà bloqué l'avancement sinon). */
function PieceIdentiteRecapRow({ label, preview }: { label: string; preview: IdentityDocumentPreview | null }) {
  const { t } = useTranslation('onboarding')
  const isPdf = preview != null && preview.path.toLowerCase().endsWith('.pdf')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
        background: SugarV2.cardSubtle, display: 'grid', placeItems: 'center',
      }}>
        {preview == null ? (
          <SgIcon name="close" size={15} stroke={SugarV2.err} />
        ) : isPdf ? (
          <SgIcon name="inbox" size={17} stroke={SugarV2.muted} />
        ) : (
          <img src={preview.signedUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: SugarV2.ink }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: preview ? SugarV2.ok : SugarV2.err }}>
          {preview ? t('wizard.recap.pieceIdentite.uploaded') : t('wizard.recap.pieceIdentite.missing')}
        </span>
      </div>
    </div>
  )
}
