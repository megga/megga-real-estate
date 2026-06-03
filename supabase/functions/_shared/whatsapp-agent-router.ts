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

export type ToolTier = 'read' | 'auto' | 'confirm' | 'slow_async'

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
  qualify_lead: 'auto',
  // update_pipeline modifie l'étape pipeline → garde-fou absolu du cerveau
  // (ai-guardrails : « jamais sans action humaine ») ⇒ confirm (le « oui » de l'agent).
  update_pipeline: 'confirm',
  send_client_message: 'confirm',
  send_listings: 'confirm',
  record_offer: 'confirm',
  open_kyc_case: 'confirm',
  attach_kyc_document: 'auto',          // reste synchrone (P2b : async + R2)
  run_kyc_screening: 'slow_async',      // ~50s Dilisense → hors boucle (file + cron)
  send_kyc_report: 'slow_async',        // ~60s render PDF + envoi → hors boucle
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

/** Libellés FR des étapes — pour parler humain à l'agent (jamais l'enum brut). */
export const STAGE_LABELS_FR: Record<PipelineStage, string> = {
  new_lead: 'Nouveau lead', to_qualify: 'À qualifier', active_search: 'Recherche active',
  visit_planned: 'Visite planifiée', visit_done: 'Visite effectuée', interest_confirmed: 'Intérêt confirmé',
  offer: 'Offre', negotiation: 'Négociation', reserved: 'Réservé', financing: 'Financement',
  notary: 'Notaire', signed: 'Signé', lost: 'Perdu', to_recontact: 'À relancer',
}

/** Libellés EN des étapes (copilote bilingue FR/EN, cf. whatsapp-i18n). */
export const STAGE_LABELS_EN: Record<PipelineStage, string> = {
  new_lead: 'New lead', to_qualify: 'To qualify', active_search: 'Active search',
  visit_planned: 'Visit planned', visit_done: 'Visit done', interest_confirmed: 'Interest confirmed',
  offer: 'Offer', negotiation: 'Negotiation', reserved: 'Reserved', financing: 'Financing',
  notary: 'Notary', signed: 'Signed', lost: 'Lost', to_recontact: 'To follow up',
}

/** Libellé d'étape dans la langue de l'agent ('fr' par défaut). */
export function stageLabel(stage: string, lang: 'fr' | 'en'): string {
  const map = lang === 'en' ? STAGE_LABELS_EN : STAGE_LABELS_FR
  return map[stage as PipelineStage] ?? stage
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
