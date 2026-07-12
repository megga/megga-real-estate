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

/** LBA art. 6 al. 1 lit. b — typologie origine des fonds (Sprint 3). */
export type KycSourceOfFundsType =
  | 'salary'
  | 'sale_property'
  | 'sale_business'
  | 'inheritance'
  | 'investment'
  | 'crypto'
  | 'loan'
  | 'mixed'
  | 'other'

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
  // Sprint 3 — Origine économique des fonds (LBA art. 6 al. 1 lit. b)
  source_of_funds_type: KycSourceOfFundsType | null
  source_of_funds_description: string | null
  source_of_funds_doc_id: string | null
  // Sprint 4.5 — Analyse contextuelle Claude Sonnet 4 (complément Dilisense)
  ai_analysis: KycAiAnalysis | null
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
  /** Sprint 3 — SHA-256 hex du contenu fichier (intégrité LBA art. 7). NULL pour les docs legacy. */
  sha256_hash: string | null
}

export interface KycAuditEvent {
  id: string
  agency_id: string
  actor_id: string | null
  /** Sprint 3 : 'user' = humain (actor_id → profiles), 'ai' / 'system' = actor_id NULL. */
  actor_kind?: 'user' | 'ai' | 'system'
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string
  /** Jointure optionnelle avec profiles pour afficher le nom réel de l'acteur. */
  actor?: { full_name: string | null } | null
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
  /** Sprint 4.5 — null si ANTHROPIC_API_KEY absent ou API plante (graceful). */
  ai_analysis: KycAiAnalysis | null
}

// ─── Sprint 4.5 — Couche IA Claude Sonnet 4 ────────────────────────────────

export type KycAiQualitativeRisk = 'low' | 'medium' | 'high' | 'critical'
export type KycAiVigilanceReco = 'standard' | 'renforced' | 'escalation_mlro'

export interface KycAiAnalysis {
  /** Identifiant du modèle utilisé (ex: 'claude-sonnet-4-6'). */
  provider: string
  /** ISO timestamp de l'analyse. */
  analyzed_at: string
  /** Verdict qualitatif (différent du score quantitatif Dilisense/algo). */
  qualitative_risk: KycAiQualitativeRisk
  /** Recommandation au compliance officer. */
  vigilance_recommendation: KycAiVigilanceReco
  /** Patterns suspects détectés par Sonnet (structuring, unusual_pattern, ...). */
  patterns_detected: string[]
  /** Justification 2-3 phrases en français. */
  justification: string
  /** Checks complémentaires suggérés au compliance officer. */
  additional_checks_suggested: string[]
  /** Confiance Sonnet (0-1). */
  confidence: number
  prompt_tokens?: number
  completion_tokens?: number
}

// ─── Sprint 2 — Workflow décision compliance (red-team Marc #2, Roger #6) ──

export type ScreeningDecisionTarget = 'sanctions' | 'pep'

export type ScreeningDecisionVerdict =
  | 'false_positive'        // examen humain : faux match → débloque verified
  | 'true_match'            // vrai match → SAR/MROS obligatoire
  | 'escalated'             // remonté à la direction
  | 'awaiting_evidence'     // en attente d'éléments complémentaires

export interface KycScreeningDecision {
  id: string
  agency_id: string
  kyc_case_id: string
  decision_target: ScreeningDecisionTarget
  decision: ScreeningDecisionVerdict
  justification: string
  decided_by: string
  decided_at: string
  screening_snapshot: Record<string, unknown>
  supersedes_id: string | null
}

/** Forme renvoyée par la RPC `kyc_latest_screening_decision`. */
export interface KycLatestScreeningDecision {
  id: string
  decision: ScreeningDecisionVerdict
  justification: string
  decided_by: string
  decided_at: string
}
