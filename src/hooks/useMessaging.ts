import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

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

export function useMessaging(threadId: string | null) {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  // Fetch all threads
  const threadsQuery = useQuery({
    queryKey: ['threads', profile?.agency_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_threads')
        .select('id, agency_id, contact_id, contact_name, contact_type, property_id, property_title, channel, last_message_at, unread_count, last_message, created_at')
        .order('last_message_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((t) => ({
        ...t,
        avatar_initials: (t.contact_name || '').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      })) as MessageThread[]
    },
    enabled: !!user,
  })

  // Fetch messages for selected thread
  const messagesQuery = useQuery({
    queryKey: ['messages', threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, thread_id, sender_id, sender_type, sender_name, content, read_at, created_at')
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
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] })
      queryClient.invalidateQueries({ queryKey: ['threads'] })
    },
  })

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!threadId) return
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
    if (!threadId) return

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
