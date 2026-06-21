// supabase/functions/_shared/kyc-screening-core.ts
// Pur (testable Node) : partition des hits Dilisense + scoring de risque KYC.
// Aucun I/O, aucune clé. L'exécuteur impur (kyc-screening/index.ts) importe d'ici.
//
// ⚠ SURFACE COMPLIANCE LBA — corps DÉPLACÉ verbatim depuis kyc-screening/index.ts
// (comportement constant). Ne PAS modifier les seuils, les listes GAFI ni les
// slices sans décision compliance explicite. Figé par _shared/kyc-screening-core.test.ts.

export interface DilisenseRecord {
  source_type: string
  name: string
  source_id: string
  [key: string]: unknown
}

export interface RiskFactor {
  id: string
  label: string
  level: 'low' | 'medium' | 'high'
  detail: string
  points: number
}

export const FATF_HIGH_RISK_COUNTRIES = ['AF', 'KP', 'IR', 'MM', 'SY', 'YE', 'RU', 'BY']
export const FATF_INCREASED_MONITORING = [
  'BF', 'CM', 'CD', 'HT', 'KE', 'ML', 'MZ', 'NG',
  'PH', 'SN', 'ZA', 'SS', 'TZ', 'VN',
]

/** Partition des found_records par source_type + dérivation du statut/détails.
 *  Réplique exactement l'inline d'origine : seuils length>0, slice(0,5), total
 *  réel conservé. Tolère null/undefined (→ clear/clear, détails null). */
export function partitionDilisenseHits(records: DilisenseRecord[] | null | undefined): {
  pepRecords: DilisenseRecord[]
  sanctionRecords: DilisenseRecord[]
  pepStatus: 'match' | 'clear'
  sanctionsStatus: 'match' | 'clear'
  pepDetails: { total: number; records: DilisenseRecord[] } | null
  sanctionsDetails: { total: number; records: DilisenseRecord[] } | null
} {
  const rows = Array.isArray(records) ? records : []
  const pepRecords = rows.filter((r) => r.source_type === 'PEP')
  const sanctionRecords = rows.filter((r) => r.source_type === 'SANCTION')
  return {
    pepRecords,
    sanctionRecords,
    pepStatus: pepRecords.length > 0 ? 'match' : 'clear',
    sanctionsStatus: sanctionRecords.length > 0 ? 'match' : 'clear',
    pepDetails: pepRecords.length > 0 ? { total: pepRecords.length, records: pepRecords.slice(0, 5) } : null,
    sanctionsDetails: sanctionRecords.length > 0 ? { total: sanctionRecords.length, records: sanctionRecords.slice(0, 5) } : null,
  }
}

// Barème de risque LBA — 5 axes (nationalité GAFI, PEP, montant, type entité, docs).
// Corps VERBATIM depuis kyc-screening/index.ts. Seuils : nationalité 25/15, PEP 25,
// montant 20/10, entité 15, docs 15/8 ; niveaux >=40 high, >=20 medium.
export function calculateRiskScore(input: {
  contactNationality: string
  pepMatch: boolean
  transactionAmount: number
  kycType: string
  completionPct: number
}): { score: number; level: 'low' | 'medium' | 'high'; factors: RiskFactor[] } {
  const factors: RiskFactor[] = []
  const nat = input.contactNationality.toUpperCase()

  // 1. Nationality (0-25 pts)
  if (FATF_HIGH_RISK_COUNTRIES.includes(nat)) {
    factors.push({ id: 'nationality', label: 'Nationalité', level: 'high', detail: `Pays à haut risque GAFI (${nat})`, points: 25 })
  } else if (FATF_INCREASED_MONITORING.includes(nat)) {
    factors.push({ id: 'nationality', label: 'Nationalité', level: 'medium', detail: `Pays sous surveillance renforcée GAFI (${nat})`, points: 15 })
  } else {
    factors.push({ id: 'nationality', label: 'Nationalité', level: 'low', detail: nat === 'CH' ? 'Suisse' : `Pays standard (${nat})`, points: 0 })
  }

  // 2. PEP (0-25 pts)
  if (input.pepMatch) {
    factors.push({ id: 'pep', label: 'Statut PEP', level: 'high', detail: 'Correspondance PEP détectée', points: 25 })
  } else {
    factors.push({ id: 'pep', label: 'Statut PEP', level: 'low', detail: 'Aucune correspondance PEP', points: 0 })
  }

  // 3. Amount (0-20 pts)
  if (input.transactionAmount > 5_000_000) {
    factors.push({ id: 'amount', label: 'Montant transaction', level: 'high', detail: `> CHF 5'000'000`, points: 20 })
  } else if (input.transactionAmount > 2_000_000) {
    factors.push({ id: 'amount', label: 'Montant transaction', level: 'medium', detail: `> CHF 2'000'000`, points: 10 })
  } else {
    factors.push({ id: 'amount', label: 'Montant transaction', level: 'low', detail: `< CHF 2'000'000`, points: 0 })
  }

  // 4. Entity type (0-15 pts)
  if (input.kycType.includes('_pm')) {
    factors.push({ id: 'entity', label: "Type d'entité", level: 'medium', detail: 'Personne morale — structure à vérifier (UBO)', points: 15 })
  } else {
    factors.push({ id: 'entity', label: "Type d'entité", level: 'low', detail: 'Personne physique', points: 0 })
  }

  // 5. Documents (0-15 pts)
  if (input.completionPct < 50) {
    factors.push({ id: 'docs', label: 'Documents', level: 'high', detail: `${input.completionPct}% complété`, points: 15 })
  } else if (input.completionPct < 80) {
    factors.push({ id: 'docs', label: 'Documents', level: 'medium', detail: `${input.completionPct}% complété`, points: 8 })
  } else {
    factors.push({ id: 'docs', label: 'Documents', level: 'low', detail: `${input.completionPct}% complété`, points: 0 })
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0)
  const level = score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low'
  return { score, level, factors }
}
