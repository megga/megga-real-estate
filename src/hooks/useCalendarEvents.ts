/**
 * Les ÉVÉNEMENTS du Calendrier (`calendar_events`, 15.09.2026) : ce qui n'est ni une visite,
 * ni une tâche (relance), ni un rendez-vous KYC — un rendez-vous chez le notaire, à la
 * banque, une signature, un mandat — gardé TEL QU'ON L'A SAISI : titre, début et fin, type,
 * journée entière, récurrence, lieu, notes, couleur, contact, bien, et l'e-mail d'origine.
 *
 * ⛔ Avant cette table (20260915080300), ces événements partaient en `reminders` : au
 * rechargement ils revenaient « Tâche », leur fin et leur type perdus. `CalendarApp` y écrit ;
 * `useCalendarScreen` les lit.
 */
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CalEvent } from '@/components/crm/calendar/data'
import type { Database } from '@/types/database'
import { versLigneEvenement } from '@/lib/calendrierEvenements'

type LigneEvenement = Database['public']['Tables']['calendar_events']['Insert']

/** Créer, modifier, supprimer un événement ; chaque geste relit la fenêtre du Calendrier. */
export function useCalendarEvents() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const relire = useCallback(() => qc.invalidateQueries({ queryKey: ['calendar-events'] }), [qc])

  const creer = useCallback(async (d: CalEvent): Promise<string> => {
    if (!agencyId) throw new Error('Aucune agence rattachée')
    const { data, error } = await supabase.from('calendar_events').insert({ ...versLigneEvenement(d), agency_id: agencyId }).select('id').single()
    if (error) throw error
    await relire()
    return data.id
  }, [agencyId, relire])

  const modifier = useCallback(async (id: string, patch: Partial<Omit<LigneEvenement, 'agency_id'>>): Promise<void> => {
    const { error } = await supabase.from('calendar_events').update(patch).eq('id', id)
    if (error) throw error
    await relire()
  }, [relire])

  const supprimer = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) throw error
    await relire()
  }, [relire])

  return { creer, modifier, supprimer }
}
