/**
 * Wizard « Identité légale » (KYB) — étape 4, la pièce d'identité du signataire.
 *
 * Peau MEGGA X (transcription verbatim de la vitrine megga.ch, scopée `.megga-x`) :
 * l'écran ne pose plus aucune valeur de couleur, taille, rayon ou ombre — tout vient
 * des classes de la vitrine et des composants de src/components/megga-x/. La coquille
 * (IdentityShell) enveloppe le contenu dans <MeggaX>, c'est elle qui porte le fond et
 * la police ; cette étape ne rend que son contenu.
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
 * les étapes précédentes : aucun accès Supabase direct ici, seulement des props (aperçus
 * déjà résolus + callback de sélection) — IdentityShell détient
 * useIdentityDocuments()/uploadIdentityDocument() (useAgencyIdentity.ts, tâche 6).
 *
 * Aucun champ ici n'écrit dans agency_person_verification_checks : cette ligne de
 * check (check_type='id_document', source='manual', result='pending_manual_review')
 * ne peut être posée que par submit_agency_identity() (RPC SECURITY DEFINER, garde
 * 42501 sur les tables de checks) — l'étape 5 (récapitulatif, tâche 7) l'appellera au
 * moment de la soumission finale.
 */
import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MxButton, MxModal, MxStateMessage } from '@/components/megga-x'
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
    <div className="inner-container _634px center">
      <h1 className="display-6">{t('wizard.pieceIdentite.title')}</h1>
      <div className="mg-top-4x-extra-small">
        <p className="paragraph-large text-paragraph">
          {t('wizard.pieceIdentite.subtitle')}
        </p>
      </div>

      {disabled ? (
        // Information, pas erreur : une carte neutre, jamais le pavé rouge de la
        // vitrine — rien n'a échoué, il manque seulement une étape en amont.
        <div className="mg-top-medium">
          <div className="card">
            <div className="pd---content-inside-card">
              <p className="paragraph-small text-color-neutral-600 text-center">
                {t('wizard.pieceIdentite.missingSignataire')}
              </p>
            </div>
          </div>
        </div>
      ) : loadError ? (
        // Correctif revue tâche 6, point 5 : état d'erreur dédié, jamais silencieux.
        // `.error-message` porte déjà sa marge haute, d'où l'absence de mg-top-* ici.
        <MxStateMessage variant="error" role="alert">
          {t('wizard.pieceIdentite.errors.loadFailed')}
        </MxStateMessage>
      ) : (
        <div className="mg-top-medium">
          <div className="grid-2-columns">
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
        </div>
      )}

      {error && <MxStateMessage variant="error">{error}</MxStateMessage>}
    </div>
  )
}

/**
 * Une case recto/verso : vide (bouton qui ouvre le sélecteur de fichier), en cours de
 * téléversement, ou remplie (aperçu + bouton = remplacer, même geste que le logo
 * d'agence — AgencyFocusSection.tsx).
 *
 * La vitrine n'a AUCUNE zone de dépôt (vérifié sur ses 21 pages) : la case est donc
 * composée de son vocabulaire existant — `.card` + `.pd---content-inside-card` pour le
 * contenant, un bouton secondaire pour l'action. Aucune grande surface cliquable,
 * donc : le geste passe par un vrai bouton, qui garde son anneau de focus natif.
 *
 * L'APERÇU utilisait `.link-item-image-wrapper`/`.link-item-image` de la vitrine, qui
 * ne posent AUCUNE hauteur : c'était donc la photo de l'agent qui dictait la forme de
 * la tuile. Mesuré à 1440 px : un scan 1712×1080 rendait 237×150, une photo de
 * téléphone 1500×2000 rendait 237×316 — deux tuiles de hauteurs différentes, et un
 * document trop petit pour être vérifié (la carte y faisait ~90 px). Remplacé par
 * `mx-docframe` (ratio ID-1 fixe, `contain`) et un agrandissement au clic.
 *
 * Aucune retouche n'est proposée, et c'est délibéré : l'original déposé EST la pièce
 * examinée par l'équipe conformité (décision produit du 02.08.2026, « l'original doit
 * rester intact »). Une photo mal cadrée se reprend, elle ne se rogne pas.
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
  // L'agrandissement retient le CHEMIN qu'il montre, pas un simple booléen : si le
  // document change sous lui (remplacement par un fichier d'une autre extension,
  // donc d'une autre clé Storage), l'égalité cesse d'être vraie et la vue se ferme
  // d'elle-même. État dérivé plutôt qu'un effet qui appellerait setState.
  const [zoomedPath, setZoomedPath] = useState<string | null>(null)
  const zoomed = preview != null && zoomedPath === preview.path

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
    <div className="card">
      <div className="pd---content-inside-card">
        <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleChange} className="display-none" />

        <div className="flex-horizontal space-between">
          <div className="display-1 medium text-color-neutral-600">{label}</div>
          {filled && !uploading && (
            <div className="badge-light small">{t('wizard.recap.pieceIdentite.uploaded')}</div>
          )}
        </div>

        {/* Un PDF ne se rend pas dans un <img>. Plutôt que de le laisser sans
            aucune vérification possible — ce qui était le cas jusqu'ici —, il
            s'ouvre dans un onglet, où le lecteur du navigateur fait le travail.
            `noopener` : l'URL signée ne doit jamais donner la main sur l'onglet
            du wizard. */}
        {preview != null && isPdf && (
          <div className="mg-top-3x-extra-small">
            <a
              className="link-single display-1 medium"
              href={preview.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('wizard.pieceIdentite.openPdf')}
            </a>
          </div>
        )}

        {preview != null && !isPdf && (
          <div className="mg-top-3x-extra-small">
            {/* Un vrai <button> et non le wrapper d'image de la vitrine : le cadre
                est le geste d'agrandissement, il doit s'atteindre au clavier et
                garder son anneau de focus. `mx-docframe` impose le ratio d'une
                pièce d'identité et `contain` — un document déposé n'est jamais
                rogné, c'est précisément le bord manquant qu'on demande de voir. */}
            <button
              type="button"
              className="mx-docframe"
              onClick={() => setZoomedPath(preview.path)}
              aria-label={t('wizard.pieceIdentite.zoomOpen', { side: label })}
            >
              <img src={preview.signedUrl} alt={label} />
            </button>
          </div>
        )}

        <div className="mg-top-3x-extra-small">
          <MxButton
            type="button"
            variant="secondary"
            size="small"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {filled ? t('wizard.pieceIdentite.replaceHint') : t('wizard.pieceIdentite.dropHint')}
          </MxButton>
        </div>

        {/* Ligne d'état de la case : les formats acceptés au repos, l'avancement pendant
            un téléversement. `role="status"` pour que l'attente s'entende aussi — la
            peau MEGGA X n'a pas de spinner, l'attente ne se lit que là. */}
        <div className="mg-top-4x-extra-small">
          <p className="paragraph-small text-color-neutral-600" role="status">
            {uploading
              ? t('wizard.footer.saving')
              : isLoading
                ? t('wizard.recap.pieceIdentite.loading')
                : t('wizard.pieceIdentite.formatHint')}
          </p>
        </div>
      </div>

      {/* Agrandissement. Le document est montré ENTIER et à sa taille naturelle
          plafonnée à la fenêtre : c'est le seul endroit où l'agent peut juger la
          netteté et vérifier que les quatre coins sont dans le cadre. Aucune
          retouche n'y est proposée — l'original déposé est la pièce examinée, la
          seule correction possible est de reprendre la photo (bouton Remplacer,
          rappelé sous l'image). */}
      {zoomed && preview != null && (
        <MxModal
          wide
          title={label}
          closeLabel={t('wizard.pieceIdentite.zoomClose')}
          onClose={() => setZoomedPath(null)}
        >
          <img className="mx-docfull" src={preview.signedUrl} alt={label} />
          <div className="mg-top-3x-extra-small text-center">
            <p className="paragraph-small text-color-neutral-600">
              {t('wizard.pieceIdentite.zoomHint')}
            </p>
          </div>
        </MxModal>
      )}
    </div>
  )
}
