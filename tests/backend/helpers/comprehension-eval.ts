// Golden set d'éval de la compréhension WhatsApp — SCORING PUR (0 I/O, 0 clé).
//
// Le golden set (tests/backend/fixtures/comprehension-golden.ts) fige ~24 conversations
// synthétiques + les labels attendus. Ici on SCORE une sortie ConversationInsight de
// DeepSeek contre ces labels. Déterministe → testable sans clé (describe déterministe
// du spec). La sortie LLM étant non-déterministe, on ne note QUE les champs catégoriels
// (langue, sentiment, urgence, next_action, lead, mots-clés d'intention) et on agrège
// un score global comparé à un SEUIL — un vrai régression (migration de modèle qui
// dégrade la qualité) tombe sous le seuil ; un aléa ponctuel du modèle ne rougit pas.
//
// La non-fuite PII est traitée à part (findLeaks) comme un invariant DUR, pas une note.

import type { ConversationInsight } from '../../../supabase/functions/_shared/whatsapp-comprehend.ts'

/** Ce qu'on attend d'une conversation. Ne renseigner QUE les champs francs (sinon on
 *  note de l'ambigu → flaky). Un champ absent n'est pas noté. */
export interface GoldenExpect {
  language?: 'fr' | 'de' | 'en' | 'it'
  sentiment?: 'positif' | 'neutre' | 'tendu'
  urgency?: 'haute' | 'moyenne' | 'faible'
  /** type de next_action attendu (un seul) OU un ensemble acceptable. */
  nextActionType?: string
  nextActionOneOf?: string[]
  /** l'intention (minuscule) doit contenir au moins un de ces mots-clés. */
  intentIncludesAny?: string[]
  hasLead?: boolean
  leadIsThirdParty?: boolean
  commitmentsNonEmpty?: boolean
  objectionsNonEmpty?: boolean
  /** valeurs PII sensibles qui NE DOIVENT JAMAIS réapparaître (digest ou insight). */
  mustNotLeak?: string[]
  /** valeurs (nom/téléphone/email) qui DOIVENT être préservées dans le digest. */
  mustPreserve?: string[]
}

export interface CheckResult {
  dimension: string
  ok: boolean
  want: unknown
  got: unknown
}

/** Note une sortie insight contre les labels attendus → une liste de checks catégoriels.
 *  Seuls les champs renseignés dans `expect` produisent un check. */
export function scoreCase(insight: ConversationInsight, expect: GoldenExpect): CheckResult[] {
  const checks: CheckResult[] = []
  const push = (dimension: string, ok: boolean, want: unknown, got: unknown) =>
    checks.push({ dimension, ok, want, got })

  if (expect.language !== undefined) {
    push('language', insight.language === expect.language, expect.language, insight.language)
  }
  if (expect.sentiment !== undefined) {
    push('sentiment', insight.sentiment === expect.sentiment, expect.sentiment, insight.sentiment)
  }
  if (expect.urgency !== undefined) {
    push('urgency', insight.urgency === expect.urgency, expect.urgency, insight.urgency)
  }
  if (expect.nextActionType !== undefined) {
    push('next_action', insight.next_action?.type === expect.nextActionType, expect.nextActionType, insight.next_action?.type ?? null)
  }
  if (expect.nextActionOneOf !== undefined) {
    const got = insight.next_action?.type ?? null
    push('next_action', got != null && expect.nextActionOneOf.includes(got), expect.nextActionOneOf, got)
  }
  if (expect.intentIncludesAny !== undefined) {
    const intent = (insight.intent ?? '').toLowerCase()
    const ok = expect.intentIncludesAny.some((k) => intent.includes(k.toLowerCase()))
    push('intent', ok, expect.intentIncludesAny, insight.intent)
  }
  if (expect.hasLead !== undefined) {
    push('lead_presence', (insight.lead !== null) === expect.hasLead, expect.hasLead, insight.lead !== null)
  }
  if (expect.leadIsThirdParty !== undefined) {
    push('lead_third_party', insight.lead?.is_third_party === expect.leadIsThirdParty, expect.leadIsThirdParty, insight.lead?.is_third_party ?? null)
  }
  if (expect.commitmentsNonEmpty !== undefined) {
    push('commitments', (insight.commitments.length > 0) === expect.commitmentsNonEmpty, expect.commitmentsNonEmpty, insight.commitments.length)
  }
  if (expect.objectionsNonEmpty !== undefined) {
    push('objections', (insight.objections.length > 0) === expect.objectionsNonEmpty, expect.objectionsNonEmpty, insight.objections.length)
  }
  return checks
}

export interface Aggregate {
  total: number
  passed: number
  accuracy: number
  byDimension: Record<string, { passed: number; total: number; accuracy: number }>
}

/** Agrège une liste de checks → score global + ventilation par dimension (diagnostic). */
export function aggregate(checks: CheckResult[]): Aggregate {
  const byDimension: Record<string, { passed: number; total: number; accuracy: number }> = {}
  let passed = 0
  for (const c of checks) {
    const d = byDimension[c.dimension] ?? { passed: 0, total: 0, accuracy: 0 }
    d.total++
    if (c.ok) { d.passed++; passed++ }
    byDimension[c.dimension] = d
  }
  for (const d of Object.values(byDimension)) d.accuracy = d.total ? d.passed / d.total : 1
  const total = checks.length
  return { total, passed, accuracy: total ? passed / total : 1, byDimension }
}

/** Renvoie les valeurs PII qui ont FUITÉ dans `text` (substring, insensible à la casse
 *  pour les lettres d'un IBAN). Vide = aucune fuite (invariant respecté). */
export function findLeaks(text: string, mustNotLeak: string[] | undefined): string[] {
  if (!mustNotLeak?.length) return []
  const hay = (text ?? '').toLowerCase()
  return mustNotLeak.filter((needle) => {
    const n = needle.trim().toLowerCase()
    return n.length > 0 && hay.includes(n)
  })
}

/** Renvoie les valeurs qui DEVAIENT être préservées mais sont ABSENTES de `text`. */
export function findMissing(text: string, mustPreserve: string[] | undefined): string[] {
  if (!mustPreserve?.length) return []
  const hay = (text ?? '').toLowerCase()
  return mustPreserve.filter((needle) => {
    const n = needle.trim().toLowerCase()
    return n.length > 0 && !hay.includes(n)
  })
}

/** Moyenne MACRO : moyenne des précisions PAR DIMENSION (chaque dimension pèse pareil).
 *  Contrairement à agg.accuracy (micro = pooled), la langue sur-représentée (~1 check/cas)
 *  ne dilue plus les dimensions dures → un effondrement de next_action/sentiment ne peut
 *  plus être masqué par une langue quasi parfaite. */
export function macroAccuracy(agg: Aggregate): number {
  const dims = Object.values(agg.byDimension)
  if (!dims.length) return 1
  return dims.reduce((s, d) => s + d.accuracy, 0) / dims.length
}

// ── Classification des erreurs DeepSeek (infra ≠ config) ─────────────────────
export type ErrKind = 'permanent' | 'transient'

/**
 * Classe une erreur remontée par comprehend() (qui lève « deepseek HTTP <status> » sur
 * non-2xx, ou une AbortError sur timeout/hang, ou une erreur réseau).
 *  - PERMANENT = faute de config : clé invalide/expirée (401/403), requête rejetée
 *    (400/404). L'éval ne teste RIEN → doit ROUGIR (sinon « tout en 401 → 0 répondu →
 *    skip » passerait vert vacui).
 *  - TRANSITOIRE = incident infra : 5xx, 429 (quota), timeout/hang, réseau → skip infra,
 *    jamais de rouge injuste sur une panne DeepSeek.
 */
export function classifyError(msg: string): ErrKind {
  const m = /HTTP\s+(\d{3})/.exec(msg ?? '')
  if (m) {
    const code = Number(m[1])
    if (code === 429 || code >= 500) return 'transient'
    if (code >= 400) return 'permanent'   // 400/401/403/404 → clé/requête invalide
  }
  return 'transient'                        // AbortError (timeout/hang) / réseau
}

// ── Seuils de l'éval (internes ; ce sont des tests, pas du contenu public) ─────
// Points de départ CONSERVATEURS (labels jamais joués en live) : à resserrer après la
// première baseline live. Le gate combine macro-moyenne (dégradation large) + planchers
// sur les dimensions CORE fiables et bien échantillonnées (effondrement ciblé).
export const EVAL_THRESHOLDS = {
  /** Macro-précision minimale (moyenne des dimensions). */
  MACRO_MIN: 0.75,
  /** Planchers par dimension CORE (fiable + bien échantillonnée). Un effondrement d'une
   *  seule de ces capacités rougit, même si la macro globale tient. */
  CORE_FLOORS: { language: 0.9, intent: 0.7, next_action: 0.7 } as Record<string, number>,
  /** Pas de plancher sur une dimension trop peu échantillonnée (anti-flaky). */
  MIN_DIM_SAMPLES: 5,
  /** Fraction minimale de cas ayant répondu ; en dessous = incident infra TRANSITOIRE
   *  (DeepSeek down / hang / quota 429) → on N'ASSERTE PAS la qualité (pas de rouge injuste).
   *  NB : une clé invalide (4xx permanent) est traitée à part = échec DUR, pas un skip. */
  MIN_RESPONDED_RATIO: 0.7,
} as const

export interface ThresholdResult { pass: boolean; failures: string[]; macro: number }

/** Applique le gate : macro >= MACRO_MIN ET chaque dimension CORE (assez échantillonnée)
 *  >= son plancher. Renvoie les raisons d'échec (diagnostic lisible en CI). Pur. */
export function checkThresholds(agg: Aggregate): ThresholdResult {
  const failures: string[] = []
  const macro = macroAccuracy(agg)
  if (macro < EVAL_THRESHOLDS.MACRO_MIN) {
    failures.push(`macro ${(macro * 100).toFixed(1)}% < ${EVAL_THRESHOLDS.MACRO_MIN * 100}%`)
  }
  for (const [dim, floor] of Object.entries(EVAL_THRESHOLDS.CORE_FLOORS)) {
    const d = agg.byDimension[dim]
    if (d && d.total >= EVAL_THRESHOLDS.MIN_DIM_SAMPLES && d.accuracy < floor) {
      failures.push(`${dim} ${(d.accuracy * 100).toFixed(1)}% < plancher ${floor * 100}% (${d.passed}/${d.total})`)
    }
  }
  return { pass: failures.length === 0, failures, macro }
}
