// Golden set d'éval de la compréhension WhatsApp (whatsapp-comprehend → DeepSeek).
//
// Rien n'évaluait la QUALITÉ de la sortie DeepSeek → une migration de modèle serait un
// saut dans le vide. Ce spec fige ~24 conversations synthétiques labellisées et mesure la
// précision catégorielle de l'extraction (langue/sentiment/urgence/next_action/lead/
// mots-clés d'intention) contre un SEUIL. Une régression (modèle qui dégrade) tombe sous
// le seuil ; un aléa ponctuel du modèle ne rougit pas (score agrégé, pas exact-match).
//
// Deux niveaux :
//   1. DÉTERMINISTE (sans clé, tourne partout, y compris backend.yml sur chaque PR) :
//      redaction PII (les AVS/IBAN/mdp FICTIFS sont scrubés, nom/tél préservés) + les
//      unités du helper de scoring.
//   2. LIVE (skipIf sans DEEPSEEK_API_KEY) : appelle réellement DeepSeek sur le golden set.
//      « Live in CI » via .github/workflows/comprehension-eval.yml (secret DEEPSEEK_API_KEY).
//      Modèle A/B testable : DEEPSEEK_EVAL_MODEL (défaut deepseek-chat) → dé-risque le 24/07.
//
// Robustesse infra≠qualité : un incident DeepSeek (réseau/5xx) → cas en erreur exclus ;
// si trop de cas échouent, l'assertion qualité est IGNORÉE (pas de rouge injuste).

import { describe, it, expect } from 'vitest'
import { buildThreadDigest, buildMessages, comprehend, type ConversationInsight } from '../../supabase/functions/_shared/whatsapp-comprehend.ts'
import { GOLDEN_CASES } from './fixtures/comprehension-golden.ts'
import {
  scoreCase, aggregate, findLeaks, findMissing, checkThresholds, macroAccuracy, classifyError, EVAL_THRESHOLDS,
  type CheckResult, type ErrKind,
} from './helpers/comprehension-eval.ts'

const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const HAS_KEY = !!API_KEY
const MODEL = process.env.DEEPSEEK_EVAL_MODEL || 'deepseek-chat'
const CONCURRENCY = 4

// ── DÉTERMINISTE — redaction PII (sans clé) ──────────────────────────────────
describe('golden — redaction déterministe (PII fictives scrubées, contact préservé)', () => {
  it('aucune PII sensible (AVS/IBAN/mdp) ne survit au digest ; nom/tél préservés', () => {
    const leaks: string[] = []
    const missing: string[] = []
    for (const gc of GOLDEN_CASES) {
      const digest = buildThreadDigest(gc.messages)
      for (const l of findLeaks(digest, gc.expect.mustNotLeak)) leaks.push(`${gc.id}: ${l}`)
      for (const m of findMissing(digest, gc.expect.mustPreserve)) missing.push(`${gc.id}: ${m}`)
    }
    expect(leaks, 'PII sensible a fuité dans le digest envoyé à DeepSeek').toEqual([])
    expect(missing, 'donnée de contact à préserver absente du digest (redaction trop agressive)').toEqual([])
  })

  it('couvre 20-30 conversations (exigence du golden set)', () => {
    expect(GOLDEN_CASES.length).toBeGreaterThanOrEqual(20)
    expect(GOLDEN_CASES.length).toBeLessThanOrEqual(30)
    // ids uniques (pas de doublon silencieux)
    expect(new Set(GOLDEN_CASES.map((g) => g.id)).size).toBe(GOLDEN_CASES.length)
  })
})

// ── DÉTERMINISTE — unités du helper de scoring ───────────────────────────────
describe('golden — helper de scoring (pur)', () => {
  const base: ConversationInsight = {
    summary: null, rolling_summary: null, intent: 'recherche_achat', entities: {},
    commitments: [], objections: [], sentiment: 'positif', urgency: 'haute',
    language: 'fr', next_action: { type: 'planifier_visite', label: 'x' }, lead: null,
  }
  it('scoreCase ne note QUE les champs renseignés et détecte le bon/mauvais', () => {
    const ok = scoreCase(base, { language: 'fr', sentiment: 'positif' })
    expect(ok.every((c) => c.ok)).toBe(true)
    expect(ok.length).toBe(2) // seuls 2 champs renseignés
    const bad = scoreCase(base, { language: 'de', urgency: 'faible' })
    expect(bad.every((c) => !c.ok)).toBe(true)
  })
  it('nextActionOneOf accepte un ensemble ; intentIncludesAny fait un contains', () => {
    expect(scoreCase(base, { nextActionOneOf: ['planifier_visite', 'envoyer_biens'] })[0].ok).toBe(true)
    expect(scoreCase(base, { intentIncludesAny: ['achat'] })[0].ok).toBe(true)
    expect(scoreCase(base, { intentIncludesAny: ['location'] })[0].ok).toBe(false)
  })
  it('aggregate calcule la précision globale + par dimension', () => {
    const checks: CheckResult[] = [
      { dimension: 'language', ok: true, want: 'fr', got: 'fr' },
      { dimension: 'language', ok: false, want: 'fr', got: 'de' },
      { dimension: 'sentiment', ok: true, want: 'positif', got: 'positif' },
    ]
    const agg = aggregate(checks)
    expect(agg.accuracy).toBeCloseTo(2 / 3)
    expect(agg.byDimension.language.accuracy).toBeCloseTo(0.5)
    expect(agg.byDimension.sentiment.accuracy).toBe(1)
  })
  it('macro-moyenne : la langue sur-représentée ne masque pas un effondrement', () => {
    // 20 checks langue OK + 1 next_action KO. Micro = 20/21 ≈ 95% (masque),
    // macro = (langue 100% + next_action 0%)/2 = 50% (démasque).
    const checks: CheckResult[] = [
      ...Array.from({ length: 20 }, () => ({ dimension: 'language', ok: true, want: 'fr', got: 'fr' })),
      { dimension: 'next_action', ok: false, want: 'planifier_visite', got: 'rien' },
    ]
    const agg = aggregate(checks)
    expect(agg.accuracy).toBeGreaterThan(0.9)   // micro trompeur
    expect(macroAccuracy(agg)).toBeCloseTo(0.5) // macro honnête
  })
  it('checkThresholds : plancher CORE ignoré si trop peu échantillonné (anti-flaky)', () => {
    // next_action à 0% mais 1 seul échantillon (< MIN_DIM_SAMPLES) → pas de plancher ;
    // seule la macro décide. Ici macro (langue 100 + next 0)/2 = 50 < MACRO_MIN → échec macro.
    const few: CheckResult[] = [
      { dimension: 'language', ok: true, want: 'fr', got: 'fr' },
      { dimension: 'next_action', ok: false, want: 'x', got: 'y' },
    ]
    const r1 = checkThresholds(aggregate(few))
    expect(r1.pass).toBe(false)
    expect(r1.failures.some((f) => f.startsWith('macro'))).toBe(true)
    expect(r1.failures.some((f) => f.startsWith('next_action'))).toBe(false) // sous-échantillonné → pas de plancher

    // Tout bon et bien échantillonné → pass.
    const good = [
      ...Array.from({ length: 10 }, () => ({ dimension: 'language', ok: true, want: 'fr', got: 'fr' })),
      ...Array.from({ length: 10 }, () => ({ dimension: 'intent', ok: true, want: 'a', got: 'a' })),
      ...Array.from({ length: 10 }, () => ({ dimension: 'next_action', ok: true, want: 'a', got: 'a' })),
    ]
    expect(checkThresholds(aggregate(good)).pass).toBe(true)

    // next_action bien échantillonné mais effondré → plancher CORE déclenché.
    const collapse = [
      ...Array.from({ length: 10 }, () => ({ dimension: 'language', ok: true, want: 'fr', got: 'fr' })),
      ...Array.from({ length: 10 }, () => ({ dimension: 'intent', ok: true, want: 'a', got: 'a' })),
      ...Array.from({ length: 10 }, () => ({ dimension: 'next_action', ok: false, want: 'a', got: 'b' })),
    ]
    const r2 = checkThresholds(aggregate(collapse))
    expect(r2.pass).toBe(false)
    expect(r2.failures.some((f) => f.startsWith('next_action'))).toBe(true)
  })
  it('findLeaks / findMissing insensibles à la casse', () => {
    expect(findLeaks('IBAN CH9300762011623852957 ici', ['ch9300762011623852957'])).toHaveLength(1)
    expect(findLeaks('rien de sensible', ['756.1234'])).toEqual([])
    expect(findMissing('bonjour Camille', ['Camille'])).toEqual([])
    expect(findMissing('bonjour', ['Camille'])).toEqual(['Camille'])
  })
  it('classifyError : clé invalide/requête rejetée = PERMANENT (rougit), incident = TRANSITOIRE (skip)', () => {
    const perm: ErrKind = 'permanent'
    const tran: ErrKind = 'transient'
    expect(classifyError('deepseek HTTP 401')).toBe(perm)   // clé invalide
    expect(classifyError('deepseek HTTP 403')).toBe(perm)
    expect(classifyError('deepseek HTTP 400')).toBe(perm)   // requête rejetée
    expect(classifyError('deepseek HTTP 404')).toBe(perm)
    expect(classifyError('deepseek HTTP 429')).toBe(tran)   // quota
    expect(classifyError('deepseek HTTP 500')).toBe(tran)
    expect(classifyError('deepseek HTTP 503')).toBe(tran)
    expect(classifyError('The operation was aborted')).toBe(tran) // timeout/hang
    expect(classifyError('fetch failed')).toBe(tran)              // réseau
  })
})

// ── LIVE — appel DeepSeek réel sur le golden set ─────────────────────────────
type Outcome =
  | { ok: true; insight: ConversationInsight }
  | { ok: false; error: string; kind: ErrKind }

const RETRY_TRIES = 2   // borne le pire cas sous le timeout du it() (cf. finding hang)

async function comprehendWithRetry(messages: Array<{ role: string; content: string }>): Promise<Outcome> {
  let last: { error: string; kind: ErrKind } = { error: 'error', kind: 'transient' }
  for (let t = 0; t < RETRY_TRIES; t++) {
    try {
      const insight = await comprehend(messages, API_KEY, undefined, MODEL)
      return { ok: true, insight }
    } catch (e) {
      const error = String((e as Error)?.message ?? 'error').slice(0, 120)
      const kind = classifyError(error)
      last = { error, kind }
      if (kind === 'permanent') break                 // inutile de rejouer une clé invalide
      if (t < RETRY_TRIES - 1) await new Promise((r) => setTimeout(r, 300)) // backoff entre essais seulement
    }
  }
  return { ok: false, ...last }
}

async function mapPool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let idx = 0
  const worker = async () => {
    for (;;) {
      const i = idx++
      if (i >= items.length) return
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return results
}

describe.skipIf(!HAS_KEY)('golden — compréhension live (DeepSeek)', () => {
  // Timeout large : pire cas HANG borné = ceil(cas/CONCURRENCY) vagues × (RETRY_TRIES × 15s
  // + backoff) ≈ 7 × 30s ≈ 212s < 300s → le skip infra s'exécute au lieu de rougir en timeout.
  it(`macro-précision >= ${EVAL_THRESHOLDS.MACRO_MIN * 100}% + planchers CORE (modèle ${MODEL})`, async () => {
    const outcomes = await mapPool(GOLDEN_CASES, CONCURRENCY, async (gc) => {
      const digest = buildThreadDigest(gc.messages)
      const res = await comprehendWithRetry(buildMessages(digest, gc.priorSummary ?? null))
      return { gc, res }
    })

    const responded = outcomes.filter((o) => o.res.ok) as Array<{ gc: (typeof GOLDEN_CASES)[number]; res: { ok: true; insight: ConversationInsight } }>
    const permanent = outcomes.filter((o) => !o.res.ok && o.res.kind === 'permanent')
    const transient = outcomes.filter((o) => !o.res.ok && o.res.kind === 'transient')

    // (1) ÉCHEC DUR : erreurs PERMANENTES (clé invalide/expirée, requête rejetée). Sans ça,
    // « tout en 401 → 0 répondu → skip » passerait VERT en ne testant rien (finding).
    if (permanent.length > 0) {
      const sample = permanent.slice(0, 3).map((o) => `${o.gc.id}: ${(o.res as { error: string }).error}`).join(' | ')
      throw new Error(`Éval NON exécutée : ${permanent.length} appel(s) DeepSeek en échec permanent (clé invalide/expirée ou requête rejetée) — ${sample}`)
    }

    // (2) INVARIANT DUR : aucune PII fictive ne réapparaît dans la sortie modèle.
    const leaks: string[] = []
    const allChecks: CheckResult[] = []
    for (const o of responded) {
      for (const l of findLeaks(JSON.stringify(o.res.insight), o.gc.expect.mustNotLeak)) {
        leaks.push(`${o.gc.id}: ${l}`)
      }
      allChecks.push(...scoreCase(o.res.insight, o.gc.expect))
    }
    const agg = aggregate(allChecks)
    const { pass, failures, macro } = checkThresholds(agg)

    // Rapport lisible (rend une régression diagnosticable dans les logs CI).
    const dims = Object.entries(agg.byDimension)
      .map(([d, s]) => `${d} ${(s.accuracy * 100).toFixed(0)}% (${s.passed}/${s.total})`)
      .join(' · ')
    console.log(`[golden ${MODEL}] répondu ${responded.length}/${GOLDEN_CASES.length}` +
      (transient.length ? ` (${transient.length} err transitoire)` : '') +
      ` — macro ${(macro * 100).toFixed(1)}% · micro ${(agg.accuracy * 100).toFixed(1)}% sur ${agg.total} checks — ${dims}`)
    for (const c of allChecks.filter((c) => !c.ok)) {
      console.log(`  ✗ ${c.dimension}: attendu ${JSON.stringify(c.want)}, obtenu ${JSON.stringify(c.got)}`)
    }

    expect(leaks, 'PII fictive a fuité dans la sortie du modèle').toEqual([])

    // (3) infra ≠ qualité : trop de cas en erreur TRANSITOIRE (5xx/hang/quota) → incident
    // infra probable, on N'ASSERTE PAS la qualité (pas de rouge injuste sur panne DeepSeek).
    const respondedRatio = responded.length / GOLDEN_CASES.length
    if (respondedRatio < EVAL_THRESHOLDS.MIN_RESPONDED_RATIO) {
      console.warn(`[golden] ${transient.length}/${GOLDEN_CASES.length} cas en erreur transitoire (${transient.map((e) => (e.res as { error: string }).error).slice(0, 3).join(' | ')}) — incident infra probable, assertion qualité IGNORÉE`)
      return
    }

    // (4) GATE qualité : macro-moyenne + planchers CORE (voir checkThresholds).
    expect(pass, `qualité insuffisante (modèle ${MODEL}) : ${failures.join(' ; ')} — voir les ✗ ci-dessus`).toBe(true)
  }, 300_000)
})
