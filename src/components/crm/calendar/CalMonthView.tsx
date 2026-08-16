// MEGGA CRM Sugar — Calendar — Vue Mois (refonte « façon Google »)
// Grille du mois, pastilles par jour (jusqu'à 3 + « +N autres »). Clic case vide
// → création à 09:00 ; clic pastille → bulle ; clic n° de jour → vue Jour.
// Externe « Occupé » = pastille creuse (jamais un aplat plein).

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { calTypeStyle, useCalPalette, type CalEvent } from './data'
import { calDays, fmtTime, sameDay } from './helpers'

interface CalMonthViewProps {
  events: CalEvent[]
  currentDate: Date
  now: Date
  selectedId: string | null
  onSelectEvent: (id: string, rect: DOMRect) => void
  onDateChange: (d: Date) => void
  onOpenDay: (d: Date) => void
  onCreateAt: (d: Date) => void
}

interface MonthCell { d: Date; mute: boolean }

export function CalMonthView({
  events, currentDate, now, selectedId, onSelectEvent, onOpenDay, onCreateAt,
}: CalMonthViewProps) {
  const { t } = useTranslation('calendar')
  const SP = useCalPalette()
  // En-tête lundi→dimanche : réordonne calDays() (dimanche→samedi).
  const weekdayHeaders = [1, 2, 3, 4, 5, 6, 0].map(i => calDays()[i])

  const monthKey = currentDate.getFullYear() + '-' + currentDate.getMonth()
  const cells = useMemo<MonthCell[]>(() => {
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    const startOffset = (first.getDay() + 6) % 7
    const arr: MonthCell[] = []
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(first); d.setDate(d.getDate() - (startOffset - i)); arr.push({ d, mute: true })
    }
    for (let i = 1; i <= last.getDate(); i++) {
      arr.push({ d: new Date(currentDate.getFullYear(), currentDate.getMonth(), i), mute: false })
    }
    while (arr.length % 7) { const d = new Date(arr[arr.length - 1].d); d.setDate(d.getDate() + 1); arr.push({ d, mute: true }) }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey])

  // Regroupement des events par jour (all-day/multi-jours d'abord, puis par heure).
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    const push = (k: string, e: CalEvent) => { if (!m.has(k)) m.set(k, []); m.get(k)!.push(e) }
    for (const e of events) {
      const multi = e.allDay || !sameDay(e.start, e.end)
      if (multi) {
        const d = new Date(e.start); d.setHours(0, 0, 0, 0)
        const end = new Date(e.end); end.setHours(0, 0, 0, 0)
        let guard = 0
        while (d <= end && guard < 120) {
          push(d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(), e)
          d.setDate(d.getDate() + 1); guard++
        }
      } else {
        push(e.start.getFullYear() + '-' + e.start.getMonth() + '-' + e.start.getDate(), e)
      }
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => {
        const am = a.allDay || !sameDay(a.start, a.end)
        const bm = b.allDay || !sameDay(b.start, b.end)
        if (am !== bm) return am ? -1 : 1
        return a.start.getTime() - b.start.getTime()
      })
    }
    return m
  }, [events])

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', borderBottom: `1px solid ${SP.line}`, flexShrink: 0 }}>
        {weekdayHeaders.map((d, i) => (
          <div key={i} style={{ padding: 'var(--crm-space-xl) var(--crm-space-2xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: SP.muted }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gridAutoRows: '1fr' }}>
        {cells.map((c, i) => {
          const dayEvents = eventsByDay.get(c.d.getFullYear() + '-' + c.d.getMonth() + '-' + c.d.getDate()) || []
          const isToday = sameDay(c.d, now)
          const shown = dayEvents.slice(0, 3)
          return (
            <div
              key={i}
              onClick={() => onCreateAt(new Date(c.d.getFullYear(), c.d.getMonth(), c.d.getDate(), 9, 0))}
              style={{
                borderTop: `1px solid ${SP.line}`, borderLeft: i % 7 ? `1px solid ${SP.line}` : 0,
                padding: 'var(--crm-space-sm) var(--crm-space-md) var(--crm-space-md)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)',
                minWidth: 0, minHeight: 0, opacity: c.mute ? 0.42 : 1, overflow: 'hidden',
              }}
            >
              <button
                onClick={e => { e.stopPropagation(); onOpenDay(c.d) }}
                style={{
                  alignSelf: 'flex-start', border: 0, background: isToday ? SP.accent : 'transparent',
                  color: isToday ? SP.onAccent : SP.ink, cursor: 'pointer', fontFamily: 'inherit',
                  width: 26, height: 26, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center',
                  fontSize: 'var(--crm-text-md)', fontWeight: 500,
                }}
              >
                {c.d.getDate()}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', minWidth: 0 }}>
                {shown.map(e => {
                  const ts = calTypeStyle(e, SP)
                  const ext = !!e.external
                  const hasStatus = e.status === 'done' || e.status === 'cancelled'
                  const multi = e.allDay || !sameDay(e.start, e.end)
                  const dk = SP.isDark
                  const filled = ext ? false : !dk || multi
                  return (
                    <button
                      key={e.id}
                      onClick={ev => { ev.stopPropagation(); onSelectEvent(e.id, ev.currentTarget.getBoundingClientRect()) }}
                      style={{
                        border: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-xs)',
                        background: filled ? ts.bg : 'transparent', color: ext ? SP.muted : filled ? ts.ink : SP.ink,
                        fontSize: 'var(--crm-text-xs)', fontWeight: 500, lineHeight: 1.25, opacity: hasStatus ? 0.55 : 1,
                        boxShadow: e.id === selectedId ? `0 0 0 2px ${SP.ring}` : 'none',
                        whiteSpace: 'nowrap', overflow: 'hidden',
                        textDecoration: hasStatus ? 'line-through' : 'none',
                      }}
                    >
                      {ext ? (
                        <span style={{ width: 6, height: 6, borderRadius: 'var(--crm-radius-pill)', boxShadow: `inset 0 0 0 1.5px ${SP.ghost}`, flexShrink: 0 }} />
                      ) : (
                        dk && !multi && <span style={{ width: 6, height: 6, borderRadius: 'var(--crm-radius-pill)', background: ts.accent, flexShrink: 0 }} />
                      )}
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {multi ? e.title : `${fmtTime(e.start)} · ${e.title}`}
                      </span>
                    </button>
                  )
                })}
                {dayEvents.length > 3 && (
                  <button
                    onClick={e => { e.stopPropagation(); onOpenDay(c.d) }}
                    style={{
                      border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', padding: 'var(--crm-space-2xs) var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', color: SP.muted, fontWeight: 500,
                    }}
                  >
                    {t('views.moreEvents', { count: dayEvents.length - 3 })}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
