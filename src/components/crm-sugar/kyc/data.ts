// MEGGA CRM Sugar v2 — KYC mock data (Tier 4)
// Aligned with proto `megga-kyc-variations.jsx` rows + detail.

export type KycCaseStatus = 'review' | 'in' | 'valid' | 'stale'
export type KycPepStatus = 'ok' | 'review' | 'match'

export interface KycCaseRow {
  id: string
  name: string
  type: string
  amt: string
  risk: number
  pep: KycPepStatus
  st: KycCaseStatus
  prog: number
  days: number
  agent: string
}

export const KYC_ROWS: KycCaseRow[] = [
  { id: '0431', name: 'Élodie Schmidt', type: 'Acheteur PP', amt: "CHF 850'000", risk: 14, pep: 'ok', st: 'review', prog: 78, days: 0, agent: 'Sophie M.' },
  { id: '0428', name: 'Antoine Picard', type: 'Acheteur PP', amt: "CHF 1'420'000", risk: 28, pep: 'ok', st: 'in', prog: 55, days: 3, agent: 'Gregory L.' },
  { id: '0425', name: 'ATR Holding SA', type: 'Acheteur PM', amt: "CHF 4'200'000", risk: 62, pep: 'review', st: 'review', prog: 71, days: 1, agent: 'Julien S.' },
  { id: '0424', name: 'Marie Bertrand', type: 'Acheteur PP', amt: "CHF 1'180'000", risk: 9, pep: 'ok', st: 'valid', prog: 100, days: 0, agent: 'Sophie M.' },
  { id: '0421', name: 'S. Volkov', type: 'Acheteur PP', amt: "CHF 2'750'000", risk: 78, pep: 'match', st: 'review', prog: 64, days: 6, agent: 'Julien S.' },
  { id: '0419', name: 'Pierre Vionnet', type: 'Vendeur PP', amt: "CHF 920'000", risk: 12, pep: 'ok', st: 'valid', prog: 100, days: 0, agent: 'Gregory L.' },
  { id: '0417', name: 'Catherine Loreau', type: 'Vendeur PP', amt: "CHF 680'000", risk: 18, pep: 'ok', st: 'in', prog: 32, days: 5, agent: 'Sophie M.' },
  { id: '0414', name: 'A. Reinhardt', type: 'Acheteur PP', amt: "CHF 1'550'000", risk: 21, pep: 'ok', st: 'stale', prog: 100, days: 12, agent: 'Julien S.' },
]

export const KYC_STATUS_MAP: Record<
  KycCaseStatus,
  { tone: 'warn' | 'pending' | 'ok'; label: string }
> = {
  review: { tone: 'warn', label: 'À valider' },
  in: { tone: 'pending', label: 'En cours' },
  valid: { tone: 'ok', label: 'Validé' },
  stale: { tone: 'pending', label: 'À re-screener' },
}

export const KYC_KPIS: { k: string; v: string; sub: string; tone: 'neutral' | 'warn' | 'ok' | 'danger' | 'pending' }[] = [
  { k: 'Dossiers actifs', v: '47', sub: '+6 ce mois', tone: 'neutral' },
  { k: 'À valider', v: '12', sub: 'dont 3 > 7j', tone: 'warn' },
  { k: 'Score moyen', v: '23', sub: 'Faible · stable', tone: 'ok' },
  { k: 'Alertes PEP', v: '2', sub: 'À examiner', tone: 'danger' },
  { k: 'Screenings > 12 mois', v: '5', sub: 'À rafraîchir', tone: 'pending' },
]

export const KYC_FILTERS = [
  'Tous (47)',
  'À valider (12)',
  'En cours (18)',
  'Validés (12)',
  'À re-screener (5)',
  'Risque élevé (4)',
]

// ─── Detail page mock data ────────────────────────────────────────────────
export type KycStepState = 'done' | 'active' | 'todo'
export type KycDocState = 'ok' | 'wait' | 'todo'
export type KycScreeningMatch = 'clear' | 'review'

export interface KycDetailStep {
  k: string
  label: string
  sub: string
  state: KycStepState
}

export interface KycDetailDoc {
  name: string
  by: string
  state: KycDocState
  method?: string
}

export interface KycDetailScreening {
  src: string
  match: KycScreeningMatch
}

export interface KycDetailRiskRow {
  k: string
  v: number
  max: number
}

export interface KycDetailHero {
  ref: string
  name: string
  badge: string
  meta: string
  avatarSize?: number
  riskScore: number
  riskLabel: string
  progressPct: number
  progressSub: string
  lastScreening: string
  lastScreeningSub: string
}

export interface KycDetailData {
  hero: KycDetailHero
  steps: KycDetailStep[]
  screenings: KycDetailScreening[]
  screeningSources: number
  screeningLastRun: string
  alertText: string
  riskScore: number
  riskRows: KycDetailRiskRow[]
  docs: KycDetailDoc[]
}

export const KYC_DETAIL_MOCK: KycDetailData = {
  hero: {
    ref: 'KYC-2026-0431',
    name: 'Élodie Schmidt',
    badge: 'Acheteuse · Personne physique',
    meta: "🇨🇭 Suisse · né(e) 14.03.1981 · Carouge, GE · Transaction CHF 850'000 — Carouge 5p",
    riskScore: 14,
    riskLabel: 'Faible',
    progressPct: 78,
    progressSub: '5/7 étapes',
    lastScreening: '12.04.26',
    lastScreeningSub: 'il y a 21 jours',
  },
  steps: [
    { k: 'id', label: 'Identification', sub: 'PJ identité, justif. domicile', state: 'done' },
    { k: 'ben', label: 'Bénéficiaire effectif', sub: 'Auto-déclaration', state: 'done' },
    { k: 'fund', label: 'Origine des fonds', sub: 'Épargne · attestation UBS', state: 'done' },
    { k: 'scr', label: 'Screening PEP / sanctions', sub: 'Aucune correspondance', state: 'done' },
    { k: 'risk', label: 'Évaluation du risque', sub: 'Faible · 14 / 100', state: 'active' },
    { k: 'valid', label: 'Validation conformité', sub: 'Sophie M. — en attente', state: 'todo' },
    { k: 'renew', label: 'Renouvellement', sub: 'Auto · 12 mois', state: 'todo' },
  ],
  screenings: [
    { src: 'Liste OFAC (US)', match: 'clear' },
    { src: 'Sanctions UE', match: 'clear' },
    { src: 'SECO (Suisse)', match: 'clear' },
    { src: 'PEP World-Check', match: 'review' },
  ],
  screeningSources: 4,
  screeningLastRun: 'Lancé il y a 2 min',
  alertText:
    '« Elodie Schmid » (Vienne, AT) — homonymie partielle, score 47/100. Date de naissance différente.',
  riskScore: 14,
  riskRows: [
    { k: 'Nationalité (CH)', v: 0, max: 20 },
    { k: 'Montant (CHF 850k)', v: 6, max: 30 },
    { k: 'Type (acheteur PP)', v: 4, max: 20 },
    { k: 'Screening (1 alerte mineure)', v: 4, max: 20 },
    { k: 'Complétude dossier (78%)', v: 0, max: 10 },
  ],
  docs: [
    { name: 'Passeport CH', by: 'Vérifié par Sophie M. · 12.04.26', method: 'en personne', state: 'ok' },
    { name: 'Justificatif domicile', by: 'Facture SIG · janvier', state: 'ok' },
    { name: 'Auto-déclaration béné. effectif', by: 'Signée 12.04.26', state: 'ok' },
    { name: 'Attestation UBS', by: '1.2 Mo · PDF', state: 'ok' },
    { name: 'Relevés 3 derniers mois', by: 'Demandé · attente client', state: 'wait' },
    { name: 'Auto-décl. fonds non liés', by: 'À signer', state: 'todo' },
  ],
}
