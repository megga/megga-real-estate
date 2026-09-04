/**
 * Brouillons LOCAUX (D7) : une ligne par composition non envoyée, visible de son
 * auteur seul (RLS). Ils ne sont jamais poussés chez le fournisseur — un
 * brouillon est un état d'écran, pas un message.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { MailAddress } from '@/hooks/useMailThreads'

export interface MailDraft {
  id: string; account_id: string; kind: 'new' | 'reply' | 'forward'; thread_id: string | null; in_reply_to_message_id: string | null
  to: MailAddress[]; cc: MailAddress[]; subject: string | null; body_text: string | null; attachments: { name: string; size: number; storage_path: string }[]; updated_at: string
}

/** Les brouillons de la boîte courante, et leur enregistrement / suppression. */
export function useMailDrafts(accountId: string | null) {
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['mail', 'drafts', accountId],
    enabled: !!user && !!accountId,
    queryFn: async (): Promise<MailDraft[]> => {
      // `enabled` garantit l'identifiant, le typage ne le sait pas.
      if (!accountId) throw new Error('no_account')
      const { data, error } = await supabase.from('mail_drafts').select('*').eq('account_id', accountId).order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as MailDraft[]
    },
  })
  const done = () => { void qc.invalidateQueries({ queryKey: ['mail', 'drafts', accountId] }); void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts', accountId] }) }
  const save = useMutation({
    mutationFn: async (d: Partial<MailDraft> & { id?: string }) => {
      if (!accountId || !user || !profile?.agency_id) throw new Error('no_account')
      const row = { account_id: accountId, agency_id: profile.agency_id, author_id: user.id, kind: d.kind ?? 'new', thread_id: d.thread_id ?? null,
        in_reply_to_message_id: d.in_reply_to_message_id ?? null, to: d.to ?? [], cc: d.cc ?? [], subject: d.subject ?? null, body_text: d.body_text ?? null, attachments: d.attachments ?? [] }
      const q = d.id ? supabase.from('mail_drafts').update(row).eq('id', d.id).select('id').single() : supabase.from('mail_drafts').insert(row).select('id').single()
      const { data, error } = await q
      if (error) throw error
      return data.id as string
    },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('mail_drafts').delete().eq('id', id); if (error) throw error },
    onSuccess: done,
  })
  return { drafts: list.data ?? [], isLoading: list.isPending, save, remove }
}
