/**
 * Gestes sur un fil : l'écran change tout de suite, l'edge répercute chez le
 * fournisseur ; un refus RÉTABLIT l'état et remonte l'erreur (plan maître §4,
 * « Flux d'actions »).
 *
 * ⚠ `label_id` est la SEULE colonne que le client écrit directement sur
 * `mail_threads` — tout le reste passe par `mail-actions`, parce que tout le
 * reste doit aussi partir chez Gmail ou Graph.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { invokeMail } from '@/lib/mail/invoke'
import type { MailThreadRow } from '@/hooks/useMailThreads'

export type MailThreadAction = 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'trash' | 'untrash'
const PATCH: Record<MailThreadAction, Partial<MailThreadRow>> = {
  mark_read: { is_read: true }, mark_unread: { is_read: false }, star: { is_starred: true }, unstar: { is_starred: false },
  archive: { is_archived: true }, unarchive: { is_archived: false }, trash: { is_trashed: true }, untrash: { is_trashed: false, is_archived: false },
}

/** Les cinq gestes de la liste et du lecteur, tous optimistes sauf `sync_now`. */
export function useMailActions(accountId: string | null) {
  const qc = useQueryClient()
  const patchCaches = (threadId: string, patch: Partial<MailThreadRow>) => {
    qc.setQueriesData<{ rows: MailThreadRow[]; total: number }>({ queryKey: ['mail', 'threads', accountId] }, (old) =>
      old ? { ...old, rows: old.rows.map((r) => (r.id === threadId ? { ...r, ...patch } : r)) } : old)
  }
  const settle = () => {
    void qc.invalidateQueries({ queryKey: ['mail', 'threads', accountId] })
    void qc.invalidateQueries({ queryKey: ['mail', 'unread'] })
    void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts', accountId] })
  }

  const act = useMutation({
    mutationFn: async (a: { action: MailThreadAction; threadId: string }) => {
      const r = await invokeMail('mail-actions', { action: a.action, account_id: accountId, thread_id: a.threadId })
      if (r.error) throw new Error(r.detail ? `${r.error}: ${r.detail}` : r.error)
    },
    onMutate: async (a) => {
      await qc.cancelQueries({ queryKey: ['mail', 'threads', accountId] })
      const snapshot = qc.getQueriesData<{ rows: MailThreadRow[]; total: number }>({ queryKey: ['mail', 'threads', accountId] })
      patchCaches(a.threadId, PATCH[a.action])
      return { snapshot }
    },
    onError: (_e, _a, ctx) => { for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data) },
    onSettled: settle,
  })

  const setLabel = useMutation({
    mutationFn: async (a: { threadId: string; labelId: string | null }) => {
      const { error } = await supabase.from('mail_threads').update({ label_id: a.labelId }).eq('id', a.threadId)
      if (error) throw error
    },
    onMutate: async (a) => { patchCaches(a.threadId, { label_id: a.labelId }) },
    onSettled: settle,
  })

  const linkContact = useMutation({
    mutationFn: async (a: { threadId: string; contactId: string; email: string }) => {
      const r = await invokeMail('mail-actions', { action: 'link_contact', account_id: accountId, thread_id: a.threadId, contact_id: a.contactId, email: a.email })
      if (r.error) throw new Error(r.error)
    },
    onSuccess: (_d, a) => { patchCaches(a.threadId, { contact_id: a.contactId }); void qc.invalidateQueries({ queryKey: ['mail', 'thread', a.threadId] }) },
  })

  // ⚠ `sync_now` peut répondre `{ skipped: 'locked' }` en HTTP 200 : un bail par
  // compte sérialise les quatre chemins de synchronisation. C'est une forme de
  // SUCCÈS, pas une erreur — l'invalidation qui suit ne coûte rien.
  const syncNow = useMutation({
    mutationFn: async () => { const r = await invokeMail('mail-actions', { action: 'sync_now', account_id: accountId }); if (r.error) throw new Error(r.error) },
    onSettled: settle,
  })

  return { act, setLabel, linkContact, syncNow }
}
