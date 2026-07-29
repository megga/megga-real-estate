/**
 * Wizard « Identité légale » (KYB) — étape 4, la pièce d'identité du signataire.
 *
 * Téléversement recto/verso avec aperçu et remplacement — mais contrairement aux
 * étapes précédentes (texte tenu en brouillon React, écrit seulement au clic sur
 * Continuer), un fichier choisi est téléversé IMMÉDIATEMENT vers Storage (même motif
 * que le logo d'agence, AgencyFocusSection.tsx) : fermer l'onglet juste après avoir
 * choisi un fichier ne doit jamais le perdre, cf. la règle de persistance de
 * IdentityShell (son en-tête, « Persistance »). Il n'y a donc rien à « sauvegarder »
 * de plus au changement d'étape — persistCurrentStep (IdentityShell) ne fait ici que
 * vérifier la complétude.
 *
 * Purement contrôlée par IdentityShell, comme StepSignataire/StepAgence/
 * StepBeneficiaires : aucun accès Supabase direct ici, seulement des props (aperçus
 * déjà résolus + callback de sélection) — IdentityShell détient
 * useIdentityDocuments()/uploadIdentityDocument() (useAgencyIdentity.ts, tâche 6).
 *
 * Aucun champ ici n'écrit dans agency_person_verification_checks : cette ligne de
 * check (check_type='id_document', source='manual', result='pending_manual_review')
 * ne peut être posée que par submit_agency_identity() (RPC SECURITY DEFINER, garde
 * 42501 sur les tables de checks) — l'étape 5 (récapitulatif, tâche 7) l'appellera au
 * moment de la soumission finale.
 */
import { useRef, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2 } from '../tokens'
import { SgIcon } from '@/components/crm-sugar-wizard/primitives'
import type { IdentityDocumentPreview, IdentityDocumentSide } from '@/hooks/useAgencyIdentity'

interface StepPieceIdentiteProps {
  recto: IdentityDocumentPreview | null
  verso: IdentityDocumentPreview | null
  /** true tant que useIdentityDocuments() n'a pas encore résolu — évite un flash "vide" avant que l'aperçu existant n'apparaisse. */
  isLoading: boolean
  /** Le côté en cours de téléversement, pour son propre spinner — jamais les deux à la fois (un input à la fois). */
  uploadingSide: IdentityDocumentSide | null
  /** Message d'erreur déjà traduit (format/taille/échec réseau) — IdentityShell choisit lequel. */
  error: string | null
  /**
   * Correctif revue tâche 6, point 5 — true si useIdentityDocuments() a échoué (ex. le
   * bug de casse Storage du point 1, qui rendait l'étape bloquée en silence). Remplace
   * la grille par un état d'erreur dédié : sans donnée fiable sur ce qui est déjà
   * téléversé, montrer des tuiles vides inviterait à re-téléverser un document peut-être
   * déjà présent. Distinct de `error` (échec d'un téléversement EN COURS), qui reste
   * affiché sous la grille normale — les trois états requis par le projet (chargement,
   * vide, erreur) sont ainsi tous couverts : isLoading, grille vide/remplie, loadError.
   */
  loadError: boolean
  /** true si aucun signataire n'est encore enregistré — ne devrait pas arriver en pratique (étape 0 bloque l'avancement avant), l'écran reste défensif. */
  disabled: boolean
  onSelectFile: (side: IdentityDocumentSide, file: File) => void
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf'

/** Étape 4 du wizard identité : recto/verso de la pièce d'identité du signataire. */
export function StepPieceIdentite({
  recto, verso, isLoading, uploadingSide, error, loadError, disabled, onSelectFile,
}: StepPieceIdentiteProps) {
  const { t } = useTranslation('onboarding')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', animation: 'sgPage .45s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{t('wizard.pieceIdentite.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 32, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.6, lineHeight: 1.15,
        }}>{t('wizard.pieceIdentite.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {t('wizard.pieceIdentite.subtitle')}
        </p>
      </div>

      {disabled ? (
        <p style={{
          margin: 0, padding: '16px 20px', borderRadius: 16,
          background: SugarV2.cardSubtle, color: SugarV2.muted,
          fontSize: 13, fontWeight: 500, lineHeight: 1.5, textAlign: 'center',
        }}>
          {t('wizard.pieceIdentite.missingSignataire')}
        </p>
      ) : loadError ? (
        // Correctif revue tâche 6, point 5 : état d'erreur dédié, jamais silencieux —
        // même forme que le bloc `disabled` ci-dessus (case cardSubtle), mais teinté
        // SugarV2.err pour le distinguer visuellement d'une simple information.
        <p role="alert" style={{
          margin: 0, padding: '16px 20px', borderRadius: 16,
          background: SugarV2.cardSubtle, color: SugarV2.err,
          fontSize: 13, fontWeight: 500, lineHeight: 1.5, textAlign: 'center',
        }}>
          {t('wizard.pieceIdentite.errors.loadFailed')}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <DocumentTile
            label={t('wizard.pieceIdentite.sides.recto')}
            preview={recto}
            uploading={uploadingSide === 'recto'}
            isLoading={isLoading}
            onSelectFile={(file) => onSelectFile('recto', file)}
          />
          <DocumentTile
            label={t('wizard.pieceIdentite.sides.verso')}
            preview={verso}
            uploading={uploadingSide === 'verso'}
            isLoading={isLoading}
            onSelectFile={(file) => onSelectFile('verso', file)}
          />
        </div>
      )}

      {error && (
        <p style={{ margin: '16px 0 0', fontSize: 12.5, fontWeight: 600, color: SugarV2.err, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Une case recto/verso : vide (cliquable, ouvre le sélecteur de fichier), en cours de
 * téléversement, ou remplie (aperçu + clic = remplacer, même geste que le logo
 * d'agence — AgencyFocusSection.tsx, `<button onClick={() => fileRef.current?.click()}>`
 * enveloppant la tuile déjà servie).
 */
function DocumentTile({
  label, preview, uploading, isLoading, onSelectFile,
}: {
  label: string
  preview: IdentityDocumentPreview | null
  uploading: boolean
  isLoading: boolean
  onSelectFile: (file: File) => void
}) {
  const { t } = useTranslation('onboarding')
  const inputRef = useRef<HTMLInputElement>(null)

  const filled = preview != null
  const isPdf = filled && preview.path.toLowerCase().endsWith('.pdf')
  const busy = uploading || isLoading

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Vide la valeur de l'input : sans ça, re-sélectionner EXACTEMENT le même fichier
    // (ex. après une erreur de format corrigée autrement) ne redéclencherait pas onChange.
    e.target.value = ''
    if (file) onSelectFile(file)
  }

  return (
    <div style={{
      position: 'relative', background: SugarV2.card, borderRadius: 24, padding: 20,
      boxShadow: SugarV2.shadow, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleChange} style={{ display: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: SugarV2.ink }}>{label}</div>
        {filled && !uploading && (
          <span style={{
            width: 20, height: 20, borderRadius: 999, display: 'grid', placeItems: 'center',
            background: SugarV2.ok, flexShrink: 0,
          }}>
            <SgIcon name="check" size={11} stroke={SugarV2.onBlack} sw={3} />
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          position: 'relative', height: 160, borderRadius: 16, border: 0, padding: 0,
          background: SugarV2.cardSubtle, boxShadow: `inset 0 0 0 1px ${SugarV2.line}`,
          cursor: busy ? 'default' : 'pointer',
          display: 'grid', placeItems: 'center', overflow: 'hidden',
        }}
      >
        {busy ? (
          <span style={{
            width: 22, height: 22, borderRadius: 999,
            border: `2px solid ${SugarV2.line}`, borderTopColor: SugarV2.ink,
            animation: 'sgSpin .8s linear infinite',
          }} />
        ) : filled ? (
          isPdf ? (
            <SgIcon name="inbox" size={28} stroke={SugarV2.muted} />
          ) : (
            <img src={preview.signedUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 16px', textAlign: 'center' }}>
            <SgIcon name="upload" size={24} stroke={SugarV2.muted} />
            <span style={{ fontSize: 12, fontWeight: 600, color: SugarV2.muted }}>{t('wizard.pieceIdentite.dropHint')}</span>
          </div>
        )}
      </button>

      <div style={{ fontSize: 11, color: SugarV2.muted, fontWeight: 500, textAlign: 'center' }}>
        {filled ? t('wizard.pieceIdentite.replaceHint') : t('wizard.pieceIdentite.formatHint')}
      </div>
    </div>
  )
}
