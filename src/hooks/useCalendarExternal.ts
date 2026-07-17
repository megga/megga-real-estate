// MEGGA CRM — Agendas externes synchronisés → créneaux « Occupé »
// Ponte les événements Google / Outlook (type CalendarEvent) vers le modèle
// CalEvent du calendrier Sugar, en LECTURE SEULE. Conformité LBA/nLPD : AUCUN
// détail personnel n'est importé — titre forcé à « Occupé », ni lieu ni note.

import { useMemo } from 'react'
import { useGoogleCalendar } from './useGoogleCalendar'
import { useOutlookCalendar } from './useOutlookCalendar'
import type { CalEvent } from '@/components/crm-sugar/calendar/data'
import type { CalendarEvent } from '@/components/calendar/week-view-types'

function bridge(ce: CalendarEvent, source: 'google' | 'microsoft', busyTitle: string): CalEvent {
  return {
    id: ce.id, // gcal_* / ocal_* — namespace distinct, pas de collision avec les ids MEGGA
    type: 'autre',
    title: busyTitle,
    start: ce.start,
    end: ce.end,
    allDay: !!ce.isAllDay,
    external: true,
    source,
  }
}

export interface UseCalendarExternalReturn {
  externalEvents: CalEvent[]
  google: ReturnType<typeof useGoogleCalendar>
  outlook: ReturnType<typeof useOutlookCalendar>
  anyConnected: boolean
  isFetching: boolean
}

/**
 * Récupère les créneaux occupés des agendas connectés dans la fenêtre `range`
 * et les convertit en blocs « Occupé » (lecture seule). Renvoie aussi les hooks
 * bruts (connect/sync/status) pour l'onboarding et la propagation.
 */
export function useCalendarExternal(
  range: { start: Date; end: Date },
  busyTitle: string,
): UseCalendarExternalReturn {
  const google = useGoogleCalendar(range)
  const outlook = useOutlookCalendar(range)

  const externalEvents = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = []
    if (google.isConnected) for (const e of google.googleEvents) out.push(bridge(e, 'google', busyTitle))
    if (outlook.isConnected) for (const e of outlook.outlookEvents) out.push(bridge(e, 'microsoft', busyTitle))
    return out
  }, [google.isConnected, google.googleEvents, outlook.isConnected, outlook.outlookEvents, busyTitle])

  return {
    externalEvents,
    google,
    outlook,
    anyConnected: google.isConnected || outlook.isConnected,
    isFetching: google.eventsLoading || outlook.eventsLoading,
  }
}
