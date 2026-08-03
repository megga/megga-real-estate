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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { HlSignalData } from './dataH'

/** Fenêtre de découverte à la toute première session (aucune ligne de présence). */
const FIRST_SESSION_HOURS = 72

/** Palette d'avatars du prototype — déterministe sur l'identifiant du contact. */
const AV_PALETTE = ['#5b6cff', '#9b7cf0', '#39B7C9', '#E08A45', '#34C796', '#8B5CF6', '#2370ff', '#c0566b']

function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AV_PALETTE[Math.abs(h) % AV_PALETTE.length]
}

function initialsOf(first: string | null, last: string | null): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '??'
}

interface AbsenceRow {
  id: string
  kind: 'like' | 'skip' | 'reminder'
  contact_id: string | null
  first_name: string | null
  last_name: string | null
  subject: string | null
  motif: string | null
  occurred_at: string
  late: boolean
  ref_id: string
}

interface AbsencePayload {
  since: string | null
  signals: AbsenceRow[]
}

export interface AbsenceSignal extends HlSignalData {
  /** Cible de deep-link du CTA, et sa référence réelle. */
  route: string
  navRef?: string
  /** Identifiant de la LIGNE d'origine (rappel ou match) — cible du geste. */
  refId: string
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
  /** Avance la présence : vide le fil de façon durable. */
  markAllSeen: () => Promise<void>
  /** « Reprendre » : marque le rappel traité. Rend `false` si l'écriture échoue. */
  resumeReminder: (signal: AbsenceSignal) => Promise<boolean>
}

export function useAbsenceSignals(): UseAbsenceSignalsReturn {
  const { t, i18n } = useTranslation('dashboard')
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  // Écartement d'une ligne : local à la session, comme dans la maquette. La
  // disparition DURABLE viendra du geste (Lot 2), pas d'un accusé de lecture.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['today-absence', profile?.id],
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
    await queryClient.invalidateQueries({ queryKey: ['today-absence', profile?.id] })
  }, [queryClient, profile?.id])

  // ─── Geste « Reprendre » (Lot 2) ─────────────────────────────────────────
  // AUCUNE RPC nouvelle : `reminders` est écrite en direct par l'agent (policy
  // UPDATE agence), et la forme canonique est celle de `useReminders.markAsDone`
  // — `status='done'` + `completed_at`. Vérifié avant de l'employer : la table
  // n'a AUCUN trigger, et la seule fonction qui lit `reminders`+`done` est
  // `contact_next_action`, en LECTURE. Marquer traité n'a donc pas d'effet caché.
  const resumeReminder = useCallback(async (signal: AbsenceSignal): Promise<boolean> => {
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
      queryClient.invalidateQueries({ queryKey: ['today-absence', profile?.id] }),
      queryClient.invalidateQueries({ queryKey: ['calendar-sugar-reminders'] }),
    ])
    return true
  }, [queryClient, profile?.id, profile?.agency_id])

  // ─── Prose : le SQL rend des données, l'i18n rend des phrases ────────────
  const signals = useMemo<AbsenceSignal[]>(() => {
    const rows = data?.signals ?? []
    const relative = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })
    const timeOnly = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' })
    const dayAndTime = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', hour: '2-digit', minute: '2-digit' })

    return rows.filter((r) => !dismissed.has(r.id)).map((r) => {
      const first = r.first_name?.trim() || ''
      const who = [first, r.last_name?.trim() || ''].filter(Boolean).join(' ') || t('today.h.absence.unknownContact')
      const subject = r.subject?.trim() || t('today.h.absence.unknownProperty')
      const when = new Date(r.occurred_at)
      // Référence de temps = l'instant du FETCH, pas l'horloge lue au rendu :
      // lire l'heure pendant le rendu est impur (deux rendus, deux résultats).
      // `dataUpdatedAt` est stable entre deux refetch et décrit exactement ce
      // que le libellé prétend décrire : la donnée telle qu'elle a été reçue.
      const daysAgo = Math.round((when.getTime() - dataUpdatedAt) / 86_400_000)

      // Moins de 24 h → l'heure ; hier → « hier 21:47 » ; au-delà → jour + heure.
      const meta = daysAgo === 0
        ? timeOnly.format(when)
        : daysAgo === -1
          ? `${relative.format(-1, 'day')} ${timeOnly.format(when)}`
          : dayAndTime.format(when)

      if (r.kind === 'like') {
        return {
          id: r.id, type: 'like' as const, who, initials: initialsOf(r.first_name, r.last_name),
          av: avatarColor(r.contact_id || r.id),
          text: t('today.h.absence.liked', { subject }),
          meta, late: false,
          cta: t('today.h.absence.ctaProposeVisit'),
          route: 'contact-detail', navRef: r.contact_id ?? undefined, refId: r.ref_id,
        }
      }
      if (r.kind === 'skip') {
        return {
          id: r.id, type: 'skip' as const, who, initials: initialsOf(r.first_name, r.last_name),
          av: avatarColor(r.contact_id || r.id),
          text: t('today.h.absence.skipped', { subject }),
          // Le motif d'écartement est la donnée la plus utile du signal : il dit
          // POURQUOI recalibrer. On le montre à côté de l'horodatage.
          meta: r.motif ? `${meta} · « ${r.motif} »` : meta,
          late: false,
          cta: t('today.h.absence.ctaRecalibrate'),
          route: 'contact-detail', navRef: r.contact_id ?? undefined, refId: r.ref_id,
        }
      }
      return {
        id: r.id, type: 'rappel' as const, who, initials: initialsOf(r.first_name, r.last_name),
        av: avatarColor(r.contact_id || r.id),
        text: t('today.h.absence.reminderDue', { subject }),
        meta, late: r.late,
        cta: t('today.h.absence.ctaResume'),
        route: 'contact-detail', navRef: r.contact_id ?? undefined, refId: r.ref_id,
      }
    })
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
    markAllSeen,
    resumeReminder,
  }
}
