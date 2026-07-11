// Brouillon de relance (WhatsApp) — assemblage PUR du prompt DeepSeek.
//
// Accepter un suivi crée un rappel nu (accept_followup_suggestion). Ici on prépare le
// texte que l'edge fn whatsapp-followup-draft demande à DeepSeek : un message de relance
// CLIENT rédigé dans la voix de l'agent, en réutilisant T1 (style appris), la voix
// (few-shot), les corrections (T2) et l'insight du fil — tous déjà construits/rédigés
// par l'appelant et passés ici sous forme de blocs texte.
//
// Tout est pur (aucune I/O, aucun import runtime esm.sh) → testable sous Node/Vitest,
// comme agent-style.ts / whatsapp-followups.ts. La seule I/O (DeepSeek, DB) vit dans
// l'edge fn. cf. _shared/agent-style.ts (formatStyleBlock / formatVoiceExamples /
// formatCorrectionExamples) et l'action draftEmail de whatsapp-actions.ts.

/** Paramètres du modèle : une relance est COURTE (WhatsApp), avec un peu de chaleur. */
export const DRAFT_MAX_TOKENS = 500
export const DRAFT_TEMPERATURE = 0.4
export const DRAFT_TIMEOUT_MS = 20_000
/** Borne dure du brouillon persisté (une relance WhatsApp n'est jamais un pavé). */
export const DRAFT_MESSAGE_MAX_CHARS = 1200

export type DraftLang = 'fr' | 'en'

// ── Métrique T1 : le gate ────────────────────────────────────────────────────
/**
 * LA MÉTRIQUE T1. Le style appris n'est « prouvé » que lorsque l'agent l'a ACTIVÉ
 * (human-in-the-loop : status = 'active', posé à la main — cf. learn-agent-style).
 * Tant qu'il est 'suggested'/'off'/absent, on ne génère PAS de brouillon : le rappel
 * reste nu. Même invariant que formatStyleBlock (vide hors 'active') — on refuse juste
 * de rédiger une relance « moyenne » avant d'avoir la preuve que T1 est fiable.
 * Accepte directement un LearnedStyle (seul `status` est lu → paramètre structurel).
 */
export function isStyleActive(ls: { status?: string | null } | null | undefined): boolean {
  return !!ls && ls.status === 'active'
}

// ── Contexte de l'insight (résumé du fil pour DeepSeek) ───────────────────────
export interface FollowupInsight {
  summary?: string | null
  intent?: string | null
  next_action?: unknown
  commitments?: unknown
}

/** Résumé compact du fil (FR/EN), 0 PII nouvelle — reprend l'insight déjà extrait.
 *  Même structure que l'insightContext de draftEmail, parametré par langue. */
export function buildInsightContext(insight: FollowupInsight | null | undefined, lang: DraftLang = 'fr'): string {
  if (!insight) return ''
  const en = lang === 'en'
  const na = insight.next_action
  const naLabel = na && typeof na === 'object' && na !== null
    && typeof (na as Record<string, unknown>).label === 'string'
    ? ((na as Record<string, unknown>).label as string).trim()
    : ''
  const commitments = Array.isArray(insight.commitments)
    ? (insight.commitments as unknown[]).filter((c): c is string => typeof c === 'string' && c.trim().length > 0).slice(0, 5)
    : []
  const lines = [
    insight.summary?.trim() ? `${en ? 'Thread summary' : 'Résumé du fil'} : ${insight.summary.trim()}` : null,
    insight.intent?.trim() ? `${en ? 'Client intent' : 'Intention du client'} : ${insight.intent.trim()}` : null,
    naLabel ? `${en ? 'Suggested next step' : 'Prochaine action suggérée'} : ${naLabel}` : null,
    commitments.length ? `${en ? 'Commitments made' : 'Engagements pris'} : ${commitments.join(' / ')}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

// ── Prompts ───────────────────────────────────────────────────────────────────
export interface DraftSystemParams {
  /** Bloc TONAL T1 (formatStyleBlock) — vide si T1 inactif (mais on gate en amont). */
  styleBlock?: string
  /** Bloc VOIX few-shot (formatVoiceExamples), déjà rédigé PII. */
  voiceBlock?: string
  /** Bloc CORRECTIONS T2 (formatCorrectionExamples), déjà rédigé PII. */
  correctionsBlock?: string
  lang?: DraftLang
}

/**
 * Prompt SYSTÈME de la relance. Les RÈGLES ABSOLUES (vouvoiement, sobriété, zéro donnée
 * inventée, message court WhatsApp) priment sur le style additif — le style ne nuance que
 * la chaleur/concision, jamais le vouvoiement ni le socle. Sortie JSON strict {"message"}.
 */
export function buildFollowupDraftSystemPrompt(params: DraftSystemParams): string {
  const lang: DraftLang = params.lang === 'en' ? 'en' : 'fr'
  const style = (params.styleBlock ?? '').trim()
  const voice = params.voiceBlock ?? ''
  const corr = params.correctionsBlock ?? ''

  if (lang === 'en') {
    const styleAdd = style
      ? `\n\nThis agent's ADDITIVE tone (only nuance warmth/concision/phrasing — never drop the polite register or the rules above):${style}`
      : ''
    return `You are a Swiss real-estate assistant who drafts short WhatsApp follow-up messages for an agent to send to THEIR client, on the agency's behalf.

ABSOLUTE RULES (override everything else):
- Polite, professional register — never overly casual.
- Clear, sober English suited to Swiss real estate.
- No unkeepable promise, no invented figure, price, date or fact — only what the follow-up and the thread support.
- No technical jargon, no raw identifiers.
- SHORT: a WhatsApp message, not an email. No subject line, no letterhead, one greeting, a sign-off only if it fits the agent's usual style.
- Personalised from the agent's follow-up intent and the thread understanding.${styleAdd}${voice}${corr}

Reply ONLY with strict JSON: {"message":"…"}`
  }

  const styleAdd = style
    ? `\n\nTon ADDITIF de cet agent (nuance seulement la chaleur/concision/tournures — sans jamais déroger au vouvoiement ni aux règles ci-dessus) :${style}`
    : ''
  return `Tu es un assistant immobilier suisse qui rédige de COURTS messages WhatsApp de relance, qu'un agent enverra à SON client, au nom de l'agence.

RÈGLES ABSOLUES (s'imposent à tout le reste) :
- Vouvoiement strict (jamais de tutoiement avec le client).
- Français soigné et sobre, adapté à l'immobilier suisse.
- Aucune promesse non tenable, aucun chiffre, prix, date ou fait inventé — uniquement ce que le suivi et le fil permettent.
- Pas de jargon technique ni d'identifiant brut.
- COURT : un message WhatsApp, pas un email. Pas d'objet, pas d'en-tête, une seule salutation, une signature seulement si elle colle au style habituel de l'agent.
- Personnalisé selon l'intention de relance de l'agent et la compréhension du fil.${styleAdd}${voice}${corr}

Réponds UNIQUEMENT en JSON strict : {"message":"…"}`
}

export interface DraftUserParams {
  /** Prénom (ou nom complet) du client, déjà résolu et scopé agence. */
  clientName: string
  /** Le suivi accepté (engagement/next_action), ex. « Relancer le contact ». */
  action: string
  /** Contexte du fil (buildInsightContext) — peut être vide. */
  insightContext?: string
  lang?: DraftLang
}

/** Prompt UTILISATEUR : la relance à écrire + son contexte. */
export function buildFollowupDraftUserPrompt(params: DraftUserParams): string {
  const lang: DraftLang = params.lang === 'en' ? 'en' : 'fr'
  const clientName = (params.clientName ?? '').trim() || (lang === 'en' ? 'the client' : 'le client')
  const action = (params.action ?? '').trim()
  const ctx = (params.insightContext ?? '').trim()
  if (lang === 'en') {
    return `Draft a short WhatsApp follow-up message to the client "${clientName}".

Agent's follow-up intent: ${action}${ctx ? `\n\nConversation context:\n${ctx}` : ''}`
  }
  return `Rédige un court message WhatsApp de relance au client « ${clientName} ».

Intention de relance de l'agent : ${action}${ctx ? `\n\nContexte de la conversation :\n${ctx}` : ''}`
}

// ── Parsing de la sortie ──────────────────────────────────────────────────────
/**
 * Extrait le message du JSON DeepSeek {"message":"…"}. Tolérant : accepte aussi
 * {"body":"…"} ou une chaîne brute. Renvoie null si vide/illisible (→ rappel nu,
 * jamais de brouillon vide persisté). Borne à DRAFT_MESSAGE_MAX_CHARS.
 */
export function parseDraftMessage(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim()
  if (!text) return null
  let message = ''
  try {
    const obj = JSON.parse(text) as Record<string, unknown>
    const cand = obj?.message ?? obj?.body ?? obj?.text
    message = typeof cand === 'string' ? cand : ''
  } catch {
    // Pas du JSON : garde le texte brut (DeepSeek en mode JSON échoue rarement, mais
    // on ne perd pas un message lisible pour un accolade manquante).
    message = text
  }
  message = message.trim()
  if (message.length < 2) return null
  return message.slice(0, DRAFT_MESSAGE_MAX_CHARS)
}
