// supabase/functions/_shared/ai-copilot-request.ts
// Construction PURE de la requête copilote MEGGA AI — zéro I/O, zéro dépendance
// Deno/https. Réutilisé par l'edge function ai-copilot (Deno) ET les tests vitest
// (Node), pour couvrir le gap « les edge functions échappent à tsc/vitest ».
// Ne fait AUCUN appel LLM ni DB : ces effets restent dans index.ts.

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
