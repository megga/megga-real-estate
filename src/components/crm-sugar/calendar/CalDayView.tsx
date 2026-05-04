// MEGGA CRM Sugar v2 — Calendar Day view + NextHero
// 1:1 port from `crm-calendar-sugar-day.jsx`.

import { useMemo } from 'react'
import { CalIcon } from './CalIcon'
import { CAL_EVENT_TYPES, CAL_PALETTE, type CalEvent } from './data'
import { fmtTime, sameDay } from './helpers'

interface CalDayViewProps {
  events: CalEvent[]
  currentDate: Date
  now: Date
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CalDayView({ events, currentDate, now, selectedId, onSelect }: CalDayViewProps) {
  const SP = CAL_PALETTE
  const TYPES = CAL_EVENT_TYPES

  const dayEvents = useMemo(() => {
    return events
      .filter(e => sameDay(e.start, currentDate))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [events, currentDate])

  const HOUR_START = 7
  const HOUR_END = 21
  const ROW_H = 64
  const TOTAL_H = (HOUR_END - HOUR_START) * ROW_H

  const eventTop = (d: Date) => {
    const h = d.getHours() + d.getMinutes() / 60
    return (h - HOUR_START) * ROW_H
  }
  const eventHeight = (e: CalEvent) => {
    const mins = (e.end.getTime() - e.start.getTime()) / 60000
    return Math.max(36, (mins / 60) * ROW_H - 6)
  }

  const isToday = sameDay(currentDate, now)
  const nowTop = isToday ? eventTop(now) : -1

  const nextEvent = isToday ? dayEvents.find(e => e.end > now) : dayEvents[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, height: '100%' }}>
      {nextEvent && (
        <CalNextHero
          event={nextEvent}
          now={now}
          isToday={isToday}
          onOpen={() => onSelect(nextEvent.id)}
        />
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: SP.card,
          borderRadius: 24,
          padding: '20px 8px 20px 0',
          boxShadow: SP.shadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '0 24px 12px 84px',
            borderBottom: `1px solid ${SP.line}`,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SP.muted,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}
          >
            Timeline · {dayEvents.length} événement{dayEvents.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {Object.values(TYPES)
              .slice(0, 5)
              .map(t => (
                <div
                  key={t.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: t.dark ? t.bg : t.accent,
                    }}
                  />
                  <span style={{ fontSize: 11, color: SP.muted, fontWeight: 600 }}>
                    {t.label}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px 0' }}>
          <div
            style={{
              position: 'relative',
              height: TOTAL_H,
              paddingLeft: 84,
            }}
          >
            {/* Hour lines */}
            {Array.from({ length: HOUR_END - HOUR_START }).map((_, i) => {
              const hour = HOUR_START + i
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: i * ROW_H,
                    height: ROW_H,
                    borderTop: `1px solid ${SP.line}`,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 16,
                      top: -8,
                      fontSize: 11,
                      fontWeight: 700,
                      color: SP.muted,
                      letterSpacing: 0.4,
                    }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                </div>
              )
            })}

            {/* "Now" indicator */}
            {isToday && nowTop >= 0 && nowTop <= TOTAL_H && (
              <div
                style={{
                  position: 'absolute',
                  left: 70,
                  right: 0,
                  top: nowTop,
                  height: 0,
                  zIndex: 5,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -8,
                    top: -6,
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: '#E54D38',
                    boxShadow: '0 0 0 3px rgba(229,77,56,0.18)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    top: -1,
                    height: 2,
                    background: '#E54D38',
                    borderRadius: 2,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: -22,
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: '#E54D38',
                    letterSpacing: 0.6,
                    background: SP.card,
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  MAINTENANT · {fmtTime(now)}
                </div>
              </div>
            )}

            {/* Events */}
            {dayEvents.map(e => {
              const t = TYPES[e.type]
              const top = eventTop(e.start)
              const h = eventHeight(e)
              const isSelected = e.id === selectedId
              const isPast = e.end < now && isToday
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  style={{
                    position: 'absolute',
                    left: 84,
                    right: 16,
                    top,
                    height: h,
                    borderRadius: 14,
                    border: 0,
                    background: t.bg,
                    color: t.ink,
                    padding: '10px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 2,
                    opacity: isPast ? 0.55 : 1,
                    boxShadow: isSelected
                      ? `0 0 0 2px ${SP.black}, 0 8px 20px rgba(11,12,14,0.16)`
                      : '0 1px 3px rgba(11,12,14,0.06)',
                    transition: 'all .18s ease',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={ev => {
                    if (!isSelected) ev.currentTarget.style.transform = 'translateX(2px)'
                  }}
                  onMouseLeave={ev => {
                    ev.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                      opacity: 0.75,
                    }}
                  >
                    <span>
                      {fmtTime(e.start)} – {fmtTime(e.end)}
                    </span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span style={{ textTransform: 'uppercase' }}>{t.label}</span>
                  </div>
                  <div
                    style={{
                      fontSize: h < 50 ? 13 : 14,
                      fontWeight: 700,
                      letterSpacing: -0.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {e.title}
                  </div>
                  {h >= 70 && e.location && (
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 500,
                        opacity: 0.7,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <CalIcon name="pin" size={11} stroke={t.ink} sw={2} />
                      {e.location}
                    </div>
                  )}
                </button>
              )
            })}

            {dayEvents.length === 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  color: SP.muted,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Journée libre — bloquez du temps pour les acheteurs chauds.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface CalNextHeroProps {
  event: CalEvent
  now: Date
  isToday: boolean
  onOpen: () => void
}

function CalNextHero({ event, now, isToday, onOpen }: CalNextHeroProps) {
  const SP = CAL_PALETTE
  const t = CAL_EVENT_TYPES[event.type]

  const diffMin = Math.round((event.start.getTime() - now.getTime()) / 60000)
  const inProgress = event.start <= now && event.end > now
  const upcoming = !inProgress && diffMin > 0

  const headline = !isToday
    ? 'Premier RDV'
    : inProgress
      ? 'EN COURS'
      : upcoming
        ? diffMin <= 60
          ? `DANS ${diffMin} MIN`
          : `À ${fmtTime(event.start)}`
        : 'DERNIER RDV'

  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%',
        textAlign: 'left',
        border: 0,
        fontFamily: 'inherit',
        background: SP.black,
        color: '#fff',
        borderRadius: 24,
        padding: 22,
        cursor: 'pointer',
        boxShadow: '0 16px 36px rgba(11,12,14,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        transition: 'transform .2s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* Time block */}
      <div
        style={{
          flexShrink: 0,
          padding: '14px 18px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.08)',
          textAlign: 'center',
          minWidth: 110,
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          {fmtTime(event.start)}
        </div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            opacity: 0.6,
            letterSpacing: 1,
            marginTop: 6,
            textTransform: 'uppercase',
          }}
        >
          {fmtTime(event.end)}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            opacity: 0.55,
            letterSpacing: 1.6,
            marginBottom: 6,
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {(inProgress || (upcoming && diffMin <= 60)) && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: inProgress ? '#10B981' : '#FCD34D',
                animation: 'calPulseDot 1.6s ease-in-out infinite',
              }}
            />
          )}
          {headline}
          <span style={{ opacity: 0.5 }}>·</span>
          <span>{t.label}</span>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: -0.6,
            marginBottom: 6,
            lineHeight: 1.2,
          }}
        >
          {event.title}
        </div>
        {event.location && (
          <div
            style={{
              fontSize: 13,
              opacity: 0.75,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CalIcon name="pin" size={13} stroke="#fff" sw={1.8} />
            {event.location}
          </div>
        )}
      </div>

      {/* Right column */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 18 }}>
        {event.contact && (
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                opacity: 0.55,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {event.contact.role}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>
              {event.contact.name}
            </div>
            {event.contact.warm && (
              <div
                style={{
                  marginTop: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.10)',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                }}
              >
                <CalIcon name="flame" size={10} stroke="#FCD34D" sw={2} />
                Chaud · {event.contact.warm}%
              </div>
            )}
          </div>
        )}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.10)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <CalIcon name="arrowR" size={18} stroke="#fff" sw={2} />
        </div>
      </div>
    </button>
  )
}
