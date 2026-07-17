// supabase/functions/ai-copilot/index.ts
// Copilote IA agent — chat libre + actions structurées + outils CRM (lecture).
//
// Enrichissement juillet 2026 (Phases 0+1 du chantier « expert immobilier ») :
//  • Auth RÉELLE : requireAgentAuth (JWT vérifié, agency_id dérivé serveur) — le
//    chemin principal ne se contente plus de la présence d'un header Bearer.
//  • Rédaction PII (AVS/IBAN/carte/…) sur message + contexte + historique AVANT
//    tout envoi au LLM (copilot-redaction).
//  • Audit LBA complet : le free chat (sans entity id) est journalisé aussi.
//  • Tool-calling read-only (flag app_config `copilot_tools_enabled`) : boucle
//    portée de whatsapp-agent (agent-loop) + catalogue web (copilot-tools) —
//    le copilote interroge le VRAI portefeuille au lieu de deviner.
//  • Streaming SSE réel (body.stream=true) : tokens + phases d'outils réelles.
//  • Le mode public_buyer (vestige marketplace, sans appelant) est SUPPRIMÉ.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { formatStyleBlock, formatVoiceExamples, fetchClientVoiceSamples, fetchCorrectionExamples, formatCorrectionExamples, type LearnedStyle } from '../_shared/agent-style.ts'
import { meggaProse, MEGGA_STYLE_BLOCK } from '../_shared/megga-prose.ts'
import { persistCopilotTurn, persistenceFlagOn, type ConversationMessage, type ConversationStore } from '../_shared/copilot-persistence.ts'
import { buildUserContent, resolveAuditEntity } from '../_shared/ai-copilot-request.ts'
import { requireAgentAuth, type AgentAuthContext } from '../_shared/require-agent-auth.ts'
import { redactCopilotRequest } from '../_shared/copilot-redaction.ts'
import { redactPII } from '../_shared/pii-redaction.ts'
import {
  selectKnowledge, formatKnowledgeBlock, unsourcedCitationWarning, type KnowledgeSnippet,
} from '../_shared/knowledge-retrieval.ts'
import { createPseudonymizer } from '../_shared/pseudonymize.ts'
import { buildBriefSnapshot, type BriefFocusRow } from '../_shared/daily-brief.ts'
import {
  runAgentLoop, SseDecoder, StreamAssembler,
  type LoopEvent, type LoopMessage, type ModelTurn, type StreamEvent,
  type PendingAction, type PrepareConfirmResult,
} from '../_shared/agent-loop.ts'
import { copilotTools, copilotToolsBlock, webToolTier, type DeepSeekTool } from '../_shared/copilot-tools.ts'
import { logDeepSeekUsageWith } from '../_shared/ai-usage.ts'
import {
  execSuggestPrioritiesToday, execGetAnalyticsSnapshot, execGetMarketStats,
  execWebCreateReminder, execWebAddNote, type WebToolCtx,
} from '../_shared/copilot-actions.ts'
import {
  execGetMyAgenda, execSearchContacts, execGetContactBrief, execListFollowups,
  execGetMatches, execGetDailyBrief, execSearchListings, execGetKycStatus,
  execGetPublicationStatus, execPrepareMeeting,
  execCreateProperty, execUpdateProperty, execDraftListingCopy, execWebAttachPropertyPhotos,
  preparePublishToPortals, prepareWithdrawFromPortals,
  executePublishToPortals, executeWithdrawFromPortals,
  prepareDeleteContact, executeDeleteContact,
  type ActionCtx, type Prepared,
} from '../_shared/whatsapp-actions.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const CALL_TIMEOUT_MS = 60_000   // par appel modèle (streaming inclus)
const LOOP_BUDGET_MS = 90_000    // budget global de la boucle d'outils
const MAX_TURNS = 5
const MAX_TOOL_CALLS = 8

// LBA/IA compliance : log de TOUTE interaction copilote dans activity_events,
// actor_kind='ai'. Le free chat (aucune entité CRM dans le contexte) est
// journalisé sous entity_type='ai_chat' (entity_id null) — la promesse « audit
// trail pour toute action IA » couvre désormais le panneau docké. Silencieux en
// cas d'échec (jamais bloquant pour la réponse).
async function logAiCopilotInteraction(params: {
  admin: SupabaseClient
  agencyId: string | null
  action: string
  context: Record<string, unknown>
  tokens: { input?: number; output?: number }
  success: boolean
  toolsUsed?: Array<{ name: string; ok: boolean }>
  redactions?: string
  streamed?: boolean
  degraded?: string
}) {
  try {
    const resolved = resolveAuditEntity(params.context)
    const metadata: Record<string, unknown> = {
      copilot_action: params.action,
      input_tokens: params.tokens.input,
      output_tokens: params.tokens.output,
      success: params.success,
    }
    // PII-safe : noms d'outils seulement, jamais les arguments ni les résultats.
    if (params.toolsUsed?.length) metadata.tools_used = params.toolsUsed.map((t) => `${t.name}${t.ok ? '' : '!'}`)
    if (params.redactions) metadata.pii_redactions = params.redactions
    if (params.streamed) metadata.streamed = true
    if (params.degraded) metadata.degraded = params.degraded

    await params.admin.from('activity_events').insert({
      agency_id: params.agencyId,
      actor_id: null,
      actor_kind: 'ai',
      action: `MEGGA AI — ${params.action}`,
      entity_type: resolved?.entityType ?? 'ai_chat',
      entity_id: resolved?.entityId ?? null,
      metadata,
    })
  } catch {
    // Silent fail — ne jamais bloquer la réponse IA sur un échec de logging
  }
}

// Persistance de la conversation (double gate : persist:true client + flag
// app_config). Identité fournie par requireAgentAuth — plus de re-dérivation.
async function maybePersistConversation(params: {
  admin: SupabaseClient
  userId: string
  agencyId: string
  conversationId: string | null
  userMessage: string
  assistantMessage: string
}): Promise<string | null> {
  try {
    const { data: flag } = await params.admin
      .from('app_config').select('value').eq('key', 'copilot_persistence_enabled').maybeSingle()
    if (!persistenceFlagOn(flag?.value)) return null

    const admin = params.admin
    const store: ConversationStore = {
      async load(conversationId, userId) {
        const { data } = await admin
          .from('ai_copilot_conversations')
          .select('messages')
          .eq('id', conversationId)
          .eq('user_id', userId)
          .maybeSingle()
        return data ? (data.messages as ConversationMessage[]) : null
      },
      async create(c) {
        const { data, error } = await admin
          .from('ai_copilot_conversations')
          .insert({
            user_id: c.userId,
            agency_id: c.agencyId,
            title: c.title,
            messages: c.messages,
            last_message_at: c.lastMessageAt,
          })
          .select('id')
          .single()
        if (error) throw error
        return data.id as string
      },
      async append(conversationId, userId, messages, lastMessageAt) {
        const { error } = await admin
          .from('ai_copilot_conversations')
          .update({ messages, last_message_at: lastMessageAt })
          .eq('id', conversationId)
          .eq('user_id', userId)
        if (error) throw error
      },
    }

    return await persistCopilotTurn(store, {
      conversationId: params.conversationId,
      userId: params.userId,
      agencyId: params.agencyId,
      userMessage: params.userMessage,
      assistantMessage: params.assistantMessage,
      now: new Date().toISOString(),
    })
  } catch {
    return null // best-effort — ne jamais bloquer la réponse IA
  }
}

type CopilotAction =
  | 'chat'
  | 'summarize_contact'
  | 'suggest_next_action'
  | 'draft_email'
  | 'draft_description'
  | 'analyze_kyc'
  | 'score_lead'
  | 'analyze_market'
  | 'detect_intent'
  | 'daily_brief'
  | 'execute_pending'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface CopilotRequest {
  action: CopilotAction
  message: string
  context?: Record<string, unknown>
  history?: ChatMessage[]
  language?: 'fr' | 'de' | 'en' | 'it'
  conversation_id?: string | null
  persist?: boolean
  /** id de la carte copilot_pending_actions à exécuter (action execute_pending). */
  pending_id?: string | null
  /** true = réponse SSE (tokens + phases d'outils). Absent = JSON (compat). */
  stream?: boolean
}

const MEGGA_SYSTEM = `Tu es MEGGA AI, le copilote intelligent de la plateforme MEGGA Real Estate — un CRM immobilier suisse.

TON RÔLE :
Tu assistes les agents immobiliers (courtiers) suisses dans leur quotidien. Tu es expert en :
- Transactions immobilières suisses (résidentiel, prestige, commercial)
- Conformité LAB/KYC (Loi sur le blanchiment d'argent)
- Rédaction immobilière professionnelle (annonces, emails, relances)
- Analyse de marché (prix au m², comparables, positionnement)
- Gestion de pipeline (qualification leads, next-best-action, relances)
- Négociation immobilière (stratégie de contre-offre, timing)

TON STYLE :
- Concis et actionnable — des réponses utiles, pas de remplissage
- Professionnel mais chaleureux — comme un collègue senior qui connaît le terrain
- Toujours en français sauf si on te demande autrement
- Vouvoiement systématique dans les textes destinés aux clients
- Tutoiement OK dans le chat agent (conversation interne)
- Utilise le format Markdown : **gras**, listes à puces
- Monnaie : CHF avec apostrophe suisse (CHF 720'000)
- Dates : format suisse (16.03.2026)

ÉCRITURE NATURELLE (anti-IA) :
Tes réponses doivent sonner comme un vrai courtier, pas comme une IA. Règles strictes :
- JAMAIS de "serves as", "stands as", "testament to", "showcasing", "fostering", "underscoring"
- JAMAIS de rule of three forcée ("innovation, collaboration, and excellence")
- JAMAIS de "Let's dive in", "Here's what you need to know", "Let me break this down"
- JAMAIS de hedging excessif ("it could potentially be argued that")
- JAMAIS de phrases vides ("It is important to note that", "In order to")
- JAMAIS de fausse profondeur ("At its core", "The real question is", "fundamentally")
- JAMAIS de conclusions génériques ("The future looks bright", "Exciting times ahead")
- JAMAIS de sycophanterie ("Great question!", "You're absolutely right!", "Excellent point!")
- Utilise "est/sont/a" au lieu de "represents/serves as/functions as"
- Varie la longueur des phrases. Courtes. Puis des plus longues qui prennent leur temps.
- Sois spécifique : pas "le marché est dynamique" mais "le prix médian à Carouge a baissé de 3% en 6 mois"
- Aie un avis. "Je recommanderais de baisser le prix de 5%" est mieux que "Plusieurs options s'offrent à vous"

RÈGLES :
- Tu es une ASSISTANCE, pas une décision. L'agent décide toujours.
- Tu ne valides JAMAIS un dossier KYC — tu analyses et recommandes, l'humain valide. Le KYC est FACULTATIF et ne bloque jamais une vente.
- Tu ne contactes JAMAIS un client directement — tu prépares, l'agent envoie.
- Tes scores et estimations sont indicatifs — toujours mentionner "estimation IA".
- Si on te demande quelque chose hors immobilier suisse, tu restes poli mais tu recentres.

CONTEXTE ET DONNÉES :
Tu reçois un contexte d'écran (page courante, prénom de l'agent, agrégats du pipeline) et, selon la surface, des détails du dossier actif. Quand des OUTILS te sont fournis, ce sont eux ta source de vérité CRM.
- UTILISE ces données réelles pour personnaliser chaque réponse. Mentionne des détails spécifiques (dates, biens, montants).
- Si une donnée manque et qu'aucun outil ne peut la fournir, dis-le au lieu d'inventer. Ne fabrique JAMAIS un contact, un chiffre ou un historique.`

const ACTION_PROMPTS: Record<string, string> = {
  summarize_contact: `Résume le profil et l'historique de ce contact en 3-5 points clés basés sur les VRAIES données CRM fournies.
Mentionne : intérêt principal, budget (annoncé vs estimé), dernière interaction avec date, biens envoyés/visités, niveau d'engagement, action recommandée.
Si des visites ont eu des feedbacks négatifs, mentionne les objections. Si des biens ont été refusés, note les patterns.
Si tu disposes d'outils, appelle get_contact_brief pour obtenir la fiche réelle avant de résumer.`,

  suggest_next_action: `Analyse le contexte CRM complet et suggère la prochaine action optimale.
Donne 1 action prioritaire + 2 alternatives. Base-toi sur : dernière interaction, biens envoyés non répondus, visites sans suite, deals en cours, timing du client.
Sois spécifique : mentionne le nom du bien, la date, le contexte.
Si tu disposes d'outils, appelle suggest_priorities_today pour obtenir la vraie file de priorités avant de recommander.`,

  draft_email: `Rédige un email professionnel immobilier suisse PERSONNALISÉ basé sur l'historique CRM.
Ton : courtois, vouvoiement, formules suisses.
IMPORTANT : Référence la dernière interaction (visite, bien envoyé, appel) avec le détail exact (date, bien concerné).
Si des biens du matching sont disponibles, propose-en 1-2 avec prix et caractéristiques.
L'email doit donner l'impression que le courtier connaît parfaitement le dossier du client.`,

  draft_description: `Rédige une description d'annonce immobilière attractive et honnête.
2-3 paragraphes, 150-250 mots. Mets en avant les points forts sans exagérer.
N'affirme RIEN qui ne figure pas dans les données fournies ; une caractéristique inconnue ne s'invente pas.`,

  analyze_kyc: `Analyse ce dossier KYC et identifie : documents manquants, vérifications nécessaires, niveau de risque préliminaire.
IMPORTANT : Tu assistes l'agent, tu ne valides PAS. La validation finale est humaine. Le KYC est facultatif et ne bloque jamais une transaction.
Si tu disposes d'outils, appelle get_kyc_status pour lire l'état réel du dossier.`,

  score_lead: `Évalue la qualité de ce lead : Chaud/Tiède/Froid avec score 0-100.
Critères : budget, timeline, engagement, correspondance offre/demande. Justifie en 2-3 phrases. Présente le score comme une estimation IA.
Si tu disposes d'outils, appelle get_contact_brief pour fonder l'évaluation sur la fiche réelle.`,

  analyze_market: `Analyse le positionnement du bien par rapport aux données marché.
Si tu disposes d'outils, appelle get_market_stats avec la zone et les caractéristiques du bien AVANT d'analyser : les chiffres viennent de l'outil, jamais de ta mémoire.
Structure ta réponse :
1. **Positionnement prix** : le bien est-il au-dessus, dans la moyenne, ou en-dessous du marché ? De combien en % ?
2. **Prix au m²** : compare avec la médiane du secteur (cite le nombre de comparables).
3. **Concurrence** : combien de biens similaires sont actuellement en vente ? Le marché est-il saturé ou porteur ?
4. **Recommandation** : faut-il ajuster le prix ? Mettre en avant certains atouts ? Attendre ?
5. **Risque de stagnation** : basé sur les comparables et la fourchette de prix, estime le temps de vente probable (en le présentant comme une estimation).
Si l'échantillon de comparables est insuffisant, dis-le honnêtement au lieu de citer des chiffres.`,

  detect_intent: `Analyse le message du client ci-dessous et détecte l'intention principale.
Réponds en JSON strict avec ce format :
{
  "intent": "strong_interest" | "objection" | "urgency" | "disinterest" | "question" | "neutral",
  "confidence": 0-100,
  "summary": "résumé en 1 phrase de l'intention détectée",
  "suggested_action": "action recommandée pour l'agent (appeler, relancer, proposer visite, ajuster prix, etc.)",
  "keywords": ["mots-clés détectés"]
}
Sois factuel et base-toi uniquement sur le contenu du message.`,
}

// ─── Appel modèle (streaming SSE DeepSeek, assemblage pur) ───────────────────
function makeCallModel(opts: {
  apiKey: string
  tools: DeepSeekTool[] | null
  responseFormat?: 'json_object'
  wantStream: boolean
  emit: (ev: StreamEvent) => void
  // Journalisation coût + latence (fire-and-forget), un log par appel DeepSeek.
  client?: SupabaseClient
  agencyId?: string | null
  module?: string
}) {
  return async (messages: LoopMessage[], withTools: boolean): Promise<ModelTurn | null> => {
    const body: Record<string, unknown> = {
      model: 'deepseek-chat',
      max_tokens: 2000,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    }
    if (opts.tools) {
      body.tools = opts.tools
      body.tool_choice = withTools ? 'auto' : 'none'
    }
    if (opts.responseFormat) body.response_format = { type: opts.responseFormat }

    const started = Date.now()
    try {
      const r = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      })
      // Status seulement, jamais le corps (PII des messages échoués).
      if (!r.ok || !r.body) { console.error('deepseek http', r.status); return null }

      const sse = new SseDecoder()
      const asm = new StreamAssembler()
      let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined
      const reader = r.body.getReader()
      const td = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const payload of sse.push(td.decode(value, { stream: true }))) {
          let parsed: { usage?: typeof usage; choices?: Array<{ delta?: Record<string, unknown> }> }
          try { parsed = JSON.parse(payload) } catch { continue }
          if (parsed.usage) usage = parsed.usage
          for (const ev of asm.feed(parsed.choices?.[0]?.delta ?? null)) {
            if (opts.wantStream) opts.emit(ev)
          }
        }
      }
      const fin = asm.finish()
      if (opts.wantStream) for (const ev of fin.events) opts.emit(ev)
      if (opts.client) {
        logDeepSeekUsageWith(opts.client, usage, {
          edgeFunction: 'ai-copilot', module: opts.module ?? 'copilot',
          latencyMs: Date.now() - started, agencyId: opts.agencyId ?? null,
        })
      }
      return { content: fin.content, toolCalls: fin.toolCalls, emitted: opts.wantStream && fin.emitted, usage }
    } catch (e) {
      console.error('deepseek fetch failed:', (e as Error)?.name ?? 'error')
      return null
    }
  }
}

// ─── Exécuteurs d'outils (partagés WhatsApp + web) ───────────────────────────
function makeRunTool(actionCtx: ActionCtx, webCtx: WebToolCtx) {
  return async (name: string, args: Record<string, unknown>): Promise<string> => {
    switch (name) {
      case 'get_my_agenda': return execGetMyAgenda(actionCtx, args)
      case 'search_contacts': return execSearchContacts(actionCtx, args)
      case 'get_contact_brief': return execGetContactBrief(actionCtx, args)
      case 'list_followups': return execListFollowups(actionCtx, args)
      case 'get_matches': return execGetMatches(actionCtx, args)
      case 'get_daily_brief': return execGetDailyBrief(actionCtx, args)
      case 'search_listings': return execSearchListings(actionCtx, args)
      case 'get_kyc_status': return execGetKycStatus(actionCtx, args)
      case 'get_publication_status': return execGetPublicationStatus(actionCtx, args)
      case 'prepare_meeting': return execPrepareMeeting(actionCtx, args)
      case 'suggest_priorities_today': return execSuggestPrioritiesToday(webCtx, args)
      case 'get_analytics_snapshot': return execGetAnalyticsSnapshot(webCtx, args)
      case 'get_market_stats': return execGetMarketStats(webCtx, args)
      // Écritures auto (Phase 4a) — exécutées seulement si la boucle l'autorise
      // (allowWrites) ; le tier 'auto' garde ce filet même si un tool était nommé.
      case 'create_reminder': return execWebCreateReminder(webCtx, args)
      case 'add_note': return execWebAddNote(webCtx, args)
      // Annonce : rédaction (read) + montage du bien (auto). Exécuteurs partagés
      // WhatsApp, scopés agence au SQL, audités via='web'. La boucle n'exécute
      // create_property/update_property (auto) que si les écritures sont autorisées.
      case 'draft_listing_copy': return execDraftListingCopy(actionCtx, args)
      case 'create_property': return execCreateProperty(actionCtx, args)
      case 'update_property': return execUpdateProperty(actionCtx, args)
      case 'attach_property_photos': return execWebAttachPropertyPhotos(actionCtx, args)
      default: return `Outil inconnu: ${name}`
    }
  }
}

// ─── Publication (tier confirm) : préparation + stash HITL ────────────────────
// Le tier 'confirm' (publish_to_portals / withdraw_from_portals) n'est JAMAIS exécuté
// dans la boucle. Il est PRÉPARÉ ici (aperçu déterministe + charge figée), stashé dans
// copilot_pending_actions, puis validé par l'agent via une carte (action execute_pending).

/** Carte de validation renvoyée au panneau après stash (id DB + aperçu). */
interface StashedPending { id: string; kind: string; title: string | null; portals: string[]; preview: string }

/** Adapte les prepare de whatsapp-actions au contrat PrepareConfirmResult de la boucle. */
function makePrepareConfirm(ctx: ActionCtx) {
  return async (name: string, args: Record<string, unknown>): Promise<PrepareConfirmResult> => {
    let prep: Prepared
    if (name === 'publish_to_portals') prep = await preparePublishToPortals(ctx, args)
    else if (name === 'withdraw_from_portals') prep = await prepareWithdrawFromPortals(ctx, args)
    else if (name === 'delete_contact') prep = await prepareDeleteContact(ctx, args)
    else return { ok: false, error: `Action non préparable ici : ${name}` }
    if (!prep.ok) return { ok: false, error: prep.error }
    // preview obligatoire pour la carte ; publication et suppression le fournissent toujours.
    if (!prep.preview) return { ok: false, error: "Aperçu indisponible pour cette action." }
    return {
      ok: true,
      kind: prep.kind ?? 'confirm',
      payload: prep.payload,
      preview: prep.preview,
      title: (typeof prep.payload.title === 'string' ? prep.payload.title : null),
    }
  }
}

/** Fige l'action confirm préparée dans copilot_pending_actions (TTL 15 min). INSERT d'une
 *  ligne PROPRE par carte (id immuable) — surtout PAS d'upsert sur user_id : sinon une 2e
 *  préparation écraserait la charge d'une carte déjà affichée dans un autre onglet, et le
 *  clic « Publier » enverrait un bien différent de l'aperçu validé. Renvoie la carte (id +
 *  aperçu) à afficher, ou null si le stash échoue (pas de carte → l'agent reformule).
 *  Best-effort : jamais bloquant pour la réponse. */
async function stashPendingAction(
  admin: SupabaseClient, userId: string, agencyId: string | null,
  pending: PendingAction, lang: string,
): Promise<StashedPending | null> {
  const portals = Array.isArray(pending.payload.portals)
    ? pending.payload.portals.filter((x): x is string => typeof x === 'string')
    : []
  try {
    // Purge paresseuse des cartes expirées (table minuscule, bornée par le TTL).
    await admin.from('copilot_pending_actions').delete().lt('expires_at', new Date().toISOString())
    const { data, error } = await admin.from('copilot_pending_actions').insert({
      user_id: userId,
      agency_id: agencyId,
      kind: pending.kind,
      tool: pending.tool,
      payload: { ...pending.payload, __lang: lang },
      preview: pending.preview,
      title: pending.title ?? null,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }).select('id').single()
    if (error || !data) return null
    return { id: data.id as string, kind: pending.kind, title: pending.title ?? null, portals, preview: pending.preview }
  } catch {
    return null
  }
}

// ─── Exécution d'une action confirm validée par l'agent (execute_pending) ─────
// Appelé quand l'agent clique « Publier » / « Retirer » sur la carte. CONSOMME la carte
// ATOMIQUEMENT (DELETE...RETURNING scopé à l'agent du JWT = winner-takes-all, pas de double
// exécution) puis rejoue la charge figée via l'exécuteur partagé (via='web'). Sur ÉCHEC, la
// carte est réinsérée (même id/charge/TTL) → retry possible. Rien ne part au portail sans ce
// clic. Gated copilot_publish_enabled.
async function handleExecutePending(params: {
  auth: AgentAuthContext
  pendingId: string
  language: string
}): Promise<Response> {
  const { auth, pendingId, language } = params
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  // Flags lus au moment de l'exécution (coupés entre préparer et valider = refus). Le gate
  // PRÉCIS dépend de l'outil de la carte (publication vs suppression) et se fait après la
  // consommation atomique, une fois row.tool connu.
  let publishOn = false, deleteOn = false
  try {
    const { data: flags } = await auth.supabase
      .from('app_config').select('key, value').in('key', ['copilot_tools_enabled', 'copilot_publish_enabled', 'copilot_delete_enabled'])
    const val = (k: string) => flags?.find((f) => f.key === k)?.value
    const toolsOn = val('copilot_tools_enabled') === 'true'
    publishOn = toolsOn && val('copilot_publish_enabled') === 'true'
    deleteOn = toolsOn && val('copilot_delete_enabled') === 'true'
    if (!toolsOn) return json({ error: 'Les actions du copilote sont désactivées.' }, 403)
  } catch {
    return json({ error: 'Impossible de vérifier la configuration.' }, 500)
  }

  if (!pendingId || typeof pendingId !== 'string') return json({ error: 'pending_id requis.' }, 400)

  // CONSOMME la carte ATOMIQUEMENT (winner-takes-all, comme le canal WhatsApp F3) :
  // DELETE ... RETURNING scopé à l'agent du JWT. Deux execute_pending concurrents tentent
  // la même ligne mais UNE SEULE la voit revenir → une seule exécute (pas de double audit
  // sur le trail append-only LBA) ; le perdant reçoit 404. Sur ÉCHEC métier, la carte est
  // réinsérée plus bas pour préserver le retry.
  const { data: rows, error: delErr } = await auth.supabase
    .from('copilot_pending_actions')
    .delete()
    .eq('id', pendingId)
    .eq('user_id', auth.user.id)
    .select('kind, tool, payload, preview, title, expires_at, agency_id')
  if (delErr) return json({ error: "Impossible de lire l'action en attente." }, 500)
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) return json({ error: 'Action introuvable ou déjà traitée.' }, 404)
  if (Date.parse(String(row.expires_at)) <= Date.now()) {
    return json({ error: 'Cette action a expiré — relance-la depuis le panneau.' }, 410)
  }

  // Gate PRÉCIS par capacité (la carte a pu être créée quand la capacité était on puis coupée).
  // Si la capacité de CETTE action est off, on RÉINSÈRE la carte consommée (même id/charge/TTL)
  // et on refuse — rien n'a été exécuté.
  const capOk = row.tool === 'delete_contact' ? deleteOn : publishOn
  if (!capOk) {
    try {
      await auth.supabase.from('copilot_pending_actions').insert({
        id: pendingId, user_id: auth.user.id, agency_id: row.agency_id,
        kind: row.kind, tool: row.tool, payload: row.payload,
        preview: row.preview, title: row.title, expires_at: row.expires_at,
      })
    } catch { /* réinsertion best-effort */ }
    return json({ error: row.tool === 'delete_contact' ? 'La suppression est désactivée.' : 'La publication est désactivée.' }, 403)
  }

  const payload = (row.payload ?? {}) as Record<string, unknown>
  const lang = (typeof payload.__lang === 'string' ? payload.__lang : language) === 'en' ? 'en' : 'fr'
  const ctx: ActionCtx = {
    supabase: auth.supabase,
    profileId: auth.user.id,
    agencyId: auth.profile.agency_id,
    lang,
    via: 'web',
  }

  // Contrat {ok,message} : on distingue succès et échec métier → l'UI n'affiche un
  // succès (« publié ») QUE si ok. `retryable:false` (suppression d'un contact déjà parti)
  // = échec DÉFINITIF → on ne réarme pas la carte (sinon elle traînerait jusqu'au TTL).
  let outcome: { ok: boolean; message: string; retryable?: boolean }
  try {
    if (row.tool === 'publish_to_portals') outcome = await executePublishToPortals(ctx, payload)
    else if (row.tool === 'withdraw_from_portals') outcome = await executeWithdrawFromPortals(ctx, payload)
    else if (row.tool === 'delete_contact') outcome = await executeDeleteContact(ctx, payload)
    else outcome = { ok: false, message: lang === 'en' ? 'Unknown action.' : 'Action inconnue.' }
  } catch (e) {
    outcome = { ok: false, message: (lang === 'en' ? 'Action failed: ' : "Échec de l'action : ") + ((e as Error)?.message ?? 'inconnue') }
  }

  // La carte a été consommée par le claim atomique. Sur ÉCHEC métier RÉESSAYABLE, on la
  // RÉINSÈRE (même id, même charge, même TTL d'origine) pour permettre un nouvel essai depuis
  // la carte — sans avoir doublé l'exécution ni l'audit. Best-effort. Un échec DÉFINITIF
  // (retryable:false — ex. contact déjà supprimé) NE réinsère PAS : réessayer échouerait
  // à l'identique et la carte traînerait jusqu'au TTL ; on la laisse consommée (un nouveau
  // clic → 404, la modale se ferme).
  if (!outcome.ok && outcome.retryable !== false) {
    try {
      await auth.supabase.from('copilot_pending_actions').insert({
        id: pendingId, user_id: auth.user.id, agency_id: row.agency_id,
        kind: row.kind, tool: row.tool, payload: row.payload,
        preview: row.preview, title: row.title, expires_at: row.expires_at,
      })
    } catch { /* réinsertion best-effort : si elle échoue, l'agent reformulera */ }
  }

  // Audit copilote FIDÈLE au résultat réel (l'exécuteur écrit en plus l'audit métier
  // property_published_to_portal sur le seul chemin de succès).
  await logAiCopilotInteraction({
    admin: auth.supabase,
    agencyId: auth.profile.agency_id,
    action: 'execute_pending',
    context: {},
    tokens: {},
    success: outcome.ok,
    toolsUsed: [{ name: String(row.tool), ok: outcome.ok }],
  })

  return json({ result: outcome.message, ok: outcome.ok })
}

// ─── Savoir métier vérifié : chargement + sélection déterministe ─────────────
// Best-effort (jamais bloquant). Gated par app_config `copilot_knowledge_enabled`
// (défaut OFF par absence). Fetch des snippets ACTIFS non-expirés (table minuscule,
// SELECT trivial via service-role) puis sélection PURE (knowledge-retrieval.ts).
async function loadKnowledge(params: {
  admin: SupabaseClient
  message: string
  action: string
  canton: string | null
  lang: 'fr' | 'en'
}): Promise<{ block: string; injected: KnowledgeSnippet[]; enabled: boolean }> {
  try {
    const { data: flag } = await params.admin
      .from('app_config').select('value').eq('key', 'copilot_knowledge_enabled').maybeSingle()
    if (flag?.value !== 'true') return { block: '', injected: [], enabled: false }

    const today = new Date().toISOString().slice(0, 10)
    const { data } = await params.admin
      .from('knowledge_snippets')
      .select('slug, domain, canton, title, body_md, applies_to_actions, keywords, priority, source_ref, source_url, verified_at, review_after')
      .eq('status', 'active')
      .or(`review_after.is.null,review_after.gte.${today}`)
      .limit(200)
    if (!data?.length) return { block: '', injected: [], enabled: true }

    const selected = selectKnowledge(data as KnowledgeSnippet[], params.message, {
      action: params.action, canton: params.canton, maxSnippets: 3, budgetTokens: 700,
    })
    return { block: formatKnowledgeBlock(selected, params.lang), injected: selected, enabled: true }
  } catch {
    return { block: '', injected: [], enabled: false } // best-effort — jamais bloquer la réponse
  }
}

// ─── Assemblage du system prompt (style + personnalisation agent) ────────────
async function buildSystemPrompt(params: {
  auth: AgentAuthContext
  language: string
  toolsOn: boolean
  writesOn: boolean
  publishOn: boolean
  deleteOn: boolean
}): Promise<string> {
  const { auth, language, toolsOn, writesOn, publishOn, deleteOn } = params
  let systemPrompt = MEGGA_SYSTEM
  systemPrompt += `\n\n${MEGGA_STYLE_BLOCK}`
  if (toolsOn) systemPrompt += copilotToolsBlock(writesOn, publishOn, deleteOn)

  // Ancrage temporel : indispensable pour résoudre « demain », « cette semaine »
  // en ISO 8601 (get_my_agenda) et dater correctement les réponses.
  // CACHE CONTEXTE : seule l'INSTRUCTION (statique) reste ici, dans le préfixe. La VALEUR
  // horodatée (change à la minute) est ajoutée en tout dernier, après les blocs de
  // personnalisation, pour que le préfixe stable du cache DeepSeek couvre tout le volume.
  systemPrompt += `\n\nConvertis toute date relative en ISO 8601 avec le décalage suisse, en te basant sur la date/heure actuelle indiquée en fin de message.`

  if (language !== 'fr') systemPrompt += `\n\nLangue de réponse : ${language}`

  // Personnalisation (Day 0 + style appris + voix + corrections). Best-effort.
  try {
    const sb = auth.supabase
    const { data: aiProfile } = await sb
      .from('agent_ai_profiles')
      .select('brief, learned_style')
      .eq('agent_id', auth.user.id)
      .maybeSingle()
    const addendum = (aiProfile?.brief as { system_addendum?: string } | null)?.system_addendum
    if (typeof addendum === 'string' && addendum.trim()) {
      systemPrompt += `\n\n--- Contexte de l'agent (calibrage Day 0) ---\n${addendum.trim()}`
    }
    const styleBlock = formatStyleBlock((aiProfile?.learned_style as LearnedStyle | null) ?? null)
    if (styleBlock) systemPrompt += styleBlock

    const voiceLang = language === 'en' ? 'en' : 'fr'
    // Mimétisme de voix : vrais messages clients de l'agence (few-shot), pour les brouillons client.
    // PII : ces corps proviennent de whatsapp_messages (stockés bruts) — un agent a pu y taper un
    // IBAN/N° AVS. On les rédige AVANT injection dans le prompt LLM, comme message/contexte/historique
    // (même invariant « aucune PII sensible vers DeepSeek »). La rédaction préserve le TON (seuls les
    // identifiants sensibles → [REDACTED:*]), ce qui est exactement ce que le mimétisme exploite.
    const voiceSamples = (await fetchClientVoiceSamples(sb, auth.profile.agency_id, { profileId: auth.user.id }))
      .map((s) => ({ body: redactPII(s.body).redactedText }))
    const rawVoice = formatVoiceExamples(voiceSamples, voiceLang)
    if (rawVoice) {
      systemPrompt += voiceLang === 'en'
        ? `\n\nWhen you draft a CLIENT-FACING message (email/listing), mirror this tone; for internal analysis keep your usual style.${rawVoice}`
        : `\n\nQuand tu rédiges un message DESTINÉ À UN CLIENT (email/annonce), copie ce ton ; pour l'analyse interne, garde ton style habituel.${rawVoice}`
    }
    // Apprentissage T2 : corrections passées de l'agent (brouillon rejeté →
    // message envoyé), même pipeline que whatsapp-agent. Rédigées aussi (même raison).
    const corrections = (await fetchCorrectionExamples(sb, auth.user.id))
      .map((c) => ({ draft: redactPII(c.draft).redactedText, final: redactPII(c.final).redactedText }))
    systemPrompt += formatCorrectionExamples(corrections, voiceLang)
  } catch (_) {
    // personnalisation optionnelle — ne jamais bloquer la réponse IA
  }

  // Horodatage volatil en DERNIER (voir note CACHE CONTEXTE plus haut) : tout le préfixe
  // ci-dessus (système + style + outils + personnalisation) reste stable d'une minute à
  // l'autre ; seul ce court suffixe daté change, donc le cache n'est invalidé que là.
  const nowZurich = new Date().toLocaleString('fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'full', timeStyle: 'short' })
  systemPrompt += `\n\nDate/heure actuelles (Europe/Zurich) : ${nowZurich}.`

  return systemPrompt
}

// ─── Briefing matinal (Phase 3) ──────────────────────────────────────────────
// Assemble le snapshot SERVEUR (file Focus + objectif + rappels du jour) via un
// client scopé au JWT (RPC SECURITY DEFINER → agence dérivée du token), remplace
// les noms de contacts par des jetons {{Cn}}, demande à DeepSeek un briefing de
// 3-5 priorités, puis re-substitue les vrais noms côté edge. DeepSeek ne voit
// jamais un nom. Gated. Fallback déterministe si DeepSeek échoue.
async function handleDailyBrief(params: {
  auth: AgentAuthContext
  deepseekApiKey: string
  language: string
  token: string
}): Promise<Response> {
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  // Kill-switch (défaut OFF par absence).
  try {
    const { data: flag } = await params.auth.supabase
      .from('app_config').select('value').eq('key', 'copilot_briefing_enabled').maybeSingle()
    if (flag?.value !== 'true') return json({ result: '', disabled: true })
  } catch { return json({ result: '', disabled: true }) }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${params.token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Assemblage du snapshot (agence dérivée du JWT par les RPC SECURITY DEFINER).
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(); end.setHours(23, 59, 59, 999)
  const [focusRes, cockpitRes, objectifRes, remindersRes] = await Promise.all([
    userClient.rpc('focus_top_matches', { p_limit: 6 }),
    userClient.rpc('analytics_cockpit', { p_period: 'month', p_scope: 'me' }),
    userClient.rpc('analytics_objectif', { p_period: 'month', p_scope: 'me' }),
    // On ne lit QUE le type (jamais message_template : texte libre à noms en dur).
    userClient.from('reminders').select('type')
      .eq('status', 'pending').gte('trigger_at', start.toISOString()).lte('trigger_at', end.toISOString()).limit(10),
  ])

  const focus = (focusRes.data ?? []) as BriefFocusRow[]
  const pseudo = createPseudonymizer()
  const reminderTypes = (remindersRes.error ? [] : (remindersRes.data ?? []))
    .map((r) => String(r.type))

  // Assemblage pseudonymisé (module PUR testé) : noms de contacts ET titres de
  // biens → jetons ; `contributors` (noms d'acheteurs) retiré des agrégats ;
  // rappels réduits à des libellés de type. DeepSeek ne verra que des jetons {{Cn}},
  // re-substitués par les vraies valeurs après génération.
  const { snapshot, itemCount, reminderCount } = buildBriefSnapshot({
    focus,
    cockpit: (cockpitRes.error ? {} : cockpitRes.data) as Record<string, unknown>,
    objectif: (objectifRes.error ? {} : objectifRes.data) as Record<string, unknown>,
    reminderTypes,
    pseudo,
  })

  // Rien à dire → pas de briefing (le client n'affiche rien).
  if (!itemCount && !reminderCount) return json({ result: '', empty: true })

  const briefingPrompt = `Tu es MEGGA AI. Rédige le BRIEFING MATINAL de l'agent, en te basant UNIQUEMENT sur le snapshot ci-dessous (n'invente aucun contact, chiffre ou fait).
Format : une phrase d'accroche courte, puis 3 à 5 priorités numérotées. Chaque priorité = le contact concerné + POURQUOI c'est prioritaire (avec le chiffre du snapshot) + l'action concrète suggérée.
Ton direct et sobre, tutoiement de l'agent, format suisse (CHF 720'000). Pas de remplissage.
IMPÉRATIF : garde les jetons {{C1}}, {{C2}}… EXACTEMENT tels quels (ne les traduis pas, ne les remplace pas par un nom).
${params.language === 'en' ? 'Answer in English.' : ''}

SNAPSHOT :
${snapshot}`

  // Fallback déterministe (vrais noms, aucun LLM) si DeepSeek échoue.
  const fallback = () => {
    const lines = focus.slice(0, 5).map((r, i) => {
      const who = (r.contact_name || 'Contact').trim()
      const why = r.kyc_days_to_expiry != null ? `KYC expire dans ${r.kyc_days_to_expiry}j`
        : r.property_title ? `match sur « ${r.property_title} »` : 'à traiter'
      return `${i + 1}. ${who} — ${why}.`
    })
    return lines.length ? `Tes priorités du jour :\n${lines.join('\n')}` : ''
  }

  let generated = false
  let text = ''
  const started = Date.now()
  try {
    const r = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.deepseekApiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat', max_tokens: 800,
        messages: [
          { role: 'system', content: `${MEGGA_SYSTEM}\n\n${MEGGA_STYLE_BLOCK}` },
          { role: 'user', content: briefingPrompt },
        ],
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    })
    if (r.ok) {
      const d = await r.json()
      logDeepSeekUsageWith(params.auth.supabase, d?.usage, {
        edgeFunction: 'ai-copilot', module: 'copilot-daily-brief',
        latencyMs: Date.now() - started, agencyId: params.auth.profile.agency_id,
      })
      const raw = d.choices?.[0]?.message?.content || ''
      // Re-substitution des vraies valeurs APRÈS génération (DeepSeek n'a vu que
      // des jetons). Si DeepSeek a mutilé un jeton (accolades cassées, traduction)
      // et qu'un {{Cn}} SUBSISTE, on préfère le fallback déterministe propre à un
      // briefing avec un placeholder visible.
      const restored = pseudo.restore(meggaProse(raw))
      if (!/\{\{\s*C\d+\s*\}\}/.test(restored)) {
        text = restored
        generated = text.trim().length > 0
      }
    }
  } catch { /* fallback ci-dessous */ }

  if (!generated) text = fallback()
  if (!text.trim()) return json({ result: '', empty: true })

  // Audit LBA (actor_kind='ai', sans entité précise).
  try {
    await params.auth.supabase.from('activity_events').insert({
      agency_id: params.auth.profile.agency_id, actor_id: null, actor_kind: 'ai',
      action: 'MEGGA AI — daily_brief', entity_type: 'ai_chat', entity_id: null,
      metadata: { copilot_action: 'daily_brief', generated, priorities: itemCount },
    })
  } catch { /* best-effort */ }

  return json({ result: text, generated })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── Auth réelle (Phase 0) : JWT vérifié, identité dérivée serveur. ─────────
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth

  try {
    const body: CopilotRequest = await req.json()
    const { action = 'chat', message, context, history = [], language = 'fr', conversation_id = null, persist = false, stream = false } = body

    if (!message && action === 'chat') {
      return new Response(
        JSON.stringify({ error: 'message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Moteur DeepSeek (deepseek-chat) — décision coût : MEGGA AI tourne sur
    // DeepSeek (~16x moins cher que Claude). Le nom exposé reste "MEGGA AI".
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) {
      return new Response(
        JSON.stringify({ error: 'DEEPSEEK_API_KEY non configurée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Briefing matinal (Phase 3) : flux dédié — assemblage SERVEUR du snapshot
    // (priorités, objectif, rappels), PSEUDONYMISATION des noms avant DeepSeek,
    // génération, re-substitution des vrais noms côté edge. DeepSeek ne voit jamais
    // une PII client. Gated app_config `copilot_briefing_enabled` (OFF par défaut).
    if (action === 'daily_brief') {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
      return await handleDailyBrief({ auth, deepseekApiKey, language, token })
    }

    // ── Exécution d'une action confirm VALIDÉE par l'agent (clic « Publier » / « Retirer »
    // sur la carte). Consomme copilot_pending_actions (scopée à l'agent) et rejoue la
    // charge figée via l'exécuteur de publication (via='web'). Gated copilot_publish_enabled.
    if (action === 'execute_pending') {
      return await handleExecutePending({ auth, pendingId: body.pending_id ?? '', language })
    }

    // ── Rédaction PII (Phase 0) : identifiants sensibles masqués AVANT le LLM
    // (et avant la persistance). Le résumé des substitutions part dans l'audit.
    const red = redactCopilotRequest({ message: message || '', context, history })

    // ── Outils CRM (Phase 1) : flag kill-switch, OFF par défaut (clé absente).
    // detect_intent reste un one-shot JSON strict, sans outils. Les ÉCRITURES
    // (Phase 4a : create_reminder/add_note, tier 'auto') exigent un 2e flag
    // copilot_writes_enabled ET les outils actifs. Jamais d'envoi client.
    let toolsOn = false
    let writesOn = false
    let publishOn = false
    let deleteOn = false
    if (action !== 'detect_intent') {
      try {
        const { data: flags } = await auth.supabase
          .from('app_config').select('key, value').in('key', ['copilot_tools_enabled', 'copilot_writes_enabled', 'copilot_publish_enabled', 'copilot_delete_enabled'])
        const val = (k: string) => flags?.find((f) => f.key === k)?.value
        toolsOn = val('copilot_tools_enabled') === 'true'
        writesOn = toolsOn && val('copilot_writes_enabled') === 'true'
        // Publication externe (immobilier.ch) : 3e flag, indépendant des écritures
        // internes. Confirm-tier → jamais exécutée dans la boucle (validée par carte HITL).
        publishOn = toolsOn && val('copilot_publish_enabled') === 'true'
        // Suppression de contact : 4e flag, indépendant. Confirm-tier + destructif →
        // jamais dans la boucle, validé par carte HITL (execute_pending). OFF par défaut.
        deleteOn = toolsOn && val('copilot_delete_enabled') === 'true'
      } catch { toolsOn = false; writesOn = false; publishOn = false; deleteOn = false }
    }

    const systemPrompt = await buildSystemPrompt({ auth, language, toolsOn, writesOn, publishOn, deleteOn })

    // ── Savoir métier vérifié (Phase 2) : retrieval déterministe de snippets
    // juridiques suisses SOURCÉS + DATÉS, injectés selon l'intent. Gated par
    // app_config `copilot_knowledge_enabled` ; 0 match ou flag OFF = aucun bloc
    // (comportement inchangé). Les snippets injectés servent aussi la garde
    // anti-citation-inventée sur la réponse. detect_intent exclu (classifieur JSON).
    let knowledgeBlock = ''
    let injectedSnippets: KnowledgeSnippet[] = []
    let knowledgeOn = false
    if (action !== 'detect_intent') {
      const k = await loadKnowledge({
        admin: auth.supabase,
        message: red.message,
        action,
        canton: (context?.canton as string | undefined) ?? null,
        lang: language === 'en' ? 'en' : 'fr',
      })
      knowledgeBlock = k.block
      injectedSnippets = k.injected
      knowledgeOn = k.enabled
    }

    // Photos jointes par l'agent (copilote web) : URLs DÉJÀ stagées dans property-photos
    // (préfixe agence). Elles vont à l'exécuteur attach_property_photos, JAMAIS au LLM ;
    // seul un indice de COMPTAGE est injecté pour qu'il pense à appeler l'outil. Lues du
    // contexte ORIGINAL (des URLs, pas de PII à rédiger). N'ont d'effet que sous écritures.
    const attachedPhotos = Array.isArray((context as Record<string, unknown> | undefined)?.attached_photos)
      ? ((context as Record<string, unknown>).attached_photos as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 0)
      : []
    // Les URLs de photos ne partent JAMAIS au LLM (serializeContext dumperait le contexte) :
    // on les retire du contexte sérialisé dans le prompt ; elles ne vivent que dans
    // ctx.attachedPhotos, côté exécuteur. Seul l'indice de comptage ci-dessous les évoque.
    if (red.context && typeof red.context === 'object') {
      delete (red.context as Record<string, unknown>).attached_photos
    }

    let userContent = buildUserContent({ action, message: red.message, context: red.context, actionPrompts: ACTION_PROMPTS })
    if (knowledgeBlock) userContent += knowledgeBlock
    if (attachedPhotos.length && writesOn) {
      userContent += `\n\n[${attachedPhotos.length} photo(s) jointe(s) à ce message — pour les attacher à un bien, appelle attach_property_photos en précisant le bien (query).]`
    }

    const baseMessages: LoopMessage[] = [
      { role: 'system', content: systemPrompt },
      ...red.history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ]

    // Contexte d'outils : service-role (données marché, exécuteurs scopés agence
    // au SQL) + client scopé au JWT (RPC SECURITY DEFINER dérivant l'agence).
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const actionCtx: ActionCtx = {
      supabase: auth.supabase,
      profileId: auth.user.id,
      agencyId: auth.profile.agency_id,
      lang: language === 'en' ? 'en' : 'fr',
      via: 'web',
      attachedPhotos,
    }
    const webCtx: WebToolCtx = {
      supabase: auth.supabase,
      userClient,
      profileId: auth.user.id,
      agencyId: auth.profile.agency_id,
    }
    const runTool = makeRunTool(actionCtx, webCtx)

    // ── Un tour complet (boucle d'outils ou appel simple) + post-traitements. ──
    const runTurn = async (emit: (ev: LoopEvent) => void): Promise<{
      final: string
      usage: { input: number; output: number }
      conversationId: string | null
      toolsUsed: Array<{ name: string; ok: boolean }>
      degraded?: string
      pending?: StashedPending | null
    }> => {
      let text = ''
      let usage = { input: 0, output: 0 }
      let toolsUsed: Array<{ name: string; ok: boolean }> = []
      let degraded: string | undefined
      let pending: StashedPending | null = null
      let stashFailed = false

      if (toolsOn) {
        const catalog = copilotTools(writesOn, publishOn, deleteOn)
        const res = await runAgentLoop({
          callModel: makeCallModel({ apiKey: deepseekApiKey, tools: catalog, wantStream: stream, emit, client: auth.supabase, agencyId: auth.profile.agency_id, module: 'copilot' }),
          runTool,
          tierOf: webToolTier,
          allowWrites: writesOn,
          // Actions confirm (publication OU suppression) : préparées puis surfacées en carte
          // HITL, jamais exécutées dans la boucle. Absent si aucune n'est activée.
          prepareConfirm: (publishOn || deleteOn) ? makePrepareConfirm(actionCtx) : undefined,
          emit,
          maxTurns: MAX_TURNS,
          maxToolCalls: MAX_TOOL_CALLS,
          budgetMs: LOOP_BUDGET_MS,
        }, baseMessages)
        text = res.text
        usage = res.usage
        toolsUsed = res.toolsUsed
        degraded = res.degraded
        if (!text && res.degraded === 'model_error') throw new Error('Le moteur IA est indisponible, réessayez.')
        // Action confirm préparée → on la FIGE en base ; elle repartira au panneau
        // comme carte de validation. Rien n'est publié tant que l'agent ne clique pas.
        if (res.pending) {
          pending = await stashPendingAction(auth.supabase, auth.user.id, auth.profile.agency_id, res.pending, actionCtx.lang ?? 'fr')
          // Le modèle a été orienté vers « valide dans le panneau » ; si le stash échoue
          // (aucune carte affichable), on le dira honnêtement dans le texte final.
          stashFailed = !pending
        }
      } else {
        const turn = await makeCallModel({
          apiKey: deepseekApiKey,
          tools: null,
          responseFormat: action === 'detect_intent' ? 'json_object' : undefined,
          wantStream: stream,
          emit,
          client: auth.supabase,
          agencyId: auth.profile.agency_id,
          module: action === 'detect_intent' ? 'copilot-detect-intent' : 'copilot',
        })(baseMessages, false)
        if (!turn) throw new Error('Le moteur IA est indisponible, réessayez.')
        text = turn.content
        usage = { input: turn.usage?.prompt_tokens ?? 0, output: turn.usage?.completion_tokens ?? 0 }
      }

      // detect_intent renvoie du JSON strict : pas de normalisation de prose.
      // Garde réponse vide (dégradation modèle) : jamais un `final` vide côté chat,
      // sinon la bulle s'affiche vide (le client garde son accumulation, mais on
      // sécurise aussi le mode JSON one-shot et la persistance).
      const normalized = action === 'detect_intent' ? text : meggaProse(text)
      let final = action === 'detect_intent'
        ? normalized
        : (normalized.trim() ? normalized : "Je n'ai pas pu générer de réponse cette fois. Reformule ou réessaie.")

      // Carte de validation attendue mais non stashée (échec DB) → ne pas laisser le texte
      // inviter l'agent à valider une carte qui n'apparaîtra pas.
      if (stashFailed && action !== 'detect_intent') {
        // Neutre (publication OU suppression passent par cette carte) : ne présume pas
        // du type d'action — « publier » induisait en erreur une demande de suppression.
        final += language === 'en'
          ? "\n\n(I couldn't prepare the validation card — restate your request.)"
          : "\n\n(Je n'ai pas pu préparer la carte de validation — reformule ta demande.)"
      }

      // Garde anti-citation-inventée (Phase 2) : quand le savoir vérifié est actif,
      // une référence légale précise (article, loi nommée) absente des snippets
      // injectés reçoit un avertissement DOUX suffixé (jamais bloquant, jamais de
      // réécriture). Sans savoir actif : comportement inchangé.
      if (knowledgeOn && action !== 'detect_intent') {
        const warn = unsourcedCitationWarning(final, injectedSnippets, language === 'en' ? 'en' : 'fr')
        if (warn) final += warn
      }

      await logAiCopilotInteraction({
        admin: auth.supabase,
        agencyId: auth.profile.agency_id,
        action,
        context: context ?? {},
        tokens: { input: usage.input, output: usage.output },
        success: true,
        toolsUsed,
        redactions: red.summary || undefined,
        streamed: stream,
        degraded,
      })

      let conversationId: string | null = null
      if (persist) {
        conversationId = await maybePersistConversation({
          admin: auth.supabase,
          userId: auth.user.id,
          agencyId: auth.profile.agency_id,
          conversationId: conversation_id,
          userMessage: red.message,
          assistantMessage: final,
        })
      }

      return { final, usage, conversationId, toolsUsed, degraded, pending }
    }

    // ── Mode SSE : tokens + phases d'outils en direct. ──────────────────────
    if (stream) {
      const enc = new TextEncoder()
      const sseBody = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (ev: Record<string, unknown>) => {
            try { controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`)) } catch { /* flux fermé */ }
          }
          void (async () => {
            try {
              const out = await runTurn((ev) => send(ev as unknown as Record<string, unknown>))
              // Carte de validation (publication en attente) AVANT le done : le panneau
              // ouvre la modale d'aperçu ; rien n'est publié sans le clic de l'agent.
              if (out.pending) {
                send({
                  type: 'pending_action',
                  id: out.pending.id, kind: out.pending.kind, title: out.pending.title,
                  portals: out.pending.portals, preview: out.pending.preview,
                })
              }
              send({
                type: 'done',
                final: out.final,
                conversation_id: out.conversationId,
                usage: { input_tokens: out.usage.input, output_tokens: out.usage.output },
              })
            } catch (err) {
              send({ type: 'error', message: err instanceof Error ? err.message : 'Erreur interne' })
            } finally {
              try { controller.close() } catch { /* déjà fermé */ }
            }
          })()
        },
      })
      return new Response(sseBody, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    // ── Mode JSON (compat : actions one-shot, anciens appelants). ───────────
    const out = await runTurn(() => {})
    return new Response(
      JSON.stringify({
        result: out.final,
        action,
        conversation_id: out.conversationId,
        usage: { input_tokens: out.usage.input, output_tokens: out.usage.output },
        // Carte de validation (publication en attente) pour le repli JSON du panneau.
        pending_action: out.pending
          ? { id: out.pending.id, kind: out.pending.kind, title: out.pending.title, portals: out.pending.portals, preview: out.pending.preview }
          : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
