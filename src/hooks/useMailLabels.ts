/**
 * Libellés de l'agence (D12) : lecture et CRUD directs par PostgREST sous RLS.
 *
 * Nos libellés sont un classement CRM, pas un miroir de ceux de Gmail : rien
 * n'est synchronisé dans un sens ni dans l'autre.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { FX_LABELS, useMailFixtures } from '@/components/crm/messagerie/fixtures'

export interface MailLabel { id: string; agency_id: string; name: string; color: string; position: number; is_default: boolean }

/** Les libellés de l'agence, et les quatre gestes du créateur de libellé. */
export function useMailLabels() {
  const { user, profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const qc = useQueryClient()
  // Banc `/dev/messagerie` : les libellés appartiennent à l'AGENCE, pas à la
  // boîte — ils sont donc servis même dans l'état « boîte vide ».
  const fx = useMailFixtures()
  const q = useQuery({
    queryKey: ['mail', 'labels', fx],
    enabled: !!user || !!fx,
    queryFn: async (): Promise<MailLabel[]> => {
      if (fx) return fx === 'none' ? [] : FX_LABELS
      const { data, error } = await supabase.from('mail_labels').select('id, agency_id, name, color, position, is_default').order('position').order('created_at')
      if (error) throw error
      return (data ?? []) as MailLabel[]
    },
    staleTime: 60_000,
  })
  // Un libellé renommé, recoloré ou supprimé change AUSSI les lignes de liste
  // (la pastille y est peinte) : les deux caches se rafraîchissent ensemble.
  const done = () => { void qc.invalidateQueries({ queryKey: ['mail', 'labels'] }); void qc.invalidateQueries({ queryKey: ['mail', 'threads'] }) }
  const create = useMutation({
    mutationFn: async (a: { name: string; color: string }) => {
      if (!agencyId) throw new Error('no_agency')
      const position = (q.data?.length ?? 0)
      const { error } = await supabase.from('mail_labels').insert({ agency_id: agencyId, name: a.name.trim(), color: a.color, position })
      if (error) throw error
    },
    onSuccess: done,
  })
  const rename = useMutation({
    mutationFn: async (a: { id: string; name: string }) => { const { error } = await supabase.from('mail_labels').update({ name: a.name.trim() }).eq('id', a.id); if (error) throw error },
    onSuccess: done,
  })
  const recolor = useMutation({
    mutationFn: async (a: { id: string; color: string }) => { const { error } = await supabase.from('mail_labels').update({ color: a.color }).eq('id', a.id); if (error) throw error },
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('mail_labels').delete().eq('id', id); if (error) throw error },
    onSuccess: done,
  })
  return { labels: q.data ?? [], isLoading: q.isPending, create, rename, recolor, remove }
}
