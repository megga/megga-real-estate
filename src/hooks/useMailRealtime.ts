/**
 * Un fil change (synchronisation, geste d'un collègue sur une boîte partagée) →
 * on invalide. C'est ce qui fait monter la pastille de non-lus sans que l'agent
 * recharge.
 *
 * ⛔ `useId()` pour le nom du canal (CLAUDE.md §4) : un nom statique fait planter
 * au re-montage (StrictMode, navigation).
 */
import { useEffect, useId, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useMailFixtures } from '@/components/crm/messagerie/fixtures'

/**
 * Fenêtre de regroupement : une rafale d'événements ne vaut qu'un
 * rafraîchissement. Assez court pour rester vivant à l'œil, assez long pour
 * absorber une synchronisation initiale.
 */
const REGROUPEMENT_MS = 1000

/** S'abonne aux changements de `mail_threads` de l'agence. La RLS s'applique aux diffusions. */
export function useMailRealtime(agencyId: string | null) {
  const qc = useQueryClient()
  const channelId = useId()
  const enAttente = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ⚠ Le banc ne s'abonne PAS : avec `VITE_DEV_BYPASS_AUTH` il y a une session,
  // donc un `agency_id`, et le canal se serait ouvert pour invalider des caches
  // que seules les fixtures remplissent.
  const fx = useMailFixtures()
  useEffect(() => {
    if (!agencyId || fx) return
    const channel = supabase
      .channel(`mail-threads-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mail_threads', filter: `agency_id=eq.${agencyId}` }, () => {
        // ⛔ REGROUPÉ, ET CE N'EST PAS DU CONFORT. L'ingestion écrit au moins une
        // ligne `mail_threads` PAR MESSAGE, et la première fenêtre couvre 90
        // jours : connecter une boîte de quelques milliers de messages émettait
        // autant d'événements, donc jusqu'à trois fois autant de
        // rafraîchissements — dont `mail_folder_counts` et ses quatre
        // sous-requêtes d'agrégat à chaque fois. Un fil qui change reste un
        // signal ; mille fils qui changent en restent un aussi.
        if (enAttente.current) clearTimeout(enAttente.current)
        enAttente.current = setTimeout(() => {
          enAttente.current = null
          // ⚠ Les clés restent LARGES à dessein. Une diffusion peut concerner une
          // autre boîte de l'agence que celle affichée : borner sur le compte
          // courant laisserait une page en cache périmée, qu'un simple changement
          // de boîte remonterait telle quelle. Le coût que la largeur avait est
          // payé par le regroupement, pas par la portée.
          void qc.invalidateQueries({ queryKey: ['mail', 'threads'] })
          void qc.invalidateQueries({ queryKey: ['mail', 'unread'] })
          void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts'] })
        }, REGROUPEMENT_MS)
      })
      .subscribe()
    return () => {
      if (enAttente.current) { clearTimeout(enAttente.current); enAttente.current = null }
      void supabase.removeChannel(channel)
    }
  }, [agencyId, channelId, fx, qc])
}
