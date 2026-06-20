// Logique PURE de l'historique des conversations copilote (chantier B · phase 3).
// Zéro I/O, zéro React — testable seule. Le hook `useConversationHistory` gère le
// fetch RLS-scopé ; ce module ne fait que normaliser/filtrer/mapper côté présentation.

export interface ConversationSummary {
  id: string
  title: string
  lastMessageAt: string
}

export interface ConversationChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Normalise pour comparer sans tenir compte de la casse ni des accents. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/**
 * Filtre les conversations dont le TITRE contient la requête (substring,
 * insensible casse/accents). Requête vide ⇒ liste vide (pas de bruit dans la
 * section « résultats »). Tronqué à `limit`. v1 = titre seul (la recherche dans
 * le corps des messages = sémantique pgvector, repoussée — voir plan phase 6).
 */
export function filterConversationsByTitle(
  list: ConversationSummary[],
  query: string,
  limit = 5,
): ConversationSummary[] {
  const q = norm(query)
  if (!q) return []
  return list.filter(c => norm(c.title).includes(q)).slice(0, limit)
}

/**
 * Garde uniquement les messages bien formés ({role:'user'|'assistant', content:string})
 * d'un payload jsonb non fiable — pour « reprendre » une conversation sans planter
 * sur une donnée corrompue.
 */
export function sanitizeStoredMessages(raw: unknown): ConversationChatMessage[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (m): m is ConversationChatMessage =>
      !!m &&
      typeof m === 'object' &&
      (((m as { role?: unknown }).role === 'user') || ((m as { role?: unknown }).role === 'assistant')) &&
      typeof (m as { content?: unknown }).content === 'string',
  )
}
