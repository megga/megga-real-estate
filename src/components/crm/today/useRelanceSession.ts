// MEGGA CRM — Today V2 « concept H » · LOT 4 · la session de relance persiste.
// ----------------------------------------------------------------------------
// Avant : la session ne vivait que dans le `useState` de l'overlay. Fermer la
// fenêtre, changer d'onglet ou rafraîchir perdait l'index, les compteurs et les
// brouillons — l'agent recommençait, et l'IA regénérait ce qu'elle avait déjà
// écrit.
//
// Après : une session ouverte est REPRISE. La reprise ne rejoue pas un index —
// ce serait faux dès que la file de leads change — elle se lit par DIFFÉRENCE :
// les contacts déjà traités dans la session ouverte sortent de la file.
//
// ⛔ `copied_at` n'atteste PAS d'un envoi. Le geste central de la session est le
// COPIER (handoff §2.4) : l'agent colle dans sa vraie messagerie. Confondre les
// deux ferait croire à un envoi qui n'a jamais eu lieu.
//
// AUCUNE RPC : deux tables écrites par l'agent sur ses propres lignes, sous RLS
// d'agence — même conclusion qu'au Lot 2 pour « Reprendre ». Une RPC par geste
// n'ajouterait qu'une porte à garder synchronisée.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export type RelanceOutcome = 'sent' | 'skipped' | 'discarded'

export interface RelanceItemInput {
  contactId: string
  status: RelanceOutcome
  generatedText?: string | null
  generatedAt?: string | null
  copiedAt?: string | null
}

export interface UseRelanceSessionReturn {
  /** Session ouverte en cours ; null tant qu'elle n'est pas créée/retrouvée. */
  sessionId: string | null
  /** Contacts DÉJÀ traités dans cette session — à retirer de la file. */
  treatedContactIds: Set<string>
  /** true tant qu'on cherche ou crée la session : ne pas afficher de file avant. */
  isResolving: boolean
  /** Consigne le sort d'un lead. Idempotent sur (session, contact). */
  recordItem: (item: RelanceItemInput) => Promise<void>
  /** Clôt la session : la suivante repartira d'une file entière. */
  closeSession: () => Promise<void>
}

/**
 * @param enabled monter la session UNIQUEMENT quand l'overlay est ouvert :
 *   sans ça, chaque rendu de la page créerait une session vide.
 */
export function useRelanceSession(enabled: boolean): UseRelanceSessionReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  const agentId = profile?.id
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [treatedContactIds, setTreated] = useState<Set<string>>(() => new Set())
  const [isResolving, setResolving] = useState(false)
  // Garde-fou d'ouverture : `enabled` peut basculer plusieurs fois (StrictMode,
  // re-render) et l'index unique n'autorise qu'UNE session ouverte par agent —
  // sans ce verrou, la seconde tentative se heurterait à une violation.
  const opening = useRef(false)

  useEffect(() => {
    if (!enabled || !agencyId || !agentId || sessionId || opening.current) return
    opening.current = true
    setResolving(true)
    void (async () => {
      try {
        // 1. Une session ouverte existe-t-elle ? (l'index partiel garantit 0 ou 1)
        const { data: open } = await supabase
          .from('relance_sessions')
          .select('id')
          .is('closed_at', null)
          .eq('agent_id', agentId)
          .maybeSingle()

        let id = open?.id ?? null

        // 2. Sinon on l'ouvre.
        if (!id) {
          const { data: created, error } = await supabase
            .from('relance_sessions')
            .insert({ agency_id: agencyId, agent_id: agentId })
            .select('id')
            .single()
          if (error) throw error
          id = created.id
        }

        // 3. Ce qui a déjà été traité sort de la file.
        const { data: items } = await supabase
          .from('relance_items')
          .select('contact_id')
          .eq('session_id', id)
        setTreated(new Set((items ?? []).map((r) => r.contact_id)))
        setSessionId(id)
      } catch {
        // Échec « au mieux » : la session tourne alors sans persistance plutôt
        // que de bloquer l'agent. Ce qu'il perd, c'est la reprise — pas le geste.
        setSessionId(null)
      } finally {
        setResolving(false)
        opening.current = false
      }
    })()
  }, [enabled, agencyId, agentId, sessionId])

  const recordItem = useCallback(async (item: RelanceItemInput) => {
    if (!sessionId || !agencyId) return
    await supabase
      .from('relance_items')
      .upsert({
        session_id: sessionId,
        agency_id: agencyId,
        contact_id: item.contactId,
        status: item.status,
        generated_text: item.generatedText ?? null,
        generated_at: item.generatedAt ?? null,
        copied_at: item.copiedAt ?? null,
      }, { onConflict: 'session_id,contact_id' })
    setTreated((prev) => { const n = new Set(prev); n.add(item.contactId); return n })
  }, [sessionId, agencyId])

  const closeSession = useCallback(async () => {
    if (!sessionId) return
    await supabase
      .from('relance_sessions')
      .update({ closed_at: new Date().toISOString() })
      .eq('id', sessionId)
    setSessionId(null)
    setTreated(new Set())
  }, [sessionId])

  return { sessionId, treatedContactIds, isResolving, recordItem, closeSession }
}
