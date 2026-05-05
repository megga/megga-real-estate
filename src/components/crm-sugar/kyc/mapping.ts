// MEGGA CRM Sugar v2 — KYC mapping (Tier 4)
// Convertit les types Supabase (KycCase, KycCaseWithChecklist, KycDocument)
// vers les shapes Sugar v2 (KycCaseRow, KycDetailData, KycDocItem) avec fallback
// gracieux pour les champs non disponibles.

import { KYC_TYPE_LABELS } from '@/lib/constants'
import type {
  KycCase,
  KycCaseWithChecklist,
  KycChecklistItem,
  KycDocument,
} from '@/types/kyc'
import type {
  KycCaseRow,
  KycCaseStatus,
  KycDetailData,
  KycDetailDoc,
  KycDetailStep,
  KycPepStatus,
} from './data'

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatChf(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  const formatted = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
  return `CHF ${formatted}`
}

function formatRefId(id: string): string {
  // Last 4 chars of UUID for display (KYC-2026-XXXX style)
  return id.slice(-4).toUpperCase()
}

function daysAgo(iso: string | null | undefined): number {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const yr = String(d.getFullYear()).slice(-2)
  return `${day}.${mo}.${yr}`
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const days = daysAgo(iso)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 30) return `il y a ${days} jours`
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`
  return `il y a ${Math.floor(days / 365)} ans`
}

function getContactName(kyc: KycCase): string {
  if (kyc.contact) return `${kyc.contact.first_name} ${kyc.contact.last_name}`
  return 'Contact inconnu'
}

function mapStatus(s: KycCase['status']): KycCaseStatus {
  switch (s) {
    case 'review':
      return 'review'
    case 'validated':
      return 'valid'
    case 'in_progress':
      return 'in'
    case 'pending':
      return 'in'
    case 'rejected':
      return 'stale'
    default:
      return 'in'
  }
}

function mapPep(kyc: KycCase): KycPepStatus {
  // ok if both pep and sanctions clear, match if any match, review if pending
  const hasMatch = kyc.pep_status === 'match' || kyc.sanctions_status === 'match'
  if (hasMatch) return 'match'
  const isPending = kyc.pep_status === 'pending' || kyc.sanctions_status === 'pending'
  if (isPending) return 'review'
  return 'ok'
}

// ─── List mapping ─────────────────────────────────────────────────────────

export function mapKycCaseToRow(kyc: KycCase): KycCaseRow {
  return {
    id: formatRefId(kyc.id),
    name: getContactName(kyc),
    type: KYC_TYPE_LABELS[kyc.type] || 'Acheteur PP',
    amt: formatChf(kyc.transaction_amount),
    risk: kyc.risk_score ?? 0,
    pep: mapPep(kyc),
    st: mapStatus(kyc.status),
    prog: kyc.completion_pct ?? 0,
    days: daysAgo(kyc.created_at),
    agent: '—',
  }
}

// ─── Detail mapping ───────────────────────────────────────────────────────

const DEFAULT_PHASE_KEYS = [
  'id', 'ben', 'fund', 'scr', 'risk', 'valid', 'renew',
] as const

const DEFAULT_PHASE_LABELS: Record<string, { label: string; defaultSub: string }> = {
  id: { label: 'Identification', defaultSub: 'PJ identité, justif. domicile' },
  ben: { label: 'Bénéficiaire effectif', defaultSub: 'Auto-déclaration' },
  fund: { label: 'Origine des fonds', defaultSub: 'Attestation de fonds' },
  scr: { label: 'Screening PEP / sanctions', defaultSub: 'Vérification automatisée' },
  risk: { label: 'Évaluation du risque', defaultSub: 'Calcul automatisé' },
  valid: { label: 'Validation conformité', defaultSub: 'Responsable LBA' },
  renew: { label: 'Renouvellement', defaultSub: 'Auto · 12 mois' },
}

function buildSteps(checklist: KycChecklistItem[] | undefined, status: KycCase['status']): KycDetailStep[] {
  if (checklist && checklist.length > 0) {
    return checklist.slice(0, 7).map(item => ({
      k: item.id.slice(-4),
      label: item.label,
      sub: item.category,
      state: item.is_completed ? 'done' : 'todo',
      itemId: item.id,
    }))
  }
  // Fallback : 7 standard phases avec progression dérivée du statut
  const phaseProgress: Record<KycCase['status'], number> = {
    pending: 0,
    in_progress: 3,
    review: 4,
    validated: 7,
    rejected: 4,
  }
  const completedCount = phaseProgress[status] ?? 0
  return DEFAULT_PHASE_KEYS.map((k, i) => {
    const meta = DEFAULT_PHASE_LABELS[k]
    return {
      k,
      label: meta.label,
      sub: meta.defaultSub,
      state: i < completedCount ? 'done' : i === completedCount ? 'active' : 'todo',
    }
  })
}

function mapDocState(doc: KycDocument): KycDetailDoc['state'] {
  if (doc.status === 'validated') return 'ok'
  if (doc.status === 'rejected') return 'todo'
  return 'wait'
}

function mapDocs(docs: KycDocument[] | undefined): KycDetailDoc[] {
  if (!docs || docs.length === 0) return []
  return docs.map(d => ({
    name: d.name,
    by: d.uploaded_by ? `Téléversé · ${fmtDateShort(d.created_at)}` : fmtDateShort(d.created_at),
    state: mapDocState(d),
  }))
}

export function mapKycCaseToDetail(
  kyc: KycCaseWithChecklist | undefined,
  documents?: KycDocument[],
): KycDetailData | null {
  if (!kyc) return null

  const heroName = getContactName(kyc)
  const heroBadge = `${KYC_TYPE_LABELS[kyc.type] || 'Acheteur PP'} · ${kyc.contact_nationality || '—'}`
  const metaItems = [
    kyc.contact_nationality ? `🇨🇭 ${kyc.contact_nationality}` : 'Nationalité inconnue',
    fmtDateShort(kyc.created_at),
    formatChf(kyc.transaction_amount),
  ]

  const riskScore = kyc.risk_score ?? 0
  const riskLabel =
    kyc.risk_level === 'low'
      ? 'Faible'
      : kyc.risk_level === 'medium'
        ? 'Moyen'
        : kyc.risk_level === 'high'
          ? 'Élevé'
          : 'Non évalué'

  return {
    hero: {
      ref: `KYC-${formatRefId(kyc.id)}`,
      name: heroName,
      badge: heroBadge,
      metaItems,
      riskScore,
      riskLabel,
      progressPct: kyc.completion_pct ?? 0,
      progressSub: `${Math.floor((kyc.completion_pct ?? 0) / 14.28)}/7 étapes`,
      lastScreening: fmtDateShort(kyc.last_screening_at),
      lastScreeningSub: fmtRelative(kyc.last_screening_at),
    },
    steps: buildSteps(kyc.checklist, kyc.status),
    // Screenings: si pas de pep/sanctions structuré, on génère 4 sources mock
    screenings: [
      { src: 'Liste OFAC (US)', match: kyc.sanctions_status === 'match' ? 'review' : 'clear' },
      { src: 'Sanctions UE', match: kyc.sanctions_status === 'match' ? 'review' : 'clear' },
      { src: 'SECO (Suisse)', match: 'clear' },
      { src: 'PEP World-Check', match: kyc.pep_status === 'match' ? 'review' : 'clear' },
    ],
    screeningSources: 4,
    screeningLastRun: kyc.last_screening_at
      ? `Lancé ${fmtRelative(kyc.last_screening_at)}`
      : 'Pas encore lancé',
    alertText:
      kyc.pep_status === 'match' || kyc.sanctions_status === 'match'
        ? 'Correspondance partielle détectée — examiner manuellement.'
        : 'Aucune alerte à examiner.',
    riskScore,
    riskRows: [
      { k: `Nationalité (${kyc.contact_nationality || '—'})`, v: 0, max: 20 },
      { k: `Montant (${formatChf(kyc.transaction_amount)})`, v: 6, max: 30 },
      { k: `Type (${KYC_TYPE_LABELS[kyc.type] || 'Acheteur'})`, v: 4, max: 20 },
      { k: 'Screening', v: kyc.pep_status === 'match' ? 16 : 4, max: 20 },
      { k: `Complétude dossier (${kyc.completion_pct ?? 0}%)`, v: 0, max: 10 },
    ],
    docs: mapDocs(documents),
  }
}
