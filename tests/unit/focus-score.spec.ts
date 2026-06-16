// Unit tests (pur, 0 DB, 0 LLM) — Algo Focus : module focusScore.ts + contrat.
// Le tri inter-signaux final est CLIENT (archi C hybride) → c'est ICI qu'on
// prouve son déterminisme (cas non observable en base : aucune agence n'a
// deals+matches ensemble).

import { describe, it, expect } from 'vitest'
import {
  scoreItem,
  assignTier,
  buildReason,
  finalizeQueue,
  kycBonus,
  parseFocusConfig,
  toDisplayScore,
  FOCUS_DEFAULTS,
  type FocusScoreInput,
  type FocusRankable,
} from '@/components/crm-sugar/today/focusScore'
import { selectFocusQueue, FOCUS_QUEUE_DEMO, type FocusItem } from '@/components/crm-sugar/today/focusQueue'
import { transactionToCrmDeal } from '@/lib/sugarAdapters'
import type { ContactTransaction } from '@/hooks/useTransactions'

const NOW = Date.parse('2026-06-16T12:00:00')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

const match = (over: Partial<FocusScoreInput> = {}): FocusScoreInput => ({
  signalKind: 'match-market', matchScore: 85, reasonsMatchCount: 3, reasonKeys: ['budget', 'zone'], ...over,
})
const reminder = (over: Partial<FocusScoreInput> = {}): FocusScoreInput => ({
  signalKind: 'reminder', reminderTriggerAt: daysAgo(2), reminderType: 'custom', ...over,
})
const deal = (over: Partial<FocusScoreInput> = {}): FocusScoreInput => ({
  signalKind: 'deal', stageProb: 85, dealRisk: 'healthy', dealStage: 'offer', dealValue: 1_000_000, ...over,
})

const rankable = (over: Partial<FocusRankable> = {}): FocusRankable => ({
  id: 'x', contactId: 'c', signalKind: 'match-market', score: 50, tier: 'now', ...over,
})

describe('focusScore — Algo Focus (déterministe, explicable)', () => {
  it('U1 — paused→on_hold : un deal on_hold est at-risk et part en « now »', () => {
    const tx: ContactTransaction = {
      id: 't1', stage: 'offer', status: 'on_hold', price_offered: 900_000, price_final: null,
      updated_at: daysAgo(1), property: null,
    }
    const d = transactionToCrmDeal(tx, 'c1', null)
    expect(d.risk).toBe('at-risk')
    expect(assignTier(deal({ dealRisk: d.risk }), NOW)).toBe('now')
    // garde-fou de la régression : un deal actif reste healthy (pas at-risk)
    expect(transactionToCrmDeal({ ...tx, status: 'active' }, 'c1', null).risk).toBe('healthy')
  })

  it('U2 — score borné [0..100] pour toutes les familles', () => {
    for (const i of [match({ matchScore: 100, reasonsMatchCount: 5, signalKind: 'match-internal' }), reminder(), deal(), reminder({ reminderTriggerAt: daysAgo(99) })]) {
      const s = scoreItem(i, NOW)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })

  it('U3 — déterminisme : même entrée → même sortie', () => {
    const i = match({ matchScore: 88 })
    expect(scoreItem(i, NOW)).toBe(scoreItem(i, NOW))
    expect(assignTier(i, NOW)).toBe(assignTier(i, NOW))
    expect(buildReason(i, NOW)).toBe(buildReason(i, NOW))
  })

  it('U4 — seuil match 80 : 80 → now, 79 → next', () => {
    expect(assignTier(match({ matchScore: 80 }), NOW)).toBe('now')
    expect(assignTier(match({ matchScore: 79 }), NOW)).toBe('next')
  })

  it('U5 — seuil match 70 : 70 → next, 69 → rest', () => {
    expect(assignTier(match({ matchScore: 70 }), NOW)).toBe('next')
    expect(assignTier(match({ matchScore: 69 }), NOW)).toBe('rest')
  })

  it('U6 — cap « now » = 3 : 5 items now → 3 now + 2 rétrogradés next', () => {
    const items = [95, 90, 88, 85, 82].map((s, k) =>
      rankable({ id: `m${k}`, contactId: `c${k}`, score: s, tier: 'now' }),
    )
    const out = finalizeQueue(items)
    expect(out.filter((i) => i.tier === 'now')).toHaveLength(3)
    expect(out.filter((i) => i.tier === 'next')).toHaveLength(2)
    // les 3 meilleurs scores restent « now »
    expect(out.slice(0, 3).map((i) => i.score)).toEqual([95, 90, 88])
  })

  it('U7 — cap 2/contact : 4 matches d\'un même contact → 2 retenus (meilleurs)', () => {
    const items = [99, 91, 84, 77].map((s, k) =>
      rankable({ id: `m${k}`, contactId: 'same', score: s, tier: 'next', signalKind: 'match-market' }),
    )
    // un reminder du même contact ne doit PAS être cappé
    items.push(rankable({ id: 'rem', contactId: 'same', score: 40, tier: 'now', signalKind: 'reminder' }))
    const out = finalizeQueue(items)
    expect(out.filter((i) => i.signalKind.startsWith('match'))).toHaveLength(2)
    expect(out.filter((i) => i.signalKind === 'reminder')).toHaveLength(1)
    expect(out.filter((i) => i.signalKind.startsWith('match')).map((i) => i.score)).toEqual([99, 91])
  })

  it('U8 — départage à score égal : ordre stable et déterministe', () => {
    const a = rankable({ id: 'a', contactId: 'c1', score: 50, tier: 'now', signalKind: 'reminder' })
    const b = rankable({ id: 'b', contactId: 'c2', score: 50, tier: 'now', signalKind: 'match-market' })
    const out1 = finalizeQueue([a, b]).map((i) => i.id)
    const out2 = finalizeQueue([b, a]).map((i) => i.id)
    expect(out1).toEqual(out2)
    // reminder (famille 0) avant match (famille 3) à score/tier égal
    expect(out1[0]).toBe('a')
  })

  it('U9 — KYC non-bloquant : ne supprime, ne rétrograde ni ne force-now jamais', () => {
    const baseMatch = match({ matchScore: 72 }) // → next sans KYC
    const withKyc = match({ matchScore: 72, kyc: { riskHigh: true, daysToExpiry: 1 } })
    // le tier ne change pas à cause du KYC (pas de « KYC force now »)
    expect(assignTier(baseMatch, NOW)).toBe('next')
    expect(assignTier(withKyc, NOW)).toBe('next')
    // mais le bonus KYC peut faire monter le score (jamais le baisser)
    expect(scoreItem(withKyc, NOW)).toBeGreaterThanOrEqual(scoreItem(baseMatch, NOW))
    expect(kycBonus({ riskHigh: true, daysToExpiry: 1 })).toBeGreaterThan(0)
    expect(kycBonus({ riskHigh: false, daysToExpiry: 1 })).toBe(0)
    expect(kycBonus(null)).toBe(0)
  })

  it('U10 — buildReason : FR, sans UUID, sans `.detail` brut (apartment / 110 m² / zone non corresp.)', () => {
    const r = buildReason(match({ matchScore: 87, reasonKeys: ['type', 'rooms', 'zone'] }), NOW)
    expect(r).toContain('Match fort (87)')
    expect(r.toLowerCase()).not.toContain('apartment')
    expect(r).not.toContain('110 m²')
    expect(r).not.toContain('Zone non correspondante')
    expect(r).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i) // pas d'UUID
    // reminder en retard → libellé FR daté
    expect(buildReason(reminder({ reminderTriggerAt: daysAgo(3) }), NOW)).toContain('en retard de 3 j')
  })

  it('U11 — empty-state : finalizeQueue([]) → []', () => {
    expect(finalizeQueue([])).toEqual([])
  })

  it('U12 — mix inter-signaux : deal at-risk + reminder échu + match 92 (cas non observable en base)', () => {
    const items: FocusRankable[] = [
      { ...rankable({ id: 'deal', contactId: 'c1', signalKind: 'deal' }), score: scoreItem(deal({ dealRisk: 'at-risk' }), NOW), tier: assignTier(deal({ dealRisk: 'at-risk' }), NOW) },
      { ...rankable({ id: 'rem', contactId: 'c2', signalKind: 'reminder' }), score: scoreItem(reminder({ reminderTriggerAt: daysAgo(4) }), NOW), tier: assignTier(reminder({ reminderTriggerAt: daysAgo(4) }), NOW) },
      { ...rankable({ id: 'match', contactId: 'c3', signalKind: 'match-market' }), score: scoreItem(match({ matchScore: 92 }), NOW), tier: assignTier(match({ matchScore: 92 }), NOW) },
    ]
    // tous franchissent « now » (reminder échu / deal en tension / match ≥80)
    expect(items.every((i) => i.tier === 'now')).toBe(true)
    const out = finalizeQueue(items)
    expect(out).toHaveLength(3)
    // tri par score décroissant, stable
    const scores = out.map((i) => i.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })

  it('U14 — parseFocusConfig : merge défensif sur les défauts (partiel/invalide/string)', () => {
    // objet partiel → seules les clés fournies écrasent, le reste = défauts
    const partial = parseFocusConfig({ thresholds: { match_now: 90 }, caps: { per_contact: 1 } })
    expect(partial.thresholds.match_now).toBe(90)
    expect(partial.thresholds.match_gate).toBe(FOCUS_DEFAULTS.thresholds.match_gate)
    expect(partial.caps.per_contact).toBe(1)
    expect(partial.weights).toEqual(FOCUS_DEFAULTS.weights)
    // valeurs invalides → fallback défaut (jamais NaN/undefined)
    const bad = parseFocusConfig({ weights: { reminder: 'x', match: null, deal: undefined } })
    expect(bad.weights).toEqual(FOCUS_DEFAULTS.weights)
    // string JSON acceptée ; null/garbage → défauts complets
    expect(parseFocusConfig('{"version":9}').version).toBe(9)
    expect(parseFocusConfig('not json')).toEqual(FOCUS_DEFAULTS)
    expect(parseFocusConfig(null)).toEqual(FOCUS_DEFAULTS)
  })

  it('U15 — toDisplayScore : normalise 0..100, monotone, échelle lisible', () => {
    // un reminder échu fort (poids 0.45) → score d'affichage élevé mais < 100
    // (sans bonus KYC, qui ne s'applique pas aux reminders) ; un deal reste plus bas.
    const remStrong = scoreItem(reminder({ reminderTriggerAt: daysAgo(5), reminderType: 'missing_document' }), NOW)
    const dealWeak = scoreItem(deal({ stageProb: 30, dealRisk: 'healthy', dealValue: 100_000 }), NOW)
    expect(toDisplayScore(remStrong)).toBeGreaterThanOrEqual(70)
    expect(toDisplayScore(remStrong)).toBeGreaterThan(toDisplayScore(dealWeak))
    // monotone : plus de score brut → plus d'affichage ; bornes 0..100
    expect(toDisplayScore(40)).toBeGreaterThan(toDisplayScore(20))
    expect(toDisplayScore(0)).toBe(0)
    expect(toDisplayScore(999)).toBe(100)
  })

  it('U13 — selectFocusQueue : seed démo gated (jamais de fallback fictif en prod)', () => {
    const live: FocusItem[] = [
      { ...FOCUS_QUEUE_DEMO[0], tier: 'now' },
      { ...FOCUS_QUEUE_DEMO[1], tier: 'rest' },
    ]
    // live → on retire le tier « reste »
    expect(selectFocusQueue({ live: true, items: live, isDemo: false })).toHaveLength(1)
    // pas live + pas démo → vide (empty-state honnête)
    expect(selectFocusQueue({ live: false, items: [], isDemo: false })).toEqual([])
    // pas live + démo → seed autorisé
    expect(selectFocusQueue({ live: false, items: [], isDemo: true })).toBe(FOCUS_QUEUE_DEMO)
  })
})
