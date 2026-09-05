/**
 * Boîtes visibles par l'agent (RLS `owner` / `agency`, D14), compteurs de non lus
 * par boîte, et les gestes de connexion / déconnexion (edge `mail-oauth`).
 *
 * ⚠ Livré avec la tâche 2.1 et non 2.3 : `MessagerieApp` l'importe dès le
 * squelette pour savoir s'il a une boîte à montrer, et un écran qui ne compile
 * pas n'est pas un jalon.
 */
import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { invokeMail } from '@/lib/mail/invoke'
import { FX_ACCOUNTS, FX_UNREAD, useMailFixtures } from '@/components/crm/messagerie/fixtures'
import type { Database } from '@/types/database'

export type MailProviderId = Database['public']['Tables']['mail_accounts']['Row']['provider']
export interface MailAccount {
  id: string; agency_id: string; owner_id: string; provider: MailProviderId; email: string
  display_name: string | null; visibility: 'owner' | 'agency'; status: 'active' | 'reauth_required' | 'error' | 'disabled'
  last_sync_at: string | null; last_error: string | null; created_at: string
}
export interface ImapForm {
  email: string; imap_host: string; imap_port: number; smtp_host: string; smtp_port: number
  user: string; password: string; encryption: 'ssl' | 'starttls'; visibility: 'owner' | 'agency'
}

const COLS = 'id, agency_id, owner_id, provider, email, display_name, visibility, status, last_sync_at, last_error, created_at'

/** Les boîtes de l'agent, leurs non-lus, et les quatre gestes de `mail-oauth`. */
export function useMailAccounts() {
  const { user } = useAuth()
  const qc = useQueryClient()
  // Banc `/dev/messagerie` : les fixtures répondent DANS la `queryFn`, et l'état
  // entre dans la clé. Voir la note « pourquoi pas `isLoading: fx ? false : …` »
  // en bas de ce fichier.
  const fx = useMailFixtures()
  const list = useQuery({
    queryKey: ['mail', 'accounts', fx],
    enabled: !!user || !!fx,
    queryFn: async (): Promise<MailAccount[]> => {
      if (fx) return fx === 'none' ? [] : FX_ACCOUNTS
      const { data, error } = await supabase.from('mail_accounts').select(COLS).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MailAccount[]
    },
    staleTime: 30_000,
  })
  const unread = useQuery({
    queryKey: ['mail', 'unread', fx],
    enabled: !!user || !!fx,
    queryFn: async (): Promise<Record<string, number>> => {
      if (fx) return fx === 'full' ? FX_UNREAD : {}
      const { data, error } = await supabase.rpc('mail_unread_counts')
      if (error) throw error
      return Object.fromEntries((data ?? []).map((r) => [r.account_id, Number(r.unread)]))
    },
    staleTime: 15_000,
  })
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['mail'] })
  }, [qc])

  const startOAuth = useCallback(async (provider: 'gmail' | 'outlook', opts: { loginHint?: string; visibility: 'owner' | 'agency' }) => {
    // ⚠ `origin` est OBLIGATOIRE côté edge (liste `MAIL_OAUTH_ORIGINS`) : sans lui,
    // `mail-oauth start` répond 400 `invalid_origin`.
    return invokeMail<{ url: string; state: string }>('mail-oauth', { action: 'start', provider, origin: window.location.origin, login_hint: opts.loginHint ?? null, visibility: opts.visibility })
  }, [])
  const exchange = useCallback(async (code: string, state: string) => {
    const r = await invokeMail<{ account: MailAccount }>('mail-oauth', { action: 'exchange', code, state })
    if (!r.error) invalidate()
    return r
  }, [invalidate])
  const connectImap = useCallback(async (form: ImapForm) => {
    const r = await invokeMail<{ account: MailAccount }>('mail-oauth', { action: 'connect_imap', ...form })
    if (!r.error) invalidate()
    return r
  }, [invalidate])
  const disconnect = useMutation({
    mutationFn: async (accountId: string) => {
      const r = await invokeMail('mail-oauth', { action: 'disconnect', account_id: accountId })
      if (r.error) throw new Error(r.error)
    },
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: async (a: { accountId: string; display_name?: string; visibility?: 'owner' | 'agency' }) => {
      const r = await invokeMail('mail-oauth', { action: 'update', account_id: a.accountId, display_name: a.display_name, visibility: a.visibility })
      if (r.error) throw new Error(r.error)
    },
    onSuccess: invalidate,
  })

  // ⚠ `isPending` et non `isLoading` : `isLoading` retombe à false ENTRE deux
  // tentatives, et un écran qui attend `isLoading || !data` tourne sans fin.
  //
  // ⚠ ET C'EST POURQUOI LE BANC RÉPOND DANS LA `queryFn`, pas par un
  // `isLoading: fx ? false : list.isPending` comme le plan l'écrivait. Une
  // requête `enabled: false` reste `isPending` POUR TOUJOURS en TanStack v5 :
  // forcer `isLoading` à `false` par-dessus aurait rendu un couple
  // (`isLoading: false`, `data: undefined`) qui n'existe pas dans la vraie vie,
  // et l'écran serait passé du blanc au vide sans qu'on sache lequel il montre.
  // En répondant dans la `queryFn` la requête RÉSOUT : le banc emprunte le même
  // chemin que la production, cache et `staleTime` compris.
  return { list: list.data ?? [], isLoading: list.isPending, unread: unread.data ?? {}, startOAuth, exchange, connectImap, disconnect, update, invalidate }
}
