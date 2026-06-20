// Lecture de l'historique des conversations agent ↔ copilote MEGGA AI.
// Chantier B · phase 3. RLS : l'agent ne voit que les SIENNES (policy owner-scoped,
// phase 1). AUCUN fallback mock — empty/error honnête. La liste reste VIDE tant que
// le writer (phase 2) n'est pas activé (flag app_config OFF) : c'est attendu.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  sanitizeStoredMessages,
  type ConversationSummary,
  type ConversationChatMessage,
} from '@/lib/conversation-history'

export type { ConversationSummary, ConversationChatMessage } from '@/lib/conversation-history'

/**
 * Conversations copilote récentes (non archivées), triées par dernier message.
 * Colonnes légères seulement (pas le jsonb `messages`) — règle perf : jamais de
 * colonne lourde en liste.
 */
export function useConversationHistory(limit = 20) {
  return useQuery({
    queryKey: ['copilot-conversations', limit],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data, error } = await supabase
        .from('ai_copilot_conversations')
        .select('id, title, last_message_at')
        .eq('archived', false)
        .order('last_message_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []).map(r => ({
        id: r.id,
        title: r.title,
        lastMessageAt: r.last_message_at,
      }))
    },
    staleTime: 30_000,
  })
}

export interface ConversationDetail {
  id: string
  title: string
  messages: ConversationChatMessage[]
}

/**
 * Messages d'une conversation (pour « reprendre » dans le copilote). Charge le
 * jsonb `messages` uniquement ici (1 conversation, pas une liste). Renvoie null
 * si l'id est absent ou la conversation introuvable/non possédée (RLS).
 */
export function useConversationMessages(id: string | null) {
  return useQuery({
    queryKey: ['copilot-conversation', id],
    enabled: !!id,
    queryFn: async (): Promise<ConversationDetail | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('ai_copilot_conversations')
        .select('id, title, messages')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        id: data.id,
        title: data.title,
        messages: sanitizeStoredMessages(data.messages),
      }
    },
  })
}
