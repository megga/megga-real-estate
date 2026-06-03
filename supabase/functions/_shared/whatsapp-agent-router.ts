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

// SEUL outil 'confirm' qui peut passer en auto (Palier 3) : update_pipeline — réversible
// (undo) + audité, aucun flux client/argent. Le socle légal (send_client_message/send_listings/
// record_offer/open_kyc_case) renvoie false ICI quel que soit l'agent → ne quitte JAMAIS confirm.
export function canLeaveConfirm(tool: string): boolean {
  return tool === 'update_pipeline'
}

// NB: 'annule'/'annuler' figurent aussi dans le set NO de parseConfirmation — garder les deux cohérents.
const UNDO_WORDS = new Set(['/annuler', 'annuler', 'annule', 'undo', 'reviens', 'rétablis', 'retablis'])
/** Vrai si le message est une commande d'annulation courte (pour l'undo différé). */
export function isUndoCommand(body: string | null | undefined): boolean {
  if (!body) return false
  const norm = body.trim().toLowerCase().replace(/[!.…]+$/, '')
  return UNDO_WORDS.has(norm)
}

// ── Garde anti-hallucination KYC (hotfix 3 juin 2026) ────────────────────────
// Depuis le passage des outils KYC en async (Palier 2), la réponse immédiate à un screening
// est une PROMESSE (« je lance, résultat plus tard ») que DeepSeek peut FABRIQUER en texte
// sans appeler l'outil — il l'a fait en prod (incident Vladimir : « j'ai lancé le screening »
// alors que rien n'avait tourné). C'est compliance-critique (fausse assurance LBA).
// Cette fonction PURE détecte, dans une réponse en texte LIBRE de DeepSeek (= aucun outil KYC
// appelé ce tour-ci), une affirmation qu'un screening / rapport KYC a été lancé / fait / est en
// cours. Si oui, l'agent remplace la réponse par un message honnête (jamais de fausse action).
// `kycToolCalled` = true ⇒ un outil KYC a réellement tourné ⇒ l'affirmation est légitime (pas de flag).
export function isFabricatedKycClaim(reply: string | null | undefined, kycToolCalled: boolean): boolean {
  if (kycToolCalled || !reply) return false
  const r = reply.toLowerCase()

  // (1) EXPOSER LE MÉCANISME ASYNC = fabrication, SANS gate KYC : les seuls outils async de l'agent
  // sont les outils KYC, donc « traitement asynchrone » / « asynchronous » ne peut venir que de là.
  if (/(traitement\s+asynchrone|asynchron)/.test(r)) return true

  // (2) Hors de ce tell : exiger une mention KYC (scope) + écarter l'historique légitime
  // (« on a déjà généré le rapport », « le screening d'hier… » = l'agent rappelle un fait passé).
  if (!/(screening|\bscreen\b|kyc|sanctions?|\bpep\b|vérif|verif|\blba\b|contrôl|controle)/.test(r)) return false
  if (/\b(déjà|deja|hier|avant-hier|la\s+semaine\s+(dernière|derniere|passée|passee)|le\s+mois\s+dernier|auparavant|already|yesterday|last\s+(week|month))\b/.test(r)) return false

  // (3) Action présentée comme EN COURS / résultat À VENIR (la signature de l'incident Vladimir).
  if (
    /(en\s+cours|en\s+route|en\s+train\s+de|\btourne\b|\bin\s+progress\b|\bprocessing\b|\brunning\b|\bunderway\b)/.test(r) ||
    /(résultats?\s+(dans|d['e ]?ici|sous|à\s+venir|bient[ôo]t|arrive)|results?\b[^.]{0,20}(shortly|soon|coming|in\s+a\s+(few|moment)))/.test(r) ||
    /((je\s+te\s+(préviens|previens|reviens|tiens|donne|recontacte))|(je\s+reviens\s+vers)|(d[èe]s\s+que\s+c['e ]?est\s+(dispo|pr[êe]t|fait))|(i['\s]?(ll|will)\s+(let\s+you\s+know|get\s+back|keep\s+you)))/.test(r) ||
    /(ne\s+(me\s+)?remonte\s+pas\b[^.]*résultat)|((ça|ca)\s+arrive)/.test(r)
  ) return true

  // (4) Offre / futur (« tu veux que je lance », « je vais », « je peux ») = légitime, pas une action FAITE.
  if (/\b(je\s+vais|tu\s+veux|veux-tu|souhaites?-tu|si\s+tu|je\s+peux|dois-je|will\s+you|do\s+you\s+want|i\s+can|shall\s+i)\b/.test(r)) return false

  // (5) Prétend avoir LANCÉ / FAIT l'action ou en donne un RÉSULTAT (sans appel d'outil) = fabrication.
  return (
    /\bj['e ]?ai\s+(re)?(lanc|déclench|declench|démarr|demarr|initi|envoy|génér|gener|effectu|réalis|realis|vérifi|verifi|fait)/.test(r) ||
    /\bje\s+(viens\s+de|m['e ]?occupe)\b/.test(r) ||
    /\b(est|a\s+ét[ée]|sont|ont\s+ét[ée])\s+(lanc[ée]|déclench[ée]|declench[ée]|démarr[ée]|demarr[ée]|initi[ée]|envoy[ée]|génér[ée]|gener[ée]|effectu[ée]|réalis[ée]|realis[ée]|vérifi[ée]|verifi[ée]|parti[es]?)/.test(r) ||
    /\bfaite?\b/.test(r) ||
    /c['e ]?est\s+parti/.test(r) ||
    /\bi['\s]?(ve|m| have| am)?\s*(just\s+)?(launch|ran\b|run\b|start|sent|trigger|initiat|complet)/.test(r) ||
    /(screening|kyc|sanctions?|pep|report|check)\s+(is\s+|has\s+been\s+|was\s+)?(started|launched|done|complete|completed|sent|triggered)/.test(r) ||
    /(pas\s+de\s+pep|aucun\s+pep|pep\s+(détecté|detecte|trouvé|trouve|match)|correspondance\s+sanction|risque\s+(faible|moyen|élev[ée])|\bras\b)/.test(r) ||
    /(no\s+pep\s+match|sanctions?\s+(clear|match)|(low|medium|high)\s+risk)/.test(r)
  )
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
