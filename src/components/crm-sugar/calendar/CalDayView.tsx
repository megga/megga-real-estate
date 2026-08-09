// MEGGA CRM Sugar — Calendar — Vue Jour (refonte « façon Google »)
// Une seule colonne timeline, aérée. Réutilise la gouttière + la colonne
// partagées (CalGrid). Pas de héro, pas de panneau.

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalPalette } from './data'
import { CAL_HOUR_END, CAL_HOUR_START, sameDay } from './helpers'
import { CalAllDayBand, CalDayColumn, CalHourGutter } from './CalGrid'
import type { CalViewProps } from './CalWeekView'

const MIN_H = 1680

export function CalDayView({
  events, currentDate, now, selectedId, onSelectEvent, onUpdateEvent, onCommitEvent, onCreateAt,
}: CalViewProps) {
  const { t } = useTranslation('calendar')
  const SP = useCalPalette()
  const isToday = sameDay(currentDate, now)
  const count = events.filter(e => sameDay(e.start, currentDate)).length

  // Au montage, cadrer sur l'heure courante (aujourd'hui) sinon le matin (~7 h).
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let r1 = 0
    let r2 = 0
    const doScroll = () => {
      const el = bodyRef.current
      if (!el || !el.scrollHeight) return
      const th = CAL_HOUR_END - CAL_HOUR_START
      const target = isToday ? Math.max(CAL_HOUR_START, now.getHours() - 1) : 7
      el.scrollTop = Math.max(0, ((target - CAL_HOUR_START) / th) * el.scrollHeight - 10)
    }
    r1 = requestAnimationFrame(() => { doScroll(); r2 = requestAnimationFrame(doScroll) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* En-tête léger : contexte du jour */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-lg) var(--crm-space-6xl)',
        borderBottom: `1px solid ${SP.line}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--crm-text-sm)', color: SP.muted, fontWeight: 700 }}>
          {count === 0 ? t('views.dayEmpty') : t('views.timelineCount', { count })}
        </span>
      </div>

      <CalAllDayBand days={[currentDate]} events={events} selectedId={selectedId} onSelect={onSelectEvent} />

      {/* Timeline scrollable */}
      <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--crm-space-md) var(--crm-space-4xl) var(--crm-space-xl)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)',
          height: '100%', minHeight: MIN_H, position: 'relative',
        }}>
          <CalHourGutter />
          <CalDayColumn
            day={currentDate} events={events} now={now} selectedId={selectedId}
            onSelect={onSelectEvent} onUpdate={onUpdateEvent} onCommit={onCommitEvent}
            onCreateAt={onCreateAt} isToday={isToday} showLocation
          />
        </div>
      </div>
    </div>
  )
}
