/**
 * Wizard « Identité légale » (KYB) — étape 3, la pièce d'identité du signataire.
 *
 * Peau MEGGA X (transcription verbatim de la vitrine megga.ch, scopée `.megga-x`) :
 * l'écran ne pose plus aucune valeur de couleur, taille, rayon ou ombre — tout vient
 * des classes de la vitrine et des composants de src/components/megga-x/. La coquille
 * (IdentityShell) enveloppe le contenu dans <MeggaX>, c'est elle qui porte le fond et
 * la police ; cette étape ne rend que son contenu.
 *
 * L'écran demande D'ABORD la nature de la pièce (passeport / carte d'identité /
 * titre de séjour), et c'est elle qui décide combien de faces sont réclamées :
 * identityDocumentSidesFor (useAgencyIdentity.ts), la même fonction que celle qui
 * gate le bouton Continuer. Un passeport n'a qu'une page de données — l'exiger en
 * deux faces faisait photographier une couverture vierge. La réponse est écrite dans
 * `agency_related_persons.id_document_type`, colonne posée dès l'origine
 * (migration 20260729150200) et restée vide jusqu'au 3 août 2026.
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
 * 42501 sur les tables de checks) — l'étape 4 (récapitulatif, tâche 7) l'appellera au
 * moment de la soumission finale.
 */
import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MxButton, MxField, MxModal, MxRadio, MxStateMessage } from '@/components/megga-x'
import { cn } from '@/lib/utils'
import {
  IDENTITY_DOCUMENT_TYPES, identityDocumentSidesFor,
  type IdentityDocumentPreview, type IdentityDocumentSide, type IdentityDocumentType,
  type IdentityVerificationStatus,
} from '@/hooks/useAgencyIdentity'
import type { KybIdReadRecord } from '@/types/kybIdRead'

interface StepPieceIdentiteProps {
  /** Statut de la vérification chez le prestataire — null si aucune n'a été lancée. */
  verificationStatus: IdentityVerificationStatus | null
  /** `last_error.code` de Stripe, pour expliquer un refus dans la langue de l'agent. */
  verificationErrorCode: string | null
  /** true pendant l'ouverture de la session (avant la navigation vers Stripe). */
  startingVerification: boolean
  /** true quand l'écran doit montrer le dépôt manuel à la place de la vérification. */
  manualFallback: boolean
  onStartVerification: () => void
  onUseManualFallback: () => void
  /** Nature déclarée, null tant qu'elle n'a pas été choisie — les cases n'apparaissent qu'après. */
  documentType: IdentityDocumentType | null
  recto: IdentityDocumentPreview | null
  verso: IdentityDocumentPreview | null
  /** true tant que useIdentityDocuments() n'a pas encore résolu — évite un flash "vide" avant que l'aperçu existant n'apparaisse. */
  isLoading: boolean
  /** Le côté en cours de téléversement, pour son propre spinner — jamais les deux à la fois (un input à la fois). */
  uploadingSide: IdentityDocumentSide | null
  /** true pendant l'écriture de la nature (et l'éventuel retrait du verso qui l'accompagne) — fige le groupe le temps de l'aller-retour. */
  savingDocumentType: boolean
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
  /** Verdict de la lecture assistée, null tant qu'elle n'a rien rendu (ou a échoué). */
  identityRead: KybIdReadRecord | null
  identityReading: boolean
  onSelectType: (type: IdentityDocumentType) => void
  onSelectFile: (side: IdentityDocumentSide, file: File) => void
}

/**
 * Ce que la lecture assistée a trouvé — jamais un obstacle, toujours une remarque.
 *
 * Exporté et partagé avec le récapitulatif : le dirigeant doit lire la MÊME phrase aux
 * deux endroits, sans quoi la seconde ressemblerait à un second avis.
 *
 * Trois règles de fond, dans cet ordre :
 *  1. rien ici ne bloque le bouton Continuer, et la mention le dit en toutes lettres —
 *     c'est notre équipe conformité qui tranche, pas un modèle ;
 *  2. la péremption est une ligne À PART du verdict de concordance : une pièce
 *     périmée peut parfaitement appartenir à la bonne personne, et les confondre
 *     ferait chercher au dirigeant un problème d'identité qui n'existe pas ;
 *  3. « illisible » n'accuse personne — c'est une photo à reprendre, pas un soupçon.
 */
export function IdentityReadNotice({
  read, reading,
}: { read: KybIdReadRecord | null; reading: boolean }) {
  const { t } = useTranslation('onboarding')

  if (reading) {
    return (
      <div className="mg-top-3x-extra-small">
        <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
          {t('wizard.pieceIdentite.read.running')}
        </p>
      </div>
    )
  }
  if (read == null) return null

  return (
    <div className="mg-top-3x-extra-small">
      {/* `role="status"` et non `alert` même pour un mismatch : rien n'a échoué, et
          une alerte pousserait un lecteur d'écran à interrompre la saisie en cours. */}
      <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
        {t(`wizard.pieceIdentite.read.verdict.${read.verdict}`)}
      </p>
      {read.expired === true && (
        <p className="paragraph-small text-color-neutral-600">
          {t('wizard.pieceIdentite.read.expired', { date: swissDate(read.expiresOn) })}
        </p>
      )}
      {read.documentTypeMatches === false && (
        <p className="paragraph-small text-color-neutral-600">
          {t('wizard.pieceIdentite.read.typeDiffers')}
        </p>
      )}
      <p className="paragraph-small text-color-neutral-600">
        {t('wizard.pieceIdentite.read.disclaimer')}
      </p>
    </div>
  )
}

/**
 * Date suisse (31.12.2030) depuis l'ISO rendu par la lecture.
 *
 * Réécriture de CHAÎNE, jamais `formatDate()` : mesuré le 03.08.2026, une date-seule
 * passée par `new Date()` puis réaffichée en heure locale sort la VEILLE dès que le
 * fuseau de la session est à l'ouest de UTC. Même piège, même parade qu'à la date de
 * naissance du récapitulatif (birthDate, StepRecapitulatif.tsx).
 */
function swissDate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf'

/** Étape 3 du wizard identité : recto/verso de la pièce d'identité du signataire. */
export function StepPieceIdentite({
  verificationStatus, verificationErrorCode, startingVerification, manualFallback,
  onStartVerification, onUseManualFallback,
  documentType, recto, verso, isLoading, uploadingSide, savingDocumentType,
  identityRead, identityReading, error, loadError, disabled, onSelectType, onSelectFile,
}: StepPieceIdentiteProps) {
  const { t } = useTranslation('onboarding')
  // Une seule source pour « quelles faces » : la même fonction gate le bouton
  // Continuer (isPieceIdentiteStepComplete). Demander ici une face que la garde
  // n'exige pas — ou l'inverse — serait un écran qui se contredit lui-même.
  const sides = identityDocumentSidesFor(documentType)

  return (
    <div className="inner-container _634px center">
      {/* Marge portée par le <h1> lui-même, comme aux autres étapes : la règle `h1`
          de la vitrine remet les marges à zéro, et sans cette classe le titre de
          CETTE étape seule démarrait 8 px plus haut que les trois autres — un saut
          visible au changement d'étape, la coquille ne bougeant pas autour. */}
      <h1 className="display-6 mg-top-4x-extra-small">{t('wizard.pieceIdentite.title')}</h1>
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
      ) : !manualFallback ? (
        // CHEMIN PRINCIPAL — la vérification chez le prestataire. Aucun fichier ne
        // transite par MEGGA, ce qui est tout l'intérêt du changement du 3 août 2026.
        <IdentityVerificationCard
          status={verificationStatus}
          errorCode={verificationErrorCode}
          starting={startingVerification}
          onStart={onStartVerification}
          onUseManual={onUseManualFallback}
        />
      ) : (
        <>
          {/* La nature AVANT les cases, et les cases seulement après : c'est elle qui
              décide combien de faces sont demandées. L'ordre inverse aurait fait
              déposer un verso à un porteur de passeport avant de lui apprendre qu'il
              n'en a pas — un fichier de trop, déjà en ligne, qu'il faudrait retirer. */}
          <MxField className="mg-top-medium" label={t('wizard.pieceIdentite.documentType.label')}>
            {/* `mx-equal-columns` : sans lui, `1fr 1fr 1fr` ne donne PAS trois
                colonnes égales — la piste garde un minimum `auto`, et la carte au
                libellé le plus long (allemand : « Aufenthaltstitel ») écrase les deux
                autres. Même piège que le trio adresse de l'étape 2. */}
            <div
              className="grid-3-columns mx-equal-columns"
              role="radiogroup"
              aria-label={t('wizard.pieceIdentite.documentType.label')}
            >
              {IDENTITY_DOCUMENT_TYPES.map((type) => (
                <DocumentTypeCard
                  key={type}
                  type={type}
                  selected={documentType === type}
                  disabled={savingDocumentType}
                  label={t(`wizard.pieceIdentite.documentType.options.${type}`)}
                  hint={t(`wizard.pieceIdentite.documentType.hints.${type}`)}
                  onSelect={onSelectType}
                />
              ))}
            </div>
          </MxField>

          {documentType != null && (
            <div className="mg-top-medium">
              {/* Deux colonnes pour deux faces, une seule quand la pièce n'en a
                  qu'une : une case de passeport étalée sur la moitié de la largeur
                  aurait laissé un vide inexpliqué à côté d'elle. */}
              <div className={sides.length > 1 ? 'grid-2-columns' : undefined}>
                {sides.map((side) => (
                  <DocumentTile
                    key={side}
                    // « Recto » n'a de sens qu'en face d'un verso : pour un
                    // passeport, la seule face demandée s'appelle par ce qu'elle
                    // est, la page de données.
                    label={documentType === 'passport'
                      ? t('wizard.pieceIdentite.sides.dataPage')
                      : t(`wizard.pieceIdentite.sides.${side}`)}
                    preview={side === 'recto' ? recto : verso}
                    uploading={uploadingSide === side}
                    isLoading={isLoading}
                    onSelectFile={(file) => onSelectFile(side, file)}
                  />
                ))}
              </div>
              <IdentityReadNotice read={identityRead} reading={identityReading} />
            </div>
          )}
        </>
      )}

      {error && <MxStateMessage variant="error">{error}</MxStateMessage>}
    </div>
  )
}

/**
 * La carte du chemin principal : vérifier son identité chez le prestataire.
 *
 * Quatre états, et un seul geste par état — c'est la règle qui tient cet écran :
 *  · rien encore lancé -> « Vérifier mon identité » ;
 *  · `processing` -> Stripe traite ; on NE bloque PAS le parcours (cf.
 *    isIdentityVerificationSufficient), le verdict arrivera par webhook avant que le
 *    relecteur n'ouvre le dossier ;
 *  · `verified` -> c'est fait, plus rien à faire ici ;
 *  · `requires_input` -> le motif expliqué, et « Reprendre ».
 *
 * Le dépôt manuel est TOUJOURS proposé en second recours, jamais caché : le titre de
 * séjour n'est pas dans les types que Stripe accepte, et seul le dirigeant sait quelle
 * pièce il possède. Un parcours qui ne laisserait que la vérification exclurait
 * silencieusement les détenteurs de livret B/C — soit une part notable des dirigeants
 * d'agence à Genève.
 */
function IdentityVerificationCard({
  status, errorCode, starting, onStart, onUseManual,
}: {
  status: IdentityVerificationStatus | null
  errorCode: string | null
  starting: boolean
  onStart: () => void
  onUseManual: () => void
}) {
  const { t } = useTranslation('onboarding')
  const done = status === 'verified'
  const pending = status === 'processing'
  const retry = status === 'requires_input'

  return (
    <div className="mg-top-medium">
      <div className="card">
        <div className="pd---content-inside-card">
          <div className="display-2 semi-bold">
            {t(`wizard.pieceIdentite.verification.${done ? 'doneTitle' : pending ? 'pendingTitle' : 'title'}`)}
          </div>
          <div className="mg-top-4x-extra-small">
            <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
              {t(`wizard.pieceIdentite.verification.${done ? 'doneBody' : pending ? 'pendingBody' : 'body'}`)}
            </p>
          </div>

          {/* Le motif du refus, dans la langue de l'agent. Le code brut de Stripe
              (`selfie_document_missing_photo`) n'a aucun sens pour un dirigeant : tout
              code hors du catalogue traduit retombe sur une phrase générique. */}
          {retry && (
            <div className="mg-top-4x-extra-small">
              <p className="paragraph-small text-color-neutral-600">
                {t(`wizard.pieceIdentite.verification.errors.${knownVerificationError(errorCode)}`)}
              </p>
            </div>
          )}

          {!done && (
            <div className="mg-top-3x-extra-small">
              <MxButton type="button" onClick={onStart} disabled={starting} aria-busy={starting || undefined}>
                {starting
                  ? t('wizard.footer.saving')
                  : t(`wizard.pieceIdentite.verification.${retry ? 'retryCta' : 'cta'}`)}
              </MxButton>
            </div>
          )}

          {/* Second recours, jamais mis en avant mais jamais caché non plus. */}
          {!done && (
            <div className="mg-top-4x-extra-small">
              <button type="button" className="link-single display-1 medium" onClick={onUseManual}>
                {t('wizard.pieceIdentite.verification.useManual')}
              </button>
            </div>
          )}

          <div className="mg-top-4x-extra-small">
            <p className="paragraph-small text-color-neutral-600">
              {t('wizard.pieceIdentite.verification.privacy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Les codes de refus pour lesquels il existe une phrase traduite — tout le reste retombe sur `unknown`. */
const KNOWN_VERIFICATION_ERRORS = [
  'consent_declined', 'under_supported_age', 'country_not_supported',
  'document_expired', 'document_type_not_supported', 'document_unverified_other',
  'selfie_face_mismatch', 'selfie_manipulated', 'selfie_document_missing_photo',
  'selfie_unverified_other', 'abandoned',
]

function knownVerificationError(code: string | null): string {
  return code && KNOWN_VERIFICATION_ERRORS.includes(code) ? code : 'unknown'
}

/**
 * Une des trois natures de pièce, en carte.
 *
 * Même grammaire que le pouvoir de signature de l'étape 1 (SignaturePowerCard) :
 * radio réel dans un groupe — le choix est exclusif, seul un `radiogroup`
 * l'annonce comme tel (« 1 sur 3 ») et se parcourt aux flèches — et sélection
 * portée par le liseré d'accent qui ceint la carte, la pastille restant masquée
 * visuellement mais présente dans le DOM.
 *
 * Figée pendant l'écriture (`disabled`) : ce choix part immédiatement en base et
 * peut emporter le retrait du verso ; en enchaîner deux avant que le premier ait
 * résolu ferait courir deux écritures concurrentes sur la même ligne.
 */
function DocumentTypeCard({
  type, selected, disabled, label, hint, onSelect,
}: {
  type: IdentityDocumentType
  selected: boolean
  disabled: boolean
  label: string
  hint: string
  onSelect: (type: IdentityDocumentType) => void
}) {
  return (
    <div className={cn('card mx-choice-card', selected && 'mx-choice-card--selected')}>
      <MxRadio
        className="pd---content-inside-card"
        name="identity-document-type"
        value={type}
        checked={selected}
        disabled={disabled}
        onSelect={() => onSelect(type)}
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
