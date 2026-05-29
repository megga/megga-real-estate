// MEGGA — Julien chat conversations persistence (PR #468).
//
// Persiste les conversations IA dans `ai_copilot_conversations` (table créée
// par migration 20260527110000). Une conversation = un agent + messages JSONB
// (array de {role, content, created_at}). RLS owner-only via user_id.
//
// Le hook expose 3 surfaces :
//   - useCopilotConversations()    → liste recente (50, archived=false)
//   - useCopilotConversation(id)   → conversation unique avec ses messages
//   - createConversation/...       → mutations CRUD

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface CopilotConversationRow {
  id: string
  agency_id: string
  user_id: string
  title: string
  messages: CopilotMessage[]
  last_message_at: string
  archived: boolean
  created_at: string
  updated_at: string
}

interface RawRow {
  id: string
  agency_id: string
  user_id: string
  title: string
  messages: unknown
  last_message_at: string
  archived: boolean
  created_at: string
  updated_at: string
}

function adaptRow(row: RawRow): CopilotConversationRow {
  return {
    ...row,
    messages: Array.isArray(row.messages) ? (row.messages as CopilotMessage[]) : [],
  }
}

// ─── List recent ─────────────────────────────────────────────────────────

export function useCopilotConversations(limit = 50) {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: ['copilot-conversations', userId, limit],
    queryFn: async (): Promise<CopilotConversationRow[]> => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('ai_copilot_conversations')
        .select('id, agency_id, user_id, title, messages, last_message_at, archived, created_at, updated_at')
        .eq('archived', false)
        .order('last_message_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data as unknown as RawRow[]).map(adaptRow)
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

// ─── Single conversation ─────────────────────────────────────────────────

export function useCopilotConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['copilot-conversation', conversationId],
    queryFn: async (): Promise<CopilotConversationRow | null> => {
      if (!conversationId) return null
      const { data, error } = await supabase
        .from('ai_copilot_conversations')
        .select('id, agency_id, user_id, title, messages, last_message_at, archived, created_at, updated_at')
        .eq('id', conversationId)
        .maybeSingle()
      if (error) throw error
      return data ? adaptRow(data as unknown as RawRow) : null
    },
    enabled: !!conversationId,
    staleTime: 0,
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────

interface CreateInput {
  firstPrompt: string
  firstResponse?: string
}

export function useCreateConversation() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateInput): Promise<CopilotConversationRow> => {
      if (!user?.id || !profile?.agency_id) {
        throw new Error('Session ou agence non chargée')
      }
      // Titre auto à partir du premier prompt — tronqué à 80 chars.
      const title = input.firstPrompt.trim().slice(0, 80) || 'Nouvelle conversation'
      const now = new Date().toISOString()
      const initialMessages: CopilotMessage[] = [
        { role: 'user', content: input.firstPrompt, created_at: now },
      ]
      if (input.firstResponse) {
        initialMessages.push({ role: 'assistant', content: input.firstResponse, created_at: now })
      }

      const { data, error } = await supabase
        .from('ai_copilot_conversations')
        .insert({
          agency_id: profile.agency_id,
          user_id: user.id,
          title,
          messages: initialMessages as unknown as import('@/types/database').Json,
          last_message_at: now,
        })
        .select('id, agency_id, user_id, title, messages, last_message_at, archived, created_at, updated_at')
        .single()
      if (error) throw error
      return adaptRow(data as unknown as RawRow)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot-conversations'] })
    },
  })
}

interface AppendInput {
  conversationId: string
  message: CopilotMessage
}

export function useAppendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ conversationId, message }: AppendInput) => {
      // Read-modify-write : on lit la conversation, ajoute le message, ré-écrit.
      // Pour un usage en série (un message à la fois) c'est acceptable.
      const { data: cur, error: readErr } = await supabase
        .from('ai_copilot_conversations')
        .select('messages')
        .eq('id', conversationId)
        .single()
      if (readErr) throw readErr
      const rawMessages = (cur as { messages?: unknown } | null)?.messages
      const messages: CopilotMessage[] = Array.isArray(rawMessages)
        ? (rawMessages as unknown as CopilotMessage[])
        : []
      const next = [...messages, message]
      const { error: writeErr } = await supabase
        .from('ai_copilot_conversations')
        .update({
          messages: next as unknown as import('@/types/database').Json,
          last_message_at: message.created_at,
        })
        .eq('id', conversationId)
      if (writeErr) throw writeErr
    },
    onSuccess: (_data, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['copilot-conversation', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['copilot-conversations'] })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('ai_copilot_conversations')
        .delete()
        .eq('id', conversationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot-conversations'] })
    },
  })
}

export function useRenameConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from('ai_copilot_conversations')
        .update({ title: title.trim() || 'Sans titre' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copilot-conversations'] })
    },
  })
}

// Helper : groupe les conversations par période ("Aujourd'hui", "Cette
// semaine", "Ce mois-ci", "Plus ancien") pour l'affichage du History panel.
export function groupConversationsByPeriod(convs: CopilotConversationRow[]) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const oneWeekMs = 7 * 24 * 3600 * 1000
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const today: CopilotConversationRow[] = []
  const week: CopilotConversationRow[] = []
  const month: CopilotConversationRow[] = []
  const older: CopilotConversationRow[] = []

  for (const c of convs) {
    const t = new Date(c.last_message_at).getTime()
    if (t >= startOfToday) today.push(c)
    else if (t >= startOfToday - oneWeekMs) week.push(c)
    else if (t >= startOfMonth) month.push(c)
    else older.push(c)
  }

  return { today, week, month, older }
}

// Hook qui retourne uniquement les helpers utiles (pour usage agrégé)
export function useCopilotMutations() {
  const create = useCreateConversation()
  const append = useAppendMessage()
  const remove = useDeleteConversation()
  const rename = useRenameConversation()
  return useMemo(() => ({ create, append, remove, rename }), [create, append, remove, rename])
}
