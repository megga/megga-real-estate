/**
 * Prochaines actions du pipeline (Pipeline v2) — mutations et lecture ciblée
 * sur la table `reminders`, qui EST le stockage de la « prochaine action » d'un
 * deal (prochain reminder actif de la transaction ; cf. usePipelineSugar).
 *
 * Toutes les mutations passent par @supabase-cache-helpers → auto-invalidation
 * des listes reminders (pipeline, calendrier, action board) sans câblage manuel.
 */

import { useCallback } from 'react'
import {
  useQuery,
  useInsertMutation,
  useUpdateMutation,
} from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { reminderToNextAction, type PipelineReminderRow } from '@/lib/sugarAdapters'

/** Prochain reminder actif d'une transaction (bloc « Prochaine action » de la
 *  fiche deal V4). null si aucune relance planifiée. */
export function useTransactionNextReminder(transactionId: string | undefined) {
  const result = useQuery(
    supabase
      .from('reminders')
      .select('id, transaction_id, type, kind, trigger_at, message_template')
      .eq('transaction_id', transactionId ?? '00000000-0000-0000-0000-000000000000')
      .in('status', ['pending', 'triggered', 'snoozed'])
      .order('trigger_at', { ascending: true })
      .limit(1),
    { enabled: !!transactionId, staleTime: 30_000 },
  )
  const row = ((result.data ?? []) as unknown as PipelineReminderRow[])[0]
  return {
    nextAction: row ? reminderToNextAction(row) : null,
    isLoading: result.isLoading,
  }
}

/** Replanifie l'échéance d'un reminder (poignée de la vue Timeline) : jour
 *  choisi par le drag, heure d'origine conservée par l'appelant. Repasse le
 *  statut à 'pending' (un reminder 'triggered'/'snoozed' replanifié redevient
 *  une échéance à venir). */
export function useRescheduleReminder() {
  const update = useUpdateMutation(supabase.from('reminders'), ['id'])
  return {
    mutateAsync: async ({ id, triggerAt }: { id: string; triggerAt: string }) => {
      await update.mutateAsync({
        id,
        trigger_at: triggerAt,
        status: 'pending',
      } as unknown as Parameters<typeof update.mutateAsync>[0])
    },
    isPending: update.isPending,
  }
}

/** Créateurs de reminders « prochaine action » du pipeline. */
export function usePipelineReminderCreators() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  const insert = useInsertMutation(supabase.from('reminders'), ['id'])

  /** « Premier suivi » à J+2 — posé à la création d'un deal (modale Nouveau
   *  deal, création inline) pour que la carte naisse avec une échéance réelle. */
  const createFirstFollowUp = useCallback(
    async ({ transactionId, contactId }: { transactionId: string; contactId: string | null }) => {
      if (!agencyId) throw new Error('Aucune agence rattachée')
      const dueAt = new Date()
      dueAt.setDate(dueAt.getDate() + 2)
      await insert.mutateAsync([{
        agency_id: agencyId,
        transaction_id: transactionId,
        contact_id: contactId,
        type: 'custom',
        kind: 'call',
        trigger_rule: 'manual',
        trigger_days: 2,
        trigger_at: dueAt.toISOString(),
        status: 'pending',
        channel: 'task',
        message_template: 'Premier suivi',
      }])
    },
    [agencyId, insert],
  )

  /** Visite planifiée depuis l'action rapide de carte : le créneau choisi
   *  devient l'échéance réelle du deal (pas d'action factice). */
  const createVisitReminder = useCallback(
    async ({ transactionId, contactId, slotAt, note }: {
      transactionId: string
      contactId: string | null
      slotAt: Date
      note: string
    }) => {
      if (!agencyId) throw new Error('Aucune agence rattachée')
      await insert.mutateAsync([{
        agency_id: agencyId,
        transaction_id: transactionId,
        contact_id: contactId,
        type: 'custom',
        kind: 'visit',
        trigger_rule: 'manual',
        trigger_at: slotAt.toISOString(),
        status: 'pending',
        channel: 'task',
        message_template: note,
      }])
    },
    [agencyId, insert],
  )

  return { createFirstFollowUp, createVisitReminder, isPending: insert.isPending }
}

/** Annule les reminders actifs d'une transaction — hygiène à la clôture d'un
 *  deal (« Terminer » du bento signé, « Marquer perdu ») pour ne pas laisser
 *  traîner des relances d'un dossier clos dans Focus/Calendrier. Best-effort :
 *  l'échec n'est pas bloquant pour la clôture elle-même. */
export function useCancelTransactionReminders() {
  return {
    mutateAsync: useCallback(async (transactionId: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'cancelled' })
        .eq('transaction_id', transactionId)
        .in('status', ['pending', 'triggered', 'snoozed'])
      if (error) throw error
    }, []),
  }
}

