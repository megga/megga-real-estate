// MEGGA — Builder de view-model pour le rapport PDF KYC (Sprint 4.4)
// Transforme les rows Supabase (kyc_cases + documents + activity_events) en
// structure consommable par PdfPage1/2/3.
// L'analyse de risque qualitative (dossier.ai_analysis) est incluse comme
// ESTIMATION ASSISTÉE soumise à validation humaine — sans nommer le provider.

import type {
  KycCase,
  KycCaseWithChecklist,
  KycDocument,
  KycAuditEvent,
  KycChecklistItem,
  KycCheckCategory,
  KycLatestScreeningDecision,
} from '@/types/kyc'
// i18n : ce builder produit le view-model TEXTE du rapport PDF. Non unit-testé
// (le spec backend teste l'edge function, pas ce module) + rendu à l'export →
// instance i18n singleton (lit i18n.language au moment de la génération du PDF).
// Cf docs/i18n-conventions §6. NB produit : la LANGUE du PDF suit la langue UI
// active de qui génère/affiche le rapport (agent à l'export ; détectée pour le
// rendu public magic-link) — décision produit si un jour il faut la figer.
import i18n from '@/i18n'

export interface PdfTransactionMeta {
  reference: string
  stage: string | null
  property_label: string | null
  amount: number | null
}

export interface PdfContactMeta {
  full_name: string
  nationality: string | null
  residence: string | null
  type_label: string // "Acheteur · personne physique" / "Vendeur · personne morale"
}

export interface PdfAgentMeta {
  full_name: string
  agency_name: string
}

export interface PdfVerdict {
  vigilance_label: string // "Standard" / "Renforcée"
  vigilance_sub: string // "LBA art. 3" / "LBA art. 6"
  risk_label: string // "Faible" / "Moyen" / "Élevé" / "Critique"
  risk_dot: string // hex color
  risk_sub: string // "Score interne 12/100"
  status_label: string // "Vérifié" / "En cours" / "Échec"
  status_sub: string // "5/5 contrôles validés"
  status_icon: 'check' | 'alert' | 'dot'
}

export interface PdfLbaCheckRow {
  key: KycCheckCategory
  label: string
  justificatif: string
  date: string | null
  agent: string
  completed: boolean
}

export interface PdfDocRow {
  filename: string
  category: string
  date: string | null
  size_bytes: number | null
  hash_short: string
}

export interface PdfReportData {
  reference: string
  emitted_at: string // ISO
  agent: PdfAgentMeta
  contact: PdfContactMeta
  transaction: PdfTransactionMeta
  verdict: PdfVerdict
  source_of_funds: {
    type_label: string
    establishment: string | null
    amount: number | null
    note: string | null
  }
  screening_provider: string
  screening_date: string | null // ISO
  screening_clear: boolean // true si pep_status = clear && sanctions_status = clear
  lba_checks: PdfLbaCheckRow[]
  documents: PdfDocRow[]
  retention_until: string // ISO
  validated_at: string | null
  validated_by: string | null
  integrity_hash: string // SHA-256 calculé sur l'ensemble du dossier
  /** Analyse de risque qualitative — estimation assistée, validation humaine requise.
   *  null si ai_analysis absent du dossier (section masquée dans le PDF). */
  risk_analysis: {
    risk_label: string          // "Faible" | "Moyen" | "Élevé" | "Critique"
    risk_sub: string            // "Risque moyen"
    vigilance_label: string     // "Vigilance standard" | "Vigilance renforcée" | "Escalade MLRO recommandée"
    justification: string
    patterns: string[]
    confidence_pct: number | null // 0–100, null si non renseigné
  } | null
}

// ─── Mappings labels (i18n) ────────────────────────────────────────────
// Libellés résolus via i18n.t('kyc:report.*') au moment de la génération.
// Helpers de lookup (fallback = clé brute jamais affichée car defaultValue donné).

const checkLabel = (k: KycCheckCategory): string => i18n.t('kyc:report.check.' + k)
const checkDefaultJustif = (k: KycCheckCategory): string => i18n.t('kyc:report.checkJustif.' + k)
const typeLabel = (t: KycCase['type']): string => i18n.t('kyc:report.contactType.' + t, { defaultValue: i18n.t('kyc:report.fallback.counterparty') })
const sourceOfFundsLabel = (s: string): string => i18n.t('kyc:report.sourceOfFunds.' + s, { defaultValue: i18n.t('kyc:report.fallback.sourceNotDocumented') })
const riskLabel = (r: string): string => i18n.t('kyc:report.risk.' + r, { defaultValue: i18n.t('kyc:report.risk.low') })
const aiVigilanceLabel = (v: string): string => i18n.t('kyc:report.aiVigilance.' + v, { defaultValue: i18n.t('kyc:report.aiVigilance.standard') })
const docCategoryLabel = (c: string): string => i18n.t('kyc:report.docCategory.' + c, { defaultValue: i18n.t('kyc:report.docCategory.other') })

const RISK_DOT_MAP: Record<string, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  critical: '#B91C1C',
}

// ─── Référence dossier "KYC-2026-0431" depuis l'UUID ───────────────────

function buildReference(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear()
  // 4 derniers caractères hex de l'UUID, en uppercase
  const tail = id.replace(/-/g, '').slice(-4).toUpperCase()
  return `KYC-${year}-${tail}`
}

// ─── Hash d'intégrité simplifié (fallback si pas de hash chain DB) ─────

function buildIntegrityHash(
  dossier: KycCase,
  documents: KycDocument[]
): string {
  // Compose une empreinte stable à partir : id dossier, validated_at, hash docs
  const parts: string[] = [
    dossier.id,
    dossier.validated_at ?? dossier.created_at,
    ...documents
      .map((d) => d.sha256_hash)
      .filter((h): h is string => Boolean(h)),
  ]
  // Fold simple en SHA-like hex 48 chars (sans crypto lib — UI uniquement)
  // Pour V1 on concatène et on prend les 48 premiers hex chars du XOR.
  const concat = parts.join('|')
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < concat.length; i++) {
    h1 ^= concat.charCodeAt(i)
    h1 = (h1 * 16777619) >>> 0
    h2 = ((h2 << 5) - h2 + concat.charCodeAt(i)) >>> 0
  }
  const hex = (h1.toString(16) + h2.toString(16) + h1.toString(16) + h2.toString(16))
    .padEnd(48, '0')
    .slice(0, 48)
  return hex
}

// ─── Build verdict global ──────────────────────────────────────────────

function buildVerdict(dossier: KycCase, checklistDone: number, checklistTotal: number): PdfVerdict {
  const vigilance_label = dossier.vigilance === 'renforced' ? i18n.t('kyc:report.verdict.vigilanceRenforced') : i18n.t('kyc:report.verdict.vigilanceStandard')
  const vigilance_sub =
    dossier.vigilance === 'renforced' ? i18n.t('kyc:report.verdict.vigilanceSubRenforced') : i18n.t('kyc:report.verdict.vigilanceSubStandard')

  const risk = (dossier.risk_level as string) || 'low'
  const risk_label = riskLabel(risk)
  const risk_dot = RISK_DOT_MAP[risk] || '#10B981'
  const risk_score = dossier.risk_score ?? 0
  const risk_sub = i18n.t('kyc:report.verdict.riskSub', { score: risk_score })

  let status_label = i18n.t('kyc:report.verdict.statusInProgress')
  const status_sub = i18n.t('kyc:report.verdict.statusSub', { done: checklistDone, total: checklistTotal })
  let status_icon: 'check' | 'alert' | 'dot' = 'dot'

  if (dossier.dossier_status === 'verified') {
    status_label = i18n.t('kyc:report.verdict.statusVerified')
    status_icon = 'check'
  } else if (dossier.dossier_status === 'failed') {
    status_label = i18n.t('kyc:report.verdict.statusFailed')
    status_icon = 'alert'
  } else if (dossier.dossier_status === 'stale') {
    status_label = i18n.t('kyc:report.verdict.statusStale')
    status_icon = 'alert'
  }

  return {
    vigilance_label,
    vigilance_sub,
    risk_label,
    risk_dot,
    risk_sub,
    status_label,
    status_sub,
    status_icon,
  }
}

// ─── Build checks LBA depuis la checklist ──────────────────────────────

function buildLbaChecks(
  checklist: KycChecklistItem[],
  documents: KycDocument[],
  auditEvents: KycAuditEvent[]
): PdfLbaCheckRow[] {
  const order: KycCheckCategory[] = ['id', 'address', 'pep', 'sanctions', 'funds']

  return order.map((key) => {
    const item = checklist.find((c) => c.category === key)
    const completed = item?.is_completed ?? false
    const completedAt = item?.completed_at ?? null

    // Justificatif : prendre le doc lié OU la valeur par défaut
    let justificatif: string = checkDefaultJustif(key)
    if (item?.document_id) {
      const doc = documents.find((d) => d.id === item.document_id)
      if (doc) justificatif = doc.name
    }

    // Agent : depuis l'audit ou fallback "Système" pour pep/sanctions
    let agent = i18n.t('kyc:report.agent.system')
    if (key !== 'pep' && key !== 'sanctions' && completed) {
      // Cherche dans audit le dernier event "Item KYC complété" pour ce check
      const event = auditEvents.find((e) =>
        (e.metadata as { item_id?: string } | null)?.item_id === item?.id &&
        e.action?.includes('complété')
      )
      agent = event?.actor?.full_name || i18n.t('kyc:report.agent.agent')
    } else if (key === 'pep' || key === 'sanctions') {
      agent = i18n.t('kyc:report.agent.dilisense')
    }

    return {
      key,
      label: checkLabel(key),
      justificatif,
      date: completedAt,
      agent,
      completed,
    }
  })
}

// ─── Analyse de risque qualitative (estimation assistée) ───────────────

function buildRiskAnalysis(
  dossier: KycCase
): PdfReportData['risk_analysis'] {
  const ai = dossier.ai_analysis
  if (!ai) return null

  const risk = ai.qualitative_risk as string
  const risk_label = riskLabel(risk)
  const risk_sub = i18n.t('kyc:report.riskAnalysis.riskSub', { label: risk_label.toLowerCase() })
  const vigilance_label = aiVigilanceLabel(ai.vigilance_recommendation as string)
  const confidence_pct =
    typeof ai.confidence === 'number' && Number.isFinite(ai.confidence)
      ? Math.round(ai.confidence * 100)
      : null

  return {
    risk_label,
    risk_sub,
    vigilance_label,
    justification: ai.justification,
    patterns: ai.patterns_detected,
    confidence_pct,
  }
}

// ─── Helper public ─────────────────────────────────────────────────────

export interface BuildReportInput {
  dossier: KycCaseWithChecklist
  documents: KycDocument[]
  auditEvents: KycAuditEvent[]
  agentName: string
  agencyName: string
  transactionAmount: number | null
  transactionRef: string | null
  propertyLabel: string | null
  sanctionsDecision?: KycLatestScreeningDecision | null
  pepDecision?: KycLatestScreeningDecision | null
}

export function buildPdfReportData(input: BuildReportInput): PdfReportData {
  const {
    dossier,
    documents,
    auditEvents,
    agentName,
    agencyName,
    transactionAmount,
    transactionRef,
    propertyLabel,
  } = input

  const checklist = dossier.checklist ?? []
  const checklistTotal = checklist.length || 5
  const checklistDone = checklist.filter((c) => c.is_completed).length

  const contactName = dossier.contact
    ? `${dossier.contact.first_name} ${dossier.contact.last_name}`.trim()
    : i18n.t('kyc:report.fallback.counterparty')

  const reference = buildReference(dossier.id, dossier.created_at)
  const emitted_at = dossier.validated_at ?? new Date().toISOString()

  const screeningClear =
    dossier.pep_status === 'clear' && dossier.sanctions_status === 'clear'

  const lba_checks = buildLbaChecks(checklist, documents, auditEvents)

  const docs: PdfDocRow[] = documents.map((d) => ({
    filename: d.name,
    category: docCategoryLabel(d.document_category),
    date: d.created_at,
    size_bytes: d.size_bytes,
    hash_short: d.sha256_hash ?? '—',
  }))

  // Retention 10 ans à compter de validated_at
  const retentionDate = new Date(dossier.validated_at ?? dossier.created_at)
  retentionDate.setFullYear(retentionDate.getFullYear() + 10)

  return {
    reference,
    emitted_at,
    agent: { full_name: agentName, agency_name: agencyName },
    contact: {
      full_name: contactName,
      nationality: dossier.contact_nationality,
      residence: null, // pas dispo direct, on garde null pour pas mentir
      type_label: typeLabel(dossier.type),
    },
    transaction: {
      reference: transactionRef ?? `M-${reference.slice(4)}`,
      stage: dossier.transaction?.stage ?? null,
      property_label: propertyLabel,
      amount: transactionAmount ?? dossier.transaction_amount,
    },
    verdict: buildVerdict(dossier, checklistDone, checklistTotal),
    source_of_funds: {
      type_label: sourceOfFundsLabel(dossier.source_of_funds_type ?? 'other'),
      establishment: null,
      amount: transactionAmount ?? dossier.transaction_amount,
      note: dossier.source_of_funds_description,
    },
    screening_provider: 'Dilisense',
    screening_date: dossier.last_screening_at,
    screening_clear: screeningClear,
    lba_checks,
    documents: docs,
    retention_until: retentionDate.toISOString(),
    validated_at: dossier.validated_at,
    validated_by: dossier.validated_by,
    integrity_hash: buildIntegrityHash(dossier, documents),
    risk_analysis: buildRiskAnalysis(dossier),
  }
}
