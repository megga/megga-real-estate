/**
 * Un fil change (synchronisation, geste d'un collègue sur une boîte partagée) →
 * on invalide. C'est ce qui fait monter la pastille de non-lus sans que l'agent
 * recharge.
 *
 * ⛔ `useId()` pour le nom du canal (CLAUDE.md §4) : un nom statique fait planter
 * au re-montage (StrictMode, navigation).
 */
import { useEffect, useId } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** S'abonne aux changements de `mail_threads` de l'agence. La RLS s'applique aux diffusions. */
export function useMailRealtime(agencyId: string | null) {
  const qc = useQueryClient()
  const channelId = useId()
  useEffect(() => {
    if (!agencyId) return
    const channel = supabase
      .channel(`mail-threads-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mail_threads', filter: `agency_id=eq.${agencyId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['mail', 'threads'] })
        void qc.invalidateQueries({ queryKey: ['mail', 'unread'] })
        void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts'] })
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [agencyId, channelId, qc])
}
