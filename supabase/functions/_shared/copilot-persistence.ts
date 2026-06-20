// Persistance des conversations agent ↔ copilote MEGGA AI — ORCHESTRATION PURE.
//
// Chantier B · Phase 2. Réutilisé par l'edge function `ai-copilot` (Deno) ET par
// les tests vitest (Node) : ZÉRO I/O, ZÉRO dépendance Deno/https. La couche DB est
// injectée via l'interface `ConversationStore` — l'orchestration (créer vs append,
// titre, fusion des messages) est donc testable avec un faux store en mémoire.
//
// ⚠ Ce module n'AUTORISE rien : il exécute l'écriture demandée. Le double gate
// (flag app_config `copilot_persistence_enabled` + `persist:true` du client) vit
// dans l'edge function. Voir docs/system-map (chantier B) et la mémoire nLPD.

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface NewConversation {
  userId: string
  agencyId: string
  title: string
  messages: ConversationMessage[]
  lastMessageAt: string
}

/** Couche d'accès DB injectée — implémentée côté edge (service client) et côté test. */
export interface ConversationStore {
  /** Messages d'une conversation POSSÉDÉE par l'utilisateur, ou null si absente/non possédée. */
  load(conversationId: string, userId: string): Promise<ConversationMessage[] | null>
  /** Crée une conversation et renvoie son id. */
  create(conversation: NewConversation): Promise<string>
  /** Remplace `messages` + `last_message_at` d'une conversation POSSÉDÉE (filtre user). */
  append(conversationId: string, userId: string, messages: ConversationMessage[], lastMessageAt: string): Promise<void>
}

/** Longueur max du titre dérivé (troncature — un résumé LLM coûterait un appel). */
export const TITLE_MAX = 80

/** Plafond de messages stockés par conversation (garde-fou v1) : borne la taille
 *  du jsonb et le coût O(n) du cycle load→append ; au-delà, on élague les plus
 *  anciens. Le titre vit dans une colonne dédiée → jamais perdu par l'élagage. */
export const MAX_STORED_MESSAGES = 200

/** Titre v1 = 1er message utilisateur nettoyé puis tronqué. Jamais vide. */
export function buildConversationTitle(firstUserMessage: string): string {
  const clean = firstUserMessage.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Nouvelle conversation'
  return clean.length <= TITLE_MAX ? clean : `${clean.slice(0, TITLE_MAX - 1).trimEnd()}…`
}

/** Gate nLPD : le flag app_config est du TEXTE — seule la valeur exacte 'true'
 *  active la persistance. Toute autre valeur (ou clé absente ⇒ undefined) ⇒ OFF.
 *  Fail-safe : par défaut on ne persiste PAS de PII. */
export function persistenceFlagOn(value: unknown): boolean {
  return value === 'true'
}

export interface PersistTurnParams {
  /** Conversation à poursuivre, ou null pour en créer une. */
  conversationId: string | null
  userId: string
  agencyId: string
  userMessage: string
  assistantMessage: string
  /** Horodatage ISO injecté (testabilité déterministe). */
  now: string
}

/**
 * Persiste un tour (message utilisateur + réponse assistant).
 * - Sans `conversationId` (ou si l'id fourni est introuvable / non possédé) →
 *   CRÉE une conversation (titre = 1er message tronqué). Jamais d'écriture
 *   cross-user : `store.load` filtre déjà sur `userId`.
 * - Sinon → APPEND les deux messages à l'existant.
 * Renvoie l'id (nouveau ou réutilisé) que l'appelant doit conserver.
 */
export async function persistCopilotTurn(
  store: ConversationStore,
  p: PersistTurnParams,
): Promise<string> {
  const turn: ConversationMessage[] = [
    { role: 'user', content: p.userMessage },
    { role: 'assistant', content: p.assistantMessage },
  ]

  if (p.conversationId) {
    const existing = await store.load(p.conversationId, p.userId)
    if (existing) {
      const merged = [...existing, ...turn].slice(-MAX_STORED_MESSAGES)
      await store.append(p.conversationId, p.userId, merged, p.now)
      return p.conversationId
    }
    // id fourni mais introuvable/non possédé → on retombe sur création (sécurité).
  }

  return store.create({
    userId: p.userId,
    agencyId: p.agencyId,
    title: buildConversationTitle(p.userMessage),
    messages: turn,
    lastMessageAt: p.now,
  })
}
