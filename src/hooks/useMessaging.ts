import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const DEV_BYPASS = true

export interface MessageThread {
  id: string
  agency_id: string
  property_id: string | null
  property_title: string | null
  contact_id: string | null
  contact_name: string
  contact_type: 'buyer' | 'seller'
  last_message: string | null
  last_message_at: string
  unread_count: number
  avatar_initials: string
  created_at: string
}

export interface Message {
  id: string
  thread_id: string
  sender_id: string
  sender_type: 'agent' | 'contact'
  sender_name: string
  content: string
  read_at: string | null
  created_at: string
}

// Import mock data dynamically to avoid circular deps
let MOCK_THREADS: MessageThread[] = []
let MOCK_MESSAGES: Record<string, Message[]> = {}

async function loadMockData() {
  const mod = await import('@/pages/agent/messagingMockData')
  if ('MESSAGE_THREADS' in mod && 'MESSAGES' in mod) {
    MOCK_THREADS = (mod.MESSAGE_THREADS as unknown as Array<Record<string, unknown>>).map((t) => ({
      id: t.id as string,
      agency_id: 'dev-mock-agency',
      property_id: t.property_id as string | null,
      property_title: t.property_title as string | null,
      contact_id: null,
      contact_name: t.contact_name as string,
      contact_type: t.contact_type as 'buyer' | 'seller',
      last_message: t.last_message as string,
      last_message_at: t.last_message_at as string,
      unread_count: (t.unread_count as number) ?? 0,
      avatar_initials: (t.avatar_initials as string) ?? (t.contact_name as string).split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      created_at: t.last_message_at as string,
    }))

    const allMsgs = mod.MESSAGES as unknown as Array<Record<string, unknown>>
    MOCK_MESSAGES = {}
    for (const m of allMsgs) {
      const tid = m.thread_id as string
      if (!MOCK_MESSAGES[tid]) MOCK_MESSAGES[tid] = []
      MOCK_MESSAGES[tid].push({
        id: m.id as string,
        thread_id: tid,
        sender_id: 'dev-mock-user',
        sender_type: m.sender as 'agent' | 'contact',
        sender_name: m.sender_name as string,
        content: m.content as string,
        read_at: null,
        created_at: m.timestamp as string,
      })
    }
  }
}

// Pre-load mock data
if (DEV_BYPASS) {
  loadMockData()
}

export function useMessaging(threadId: string | null) {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  // Fetch all threads
  const threadsQuery = useQuery({
    queryKey: ['threads', profile?.agency_id],
    queryFn: async () => {
      if (DEV_BYPASS) return MOCK_THREADS
      const { data, error } = await supabase
        .from('message_threads')
        .select('*')
        .order('last_message_at', { ascending: false })
      if (error) throw error
      return (data as Array<Omit<MessageThread, 'avatar_initials'>>).map((t) => ({
        ...t,
        avatar_initials: t.contact_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2),
      }))
    },
    enabled: !!user,
  })

  // Fetch messages for selected thread
  const messagesQuery = useQuery({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      if (DEV_BYPASS) return MOCK_MESSAGES[threadId!] ?? []
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Message[]
    },
    enabled: !!threadId,
  })

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({ content, senderType, senderName }: {
      content: string
      senderType: 'agent' | 'contact'
      senderName: string
    }) => {
      if (!threadId) throw new Error('No thread selected')

      const newMessage: Message = {
        id: DEV_BYPASS ? crypto.randomUUID() : '',
        thread_id: threadId,
        sender_id: user?.id ?? 'dev-mock-user',
        sender_type: senderType,
        sender_name: senderName,
        content,
        read_at: null,
        created_at: new Date().toISOString(),
      }

      if (DEV_BYPASS) {
        // Optimistic update for dev mode
        queryClient.setQueryData<Message[]>(['messages', threadId], (old) => [
          ...(old ?? []),
          newMessage,
        ])
        return newMessage
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: user?.id,
          sender_type: senderType,
          sender_name: senderName,
          content,
        })
        .select()
        .single()
      if (error) throw error
      return data as Message
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
    },
  })

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!threadId || DEV_BYPASS) return
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .is('read_at', null)
        .neq('sender_id', user?.id ?? '')

      await supabase
        .from('message_threads')
        .update({ unread_count: 0 })
        .eq('id', threadId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] })
    },
  })

  // Realtime subscription for new messages
  useEffect(() => {
    if (!threadId || DEV_BYPASS) return

    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          // Only add if not sent by current user (avoid duplicate from optimistic update)
          if (newMsg.sender_id !== user?.id) {
            queryClient.setQueryData<Message[]>(['messages', threadId], (old) => [
              ...(old ?? []),
              newMsg,
            ])
            queryClient.invalidateQueries({ queryKey: ['threads'] })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId, user?.id, queryClient])

  return {
    threads: threadsQuery.data ?? [],
    isLoadingThreads: threadsQuery.isLoading,
    messages: messagesQuery.data ?? [],
    isLoadingMessages: messagesQuery.isLoading,
    sendMessage: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    markAsRead: markAsReadMutation.mutateAsync,
  }
}
