import type { KycRiskLevel, PepStatus, SanctionsStatus } from '@/lib/constants'

export type KycType = 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
export type KycStatus = 'pending' | 'in_progress' | 'review' | 'validated' | 'rejected'
export type DocumentCategory = 'identity' | 'domicile' | 'financial' | 'compliance' | 'other'

// ─── Sprint 1 — KYCDossier vocabulary (handoff spec) ────────────────────
// Spec : docs/handoff/sprint-1-kyc/HANDOFF_SPRINT_1_CLAUDE_CODE.md
// Distinct du legacy `KycStatus` — vocabulaire UI Sugar Pure aligné LBA.
export type KycDossierStatus =
  | 'none'       // pas de dossier ouvert
  | 'pending'    // dossier ouvert, vérifications en cours
  | 'verified'   // tous les checks OK, validé
  | 'stale'      // vérifié mais à re-screener (>12 mois ou changement)
  | 'failed'     // un check a échoué (sanctions, PEP confirmé sans dérogation)

export type KycVigilance =
  | 'standard'   // LBA art. 3-4 : 5 contrôles classiques
  | 'renforced'  // LBA art. 6 : approfondissement origine fonds + arrière-plan

/** 5 contrôles obligatoires LBA art. 3-7 (handoff §Modèle de données). */
export type KycCheckCategory =
  | 'id'         // Pièce d'identité officielle
  | 'address'    // Justificatif de domicile < 3 mois
  | 'pep'        // Personne Exposée Politiquement
  | 'sanctions'  // OFAC / SECO / ONU / UE
  | 'funds'      // Source des fonds (LBA art. 6 si > CHF 100'000)

export interface KycCase {
  id: string
  agency_id: string
  transaction_id: string
  contact_id: string
  type: KycType
  risk_level: KycRiskLevel
  status: KycStatus
  completion_pct: number
  validated_by: string | null
  validated_at: string | null
  created_at: string
  // Screening fields
  pep_status: PepStatus
  pep_details: Record<string, unknown> | null
  sanctions_status: SanctionsStatus
  sanctions_details: Record<string, unknown> | null
  last_screening_at: string | null
  contact_nationality: string | null
  transaction_amount: number | null
  risk_score: number | null
  risk_factors: Record<string, unknown>[] | null
  notes: string | null
  // Sprint 1 — KYCDossier handoff fields
  vigilance: KycVigilance
  expires_at: string | null
  dossier_status: KycDossierStatus
  // Joined relations (optional)
  contact?: {
    first_name: string
    last_name: string
  }
  transaction?: {
    id: string
    stage: string
    property_id?: string
  }
}

/** Retour de la RPC `kyc_by_contact_id`. */
export interface KycDossierSummary {
  id: string
  agency_id: string
  contact_id: string
  transaction_id: string | null
  type: KycType
  risk_level: KycRiskLevel
  risk_score: number | null
  dossier_status: KycDossierStatus
  vigilance: KycVigilance
  validated_at: string | null
  expires_at: string | null
  created_at: string
  pep_status: PepStatus | null
  sanctions_status: SanctionsStatus | null
  last_screening_at: string | null
  checks_total: number
  checks_completed: number
}

/** Compteurs renvoyés par la RPC `kyc_count_by_status`. */
export type KycCountByStatus = Partial<Record<KycDossierStatus, number>>

export interface KycCaseWithChecklist extends KycCase {
  checklist: KycChecklistItem[]
}

export interface KycChecklistItem {
  id: string
  kyc_case_id: string
  label: string
  category: string
  is_required: boolean
  is_completed: boolean
  document_id: string | null
  notes: string | null
  completed_at: string | null
  completed_by: string | null
}

export interface KycDocument {
  id: string
  agency_id: string
  kyc_case_id: string | null
  transaction_id: string | null
  contact_id: string | null
  property_id: string | null
  name: string
  type: string
  storage_path: string
  size_bytes: number | null
  uploaded_by: string | null
  status: 'pending' | 'validated' | 'rejected'
  created_at: string
  // Expiration fields
  issued_at: string | null
  expires_at: string | null
  document_category: DocumentCategory
}

export interface KycAuditEvent {
  id: string
  agency_id: string
  actor_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Sprint 1 — AuditEvent nLPD (handoff §Modèle de données) ───────────
export type AuditSeverity = 'info' | 'warn' | 'critical'

export type AuditCategory =
  | 'kyc'       // Dossiers KYC, screenings, validations
  | 'deal'      // Pipeline : étapes, passage outre verrou
  | 'contact'   // Création / export / modification contact
  | 'bien'      // Propriétés : création, photos, publication
  | 'doc'       // Documents signés, mandats
  | 'auth'      // Connexions, MFA, échecs
  | 'settings'  // Préférences agent, agence
  | 'ai'        // Suggestions MEGGA AI, matching auto

/** Évènement d'audit nLPD complet — appended-only, conservation 10 ans. */
export interface AuditEvent {
  id: string
  agency_id: string | null
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  // Sprint 1 fields
  severity: AuditSeverity
  category: AuditCategory | null
  object_label: string | null
  ip_address: string | null
}

export interface ScreeningResult {
  pep_status: PepStatus
  pep_hits: number
  sanctions_status: SanctionsStatus
  sanctions_hits: number
  total_hits: number
  risk_score: number
  risk_level: KycRiskLevel
}
