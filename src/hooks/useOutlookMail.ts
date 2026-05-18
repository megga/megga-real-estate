import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { EmailMessage, SendMessageParams } from '@/hooks/useGmail'

// ── Types ──

interface OutlookMailToken {
  id: string
  user_id: string
  outlook_email: string | null
  sync_enabled: boolean
  last_sync_at: string | null
}

// ── Hook ──

export function useOutlookMail() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  const { data: tokenData, isLoading: statusLoading } = useQuery({
    queryKey: ['outlook-mail-status', userId],
    queryFn: async (): Promise<OutlookMailToken | null> => {
      const { data, error } = await supabase
        .from('outlook_mail_tokens')
        .select('id, user_id, outlook_email, sync_enabled, last_sync_at')
        .eq('user_id', userId!)
        .single()
      if (error || !data) return null
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const isConnected = !!tokenData?.sync_enabled

  function connectOutlookMail() {
    supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send offline_access User.Read',
        redirectTo: `${window.location.origin}/auth/callback?outlookmail=1`,
        queryParams: {
          prompt: 'consent',
        },
      },
    })
  }

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('outlook-mail-sync', {
        body: { action: 'disconnect' },
      })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-mail-status'] })
      queryClient.invalidateQueries({ queryKey: ['outlook-mail-messages'] })
    },
  })

  const listByContactMutation = useMutation({
    mutationFn: async (params: { email_address: string; contact_id?: string; max_results?: number }): Promise<EmailMessage[]> => {
      const res = await supabase.functions.invoke('outlook-mail-sync', {
        body: { action: 'list_by_contact', ...params },
      })
      if (res.error) throw new Error(res.error.message)
      return (res.data?.messages ?? []) as EmailMessage[]
    },
  })

  const sendMessageMutation = useMutation({
    mutationFn: async (params: SendMessageParams): Promise<{ success: boolean }> => {
      const res = await supabase.functions.invoke('outlook-mail-sync', {
        body: { action: 'send_message', ...params },
      })
      if (res.error) throw new Error(res.error.message)
      return res.data as { success: boolean }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-mail-messages'] })
    },
  })

  async function saveTokens(params: {
    access_token: string
    refresh_token: string
    expires_in: number
    outlook_email?: string
  }) {
    const res = await supabase.functions.invoke('outlook-mail-sync', {
      body: { action: 'save_tokens', ...params },
    })
    if (res.error) throw new Error(res.error.message)
    queryClient.invalidateQueries({ queryKey: ['outlook-mail-status'] })
  }

  return {
    isConnected,
    isLoading: statusLoading,
    outlookEmail: tokenData?.outlook_email ?? null,
    lastSyncAt: tokenData?.last_sync_at ?? null,

    connectOutlookMail,
    disconnectOutlookMail: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,

    listByContact: listByContactMutation.mutateAsync,
    isListing: listByContactMutation.isPending,

    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,

    saveTokens,
  }
}

export function useOutlookMailMessagesForContact(
  emailAddress: string | null | undefined,
  contactId?: string,
) {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: ['outlook-mail-messages', userId, emailAddress],
    queryFn: async (): Promise<EmailMessage[]> => {
      if (!emailAddress) return []
      const res = await supabase.functions.invoke('outlook-mail-sync', {
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
