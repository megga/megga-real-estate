// Logique PURE du routage agent WhatsApp (Phase 3). Aucun I/O — testable Node.

/** Code à 6 chiffres si le corps en contient exactement 6 (espaces internes ignorés), sinon null. */
export function extractPairingCode(body: string | null | undefined): string | null {
  if (!body) return null
  const digits = body.replace(/\D/g, '')
  return digits.length === 6 ? digits : null
}

/** Valide si la date d'expiration est dans le futur. */
export function isPairingCodeValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  return Number.isFinite(t) && t > Date.now()
}

export type ToolTier = 'read' | 'auto' | 'confirm'

// Source de vérité du tier par outil. Inconnu => 'confirm' (fail-safe : jamais
// d'exécution d'un outil non classé sans confirmation humaine).
const TOOL_TIERS: Record<string, ToolTier> = {
  get_my_agenda: 'read',
  search_contacts: 'read',
  get_contact_brief: 'read',
  list_followups: 'read',
  get_matches: 'read',
  get_daily_brief: 'read',
  create_contact: 'auto',
  add_note: 'auto',
  schedule_visit: 'auto',
  create_reminder: 'auto',
  update_pipeline: 'auto',
  qualify_lead: 'auto',
  send_client_message: 'confirm',
}

export function toolTier(name: string): ToolTier {
  return TOOL_TIERS[name] ?? 'confirm'
}

// Les 14 colonnes canoniques du pipeline (= transactions.stage, hors valeurs legacy
// lead/qualified/closed/visit_planned_legacy). Source unique partagée par le catalogue
// d'outils (enum exposé à DeepSeek) et l'exécuteur update_pipeline (validation défensive).
export const PIPELINE_STAGES = [
  'new_lead', 'to_qualify', 'active_search', 'visit_planned', 'visit_done',
  'interest_confirmed', 'offer', 'negotiation', 'reserved', 'financing',
  'notary', 'signed', 'lost', 'to_recontact',
] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/** Vrai si `stage` est une étape canonique du pipeline (sensible à la casse). */
export function isValidStage(stage: string): stage is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(stage)
}

const YES = new Set(['oui', 'ok', 'okay', 'yes', 'y', 'vas-y', 'vasy', 'go', 'confirme', 'confirmer', 'valide', "d'accord", 'daccord', 'ouais', 'yep'])
const NO = new Set(['non', 'no', 'n', 'annule', 'annuler', 'stop', 'cancel', 'laisse', 'laisse tomber'])

export function parseConfirmation(body: string | null | undefined): 'yes' | 'no' | 'none' {
  if (!body) return 'none'
  const norm = body.trim().toLowerCase().replace(/[!.…]+$/, '')
  if (YES.has(norm)) return 'yes'
  if (NO.has(norm)) return 'no'
  return 'none'
}

export function isPendingActionValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  return Number.isFinite(t) && t > Date.now()
}

// ── Phase 4C / C1 : mémoire de conversation (pur) ───────────────────────────
export interface WaHistoryRow { direction: string; body: string | null; transcript: string | null }

/** Reconstruit l'historique agent↔MEGGA (lignes triées DESC) en tours chat
 *  chronologiques : inbound→user, outbound→assistant. transcript prioritaire,
 *  vides ignorés, contenu borné (1000 car). */
export function buildHistoryMessages(rowsDesc: WaHistoryRow[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return [...rowsDesc].reverse()
    .map((r) => ({
      role: (r.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: (r.transcript || r.body || '').trim().slice(0, 1000),
    }))
    .filter((m) => m.content.length > 0)
}
