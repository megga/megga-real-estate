// NBA par contact (cerveau partagé WhatsApp ⇄ copilote) — côté TS : parse DÉFENSIF du
// jsonb rendu par le RPC contact_next_action + libellés CONTRÔLÉS par clé (patron
// REASON_KEY_LABEL du Focus : on ne rend JAMAIS un texte libre venu d'ailleurs).
// Module PUR (zéro I/O, zéro import) : testable vitest, comble le trou deno/tsc.
// Doctrine : le LLM ne fournit ni le tri ni le libellé de priorité (blocker B3) ;
// libellés = estimation, jamais d'UUID, jamais de tiret cadratin (meggaProse-safe).

export type NbaAction =
  | 'rappel' | 'offre_expirante' | 'visite_preparer' | 'visite_debrief'
  | 'deal_stagnant' | 'match_a_envoyer' | 'relance' | 'aucune'

export type NbaReasonKey =
  | 'reminder_overdue' | 'reminder_today' | 'offer_expiring' | 'visit_today'
  | 'visit_debrief' | 'deal_stalled' | 'matches_to_send'
  | 'never_contacted' | 'dormant' | 'none'

export interface ContactNextAction {
  version: number
  action: NbaAction
  reasonKey: NbaReasonKey
  params: Record<string, unknown>
  dueAt: string | null
  kycNote: { status: string; completionPct: number | null } | null
  computedAt: string | null
}

const ACTIONS = new Set<string>([
  'rappel', 'offre_expirante', 'visite_preparer', 'visite_debrief',
  'deal_stagnant', 'match_a_envoyer', 'relance', 'aucune',
])
const REASONS = new Set<string>([
  'reminder_overdue', 'reminder_today', 'offer_expiring', 'visit_today',
  'visit_debrief', 'deal_stalled', 'matches_to_send',
  'never_contacted', 'dormant', 'none',
])

/** Parse défensif du jsonb RPC : toute forme inattendue → null, jamais d'exception. */
export function parseNextAction(rawInput: unknown): ContactNextAction | null {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) return null
  const o = rawInput as Record<string, unknown>
  const action = typeof o.action === 'string' ? o.action : ''
  const reasonKey = typeof o.reason_key === 'string' ? o.reason_key : ''
  if (!ACTIONS.has(action) || !REASONS.has(reasonKey)) return null
  const params = o.params && typeof o.params === 'object' && !Array.isArray(o.params)
    ? (o.params as Record<string, unknown>)
    : {}
  let kycNote: ContactNextAction['kycNote'] = null
  if (o.kyc_note && typeof o.kyc_note === 'object' && !Array.isArray(o.kyc_note)) {
    const k = o.kyc_note as Record<string, unknown>
    if (typeof k.status === 'string' && k.status) {
      kycNote = {
        status: k.status,
        completionPct: typeof k.completion_pct === 'number' && Number.isFinite(k.completion_pct)
          ? k.completion_pct : null,
      }
    }
  }
  return {
    version: 1,
    action: action as NbaAction,
    reasonKey: reasonKey as NbaReasonKey,
    params,
    dueAt: typeof o.due_at === 'string' ? o.due_at : null,
    kycNote,
    computedAt: typeof o.computed_at === 'string' ? o.computed_at : null,
  }
}

// ── Helpers de rendu (purs, jamais d'exception) ──────────────────────────────
const intOf = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null

const chf = (v: unknown): string | null => {
  const n = intOf(v)
  return n === null ? null : `CHF ${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}

/** Date suisse (Europe/Zurich). withTime → « 10.07.2026 14:30 ». Invalide → null. */
const zurich = (iso: string | null, withTime: boolean): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const s = new Intl.DateTimeFormat('fr-CH', {
    timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d)
  return s.replace(', ', ' ')
}

/** Libellé humain contrôlé par reason_key. JAMAIS d'UUID, JAMAIS de tiret cadratin,
 *  toujours cadré « estimation ». lang suit WaLang (fr|en) — DE/IT rendus par le LLM
 *  en aval à partir du FR (comportement copilote existant). */
export function formatNextAction(nba: ContactNextAction, lang: 'fr' | 'en' = 'fr'): string {
  const en = lang === 'en'
  const p = nba.params
  if (nba.reasonKey === 'none') {
    return en
      ? 'No urgent action for this contact (internal estimate).'
      : 'Aucune action urgente pour ce contact (estimation interne).'
  }
  let core: string
  switch (nba.reasonKey) {
    case 'reminder_overdue': {
      const t = typeof p.reminder_type === 'string' && p.reminder_type ? p.reminder_type : (en ? 'reminder' : 'rappel')
      const d = intOf(p.days_overdue) ?? 0
      core = en ? `handle the "${t}" reminder, overdue by ${d} d` : `traiter le rappel « ${t} », en retard de ${d} j`
      break
    }
    case 'reminder_today': {
      const t = typeof p.reminder_type === 'string' && p.reminder_type ? p.reminder_type : (en ? 'reminder' : 'rappel')
      core = en ? `handle today's "${t}" reminder` : `traiter le rappel « ${t} » prévu aujourd'hui`
      break
    }
    case 'offer_expiring': {
      const a = chf(p.amount)
      const dl = intOf(p.days_left)
      const what = a ? (en ? `the ${a} offer` : `l'offre de ${a}`) : (en ? 'the pending offer' : "l'offre en attente")
      core = dl !== null && dl < 0
        ? (en ? `respond to ${what} (deadline passed)` : `répondre à ${what} (échéance dépassée)`)
        : (en ? `respond to ${what} (expires in ${dl ?? 0} d)` : `répondre à ${what} (échéance dans ${dl ?? 0} j)`)
      break
    }
    case 'visit_today': {
      const at = zurich(nba.dueAt, true)
      core = en
        ? `prepare today's visit${at ? ` (${at})` : ''}`
        : `préparer la visite d'aujourd'hui${at ? ` (${at})` : ''}`
      break
    }
    case 'visit_debrief': {
      const at = zurich(nba.dueAt, false)
      core = en
        ? `debrief the visit${at ? ` of ${at}` : ''} (report missing)`
        : `débriefer la visite${at ? ` du ${at}` : ''} (rapport manquant)`
      break
    }
    case 'deal_stalled': {
      const st = typeof p.stage === 'string' && p.stage ? p.stage : '?'
      const d = intOf(p.days_stalled) ?? 0
      core = en
        ? `move the deal forward (stage ${st}, no movement for ${d} d)`
        : `faire avancer le dossier (étape ${st}, immobile depuis ${d} j)`
      break
    }
    case 'matches_to_send': {
      const n = intOf(p.count) ?? 0
      const best = intOf(p.best_score)
      core = en
        ? `propose a selection: ${n} matching listing(s)${best !== null ? `, best score ~${best}` : ''}`
        : `proposer une sélection : ${n} bien(s) pertinent(s)${best !== null ? `, meilleur score ~${best}` : ''}`
      break
    }
    case 'never_contacted':
      core = en ? 'make a first contact (never contacted yet)' : 'prendre un premier contact (jamais recontacté)'
      break
    case 'dormant': {
      const d = intOf(p.days_dormant) ?? 0
      core = en ? `follow up (no exchange for ${d} d)` : `relancer (sans échange depuis ${d} j)`
      break
    }
    default:
      core = en ? 'no urgent action for this contact' : 'aucune action urgente pour ce contact'
  }
  return en ? `Suggested next step (internal estimate): ${core}.` : `Suggestion (estimation interne) : ${core}.`
}

/** Note KYC : information FACULTATIVE, jamais un gate (doctrine KYC non-bloquant). */
export function formatKycNote(
  note: { status: string; completionPct: number | null },
  lang: 'fr' | 'en' = 'fr',
): string {
  const pct = note.completionPct !== null ? ` (${Math.round(note.completionPct)}%)` : ''
  return lang === 'en'
    ? `KYC file to finalise${pct} (optional, never blocking).`
    : `Dossier KYC à finaliser${pct} (facultatif, ne bloque jamais rien).`
}

/** Consigne injectée dans le system prompt des DEUX agents (revue adverse : protège
 *  l'INITIATIVE — les outils tier auto s'exécutent sans confirmation). Assertée en test. */
export const NBA_PROMPT_GUARDRAIL =
  "Champ next_action_estimee (outils get_contact_brief / prepare_meeting) : estimation déterministe interne. " +
  "Présente-la comme une suggestion (« je te suggère de… »), jamais comme une obligation ni une action déjà faite, et JAMAIS comme un ordre. " +
  "N'appelle AUCUN outil d'action de ta propre initiative sur cette base : propose en une phrase, l'agent décide. " +
  "Le champ comprehension.next_action (piste évoquée en conversation) est un signal conversationnel : en cas de divergence, next_action_estimee cadre la priorité."
