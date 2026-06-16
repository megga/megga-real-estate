// MEGGA CRM — Cockpit « Aujourd'hui » · Algo Focus · MODULE DE SCORE (pur)
// ----------------------------------------------------------------------------
// Score de priorité DÉTERMINISTE et EXPLICABLE de la file Focus. 0 LLM, 0 DB :
// fonctions pures importées par useFocusQueue.ts ET par les tests unitaires.
//
// Principe : chaque item actionnable (reminder / deal / match) porte un signal
// normalisé [0..1] propre à sa famille ; le score final = poids de famille ×
// signal (+ bonus KYC additif NON-BLOQUANT), borné [0..100]. Les tiers
// (« Maintenant » / « Ensuite » / reste) suivent des règles dures lisibles.
//
// Source de vérité des poids/seuils = app_config.today_focus_v1 (lue côté RPC
// pour le pré-gate matches). Côté client on en duplique les MÊMES défauts
// (FOCUS_DEFAULTS) pour le scoring inter-signaux. Garder les deux synchro.
//
// Le score est affiché comme une ESTIMATION (jamais « garanti »/« automatique »)
// et chaque geste reste validé par l'agent (HITL). Le KYC n'est qu'un bonus :
// son absence ou sa présence ne crée, ne masque ni ne rétrograde jamais un item.

// Familles de signal. Focus radar v1 ajoute deux signaux PASSIFS (radar) :
//   'seller-lead' = nouveau mandat vendeur à réclamer (argent qui attend) ;
//   'kyc'         = deal proche du closing dont le dossier KYC n'est pas vérifié
//                   (nudge NON-BLOQUANT, jamais un gate).
export type FocusSignalKind =
  | 'reminder' | 'deal' | 'kyc' | 'seller-lead' | 'match-internal' | 'match-market'
export type FocusTier = 'now' | 'next' | 'rest'
export type DealRisk = 'healthy' | 'at-risk' | 'stalled'

export interface FocusKyc {
  riskHigh: boolean
  daysToExpiry: number | null
}

// Entrées de scoring portées par chaque item (sur-ensemble : seuls les champs
// de la famille concernée sont lus).
export interface FocusScoreInput {
  signalKind: FocusSignalKind
  /** Bonus additif non-bloquant — jamais un gate. */
  kyc?: FocusKyc | null
  // famille reminder
  reminderTriggerAt?: string | null
  reminderType?: string | null
  reminderTime?: string
  // famille match (score brut [70..100] déjà gaté par le RPC)
  matchScore?: number
  reasonsMatchCount?: number
  reasonKeys?: string[]
  // famille deal
  stageProb?: number
  dealRisk?: DealRisk
  dealStage?: string
  dealValue?: number
  // famille kyc (deal proche du closing + dossier non vérifié). Réutilise
  // stageProb / dealStage / dealValue ; ajoute le statut du dossier.
  kycDossierStatus?: string | null   // 'pending' | 'stale' | 'failed' | 'none'
  // famille seller-lead (nouveau mandat vendeur 'new', auto-suffisant)
  sellerEstimation?: number | null
  sellerMotivation?: string | null
  sellerCity?: string | null
  sellerCreatedAt?: string | null
}

export interface FocusConfig {
  weights: { reminder: number; match: number; deal: number; kyc: number; seller_lead: number }
  thresholds: {
    match_gate: number
    match_now: number
    match_next: number
    reminder_overdue_saturation_days: number
    deal_next_stage_prob: number
    kyc_expiry_window_days: number
    seller_lead_stale_saturation_days: number
  }
  bonuses: {
    match_internal: number
    match_quality: number
    reminder_kyc: number
    reminder_offer: number
    deal_tension_at_risk: number
    deal_tension_stalled: number
    kyc_max: number
    deal_value_ref: number
    seller_lead_motivation_immediate: number
    seller_lead_value_ref: number
  }
  caps: { now_total: number; per_contact: number; matches_returned: number }
  version: number
}

// Miroir EXACT de app_config.today_focus_v1 (cf migration 20260616120000).
export const FOCUS_DEFAULTS: FocusConfig = {
  weights: { reminder: 0.45, match: 0.40, deal: 0.15, kyc: 0.42, seller_lead: 0.45 },
  thresholds: {
    match_gate: 70,
    match_now: 80,
    match_next: 70,
    reminder_overdue_saturation_days: 3,
    deal_next_stage_prob: 0.6,
    kyc_expiry_window_days: 14,
    seller_lead_stale_saturation_days: 14,
  },
  bonuses: {
    match_internal: 0.08,
    match_quality: 0.05,
    reminder_kyc: 0.15,
    reminder_offer: 0.1,
    deal_tension_at_risk: 0.2,
    deal_tension_stalled: 0.1,
    kyc_max: 0.12,
    deal_value_ref: 3_000_000,
    seller_lead_motivation_immediate: 0.15,
    seller_lead_value_ref: 3_000_000,
  },
  caps: { now_total: 3, per_contact: 2, matches_returned: 40 },
  version: 1,
}

const DAY = 86_400_000
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

// ── Config tunable (app_config.today_focus_v1) — parse DÉFENSIF ──────────────
// Le RPC get_today_focus_config() renvoie le JSON (objet jsonb) ; on le fusionne
// sur FOCUS_DEFAULTS champ par champ : une clé manquante/invalide retombe sur le
// défaut, jamais d'exception (un barème cassé en DB ne casse pas la file).
const numOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

export function parseFocusConfig(raw: unknown): FocusConfig {
  let src: unknown = raw
  if (typeof raw === 'string') {
    try { src = JSON.parse(raw) } catch { src = null }
  }
  if (!src || typeof src !== 'object') return FOCUS_DEFAULTS
  const o = src as Record<string, unknown>
  const d = FOCUS_DEFAULTS
  const w = (o.weights ?? {}) as Record<string, unknown>
  const t = (o.thresholds ?? {}) as Record<string, unknown>
  const b = (o.bonuses ?? {}) as Record<string, unknown>
  const c = (o.caps ?? {}) as Record<string, unknown>
  return {
    weights: {
      reminder: numOr(w.reminder, d.weights.reminder),
      match: numOr(w.match, d.weights.match),
      deal: numOr(w.deal, d.weights.deal),
      kyc: numOr(w.kyc, d.weights.kyc),
      seller_lead: numOr(w.seller_lead, d.weights.seller_lead),
    },
    thresholds: {
      match_gate: numOr(t.match_gate, d.thresholds.match_gate),
      match_now: numOr(t.match_now, d.thresholds.match_now),
      match_next: numOr(t.match_next, d.thresholds.match_next),
      reminder_overdue_saturation_days: numOr(t.reminder_overdue_saturation_days, d.thresholds.reminder_overdue_saturation_days),
      deal_next_stage_prob: numOr(t.deal_next_stage_prob, d.thresholds.deal_next_stage_prob),
      kyc_expiry_window_days: numOr(t.kyc_expiry_window_days, d.thresholds.kyc_expiry_window_days),
      seller_lead_stale_saturation_days: numOr(t.seller_lead_stale_saturation_days, d.thresholds.seller_lead_stale_saturation_days),
    },
    bonuses: {
      match_internal: numOr(b.match_internal, d.bonuses.match_internal),
      match_quality: numOr(b.match_quality, d.bonuses.match_quality),
      reminder_kyc: numOr(b.reminder_kyc, d.bonuses.reminder_kyc),
      reminder_offer: numOr(b.reminder_offer, d.bonuses.reminder_offer),
      deal_tension_at_risk: numOr(b.deal_tension_at_risk, d.bonuses.deal_tension_at_risk),
      deal_tension_stalled: numOr(b.deal_tension_stalled, d.bonuses.deal_tension_stalled),
      kyc_max: numOr(b.kyc_max, d.bonuses.kyc_max),
      deal_value_ref: numOr(b.deal_value_ref, d.bonuses.deal_value_ref),
      seller_lead_motivation_immediate: numOr(b.seller_lead_motivation_immediate, d.bonuses.seller_lead_motivation_immediate),
      seller_lead_value_ref: numOr(b.seller_lead_value_ref, d.bonuses.seller_lead_value_ref),
    },
    caps: {
      now_total: numOr(c.now_total, d.caps.now_total),
      per_contact: numOr(c.per_contact, d.caps.per_contact),
      matches_returned: numOr(c.matches_returned, d.caps.matches_returned),
    },
    version: numOr(o.version, d.version),
  }
}

// ── Score d'affichage [0..100] ──────────────────────────────────────────────
// Le score brut (scoreItem) est volontairement borné par le poids de famille
// (≈57 max pour un reminder, ≈27 pour un deal) afin de rester comparable entre
// familles pour le TRI. Pour l'AFFICHAGE on le normalise sur le max théorique
// atteignable (poids de famille le plus fort + bonus KYC) → 0..100 lisible.
// Transformation monotone : ne change jamais l'ordre, juste l'échelle montrée.
export function focusScoreMaxFraction(cfg: FocusConfig = FOCUS_DEFAULTS): number {
  return Math.max(
    cfg.weights.reminder, cfg.weights.match, cfg.weights.deal,
    cfg.weights.kyc, cfg.weights.seller_lead,
  ) + cfg.bonuses.kyc_max
}

export function toDisplayScore(rawScore: number, cfg: FocusConfig = FOCUS_DEFAULTS): number {
  const max = focusScoreMaxFraction(cfg)
  if (max <= 0) return Math.max(0, Math.min(100, Math.round(rawScore)))
  return Math.max(0, Math.min(100, Math.round(rawScore / max)))
}

/** Jours de retard d'un reminder (0 si à venir / date invalide). */
export function reminderOverdueDays(triggerAt: string | null | undefined, now: number): number {
  if (!triggerAt) return 0
  const tt = Date.parse(triggerAt)
  if (Number.isNaN(tt)) return 0
  return Math.max(0, Math.floor((now - tt) / DAY))
}

/** Fin de journée locale de `now` (cohérent avec le filtre « du jour » du builder). */
function endOfDay(now: number): number {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** Reminder dû aujourd'hui (pas en retard, pas au-delà de la journée). */
function reminderDueToday(triggerAt: string | null | undefined, now: number): boolean {
  if (!triggerAt) return false
  const tt = Date.parse(triggerAt)
  if (Number.isNaN(tt)) return false
  return reminderOverdueDays(triggerAt, now) === 0 && tt <= endOfDay(now)
}

// ── 1.1 reminder → signal [0..1] ───────────────────────────────────────────
export function normalizeReminder(
  input: Pick<FocusScoreInput, 'reminderTriggerAt' | 'reminderType'>,
  now: number,
  cfg: FocusConfig = FOCUS_DEFAULTS,
): { signal: number; overdueDays: number } {
  const tt = input.reminderTriggerAt ? Date.parse(input.reminderTriggerAt) : null
  const overdueDays = reminderOverdueDays(input.reminderTriggerAt, now)
  let urgency: number
  if (tt == null || Number.isNaN(tt)) urgency = 0.5
  else if (overdueDays >= 1) urgency = clamp01(overdueDays / cfg.thresholds.reminder_overdue_saturation_days)
  else {
    const h = (tt - now) / 3.6e6
    urgency = Math.min(0.6, Math.max(0.15, 1 - h / 24))
  }
  const bonus =
    input.reminderType === 'missing_document' ? cfg.bonuses.reminder_kyc
    : input.reminderType === 'price_change' ? cfg.bonuses.reminder_offer
    : 0
  return { signal: clamp01(urgency + bonus), overdueDays }
}

// ── 1.2 match → signal [0..1] (score brut remonté par le RPC) ───────────────
export function normalizeMatch(
  input: Pick<FocusScoreInput, 'signalKind' | 'matchScore' | 'reasonsMatchCount'>,
  cfg: FocusConfig = FOCUS_DEFAULTS,
): number {
  const base = (input.matchScore ?? 0) / 100
  const kindBonus = input.signalKind === 'match-internal' ? cfg.bonuses.match_internal : 0
  const quality = clamp01((input.reasonsMatchCount ?? 0) / 5) * cfg.bonuses.match_quality
  return clamp01(base + kindBonus + quality)
}

// ── 1.3 deal → signal [0..1] (poids modeste : nextAction = placeholder) ─────
export function normalizeDeal(
  input: Pick<FocusScoreInput, 'stageProb' | 'dealRisk' | 'dealValue'>,
  cfg: FocusConfig = FOCUS_DEFAULTS,
): number {
  const sStage = clamp01((input.stageProb ?? 0) / 100)
  const sTension =
    input.dealRisk === 'at-risk' ? cfg.bonuses.deal_tension_at_risk
    : input.dealRisk === 'stalled' ? cfg.bonuses.deal_tension_stalled
    : 0
  const ref = cfg.bonuses.deal_value_ref
  const value = input.dealValue ?? 0
  const sValue = value <= 0 ? 0 : clamp01(Math.log(value + 1) / Math.log(ref + 1))
  // poids internes de la famille deal (somme = 1)
  return clamp01(0.5 * sStage + 0.3 * sTension + 0.2 * sValue)
}

/** Âge en jours d'une date ISO (0 si à venir / invalide). */
function ageInDays(iso: string | null | undefined, now: number): number {
  if (!iso) return 0
  const tt = Date.parse(iso)
  if (Number.isNaN(tt)) return 0
  return Math.max(0, Math.floor((now - tt) / DAY))
}

// ── 1.5 seller-lead → signal [0..1] (nouveau mandat 'new' = argent qui attend) ─
// Valeur potentielle du mandat (estimation, log) + ancienneté non-réclamée (un
// lead qui dort se dégrade : plus vieux = plus urgent à réclamer) + bonus
// motivation « immédiate ». Plancher 0.45 : tout nouveau mandat compte.
export function normalizeSellerLead(
  input: Pick<FocusScoreInput, 'sellerEstimation' | 'sellerMotivation' | 'sellerCreatedAt'>,
  now: number,
  cfg: FocusConfig = FOCUS_DEFAULTS,
): number {
  const ref = cfg.bonuses.seller_lead_value_ref
  const v = input.sellerEstimation ?? 0
  const sValue = v <= 0 ? 0 : clamp01(Math.log(v + 1) / Math.log(ref + 1))
  const sStale = clamp01(ageInDays(input.sellerCreatedAt, now) / cfg.thresholds.seller_lead_stale_saturation_days)
  const motiv = input.sellerMotivation === 'immediate' ? cfg.bonuses.seller_lead_motivation_immediate : 0
  return clamp01(0.45 + 0.3 * sValue + 0.25 * sStale + motiv)
}

// ── 1.6 kyc → signal [0..1] (deal proche du closing, dossier non vérifié) ─────
// NON-BLOQUANT : ce signal NE remplace une priorité que pour SURFACER une
// vérification à finaliser ; il ne gèle jamais le pipeline. Proximité du closing
// (stageProb) + sévérité du dossier (failed > stale > none > pending) + valeur.
export function normalizeKyc(
  input: Pick<FocusScoreInput, 'stageProb' | 'kycDossierStatus' | 'dealValue'>,
  cfg: FocusConfig = FOCUS_DEFAULTS,
): number {
  const sStage = clamp01((input.stageProb ?? 0) / 100)
  const sev =
    input.kycDossierStatus === 'failed' ? 1.0
    : input.kycDossierStatus === 'stale' ? 0.7
    : input.kycDossierStatus === 'none' ? 0.6
    : 0.5 // 'pending' ou tout autre statut non-vérifié
  const ref = cfg.bonuses.deal_value_ref
  const v = input.dealValue ?? 0
  const sValue = v <= 0 ? 0 : clamp01(Math.log(v + 1) / Math.log(ref + 1))
  return clamp01(0.5 * sStage + 0.3 * sev + 0.2 * sValue)
}

// ── Routage deal → kyc : un deal proche du closing dont le dossier KYC n'est
// pas vérifié devient un item 'kyc' (compléter la vérification = la prochaine
// action), sinon il reste un item 'deal'. Purs + testables.
export function isClosingProximate(stage: string | null | undefined): boolean {
  return stage === 'interest-confirmed' || stage === 'offer' || stage === 'signed'
}
export function hasKycGap(dossierStatus: string | null | undefined): boolean {
  return dossierStatus != null && dossierStatus !== 'verified'
}

// ── 1.4 KYC → bonus additif NON-BLOQUANT ───────────────────────────────────
export function kycBonus(kyc: FocusKyc | null | undefined, cfg: FocusConfig = FOCUS_DEFAULTS): number {
  if (!kyc || !kyc.riskHigh || kyc.daysToExpiry == null) return 0
  if (kyc.daysToExpiry > cfg.thresholds.kyc_expiry_window_days) return 0
  return cfg.bonuses.kyc_max * clamp01(1 - kyc.daysToExpiry / cfg.thresholds.kyc_expiry_window_days)
}

// ── 2. score final [0..100] ─────────────────────────────────────────────────
export function scoreItem(input: FocusScoreInput, now: number, cfg: FocusConfig = FOCUS_DEFAULTS): number {
  let signal = 0
  let family = 0
  if (input.signalKind === 'reminder') {
    signal = normalizeReminder(input, now, cfg).signal
    family = cfg.weights.reminder
  } else if (input.signalKind === 'deal') {
    signal = normalizeDeal(input, cfg)
    family = cfg.weights.deal
  } else if (input.signalKind === 'kyc') {
    signal = normalizeKyc(input, cfg)
    family = cfg.weights.kyc
  } else if (input.signalKind === 'seller-lead') {
    signal = normalizeSellerLead(input, now, cfg)
    family = cfg.weights.seller_lead
  } else {
    signal = normalizeMatch(input, cfg)
    family = cfg.weights.match
  }
  return Math.round(clamp01(family * signal + kycBonus(input.kyc, cfg)) * 100)
}

// ── 3. tier (règles dures lisibles ; FIX revue #5 : pas de « KYC force now ») ─
export function assignTier(input: FocusScoreInput, now: number, cfg: FocusConfig = FOCUS_DEFAULTS): FocusTier {
  const T = cfg.thresholds
  const isMatch = input.signalKind === 'match-internal' || input.signalKind === 'match-market'
  const brut = input.matchScore ?? 0
  // — Maintenant —
  // Nouveau mandat vendeur 'new' = argent qui attend → à réclamer aujourd'hui
  // (le cap dur « now » s'applique ensuite ; rien n'est jamais perdu).
  if (input.signalKind === 'seller-lead') return 'now'
  // Signal KYC×closing : déjà gaté (closing-proximate + dossier non vérifié) en
  // amont ; offer/signed = maintenant, intérêt confirmé = ensuite. RESTE un
  // simple surfaçage — non-bloquant, jamais un gate sur le pipeline.
  if (input.signalKind === 'kyc') return (input.dealStage === 'offer' || input.dealStage === 'signed') ? 'now' : 'next'
  if (input.signalKind === 'reminder' && reminderOverdueDays(input.reminderTriggerAt, now) >= 1) return 'now'
  if (isMatch && brut >= T.match_now) return 'now'
  if (input.signalKind === 'deal' && (input.dealRisk === 'at-risk' || input.dealRisk === 'stalled')) return 'now'
  // Le KYC ne déclenche JAMAIS un tier à lui seul (non-bloquant) — c'est un bonus de score.
  // — Ensuite —
  if (isMatch && brut >= T.match_next) return 'next'
  if (input.signalKind === 'reminder' && reminderDueToday(input.reminderTriggerAt, now)) return 'next'
  if (input.signalKind === 'deal' && (input.stageProb ?? 0) / 100 >= T.deal_next_stage_prob) return 'next'
  // — reste —
  return 'rest'
}

// ── 4. raison « pourquoi #1 » (FR, déterministe, estimation) ─────────────────
// Mappe par CLÉ vers un libellé FR contrôlé. On IGNORE le `.detail` brut des
// reasons (non fiable : « apartment » en anglais, « 110 m² » = surface, etc.).
const REASON_KEY_LABEL_FR: Record<string, string> = {
  budget: 'budget',
  zone: 'zone',
  rooms: 'pièces',
  type: 'type de bien',
  features: 'critères',
}

export function buildReason(input: FocusScoreInput, now: number, cfg: FocusConfig = FOCUS_DEFAULTS): string {
  let base = ''
  if (input.signalKind === 'reminder') {
    const overdue = reminderOverdueDays(input.reminderTriggerAt, now)
    if (overdue >= 1) {
      base = input.reminderType === 'missing_document'
        ? `KYC en retard de ${overdue} j — vérification à compléter`
        : `Relance en retard de ${overdue} j`
    } else {
      base = input.reminderTime ? `Relance prévue aujourd'hui (${input.reminderTime})` : "Relance prévue aujourd'hui"
    }
  } else if (input.signalKind === 'seller-lead') {
    base = input.sellerCity ? `Nouveau lead vendeur — ${input.sellerCity}` : 'Nouveau lead vendeur à réclamer'
    const age = ageInDays(input.sellerCreatedAt, now)
    if (age >= 7) base += ` · en attente depuis ${age} j`
  } else if (input.signalKind === 'kyc') {
    // Toujours formulé comme une finalisation OPTIONNELLE (non-bloquant).
    const tail =
      input.kycDossierStatus === 'failed' ? ' · dossier à corriger'
      : input.kycDossierStatus === 'stale' ? ' · dossier à re-vérifier'
      : input.kycDossierStatus === 'none' ? ' · dossier non démarré'
      : ' · dossier en cours'
    base = 'Closing proche — KYC du dossier à finaliser' + tail
  } else if (input.signalKind === 'match-internal' || input.signalKind === 'match-market') {
    const brut = input.matchScore ?? 0
    const top = (input.reasonKeys ?? [])
      .map((k) => REASON_KEY_LABEL_FR[k])
      .filter(Boolean)
      .slice(0, 2)
      .join(', ')
    base = brut >= cfg.thresholds.match_now ? `Match fort (${brut})` : `Match à confirmer (${brut})`
    if (top) base += ` — ${top}`
    if (input.signalKind === 'match-internal') base += ' · mandat propre'
  } else {
    base = input.dealRisk === 'stalled' ? 'Deal au point mort — à débloquer'
      : input.dealStage === 'offer' || input.dealStage === 'interest-confirmed' ? 'Offre à suivre — closing proche'
      : input.dealRisk === 'at-risk' ? 'Deal sous tension — à relancer'
      : 'Étape à faire avancer'
  }
  const kyc = input.kyc
  if (kyc && kyc.riskHigh && kyc.daysToExpiry != null && kyc.daysToExpiry <= cfg.thresholds.kyc_expiry_window_days) {
    const d = kyc.daysToExpiry
    base += d < 0 ? ' · KYC échu' : d === 0 ? " · KYC à échéance aujourd'hui" : ` · KYC à échéance dans ${d} j`
  }
  return base
}

// ── 3b. caps + tri déterministe (appliqués au merge des 3 familles) ─────────
export interface FocusRankable {
  id: string
  contactId: string
  signalKind: FocusSignalKind
  score: number
  tier: FocusTier
  /** Timestamp d'échéance/récence (ms) — départage : plus tôt = plus prioritaire. */
  due?: number
}

// Tie-break déterministe à score+tier égaux (cosmétique : le score domine).
// Temporellement urgent d'abord (reminder), puis compliance de closing (kyc),
// deal, nouveau mandat, matches.
const FAMILY_ORDER: Record<FocusSignalKind, number> = {
  reminder: 0,
  kyc: 1,
  deal: 2,
  'seller-lead': 3,
  'match-internal': 4,
  'match-market': 5,
}
const TIER_ORDER: Record<FocusTier, number> = { now: 0, next: 1, rest: 2 }

export function finalizeQueue<T extends FocusRankable>(items: T[], cfg: FocusConfig = FOCUS_DEFAULTS): T[] {
  // Cap matches par contact (ceinture + bretelles ; le RPC l'applique déjà).
  // Ne compte QUE les items match : un deal/reminder du même contact n'est pas touché.
  const seen = new Map<string, number>()
  const capped = items.filter((it) => {
    if (it.signalKind !== 'match-internal' && it.signalKind !== 'match-market') return true
    const n = seen.get(it.contactId) ?? 0
    if (n >= cfg.caps.per_contact) return false
    seen.set(it.contactId, n + 1)
    return true
  })
  // Tri déterministe : score ↓ → tier → famille → échéance ↑ → id.
  capped.sort((a, b) =>
    b.score - a.score ||
    TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
    FAMILY_ORDER[a.signalKind] - FAMILY_ORDER[b.signalKind] ||
    (a.due ?? Number.POSITIVE_INFINITY) - (b.due ?? Number.POSITIVE_INFINITY) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  // Cap dur « Maintenant » : au plus cfg.caps.now_total items « now ».
  // PRIORITÉ DES SLOTS : un reminder en retard est une obligation DATÉE (un
  // engagement client échu) — il garde sa place « Maintenant » avant les signaux
  // RADAR plus spéculatifs (seller-lead / kyc / deal), même à score plus bas.
  // 1ʳᵉ passe : les reminders « now » (= échus, cf assignTier) réservent les
  // slots dans l'ordre de tri ; 2ᵉ passe : le budget restant va aux autres
  // « now ». Les « now » au-delà du cap rétrogradent en « next » (jamais perdus).
  const nowItems = capped.filter((it) => it.tier === 'now')
  const keepNow = new Set<string>()
  let budget = cfg.caps.now_total
  for (const it of nowItems) {
    if (budget <= 0) break
    if (it.signalKind === 'reminder') { keepNow.add(it.id); budget-- }
  }
  for (const it of nowItems) {
    if (budget <= 0) break
    if (keepNow.has(it.id)) continue
    keepNow.add(it.id); budget--
  }
  for (const it of nowItems) {
    if (!keepNow.has(it.id)) it.tier = 'next'
  }
  return capped
}
