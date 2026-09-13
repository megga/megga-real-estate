/**
 * MEGGA — Types KYC Magic Link (Sprint 4.7).
 *
 * Sources de vérité : les tables `kyc_magic_links` / `kyc_magic_link_uploads` vivent dans
 * `supabase/migrations/00000000000000_baseline_remote_schema.sql` (la migration d'origine,
 * 20260520_003, est archivée) ; la vue PUBLIQUE est construite par
 * `supabase/functions/_shared/magic-link-public-view.ts`, et ses types ici la suivent champ
 * pour champ — jamais une ligne de base (audit S10, 13.09.2026).
 */

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

/** Row `kyc_magic_link_uploads`. */
export interface KycMagicLinkUpload {
  id: string
  magic_link_id: string | null
  source: string
  kyc_case_id: string | null
  wa_message_id: string | null
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

/**
 * Vue publique d'un lien OUVERT servie par `magic-link-get` (côté client) — la liste
 * blanche de `buildMagicLinkPublicView`, et elle seule. Ni nom de famille, ni message
 * personnalisé, ni slug d'agence, ni champ OCR : la page ne les lit pas, le serveur ne les
 * sert plus. `pending` n'arrive jamais (le premier appel ouvre le lien) et `submitted` a sa
 * propre forme ; `expired` n'est gardé que pour la branche défensive de la page (le serveur
 * répond 410).
 */
export interface MagicLinkPublicView {
  magic_link_id: string
  status: Exclude<MagicLinkStatus, 'pending' | 'submitted'>
  mode: MagicLinkMode
  expires_at: string
  contact: { first_name: string } | null
  agency: { name: string } | null
  agent: { full_name: string } | null
  uploads: Pick<KycMagicLinkUpload, 'id' | 'type' | 'filename' | 'size_bytes' | 'uploaded_at'>[]
}

/**
 * Réponse de `magic-link-get` pour un lien DÉJÀ SOUMIS : aucune donnée de personne, ni
 * prénom, ni agent, ni agence, ni pièce. Les écrans de succès et de rendez-vous qui suivent
 * affichent donc leurs replis (« votre agent », « votre agence »).
 */
export interface MagicLinkSubmittedView {
  status: 'submitted'
  confirmed_at: string | null
  message: string
}
