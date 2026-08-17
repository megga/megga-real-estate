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

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  useMagicLinkClient,
  useMagicLinkConfirmClient,
  useMagicLinkUploadClient,
  type UploadResponse,
  type UploadFailure,
} from '@/hooks/useMagicLinkClient'
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

/**
 * La clé i18n d'un dépôt refusé — jamais le message du serveur.
 *
 * ⛔ CETTE PAGE AFFICHAIT LE CORPS BRUT DE LA RÉPONSE. Elle retirait le préfixe
 * `Upload failed: HTTP 413 ` et posait le RESTE dans la bannière, si bien qu'un
 * client suisse déposant son passeport lisait `{"error":"Link expired"}` — du
 * JSON, en anglais, sur la surface de conformité, dans une page par ailleurs
 * traduite en quatre langues. Vu à l'écran le 17 août 2026, sur le banc.
 *
 * ⚠ LE TRI SE FAIT SUR LE STATUT, PAS SUR LE TEXTE. Le champ `error` de l'edge
 * est de la prose anglaise, et l'une de ses valeurs est interpolée avec la taille
 * maximale : construire dessus serait bâtir sur une phrase. Le statut est stable,
 * et il sépare exactement ce que le client peut FAIRE — redemander un lien,
 * reprendre le dernier reçu, corriger son fichier, ou réessayer.
 *
 * ⚠ `regenerated` mérite sa phrase : il ne dit pas « lien mort » mais « un plus
 * récent existe », et l'action n'est pas la même.
 */
function cleEchecDepot(err: unknown): string {
  const e = err as Partial<UploadFailure> | null
  if (e?.reason === 'regenerated') return 'client.upload.error_link_superseded'
  if (e?.status === 404 || e?.status === 410) return 'client.upload.error_link'
  if (e?.status === 400) return 'client.upload.error_refused'
  return 'client.upload.error_default'
}

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
        onError: (err) => setUploadError(t(cleEchecDepot(err))),
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
