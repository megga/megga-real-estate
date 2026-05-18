import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// ── Types ──

export interface EmailMessage {
  id: string
  thread_id: string
  from_address: string
  from_name: string
  to_addresses: string[]
  cc_addresses: string[]
  subject: string
  snippet: string
  sent_at: string
  is_unread: boolean
  has_attachments: boolean
}

export interface SendMessageParams {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body_text: string
  reply_to_message_id?: string
}

export interface EmailAttachment {
  filename: string
  mime_type: string
  size: number
  attachment_id: string
}

export interface ThreadMessage extends EmailMessage {
  body_text: string
  attachments: EmailAttachment[]
}

interface GmailToken {
  id: string
  user_id: string
  gmail_email: string | null
  sync_enabled: boolean
  last_sync_at: string | null
}

// ── Hook ──

export function useGmail() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  const { data: tokenData, isLoading: statusLoading } = useQuery({
    queryKey: ['gmail-status', userId],
    queryFn: async (): Promise<GmailToken | null> => {
      const { data, error } = await supabase
        .from('gmail_tokens')
        .select('id, user_id, gmail_email, sync_enabled, last_sync_at')
        .eq('user_id', userId!)
        .single()
      if (error || !data) return null
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const isConnected = !!tokenData?.sync_enabled

  // Lance le flow OAuth avec scopes mail (séparé du calendar pour permettre
  // une révocation indépendante). On demande readonly + send dès le premier
  // consent pour éviter un second prompt à l'envoi du premier mail.
  function connectGmail() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
        redirectTo: `${window.location.origin}/auth/callback?gmail=1`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('gmail-sync', {
        body: { action: 'disconnect' },
      })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] })
      queryClient.invalidateQueries({ queryKey: ['gmail-messages'] })
    },
  })

  // Liste les messages échangés avec un contact (from OR to son email)
  const listByContactMutation = useMutation({
    mutationFn: async (params: { email_address: string; contact_id?: string; max_results?: number }): Promise<EmailMessage[]> => {
      const res = await supabase.functions.invoke('gmail-sync', {
        body: { action: 'list_by_contact', ...params },
      })
      if (res.error) throw new Error(res.error.message)
      return (res.data?.messages ?? []) as EmailMessage[]
    },
  })

  // Marquer un message lu / non lu
  const markReadMutation = useMutation({
    mutationFn: async (params: { message_id: string; is_read: boolean }) => {
      const res = await supabase.functions.invoke('gmail-sync', {
        body: { action: 'mark_read', ...params },
      })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-inbox'] })
      queryClient.invalidateQueries({ queryKey: ['gmail-messages'] })
    },
  })

  // Envoi d'un message — signature auto-append côté Edge Function
  const sendMessageMutation = useMutation({
    mutationFn: async (params: SendMessageParams): Promise<{ message_id: string; thread_id: string }> => {
      const res = await supabase.functions.invoke('gmail-sync', {
        body: { action: 'send_message', ...params },
      })
      if (res.error) throw new Error(res.error.message)
      return res.data as { message_id: string; thread_id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-messages'] })
    },
  })

  async function saveTokens(params: {
    access_token: string
    refresh_token: string
    expires_in: number
    gmail_email?: string
  }) {
    const res = await supabase.functions.invoke('gmail-sync', {
      body: { action: 'save_tokens', ...params },
    })
    if (res.error) throw new Error(res.error.message)
    queryClient.invalidateQueries({ queryKey: ['gmail-status'] })
  }

  return {
    isConnected,
    isLoading: statusLoading,
    gmailEmail: tokenData?.gmail_email ?? null,
    lastSyncAt: tokenData?.last_sync_at ?? null,

    connectGmail,
    disconnectGmail: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,

    listByContact: listByContactMutation.mutateAsync,
    isListing: listByContactMutation.isPending,

    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,

    markAsRead: markReadMutation.mutateAsync,

    saveTokens,
  }
}

// Récupère un thread Gmail complet (tous les messages + body + attachments)
export function useGmailThread(threadId: string | null | undefined) {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: ['gmail-thread', userId, threadId],
    queryFn: async (): Promise<ThreadMessage[]> => {
      if (!threadId) return []
      const res = await supabase.functions.invoke('gmail-sync', {
        body: { action: 'get_thread', thread_id: threadId },
      })
      if (res.error || !res.data?.messages) return []
      return res.data.messages as ThreadMessage[]
    },
    enabled: !!userId && !!threadId,
    staleTime: 60_000,
  })
}

// Query helper pour afficher directement les messages d'un contact (cache + fetch)
export function useGmailMessagesForContact(
  emailAddress: string | null | undefined,
  contactId?: string,
) {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: ['gmail-messages', userId, emailAddress],
    queryFn: async (): Promise<EmailMessage[]> => {
      if (!emailAddress) return []
      const res = await supabase.functions.invoke('gmail-sync', {
        body: {
          action: 'list_by_contact',
          email_address: emailAddress,
          contact_id: contactId,
          max_results: 20,
        },
      })
      if (res.error || !res.data?.messages) return []
      return res.data.messages as EmailMessage[]
    },
    enabled: !!userId && !!emailAddress,
    staleTime: 60_000,
  })
}

// Vue inbox globale (pas filtrée par contact) — query Gmail libre
export function useGmailInbox(maxResults = 30) {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: ['gmail-inbox', userId, maxResults],
    queryFn: async (): Promise<EmailMessage[]> => {
      const res = await supabase.functions.invoke('gmail-sync', {
        body: {
          action: 'list_messages',
          query: 'in:inbox',
          max_results: maxResults,
        },
      })
      if (res.error || !res.data?.messages) return []
      return res.data.messages as EmailMessage[]
    },
    enabled: !!userId,
    staleTime: 60_000,
  })
}
