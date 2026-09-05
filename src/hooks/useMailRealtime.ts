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
import { useMailFixtures } from '@/components/crm/messagerie/fixtures'

/** S'abonne aux changements de `mail_threads` de l'agence. La RLS s'applique aux diffusions. */
export function useMailRealtime(agencyId: string | null) {
  const qc = useQueryClient()
  const channelId = useId()
  // ⚠ Le banc ne s'abonne PAS : avec `VITE_DEV_BYPASS_AUTH` il y a une session,
  // donc un `agency_id`, et le canal se serait ouvert pour invalider des caches
  // que seules les fixtures remplissent.
  const fx = useMailFixtures()
  useEffect(() => {
    if (!agencyId || fx) return
    const channel = supabase
      .channel(`mail-threads-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mail_threads', filter: `agency_id=eq.${agencyId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['mail', 'threads'] })
        void qc.invalidateQueries({ queryKey: ['mail', 'unread'] })
        void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts'] })
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [agencyId, channelId, fx, qc])
}
