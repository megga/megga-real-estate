import { isSameDay, format } from 'date-fns'
import type { CalendarEvent } from './calendar.types'

export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter(e => isSameDay(e.date, day)).sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm')
}

export function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`
}

export function getConflicts(events: CalendarEvent[], event: CalendarEvent): CalendarEvent[] {
  return events.filter(e => {
    if (e.id === event.id) return false
    if (!isSameDay(e.date, event.date)) return false
    // Check time overlap
    return e.date < event.endDate && e.endDate > event.date
  })
}
