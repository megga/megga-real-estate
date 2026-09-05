/**
 * Une page de fils (12) par la RPC `mail_list_threads` ; les dossiers sont des
 * REQUÊTES et non des colonnes (D8), et la RPC rend le total avec la page —
 * `count: 'exact'` sur une boîte pleine serait un scan complet.
 */
import { useQuery } from '@tanstack/react-query'
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

/**
 * La VUE : tout ce qui définit un jeu de résultats, la page exceptée. Deux clés
 * de la même vue ne diffèrent que par leur dernier élément.
 */
const vueKey = (accountId: string | null, f: MailThreadFilters) =>
  ['mail', 'threads', accountId, f.folder, f.labelId, f.q, f.unreadOnly, f.attOnly] as const
export const threadsKey = (accountId: string | null, f: MailThreadFilters) => [...vueKey(accountId, f), f.page] as const

/** La page courante de la liste. `draft` ne passe pas par ici : les brouillons sont locaux (D7). */
export function useMailThreads(accountId: string | null, f: MailThreadFilters) {
  // Banc `/dev/messagerie` : `fxThreads` rejoue le prédicat de la RPC, filtres
  // et pagination compris — une liste de banc qui ignore la barre d'outils
  // laisserait croire que la barre marche.
  const fx = useMailFixtures()
  const q = useQuery({
    queryKey: [...threadsKey(accountId, f), fx],
    enabled: !!accountId && f.folder !== 'draft',
    /**
     * ⛔ `keepPreviousData` NU GARDAIT AUSSI LES RÉSULTATS D'UNE AUTRE VUE. Il
     * s'applique à TOUT changement de clé, or la clé porte le dossier, le
     * libellé, la recherche et les deux filtres — pas seulement la page. Et
     * comme une donnée de remplacement met `status: 'success'`, `isPending`
     * était faux : pendant tout l'aller-retour de la RPC, la liste montrait les
     * douze lignes NON filtrées de la vue précédente, sans le moindre
     * indicateur, avec l'ancien total au pager. Cliquer une ligne dans cette
     * fenêtre ouvrait un fil absent du résultat — et `ouvrirFil` le marquait lu.
     *
     * On ne garde donc l'ancienne page que si SEULE la page a changé : la
     * pagination reste sans clignotement, un changement de vue vide la liste et
     * laisse `isPending` faire son travail.
     */
    placeholderData: (prev, prevQuery) => {
      if (!prev || !prevQuery) return undefined
      const vue = vueKey(accountId, f)
      const ancienne = prevQuery.queryKey as readonly unknown[]
      return vue.every((v, i) => ancienne[i] === v) ? prev : undefined
    },
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
  //
  // ⛔ `error` ET `refetch` SONT RENDUS, et ce n'est pas de la complétude d'API.
  // Sans eux, `rows` retombait sur `[]` quand la requête avait ÉCHOUÉ, et la
  // liste affichait « Aucun message » : une erreur RLS, un statement timeout sur
  // une boîte pleine ou un 500 PostgREST devenaient indiscernables d'une boîte
  // vide. L'agent voyait une réception propre là où son courrier existait, sans
  // rien à cliquer pour s'en sortir. Un appelant qui ignore `error` reproduit le
  // défaut : c'est la liste qui doit le rendre visible.
  return {
    rows: q.data?.rows ?? [], total: q.data?.total ?? 0,
    isLoading: q.isPending, isFetching: q.isFetching,
    error: q.error as Error | null, refetch: () => { void q.refetch() },
  }
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
