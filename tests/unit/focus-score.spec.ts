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
  normalizeSellerLead,
  normalizeKyc,
  isClosingProximate,
  hasKycGap,
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
const sellerLead = (over: Partial<FocusScoreInput> = {}): FocusScoreInput => ({
  signalKind: 'seller-lead', sellerEstimation: 1_200_000, sellerMotivation: 'immediate',
  sellerCity: 'Genève', sellerCreatedAt: daysAgo(20), ...over,
})
const kyc = (over: Partial<FocusScoreInput> = {}): FocusScoreInput => ({
  signalKind: 'kyc', stageProb: 85, dealStage: 'offer', dealValue: 1_000_000, kycDossierStatus: 'pending', ...over,
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

  // ─── Focus radar v1 — familles seller-lead + kyc ────────────────────────
  it('R1 — seller-lead : un mandat « new » part toujours en « now » (argent qui attend)', () => {
    expect(assignTier(sellerLead(), NOW)).toBe('now')
    // même un lead minimal (pas d'estimation, frais, sans motivation) reste « now »
    expect(assignTier(sellerLead({ sellerEstimation: null, sellerMotivation: null, sellerCreatedAt: daysAgo(0) }), NOW)).toBe('now')
    const s = scoreItem(sellerLead(), NOW)
    expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(100)
  })

  it('R2 — normalizeSellerLead : plancher 0.45, monotone (valeur / ancienneté / motivation), borné', () => {
    const base = normalizeSellerLead({ sellerEstimation: null, sellerMotivation: null, sellerCreatedAt: daysAgo(0) }, NOW)
    expect(base).toBeGreaterThanOrEqual(0.45) // plancher : tout nouveau mandat compte
    // valeur ↑ → signal ↑
    expect(normalizeSellerLead({ sellerEstimation: 2_000_000 }, NOW)).toBeGreaterThan(normalizeSellerLead({ sellerEstimation: 200_000 }, NOW))
    // ancienneté non-réclamée ↑ → signal ↑ (un lead qui dort devient plus urgent)
    expect(normalizeSellerLead({ sellerCreatedAt: daysAgo(30) }, NOW)).toBeGreaterThan(normalizeSellerLead({ sellerCreatedAt: daysAgo(0) }, NOW))
    // motivation « immediate » = bonus
    expect(normalizeSellerLead({ sellerMotivation: 'immediate' }, NOW)).toBeGreaterThan(normalizeSellerLead({ sellerMotivation: 'curious' }, NOW))
    // borné [0..1]
    for (const i of [base, normalizeSellerLead(sellerLead(), NOW)]) { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThanOrEqual(1) }
  })

  it('R3 — seller-lead : reason FR (ville + ancienneté), sans UUID', () => {
    const r = buildReason(sellerLead({ sellerCity: 'Lausanne', sellerCreatedAt: daysAgo(20) }), NOW)
    expect(r).toContain('Nouveau lead vendeur')
    expect(r).toContain('Lausanne')
    expect(r).toContain('en attente depuis 20 j')
    expect(r).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
    // lead frais (< 7 j) : pas de mention d'attente
    expect(buildReason(sellerLead({ sellerCreatedAt: daysAgo(2) }), NOW)).not.toContain('en attente')
  })

  it('R4 — routage deal→kyc : helpers isClosingProximate / hasKycGap', () => {
    for (const s of ['interest-confirmed', 'offer', 'signed']) expect(isClosingProximate(s)).toBe(true)
    for (const s of ['new-lead', 'to-qualify', 'searching', 'visit-scheduled', 'visit-done', 'lost', null, undefined]) expect(isClosingProximate(s)).toBe(false)
    // gap = dossier ouvert mais non vérifié
    for (const d of ['pending', 'stale', 'failed', 'none']) expect(hasKycGap(d)).toBe(true)
    expect(hasKycGap('verified')).toBe(false)
    expect(hasKycGap(null)).toBe(false) // pas de dossier → pas de faux « gap »
    expect(hasKycGap(undefined)).toBe(false)
  })

  it('R5 — kyc : tier offer/signed → now, intérêt confirmé → next ; NON-BLOQUANT', () => {
    expect(assignTier(kyc({ dealStage: 'offer' }), NOW)).toBe('now')
    expect(assignTier(kyc({ dealStage: 'signed' }), NOW)).toBe('now')
    expect(assignTier(kyc({ dealStage: 'interest-confirmed', stageProb: 75 }), NOW)).toBe('next')
    // le signal KYC ne dépend PAS du bonus input.kyc (c'est une famille à part) ;
    // il surface une vérification, il ne gèle jamais une étape (jamais « rest »).
    expect(['now', 'next']).toContain(assignTier(kyc(), NOW))
  })

  it('R6 — normalizeKyc : sévérité failed > stale > none > pending ; monotone proximité/valeur ; borné', () => {
    const sev = (s: string) => normalizeKyc(kyc({ kycDossierStatus: s }), FOCUS_DEFAULTS)
    expect(sev('failed')).toBeGreaterThan(sev('stale'))
    expect(sev('stale')).toBeGreaterThan(sev('none'))
    expect(sev('none')).toBeGreaterThan(sev('pending'))
    // proximité du closing ↑ → signal ↑
    expect(normalizeKyc(kyc({ stageProb: 100 }))).toBeGreaterThan(normalizeKyc(kyc({ stageProb: 75 })))
    // valeur ↑ → signal ↑
    expect(normalizeKyc(kyc({ dealValue: 3_000_000 }))).toBeGreaterThan(normalizeKyc(kyc({ dealValue: 300_000 })))
    for (const s of ['failed', 'stale', 'none', 'pending']) { const v = sev(s); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) }
  })

  it('R7 — parseFocusConfig : merge défensif des nouveaux poids/seuils (kyc, seller_lead)', () => {
    const cfg = parseFocusConfig({ weights: { kyc: 0.5 }, thresholds: { seller_lead_stale_saturation_days: 7 } })
    expect(cfg.weights.kyc).toBe(0.5)
    expect(cfg.weights.seller_lead).toBe(FOCUS_DEFAULTS.weights.seller_lead) // non fourni → défaut
    expect(cfg.thresholds.seller_lead_stale_saturation_days).toBe(7)
    expect(cfg.bonuses.seller_lead_value_ref).toBe(FOCUS_DEFAULTS.bonuses.seller_lead_value_ref)
    // valeur invalide → défaut (jamais NaN)
    expect(parseFocusConfig({ weights: { kyc: 'x' } }).weights.kyc).toBe(FOCUS_DEFAULTS.weights.kyc)
  })

  it('R8 — displayScore [0..100] pour les 2 nouvelles familles', () => {
    for (const i of [sellerLead(), sellerLead({ sellerEstimation: null }), kyc(), kyc({ dealStage: 'signed', stageProb: 100, kycDossierStatus: 'failed' })]) {
      const ds = toDisplayScore(scoreItem(i, NOW))
      expect(ds).toBeGreaterThanOrEqual(0); expect(ds).toBeLessThanOrEqual(100)
    }
  })

  it('R9 — cap « now » : un rappel échu garde sa place « Maintenant » face à des seller-leads spéculatifs', () => {
    // 3 seller-leads (score 20, now) + 1 rappel échu (score 15, now), cap now=3.
    // Sans réservation, le tri par score reléguerait le rappel (4ᵉ) en « next ».
    const items: FocusRankable[] = [
      rankable({ id: 'sl1', contactId: 'a', signalKind: 'seller-lead', score: 20, tier: 'now' }),
      rankable({ id: 'sl2', contactId: 'b', signalKind: 'seller-lead', score: 20, tier: 'now' }),
      rankable({ id: 'sl3', contactId: 'c', signalKind: 'seller-lead', score: 20, tier: 'now' }),
      rankable({ id: 'rem', contactId: 'd', signalKind: 'reminder', score: 15, tier: 'now' }),
    ]
    const out = finalizeQueue(items)
    const byId = (id: string) => out.find((i) => i.id === id)!
    // l'obligation datée (rappel échu) garde « now » malgré un score plus bas
    expect(byId('rem').tier).toBe('now')
    // cap respecté : exactement 3 « now », donc un seller-lead bascule en « next » (jamais perdu)
    expect(out.filter((i) => i.tier === 'now')).toHaveLength(3)
    expect(out.filter((i) => i.signalKind === 'seller-lead' && i.tier === 'next')).toHaveLength(1)
    // l'ordre de tri (score ↓) est conservé : le tier ne réordonne pas la file
    expect(out.map((i) => i.id).slice(0, 3)).toEqual(['sl1', 'sl2', 'sl3'])
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
