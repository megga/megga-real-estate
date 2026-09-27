// MEGGA CRM — Today V2 « concept H » · LOT 1 · le fil « Pendant ton absence ».
// ----------------------------------------------------------------------------
// Lit `today_absence()` (migration 20260803120000) et compose la PROSE côté
// client : le SQL rend des données, l'i18n rend des phrases.
//
// Présence : `presence_touch()` est appelée quand l'agent QUITTE son poste
// (onglet caché / fermeture), jamais au montage — sinon `last_seen_at` serait
// toujours « maintenant » et le fil serait vide en permanence.
//
// ⛔ Pas d'accusé de lecture en base : « Tout marquer comme vu » avance la
// présence, ce qui vide le fil par construction. L'écartement d'UNE ligne reste
// local à la session, exactement comme dans la maquette.
//
// ⛔ LOT D1 : une relance de PROPOSITION (`follow_up_sent_property`) n'est pas un rappel qu'on « reprend » : elle se
// clôt quand ses réponses sont consignées (`fermer_relance_proposition`). La passer à `done` d'ici laissait ses biens
// `sent` sans relance : « En attente » gardait la ligne — elle vit tant qu'un bien est `sent` — mais perdait son
// échéance (conception §2 et §5.3). `retoursDe` la désigne : le bureau ouvre « Retours de … » dans le fil, le mobile
// ouvre la fiche du contact, et aucun des deux n'écrit.
//
// La traduction d'une ligne en signal vit dans `absenceSignaux.ts`, PURE, éprouvée seule.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CLE_FIL } from '@/components/matching-fil/filModele'
import { versSignalAbsence, type AbsenceRow, type AbsenceSignal } from './absenceSignaux'

// Ré-exporté : les écrans l'importent d'ici, avec le hook.
export type { AbsenceSignal } from './absenceSignaux'

/** Fenêtre de découverte à la toute première session (aucune ligne de présence). */
const FIRST_SESSION_HOURS = 72

interface AbsencePayload {
  since: string | null
  signals: AbsenceRow[]
}

/** Groupe d'affichage, avec son libellé déjà traduit. */
export interface AbsenceGroup {
  name: string
  items: AbsenceSignal[]
}

export interface UseAbsenceSignalsReturn {
  signals: AbsenceSignal[]
  groups: AbsenceGroup[]
  total: number
  /** Horodatage du dernier départ, déjà mis en forme (« vendredi 18:00 »). */
  sinceLabel: string | null
  isLoading: boolean
  /** La lecture a échoué : « tu es à jour » serait faux. */
  isError: boolean
  /** Avance la présence : vide le fil de façon durable. */
  markAllSeen: () => Promise<void>
  /**
   * « Reprendre » : marque le rappel traité. Rend `false` si l'écriture échoue — et d'emblée, SANS RIEN ÉCRIRE, pour une
   * relance de PROPOSITION (`retoursDe`) : elle se clôt quand ses réponses sont consignées (lot D1).
   */
  resumeReminder: (signal: AbsenceSignal) => Promise<boolean>
}

export function useAbsenceSignals(): UseAbsenceSignalsReturn {
  const { t, i18n } = useTranslation('dashboard')
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  // Écartement d'une ligne : local à la session, comme dans la maquette. La
  // disparition DURABLE viendra du geste (Lot 2), pas d'un accusé de lecture.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    // ⚠ Sous le préfixe du fil (`CLE_FIL`, lot D1), comme `useMatchingDuJour` : « Reprendre » ouvre « Retours de … »
    // dans le fil, et la relance se clôt quand les réponses y sont consignées. Chaque geste du fil invalide
    // `[CLE_FIL]` ; sous une clé à part, « Pendant ton absence » montrait encore la relance close au retour, le temps
    // du `staleTime`. Les deux invalidations d'ici portent la même clé.
    queryKey: [CLE_FIL, 'absence', profile?.id],
    queryFn: async (): Promise<AbsencePayload> => {
      const { data: payload, error } = await supabase.rpc('today_absence', { p_fallback_hours: FIRST_SESSION_HOURS })
      if (error) throw error
      return (payload ?? { since: null, signals: [] }) as unknown as AbsencePayload
    },
    enabled: !!profile?.id,
    staleTime: 60_000,
  })

  // Départ de l'agent → on horodate. `visibilitychange` couvre le changement
  // d'onglet ; `pagehide` couvre la fermeture (plus fiable que `beforeunload`
  // sur mobile). L'appel est « au mieux » : s'il échoue, le pire est un fil qui
  // se répète, jamais une perte de donnée.
  useEffect(() => {
    if (!profile?.id) return
    const touch = () => { void supabase.rpc('presence_touch') }
    const onHide = () => { if (document.visibilityState === 'hidden') touch() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', touch)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', touch)
    }
  }, [profile?.id])

  // Un seul geste : la présence avance, les écartements locaux redeviennent
  // inutiles (le fil se vide par sa borne), et on relit.
  const markAllSeen = useCallback(async () => {
    await supabase.rpc('presence_touch')
    setDismissed(new Set())
    await queryClient.invalidateQueries({ queryKey: [CLE_FIL, 'absence', profile?.id] })
  }, [queryClient, profile?.id])

  // ─── Geste « Reprendre » (Lot 2) ─────────────────────────────────────────
  // AUCUNE RPC nouvelle : `reminders` est écrite en direct par l'agent (policy
  // UPDATE agence), et la forme canonique est celle de `useReminders.markAsDone`
  // — `status='done'` + `completed_at`. Vérifié avant de l'employer : la table
  // n'a AUCUN trigger, et la seule fonction qui lit `reminders`+`done` est
  // `contact_next_action`, en LECTURE.
  // ⛔ Marquer traité a pourtant un effet sur une relance de PROPOSITION (lot D1) : le fil ne lit que les relances
  // OUVERTES (`useMatchingFil`), et « En attente » en tire l'échéance de l'acheteur. La clore d'ici la lui retirait
  // sans qu'aucune réponse soit consignée — d'où la garde en tête du geste.
  const resumeReminder = useCallback(async (signal: AbsenceSignal): Promise<boolean> => {
    // ⛔ Une relance de PROPOSITION se clôt quand ses réponses sont consignées (`fermer_relance_proposition`), jamais
    // d'ici. Les écrans la gardent déjà (le bureau ouvre « Retours de … », le mobile la fiche) : cette garde double la
    // leur, pour qu'un nouvel appelant ne puisse pas la clore sans réponse.
    if (signal.retoursDe) return false
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', signal.refId)
    if (error) return false

    // Piste d'audit — règle CLAUDE.md : toute action laisse une trace.
    const agencyId = profile?.agency_id
    const actorId = profile?.id
    if (agencyId && actorId) {
      void supabase.from('activity_events').insert({
        agency_id: agencyId,
        actor_id: actorId,
        actor_kind: 'user',
        action: 'reminder_resumed',
        entity_type: 'contact',
        entity_id: signal.navRef ?? null,
        category: 'contact',
        severity: 'info',
        object_label: signal.who,
        metadata: { source: 'today_absence', reminder_id: signal.refId },
      }).then(({ error: logErr }) => {
        if (logErr) console.error('[absence] journalisation reminder_resumed', logErr)
      })
    }

    // Le fil ET la journée relisent : le rappel disparaît des deux.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [CLE_FIL, 'absence', profile?.id] }),
      queryClient.invalidateQueries({ queryKey: ['calendar-reminders'] }),
    ])
    return true
  }, [queryClient, profile?.id, profile?.agency_id])

  // ─── Prose : le SQL rend des données, l'i18n rend des phrases ────────────
  const signals = useMemo<AbsenceSignal[]>(() => {
    const rows = data?.signals ?? []
    const relative = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })
    const timeOnly = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' })
    const dayAndTime = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', hour: '2-digit', minute: '2-digit' })

    return rows.filter((r) => !dismissed.has(r.id))
      .map((r) => versSignalAbsence(r, { t, relative, timeOnly, dayAndTime, dataUpdatedAt }))
  }, [data, dismissed, t, i18n.language, dataUpdatedAt])

  // Groupés par nature, comme la maquette. Un groupe vide n'apparaît pas — c'est
  // ainsi que « MEGGA AI » se retire tout seul, faute de source.
  const groups = useMemo<AbsenceGroup[]>(() => {
    const buyers = signals.filter((s) => s.type === 'like' || s.type === 'skip')
    const reminders = signals.filter((s) => s.type === 'rappel')
    return [
      { name: t('today.h.absence.groupBuyers'), items: buyers },
      { name: t('today.h.absence.groupReminders'), items: reminders },
    ].filter((g) => g.items.length > 0)
  }, [signals, t])

  // Dépendance sur `data` (et non `data?.since`) : le compilateur React infère
  // la dépendance la plus large et refuse d'optimiser si on la déclare plus
  // étroite que ce qu'il voit.
  const since = data?.since ?? null
  const sinceLabel = useMemo(() => {
    if (!since) return null
    return new Intl.DateTimeFormat(i18n.language, { weekday: 'long', hour: '2-digit', minute: '2-digit' })
      .format(new Date(since))
  }, [since, i18n.language])

  return {
    signals,
    groups,
    total: signals.length,
    sinceLabel,
    isLoading,
    isError,
    markAllSeen,
    resumeReminder,
  }
}
