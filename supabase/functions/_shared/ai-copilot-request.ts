// supabase/functions/_shared/ai-copilot-request.ts
// Construction PURE de la requête copilote MEGGA AI — zéro I/O, zéro dépendance
// Deno/https. Réutilisé par l'edge function ai-copilot (Deno) ET les tests vitest
// (Node), pour couvrir le gap « les edge functions échappent à tsc/vitest ».
// Ne fait AUCUN appel LLM ni DB : ces effets restent dans index.ts.

import { redactLlmMessages } from './wa-agent-redaction.ts'

/** Sérialise le contexte CRM en bloc Markdown (ignore null / chaîne vide ;
 *  JSON.stringify pour les objets). Renvoie '' si rien à montrer. */
export function serializeContext(context: Record<string, unknown> | undefined): string {
  if (!context || Object.keys(context).length === 0) return ''
  return Object.entries(context)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n')
}

/** Construit le message utilisateur final : preset d'action (si ≠ chat et connu)
 *  + message + bloc contexte. Aucune I/O. `actionPrompts` injecté pour rester pur.
 *  `action` typé string (découplé de l'union CopilotAction d'index.ts). */
export function buildUserContent(params: {
  action: string
  message: string
  context?: Record<string, unknown>
  actionPrompts: Record<string, string>
}): string {
  let userContent = params.message || ''
  if (params.action !== 'chat' && params.actionPrompts[params.action]) {
    userContent = `**Instruction :** ${params.actionPrompts[params.action]}\n\n**Message :** ${params.message || 'Exécute cette action.'}`
  }
  const ctx = serializeContext(params.context)
  if (ctx) userContent += `\n\n**Contexte CRM actuel :**\n${ctx}`
  return userContent
}

/** Routage d'entité pour l'audit LBA/IA : priorité kyc > contact > property >
 *  transaction. Renvoie null si free chat (aucune entité CRM ⇒ pas de log). PUR. */
export function resolveAuditEntity(
  context: Record<string, unknown> | undefined,
): { entityType: 'kyc' | 'contact' | 'property' | 'transaction'; entityId: string } | null {
  const c = context ?? {}
  const kyc = c.kyc_case_id as string | undefined
  const contact = c.contact_id as string | undefined
  const property = c.property_id as string | undefined
  const transaction = c.transaction_id as string | undefined
  const entityId = kyc || contact || property || transaction
  if (!entityId) return null
  const entityType = kyc ? 'kyc' : contact ? 'contact' : property ? 'property' : 'transaction'
  return { entityType, entityId }
}

/**
 * Construit le corps de la requête DeepSeek du copilote.
 *
 * PII — point d'étranglement unique de la BOUCLE CONVERSATIONNELLE du copilote (miroir de
 * `callDeepSeek` côté whatsapp-agent). Portée exacte : tout ce que la boucle envoie, y compris la
 * passe finale forcée. Les autres appels DeepSeek atteignables depuis ai-copilot (daily-brief,
 * distillCrmTurn, draft_listing_copy, prepare_meeting) rédigent à leur propre frontière — ce
 * helper ne les couvre pas et n'a pas à le faire.
 *
 * Le trou fermé : `copilot-redaction` ne couvre que message + contexte + historique, donc seul le
 * PREMIER tour était propre. `agent-loop` réinjecte les résultats d'outils tels quels
 * (`{role:'tool', content}`), et `get_contact_brief` renvoie `contacts.notes` — du texte libre
 * saisi par l'agent, exactement là où un IBAN ou un N° AVS atterrit.
 *
 * La redaction vit ICI plutôt qu'à chaque site de push : un outil ajouté demain ne peut pas
 * rouvrir le trou. `redactLlmMessages` exclut `role:'system'` (déjà propre) et blinde les UUID,
 * qui sont des clés fonctionnelles d'outils et non des identifiants sensibles.
 *
 * Résidu connu : les arguments d'un tool_call émis par le modèle (`tool_calls[].function.arguments`)
 * ne sont pas rédigés — ils sont produits PAR DeepSeek à partir de ce qu'il a déjà reçu, donc la
 * boucle est fermée et rien de neuf ne lui est divulgué.
 */
export function buildCopilotModelBody(params: {
  messages: Array<Record<string, unknown>>
  /** Catalogue d'outils (typé `unknown[]` pour rester découplé d'index.ts). */
  tools?: unknown[] | null
  withTools?: boolean
  responseFormat?: 'json_object'
  maxTokens?: number
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: 'deepseek-chat',
    max_tokens: params.maxTokens ?? 2000,
    messages: redactLlmMessages(params.messages),
    // Toujours en flux : l'assemblage SSE est le seul chemin de lecture, `wantStream` ne
    // décide que de la ré-émission des événements vers le client.
    stream: true,
    stream_options: { include_usage: true },
  }
  if (params.tools) {
    body.tools = params.tools
    body.tool_choice = params.withTools ? 'auto' : 'none'
  }
  if (params.responseFormat) body.response_format = { type: params.responseFormat }
  return body
}
