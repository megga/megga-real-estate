// MEGGA — Types KYC Magic Link (Sprint 4.7)
// Source de vérité : supabase/migrations/20260520_003_kyc_magic_links.sql

export type MagicLinkMode = 'libre' | 'verifiee'

export type MagicLinkChannel = 'email' | 'sms'

export type MagicLinkStatus =
  | 'pending'      // créé, pas encore ouvert par le client
  | 'opened'       // client a ouvert le lien (1er GET)
  | 'uploading'    // ≥ 1 upload reçu, pas encore confirmé
  | 'verifying'    // mode verifiee : client est sur l'écran de confirmation OCR
  | 'submitted'    // confirmé par client → dossier KYC peut avancer
  | 'expired'      // expiresAt dépassé sans soumission

export type MagicLinkUploadType = 'identity' | 'address' | 'funds' | 'other'

/** Row complète `kyc_magic_links` (vue agent, RLS agency-scoped). */
export interface KycMagicLink {
  id: string
  token: string
  agency_id: string
  kyc_case_id: string
  contact_id: string
  mode: MagicLinkMode
  channels: MagicLinkChannel[]
  custom_message: string | null
  status: MagicLinkStatus
  expires_at: string
  sent_at: string
  opened_at: string | null
  uploaded_at: string | null
  confirmed_at: string | null
  expired_at: string | null
  client_ip: string | null
  client_user_agent: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Vue résumée renvoyée par la RPC `kyc_magic_link_summary`. */
export interface KycMagicLinkSummary {
  id: string
  status: MagicLinkStatus
  mode: MagicLinkMode
  sent_at: string
  expires_at: string
  opened_at: string | null
  confirmed_at: string | null
  uploads_count: number
  channels: MagicLinkChannel[]
}

/** Row `kyc_magic_link_uploads`. */
export interface KycMagicLinkUpload {
  id: string
  magic_link_id: string
  agency_id: string
  type: MagicLinkUploadType
  filename: string
  size_bytes: number
  mime_type: string | null
  storage_path: string
  sha256_hash: string | null
  uploaded_at: string
  ocr_fields: Record<string, unknown> | null
  ocr_provider: string | null
  ocr_completed_at: string | null
  confirmed_by_client: boolean
  confirmed_at: string | null
  document_id: string | null
}

// ─── Edge function I/O ─────────────────────────────────────────────────────

export interface CreateMagicLinkInput {
  kyc_case_id: string
  contact_id: string
  mode?: MagicLinkMode
  channels?: MagicLinkChannel[]
  custom_message?: string | null
  expiration_days?: number
}

export interface CreateMagicLinkResponse {
  magic_link_id: string
  token: string
  url: string
  expires_at: string
  status: MagicLinkStatus
}

export interface RegenerateMagicLinkInput {
  magic_link_id: string
  expiration_days?: number
}

/** Vue publique servie par GET /magic-link-get?token=... (côté client). */
export interface MagicLinkPublicView {
  magic_link_id: string
  status: MagicLinkStatus
  mode: MagicLinkMode
  custom_message: string | null
  expires_at: string
  contact: {
    first_name: string
    last_name: string
  } | null
  agency: {
    name: string
    slug: string
  } | null
  agent: {
    full_name: string
  } | null
  uploads: Pick<
    KycMagicLinkUpload,
    'id' | 'type' | 'filename' | 'size_bytes' | 'uploaded_at' | 'confirmed_by_client' | 'ocr_fields'
  >[]
}
