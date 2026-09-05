/**
 * Une page de fils (12) par la RPC `mail_list_threads` ; les dossiers sont des
 * REQUÊTES et non des colonnes (D8), et la RPC rend le total avec la page —
 * `count: 'exact'` sur une boîte pleine serait un scan complet.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fxCounts, fxThreads, useMailFixtures } from '@/components/crm/messagerie/fixtures'
import type { MailFolder } from '@/components/crm/messagerie/mailState'

export const MAIL_PER_PAGE = 12
export type { MailAddress } from '@/lib/mail/format'
import type { MailAddress } from '@/lib/mail/format'
export interface MailThreadRow {
  id: string; account_id: string; subject: string | null; snippet: string | null; from_name: string | null; from_email: string | null
  participants: MailAddress[]; last_message_at: string; has_attachments: boolean
  is_read: boolean; is_starred: boolean; is_archived: boolean; is_trashed: boolean
  label_id: string | null; contact_id: string | null; message_count: number; total: number
}
export interface MailThreadFilters { folder: MailFolder; labelId: string | null; q: string; unreadOnly: boolean; attOnly: boolean; page: number }
export interface MailFolderCounts { inbox_unread: number; archived: number; drafts: number; label_counts: Record<string, number> }

export const threadsKey = (accountId: string | null, f: MailThreadFilters) => ['mail', 'threads', accountId, f.folder, f.labelId, f.q, f.unreadOnly, f.attOnly, f.page] as const

/** La page courante de la liste. `draft` ne passe pas par ici : les brouillons sont locaux (D7). */
export function useMailThreads(accountId: string | null, f: MailThreadFilters) {
  // Banc `/dev/messagerie` : `fxThreads` rejoue le prédicat de la RPC, filtres
  // et pagination compris — une liste de banc qui ignore la barre d'outils
  // laisserait croire que la barre marche.
  const fx = useMailFixtures()
  const q = useQuery({
    queryKey: [...threadsKey(accountId, f), fx],
    enabled: !!accountId && f.folder !== 'draft',
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ rows: MailThreadRow[]; total: number }> => {
      if (fx) return fxThreads(fx, accountId, f, f.page, MAIL_PER_PAGE)
      // `enabled` garantit l'identifiant, le typage ne le sait pas.
      if (!accountId) throw new Error('no_account')
      const { data, error } = await supabase.rpc('mail_list_threads', {
        p_account_id: accountId, p_folder: f.folder, p_label_id: f.labelId ?? undefined, p_q: f.q || undefined,
        p_unread_only: f.unreadOnly, p_att_only: f.attOnly, p_page: f.page, p_per_page: MAIL_PER_PAGE,
      })
      if (error) throw error
      const rows = (data ?? []) as unknown as MailThreadRow[]
      return { rows, total: rows.length ? Number(rows[0].total) : 0 }
    },
    staleTime: 10_000,
  })
  // ⚠ `isPending` et non `isLoading` : ce dernier retombe à false ENTRE deux tentatives.
  return { rows: q.data?.rows ?? [], total: q.data?.total ?? 0, isLoading: q.isPending, isFetching: q.isFetching }
}

/** Les compteurs du rail : non lus en réception, archivés, brouillons, et par libellé. */
export function useMailFolderCounts(accountId: string | null) {
  const fx = useMailFixtures()
  const q = useQuery({
    queryKey: ['mail', 'folder-counts', accountId, fx],
    enabled: !!accountId,
    queryFn: async (): Promise<MailFolderCounts> => {
      if (fx) return fxCounts(fx, accountId)
      if (!accountId) throw new Error('no_account')
      const { data, error } = await supabase.rpc('mail_folder_counts', { p_account_id: accountId })
      if (error) throw error
      const r = data?.[0] ?? { inbox_unread: 0, archived: 0, drafts: 0, label_counts: {} }
      return { inbox_unread: Number(r.inbox_unread), archived: Number(r.archived), drafts: Number(r.drafts), label_counts: (r.label_counts ?? {}) as Record<string, number> }
    },
    staleTime: 15_000,
  })
  return q.data ?? { inbox_unread: 0, archived: 0, drafts: 0, label_counts: {} }
}
