// MEGGA — Builder de view-model pour le rapport PDF KYC (concept épuré, 13.09.2026).
// Transforme les rows Supabase (kyc_cases + documents + activity_events +
// kyc_screening_decisions) en structure consommable par PdfPage1/2/3.
//
// Tout ce que le rapport AFFICHE existe en base : aucun champ n'est inventé pour
// remplir une case de la maquette. Quand la donnée manque, la case dit « — » ou
// « Non renseignée », et la section qui n'a rien à dire (analyse contextuelle,
// examen complémentaire) n'est pas rendue.
//
// L'analyse contextuelle (dossier.ai_analysis) est une ESTIMATION ASSISTÉE
// soumise à validation humaine ; le modèle qui l'a produite n'est jamais nommé.

import type {
  KycCase,
  KycCaseWithChecklist,
  KycDocument,
  KycAuditEvent,
  KycChecklistItem,
  KycCheckCategory,
  ScreeningDecisionTarget,
  ScreeningDecisionVerdict,
} from '@/types/kyc'
// i18n : ce builder produit le view-model TEXTE du rapport PDF. Rendu à l'export →
// instance i18n singleton (lit i18n.language au moment de la génération du PDF).
// NB produit : la LANGUE du PDF suit la langue UI active de qui génère/affiche le
// rapport (agent à l'export ; détectée pour le rendu public magic-link).
import i18n from '@/i18n'

export interface PdfVerdict {
  vigilance_label: string // "Standard" / "Renforcée"
  vigilance_sub: string // "Vigilance · LBA art. 3"
  risk_label: string // "Faible" / "Moyen" / "Élevé" / "Critique"
  risk_sub: string // "Risque · score interne 12/100"
  status_label: string // "Vérifié" / "En cours" / "Échec"
  status_sub: string // "5/5 contrôles validés"
}

export interface PdfLbaCheckRow {
  key: KycCheckCategory
  label: string
  justificatif: string
  date: string | null
  agent: string
  completed: boolean
}

export type PdfScreeningRowKey = 'pep' | 'ofac' | 'seco' | 'eu' | 'un' | 'adverseMedia'
export type PdfScreeningStatus = 'clear' | 'match' | 'pending' | 'not_checked'

export interface PdfScreeningRow {
  key: PdfScreeningRowKey
  status: PdfScreeningStatus
}

export interface PdfDocRow {
  filename: string
  category: string
  date: string | null
  size_bytes: number | null
  hash: string | null
}

/** Décision humaine sur un match Dilisense (la plus récente, non supersédée). */
export interface PdfComplementaryReview {
  target_label: string
  verdict_label: string
  date: string
  decided_by: string
  justification: string
}

export interface PdfReportData {
  reference: string
  emitted_at: string // ISO
  agent: { full_name: string; agency_name: string }
  contact: {
    full_name: string
    nationality: string | null
    residence: string | null
    type_label: string // "Acheteur · personne physique"
  }
  transaction: {
    reference: string
    stage_label: string | null
    property_label: string | null
    amount: number | null
  }
  verdict: PdfVerdict
  /** Analyse contextuelle — estimation assistée. null si absente du dossier. */
  ai_analysis: {
    confidence_pct: number | null // 0–100
    patterns_count: number
    justification: string
    recommendation_label: string // "vigilance standard" / "vigilance renforcée" / …
  } | null
  screening_provider: string
  screening_date: string | null // ISO
  screening_rows: PdfScreeningRow[]
  lba_checks: PdfLbaCheckRow[]
  source_of_funds: {
    type_label: string
    document_name: string | null
    amount: number | null
    note: string | null
  }
  complementary_reviews: PdfComplementaryReview[]
  /** Au plus `MAX_DOC_ROWS` lignes — au-delà la page 3 déborderait de la feuille. */
  documents: PdfDocRow[]
  documents_total: number
  retention_until: string // ISO
  validated_at: string | null
  validated_by: string | null // nom résolu, jamais l'UUID
  /** SHA-256 hex de la forme canonique du dossier (`integrity.ts`). */
  integrity_hash: string
}

/**
 * Lignes d'annexe rendues au plus. Mesuré sur la maquette : 8 lignes à 9 px de
 * padding laissent la place du bloc « Conservation » ; à 14 le pied touche encore
 * l'attestation. Au-delà, la feuille (overflow: hidden) COUPERAIT sans le dire.
 */
export const MAX_DOC_ROWS = 14

// ─── Mappings labels (i18n) ────────────────────────────────────────────
// Libellés résolus via i18n.t('kyc:report.*') au moment de la génération.

const t = (key: string, opts?: Record<string, unknown>): string => i18n.t(`kyc:report.${key}`, opts)
const checkLabel = (k: KycCheckCategory): string => t('check.' + k)
const checkDefaultJustif = (k: KycCheckCategory): string => t('checkJustif.' + k)
const typeLabel = (k: KycCase['type']): string => t('contactType.' + k, { defaultValue: t('fallback.counterparty') })
const sourceOfFundsLabel = (s: string): string => t('sourceOfFunds.' + s, { defaultValue: t('fallback.sourceNotDocumented') })
const riskLabel = (r: string): string => t('risk.' + r, { defaultValue: t('risk.low') })
const aiVigilanceLabel = (v: string): string => t('aiVigilance.' + v, { defaultValue: t('aiVigilance.standard') })
const docCategoryLabel = (c: string): string => t('docCategory.' + c, { defaultValue: t('docCategory.other') })
const decisionLabel = (d: ScreeningDecisionVerdict): string => t('decision.' + d, { defaultValue: d })
const decisionTargetLabel = (target: ScreeningDecisionTarget): string => checkLabel(target)
/** Le stade du deal, dans le vocabulaire du pipeline ; la valeur brute si inconnue. */
const stageLabel = (stage: string | null | undefined): string | null =>
  stage ? i18n.t('pipeline:stages.' + stage, { defaultValue: stage }) : null

// ─── Référence dossier "KYC-2026-0431" depuis l'UUID ───────────────────
// ⚠ Miroir de `buildReference` dans supabase/functions/kyc-report-pdf/index.ts
// (nom du fichier WhatsApp) : les deux doivent rendre la même chaîne.

function buildReference(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear()
  // 4 derniers caractères hex de l'UUID, en uppercase
  const tail = id.replace(/-/g, '').slice(-4).toUpperCase()
  return `KYC-${year}-${tail}`
}

// ─── Build verdict global ──────────────────────────────────────────────

function buildVerdict(dossier: KycCase, checklistDone: number, checklistTotal: number): PdfVerdict {
  const renforced = dossier.vigilance === 'renforced'
  const vigilance_label = renforced ? t('verdict.vigilanceRenforced') : t('verdict.vigilanceStandard')
  const vigilance_sub = `${t('pdf.verdictCol.vigilance')} · ${renforced ? t('verdict.vigilanceSubRenforced') : t('verdict.vigilanceSubStandard')}`

  const risk = (dossier.risk_level as string) || 'low'
  const risk_sub = `${t('pdf.verdictCol.risk')} · ${t('verdict.riskSub', { score: dossier.risk_score ?? 0 })}`

  let status_label = t('verdict.statusInProgress')
  if (dossier.dossier_status === 'verified') status_label = t('verdict.statusVerified')
  else if (dossier.dossier_status === 'failed') status_label = t('verdict.statusFailed')
  else if (dossier.dossier_status === 'stale') status_label = t('verdict.statusStale')

  return {
    vigilance_label,
    vigilance_sub,
    risk_label: riskLabel(risk),
    risk_sub,
    status_label,
    status_sub: t('verdict.statusSub', { done: checklistDone, total: checklistTotal }),
  }
}

// ─── Screening : une ligne par liste, un statut par ligne ───────────────
// PEP suit `pep_status` ; les quatre listes de sanctions suivent `sanctions_status`
// (Dilisense les interroge d'un seul appel) ; « adverse media » n'est pas un
// statut propre en base — la ligne porte le PIRE des deux, jamais mieux.

const STATUS_RANK: Record<PdfScreeningStatus, number> = { clear: 0, not_checked: 1, pending: 2, match: 3 }

function asScreeningStatus(s: string | null | undefined): PdfScreeningStatus {
  return s === 'clear' || s === 'match' || s === 'pending' ? s : 'not_checked'
}

function buildScreeningRows(dossier: KycCase): PdfScreeningRow[] {
  const pep = asScreeningStatus(dossier.pep_status)
  const sanctions = asScreeningStatus(dossier.sanctions_status)
  const worst = STATUS_RANK[pep] >= STATUS_RANK[sanctions] ? pep : sanctions
  return [
    { key: 'pep', status: pep },
    { key: 'ofac', status: sanctions },
    { key: 'seco', status: sanctions },
    { key: 'eu', status: sanctions },
    { key: 'un', status: sanctions },
    { key: 'adverseMedia', status: worst },
  ]
}

// ─── Build checks LBA depuis la checklist ──────────────────────────────

function buildLbaChecks(
  checklist: KycChecklistItem[],
  documents: KycDocument[],
  auditEvents: KycAuditEvent[],
): PdfLbaCheckRow[] {
  const order: KycCheckCategory[] = ['id', 'address', 'pep', 'sanctions', 'funds']

  return order.map((key) => {
    const item = checklist.find((c) => c.category === key)
    const completed = item?.is_completed ?? false
    const completedAt = item?.completed_at ?? null

    // Justificatif : le document lié, sinon la nature de pièce attendue
    let justificatif: string = checkDefaultJustif(key)
    if (item?.document_id) {
      const doc = documents.find((d) => d.id === item.document_id)
      if (doc) justificatif = doc.name
    }

    // Agent : le screening est un geste du système ; les trois autres contrôles
    // portent le nom de qui les a cochés, lu dans l'audit — et « — » tant que rien
    // n'est coché : un contrôle non fait n'a pas d'auteur.
    let agent = '—'
    if (key === 'pep' || key === 'sanctions') {
      if (completed) agent = t('agent.dilisense')
    } else if (completed) {
      const event = auditEvents.find((e) =>
        (e.metadata as { item_id?: string } | null)?.item_id === item?.id && e.action?.includes('complété'),
      )
      agent = event?.actor?.full_name || t('agent.agent')
    }

    return { key, label: checkLabel(key), justificatif, date: completedAt, agent, completed }
  })
}

// ─── Analyse contextuelle (estimation assistée) ─────────────────────────

function buildAiAnalysis(dossier: KycCase): PdfReportData['ai_analysis'] {
  const ai = dossier.ai_analysis
  if (!ai) return null
  const confidence_pct =
    typeof ai.confidence === 'number' && Number.isFinite(ai.confidence)
      ? Math.round(Math.min(1, Math.max(0, ai.confidence)) * 100)
      : null
  return {
    confidence_pct,
    patterns_count: Array.isArray(ai.patterns_detected) ? ai.patterns_detected.length : 0,
    justification: ai.justification,
    recommendation_label: aiVigilanceLabel(ai.vigilance_recommendation as string).toLowerCase(),
  }
}

// ─── Helper public ─────────────────────────────────────────────────────

/** Décision compliance à rendre en « Examen complémentaire » (forme d'entrée). */
export interface ReportScreeningDecision {
  target: ScreeningDecisionTarget
  decision: ScreeningDecisionVerdict
  justification: string
  decided_at: string
  decided_by_name: string | null
}

export interface BuildReportInput {
  dossier: KycCaseWithChecklist
  documents: KycDocument[]
  auditEvents: KycAuditEvent[]
  agentName: string
  agencyName: string
  transactionAmount: number | null
  transactionRef: string | null
  propertyLabel: string | null
  /** Nom de qui a validé le dossier (`kyc_cases.validated_by` résolu) ; null si inconnu. */
  validatedByName: string | null
  screeningDecisions: ReportScreeningDecision[]
  /** SHA-256 de la forme canonique du dossier — `computeKycIntegrityHash`. */
  integrityHash: string
}

export function buildPdfReportData(input: BuildReportInput): PdfReportData {
  const {
    dossier, documents, auditEvents, agentName, agencyName,
    transactionAmount, transactionRef, propertyLabel, validatedByName,
    screeningDecisions, integrityHash,
  } = input

  const checklist = dossier.checklist ?? []
  const checklistTotal = checklist.length || 5
  const checklistDone = checklist.filter((c) => c.is_completed).length

  const contactName = dossier.contact
    ? `${dossier.contact.first_name} ${dossier.contact.last_name}`.trim()
    : t('fallback.counterparty')

  const reference = buildReference(dossier.id, dossier.created_at)
  const emitted_at = dossier.validated_at ?? new Date().toISOString()

  const sourceDoc = dossier.source_of_funds_doc_id
    ? documents.find((d) => d.id === dossier.source_of_funds_doc_id) ?? null
    : null

  const docs: PdfDocRow[] = documents.slice(0, MAX_DOC_ROWS).map((d) => ({
    filename: d.name,
    category: docCategoryLabel(d.document_category),
    date: d.created_at,
    size_bytes: d.size_bytes,
    hash: d.sha256_hash,
  }))

  // Retention 10 ans à compter de validated_at (LBA art. 7 al. 3)
  const retentionDate = new Date(dossier.validated_at ?? dossier.created_at)
  retentionDate.setFullYear(retentionDate.getFullYear() + 10)

  const amount = transactionAmount ?? dossier.transaction_amount

  return {
    reference,
    emitted_at,
    agent: { full_name: agentName, agency_name: agencyName },
    contact: {
      full_name: contactName,
      nationality: dossier.contact_nationality ?? dossier.contact?.nationality ?? null,
      residence: null, // aucune adresse de résidence en base — on ne l'invente pas
      type_label: typeLabel(dossier.type),
    },
    transaction: {
      reference: transactionRef ?? `M-${reference.slice(4)}`,
      stage_label: stageLabel(dossier.transaction?.stage),
      property_label: propertyLabel,
      amount,
    },
    verdict: buildVerdict(dossier, checklistDone, checklistTotal),
    ai_analysis: buildAiAnalysis(dossier),
    screening_provider: 'Dilisense',
    screening_date: dossier.last_screening_at,
    screening_rows: buildScreeningRows(dossier),
    lba_checks: buildLbaChecks(checklist, documents, auditEvents),
    source_of_funds: {
      type_label: sourceOfFundsLabel(dossier.source_of_funds_type ?? 'other'),
      document_name: sourceDoc?.name ?? null,
      amount,
      note: dossier.source_of_funds_description,
    },
    complementary_reviews: screeningDecisions.map((d) => ({
      target_label: decisionTargetLabel(d.target),
      verdict_label: decisionLabel(d.decision),
      date: d.decided_at,
      decided_by: d.decided_by_name ?? t('agent.agent'),
      justification: d.justification,
    })),
    documents: docs,
    documents_total: documents.length,
    retention_until: retentionDate.toISOString(),
    validated_at: dossier.validated_at,
    validated_by: dossier.validated_at ? (validatedByName ?? agentName) : null,
    integrity_hash: integrityHash,
  }
}
