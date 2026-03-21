import { FATF_HIGH_RISK_COUNTRIES, FATF_INCREASED_MONITORING } from '@/lib/constants'
import type { PepStatus } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RiskFactor {
  id: string
  label: string
  level: 'low' | 'medium' | 'high'
  detail: string
  points: number
}

export interface RiskScoreResult {
  level: 'low' | 'medium' | 'high'
  score: number
  factors: RiskFactor[]
}

interface RiskInput {
  contactNationality: string
  pepStatus: PepStatus
  transactionAmount: number
  kycType: string // 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
  completionPct: number
}

// ─── Risk Score Calculator ──────────────────────────────────────────────────

export function calculateRiskScore(input: RiskInput): RiskScoreResult {
  const factors: RiskFactor[] = []

  // 1. Nationality (0-25 points)
  const nat = input.contactNationality.toUpperCase()
  if ((FATF_HIGH_RISK_COUNTRIES as readonly string[]).includes(nat)) {
    factors.push({
      id: 'nationality',
      label: 'Nationalité',
      level: 'high',
      detail: `Pays à haut risque GAFI (${nat})`,
      points: 25,
    })
  } else if ((FATF_INCREASED_MONITORING as readonly string[]).includes(nat)) {
    factors.push({
      id: 'nationality',
      label: 'Nationalité',
      level: 'medium',
      detail: `Pays sous surveillance renforcée GAFI (${nat})`,
      points: 15,
    })
  } else {
    factors.push({
      id: 'nationality',
      label: 'Nationalité',
      level: 'low',
      detail: nat === 'CH' ? 'Suisse' : `Pays standard (${nat})`,
      points: 0,
    })
  }

  // 2. PEP status (0-25 points)
  if (input.pepStatus === 'match_found') {
    factors.push({
      id: 'pep',
      label: 'Statut PEP',
      level: 'high',
      detail: 'Correspondance PEP détectée',
      points: 25,
    })
  } else {
    factors.push({
      id: 'pep',
      label: 'Statut PEP',
      level: 'low',
      detail: 'Aucune correspondance PEP',
      points: 0,
    })
  }

  // 3. Transaction amount (0-20 points)
  if (input.transactionAmount > 5_000_000) {
    factors.push({
      id: 'amount',
      label: 'Montant transaction',
      level: 'high',
      detail: `> CHF 5'000'000 — vigilance renforcée requise`,
      points: 20,
    })
  } else if (input.transactionAmount > 2_000_000) {
    factors.push({
      id: 'amount',
      label: 'Montant transaction',
      level: 'medium',
      detail: `> CHF 2'000'000`,
      points: 10,
    })
  } else {
    factors.push({
      id: 'amount',
      label: 'Montant transaction',
      level: 'low',
      detail: `< CHF 2'000'000`,
      points: 0,
    })
  }

  // 4. Entity type (0-15 points)
  const isPM = input.kycType.includes('_pm')
  if (isPM) {
    factors.push({
      id: 'entity',
      label: 'Type d\'entité',
      level: 'medium',
      detail: 'Personne morale — structure à vérifier (UBO)',
      points: 15,
    })
  } else {
    factors.push({
      id: 'entity',
      label: 'Type d\'entité',
      level: 'low',
      detail: 'Personne physique',
      points: 0,
    })
  }

  // 5. Document completeness (0-15 points)
  if (input.completionPct < 50) {
    factors.push({
      id: 'docs',
      label: 'Documents',
      level: 'high',
      detail: `${input.completionPct}% complété — documents critiques manquants`,
      points: 15,
    })
  } else if (input.completionPct < 80) {
    factors.push({
      id: 'docs',
      label: 'Documents',
      level: 'medium',
      detail: `${input.completionPct}% complété — documents en attente`,
      points: 8,
    })
  } else {
    factors.push({
      id: 'docs',
      label: 'Documents',
      level: 'low',
      detail: `${input.completionPct}% complété`,
      points: 0,
    })
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0)
  const level = score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low'

  return { level, score, factors }
}

// ─── Document Expiration ────────────────────────────────────────────────────

interface DocWithExpiration {
  id: string
  name: string
  expires_at: string | null
  [key: string]: unknown
}

export function getExpiringDocuments<T extends DocWithExpiration>(
  documents: T[],
  withinDays: number = 30
): { expired: T[]; expiringSoon: T[] } {
  const now = new Date()
  const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)

  const expired: T[] = []
  const expiringSoon: T[] = []

  for (const doc of documents) {
    if (!doc.expires_at) continue
    const expiresDate = new Date(doc.expires_at)
    if (expiresDate < now) {
      expired.push(doc)
    } else if (expiresDate < threshold) {
      expiringSoon.push(doc)
    }
  }

  return { expired, expiringSoon }
}
