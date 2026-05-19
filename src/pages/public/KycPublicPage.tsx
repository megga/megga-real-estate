// MEGGA — Page publique KYC Magic Link (côté client, sans compte MEGGA)
// Sprint 4.7.C — Route /kyc/:token (HORS PasswordGate, HORS AgentLayout)
//
// Cette page orchestre le parcours client :
//   - Vérifie le token HMAC via /functions/v1/magic-link-get
//   - Affiche MlkLanding → MlkUpload → MlkSuccess selon le status
//   - MlkExpired si le lien est expiré ou révoqué
//   - MlkPlaceholder pour les états de chargement / erreur réseau
//
// La cliente n'a JAMAIS conscience qu'elle est sur l'app MEGGA — c'est juste
// un "lien sécurisé envoyé par son agent". Tone : rassurant, professionnel.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  useMagicLinkClient,
  useMagicLinkConfirmClient,
  useMagicLinkUploadClient,
  type UploadResponse,
} from '@/hooks/useMagicLinkClient'
import { MlkBackground } from '@/components/kyc-magic-link/MlkPrimitives'
import {
  MlkExpired,
  MlkLanding,
  MlkPlaceholder,
  MlkSuccess,
  MlkUpload,
} from '@/components/kyc-magic-link/MlkScreens'

type LocalScreen = 'landing' | 'upload'

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
  // Type guard : MagicLinkLoadError a `status: number` (HTTP code),
  // MagicLinkPublicView a `status: MagicLinkStatus` (string).
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

  // ─── À partir d'ici, data est un MagicLinkPublicView valide ───────────
  const firstName =
    data.contact?.first_name?.trim() || t('client.placeholder.fallback_first_name')
  const agentFullName =
    data.agent?.full_name?.trim() || t('client.placeholder.fallback_agent')
  const agencyName =
    data.agency?.name?.trim() || t('client.placeholder.fallback_agency')

  // Status submitted → écran Success final
  if (data.status === 'submitted') {
    return (
      <MlkBackground>
        <MlkSuccess
          firstName={firstName}
          agentFullName={agentFullName}
          agencyName={agencyName}
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

  const handleFilePick = (file: File, type: 'identity' | 'address' | 'funds' | 'other') => {
    setUploadError(null)

    // Validation client-side
    const MAX_BYTES = 10 * 1024 * 1024
    if (file.size <= 0 || file.size > MAX_BYTES) {
      setUploadError(t('client.upload.error_size', { mb: (file.size / 1024 / 1024).toFixed(1) }))
      return
    }
    const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!ALLOWED.includes(file.type)) {
      setUploadError(t('client.upload.error_format', { type: file.type }))
      return
    }

    uploadMut.mutate(
      { token, file, type },
      {
        onSuccess: (resp) => {
          setLocalUploads((prev) => [...prev, resp])
        },
        onError: (err) => {
          setUploadError(
            err instanceof Error
              ? err.message.replace(/^Upload failed: HTTP \d+ /, '')
              : t('client.upload.error_default'),
          )
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
