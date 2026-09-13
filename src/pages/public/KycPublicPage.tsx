// MEGGA — Page publique KYC Magic Link (côté client, sans compte MEGGA)
// Sprint 4.7.C — Route /kyc/:token (route publique, HORS AgentLayout)
//
// Cette page orchestre le parcours client :
//   - Vérifie le token HMAC via /functions/v1/magic-link-get
//   - Affiche MlkLanding → MlkUpload → MlkSuccess selon le status
//   - MlkExpired si le lien est expiré ou révoqué
//   - MlkPlaceholder pour les états de chargement / erreur réseau
//
// La cliente n'a JAMAIS conscience qu'elle est sur l'app MEGGA — c'est juste
// un "lien sécurisé envoyé par son agent". Tone : rassurant, professionnel.
//
// Un refus de dépôt s'affiche par sa CATÉGORIE (MagicLinkUploadError), traduite ici :
// jamais le corps de la réponse, qui arrivait brut à l'écran, JSON compris (audit S10).

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  useMagicLinkClient,
  useMagicLinkConfirmClient,
  useMagicLinkUploadClient,
  type UploadResponse,
} from '@/hooks/useMagicLinkClient'
import { MagicLinkUploadError, type MagicLinkUploadFailure } from '@/lib/magicLinkUploadErrors'
import { MlkBackground } from '@/components/kyc-magic-link/MlkPrimitives'
import {
  MlkExpired,
  MlkLanding,
  MlkPlaceholder,
  MlkSuccess,
  MlkUpload,
} from '@/components/kyc-magic-link/MlkScreens'
import { MlkBooking } from '@/components/kyc-magic-link/MlkBooking'

type LocalScreen = 'landing' | 'upload' | 'booking'

// ─── Plafonds du lien — MIROIR du serveur ─────────────────────────────────
// Ils recopient `supabase/functions/_shared/magic-link-limits.ts` et le trigger
// `enforce_kyc_magic_link_upload_caps` (migration 20260913160400), qui font foi : la page
// ne fait que prévenir AVANT l'envoi, au lieu de faire téléverser 10 Mo pour rien. Le
// front ne peut pas importer un module edge (autre runtime) : c'est
// `tests/unit/magic-link-upload-caps.spec.ts` qui confronte les deux copies.
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 20
const MAX_TOTAL_BYTES = 100 * 1024 * 1024
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']

export default function KycPublicPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation('kyc')
  const { data, isLoading, error } = useMagicLinkClient(token)
  const uploadMut = useMagicLinkUploadClient()
  const confirmMut = useMagicLinkConfirmClient()

  // L'écran courant : par défaut Landing tant que la cliente n'a pas cliqué
  // "Commencer". Si elle a déjà uploadé au moins 1 pièce, on saute directement
  // à Upload (cas où elle ré-ouvre le lien après un upload partiel).
  const [localScreen, setLocalScreen] = useState<LocalScreen>('landing')
  const [localUploads, setLocalUploads] = useState<UploadResponse[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Sync auto landing → upload si le lien a déjà des uploads serveur
  useEffect(() => {
    if (data && 'status' in data && data.status === 'uploading' && data.uploads.length > 0) {
      setLocalScreen('upload')
    }
  }, [data])

  // ─── États de chargement / erreur ─────────────────────────────────────
  if (!token) {
    return (
      <MlkBackground>
        <MlkPlaceholder
          title={t('client.placeholder.invalid_title')}
          message={t('client.placeholder.invalid_body')}
          iconName="alert"
        />
      </MlkBackground>
    )
  }

  if (isLoading) {
    return (
      <MlkBackground>
        <MlkPlaceholder
          title={t('client.placeholder.loading_title')}
          message={t('client.placeholder.loading_body')}
          iconName="lock"
        />
      </MlkBackground>
    )
  }

  if (error) {
    return (
      <MlkBackground>
        <MlkPlaceholder
          title={t('client.placeholder.network_title')}
          message={t('client.placeholder.network_body')}
          iconName="alert"
        />
      </MlkBackground>
    )
  }

  if (!data) {
    return null
  }

  // ─── Réponse "lien expiré" du serveur (status 410) ────────────────────
  // Type guard : MagicLinkLoadError a `status: number` (HTTP code), les deux
  // formes servies (MagicLinkPublicView, MagicLinkSubmittedView) un statut texte.
  if (typeof data.status === 'number') {
    // Erreur structurée du backend : token invalide / expiré / superseded
    const isExpired = data.status === 410 || data.reason === 'expired'
    return (
      <MlkBackground>
        {isExpired ? (
          <MlkExpired />
        ) : (
          <MlkPlaceholder
            title={t('client.placeholder.invalid_title')}
            message={data.message ?? t('client.placeholder.expired_link_body')}
            iconName="alert"
          />
        )}
      </MlkBackground>
    )
  }

  // ─── À partir d'ici : lien ouvert (vue complète) ou lien soumis ───────
  // Un lien soumis ne porte AUCUN nom (magic-link-get) : les écrans qui suivent la
  // soumission affichent donc leurs replis. Le type le dit au lieu de le laisser croire.
  const vue = data.status === 'submitted' ? null : data
  const firstName =
    vue?.contact?.first_name?.trim() || t('client.placeholder.fallback_first_name')
  const agentFullName =
    vue?.agent?.full_name?.trim() || t('client.placeholder.fallback_agent')
  const agencyName =
    vue?.agency?.name?.trim() || t('client.placeholder.fallback_agency')

  // Status submitted → Success, puis prise de rendez-vous de vérification.
  // Deux écrans plutôt qu'un : la cliente vient de déposer ses pièces et doit
  // d'abord lire que MEGGA les a bien reçues. Enchaîner directement sur un
  // calendrier escamoterait cet accusé de réception, qui est la seule chose
  // qu'elle attend à cet instant.
  if (data.status === 'submitted') {
    if (localScreen === 'booking') {
      return (
        <MlkBackground>
          <MlkBooking
            token={token}
            firstName={firstName}
            agentFullName={agentFullName}
            agencyName={agencyName}
          />
        </MlkBackground>
      )
    }
    return (
      <MlkBackground>
        <MlkSuccess
          firstName={firstName}
          agentFullName={agentFullName}
          agencyName={agencyName}
          onBook={() => setLocalScreen('booking')}
        />
      </MlkBackground>
    )
  }

  // Status expired (sécurité — le 410 devrait avoir match avant mais on garde)
  if (data.status === 'expired') {
    return (
      <MlkBackground>
        <MlkExpired agentFullName={agentFullName} agencyName={agencyName} />
      </MlkBackground>
    )
  }

  // ─── Flow Landing → Upload ────────────────────────────────────────────
  const serverUploads = data.uploads ?? []
  // Fusion serveur (truth) + uploads locaux (en cours / juste reçus, avant
  // refetch). On dédup par filename + uploaded_at pour éviter doublons.
  const allUploads = (() => {
    const merged = new Map<string, UploadResponse>()
    for (const s of serverUploads) {
      merged.set(`${s.filename}-${s.uploaded_at}`, {
        upload_id: s.id,
        filename: s.filename,
        size_bytes: s.size_bytes,
        type: s.type,
        sha256_hash: null,
        uploaded_at: s.uploaded_at,
        status: 'received',
      })
    }
    for (const l of localUploads) {
      merged.set(`${l.filename}-${l.uploaded_at}`, l)
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime(),
    )
  })()

  /** La phrase de chaque catégorie de refus — un `Record` pour qu'aucune ne soit oubliée. */
  const messageDeRefus = (failure: MagicLinkUploadFailure, file: File): string => {
    const phrases: Record<MagicLinkUploadFailure, string> = {
      length_required: t('client.upload.error_length_required'),
      too_large: t('client.upload.error_size', { mb: (file.size / 1024 / 1024).toFixed(1) }),
      upload_limit: t('client.upload.error_limit', { max: MAX_FILES, mb: MAX_TOTAL_BYTES / 1024 / 1024 }),
      not_uploadable: t('client.upload.error_not_uploadable'),
      format: t('client.upload.error_format', { type: file.type }),
      expired: t('client.placeholder.expired_link_body'),
      invalid: t('client.placeholder.invalid_body'),
      other: t('client.upload.error_default'),
    }
    return phrases[failure]
  }

  const handleFilePick = (file: File, type: 'identity' | 'address' | 'funds' | 'other') => {
    setUploadError(null)

    // Validation client-side — les plafonds du serveur, recopiés en tête de fichier.
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      setUploadError(messageDeRefus('too_large', file))
      return
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError(messageDeRefus('format', file))
      return
    }
    const cumul = allUploads.reduce((total, u) => total + u.size_bytes, 0)
    if (allUploads.length >= MAX_FILES || cumul + file.size > MAX_TOTAL_BYTES) {
      setUploadError(messageDeRefus('upload_limit', file))
      return
    }

    uploadMut.mutate(
      { token, file, type },
      {
        onSuccess: (resp) => {
          setLocalUploads((prev) => [...prev, resp])
        },
        onError: (err) => {
          setUploadError(messageDeRefus(err instanceof MagicLinkUploadError ? err.failure : 'other', file))
        },
      },
    )
  }

  const handleConfirm = () => {
    if (allUploads.length === 0) {
      setUploadError(t('client.upload.error_min_one'))
      return
    }
    confirmMut.mutate({ token })
  }

  const contactSummary = `${firstName} · ${agencyName}`

  return (
    <MlkBackground>
      {localScreen === 'landing' ? (
        <MlkLanding
          firstName={firstName}
          agentFullName={agentFullName}
          agencyName={agencyName}
          expiresAt={data.expires_at}
          onStart={() => setLocalScreen('upload')}
        />
      ) : (
        <MlkUpload
          firstName={firstName}
          agentFullName={agentFullName}
          agencyName={agencyName}
          contactSummary={contactSummary}
          uploaded={allUploads.map((u) => ({
            id: u.upload_id,
            type: u.type,
            filename: u.filename,
            size_bytes: u.size_bytes,
            uploaded_at: u.uploaded_at,
          }))}
          isUploading={uploadMut.isPending}
          uploadError={uploadError}
          onFilePick={handleFilePick}
          onConfirm={handleConfirm}
          isConfirming={confirmMut.isPending}
        />
      )}
    </MlkBackground>
  )
}
