// MEGGA CRM Sugar v2 — Calendrier (Tier 3.i)
// 1:1 port from the Claude Design bundle (`crm-calendar-sugar.jsx`).

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CalIcon } from '@/components/crm-sugar/calendar/CalIcon'
import {
  CalCircleBtn, CalViewToggle, type CalViewId,
} from '@/components/crm-sugar/calendar/CalToolbar'
import { CalDayView } from '@/components/crm-sugar/calendar/CalDayView'
import { CalWeekView } from '@/components/crm-sugar/calendar/CalWeekView'
import { CalMonthView } from '@/components/crm-sugar/calendar/CalMonthView'
import { CalAgendaView } from '@/components/crm-sugar/calendar/CalAgendaView'
import { CalLeftPanel } from '@/components/crm-sugar/calendar/CalLeftPanel'
import { CalRightPanel } from '@/components/crm-sugar/calendar/CalRightPanel'
import {
  CAL_AI_INSIGHTS, CAL_PALETTE,
} from '@/components/crm-sugar/calendar/data'
import {
  CAL_MONTHS, fmtDate, fmtTime, sameDay,
} from '@/components/crm-sugar/calendar/helpers'
import { useCalendarSugar } from '@/hooks/useCalendarSugar'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'
import type { CalEvent } from '@/components/crm-sugar/calendar/data'
import type { CalendarEvent } from '@/components/calendar/week-view-types'

const DARK_TONE: DarkTone = 'meggaAi'

// Convertit un event Google/Outlook (CalendarEvent v1) vers CalEvent (Sugar v2)
function externalEventToCalEvent(e: CalendarEvent, kind: 'gcal' | 'ocal'): CalEvent {
  return {
    id: e.id, // "gcal_xxx" ou "ocal_xxx" — pas de collision avec les UUIDs MEGGA
    type: kind,
    title: e.title,
    location: e.location,
    start: e.start,
    end: e.end,
    notes: e.description,
  }
}

export default function CalendarSugarV2Page() {
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)
  const SP = CAL_PALETTE

  // Source de vérité : Supabase via useCalendarSugar (visites + reminders).
  // HOT_BUYERS et AI_INSIGHTS restent câblés sur le mock pour cette PR.
  const { events: meggaEvents, hotBuyers } = useCalendarSugar()

  const [view, setView] = useState<CalViewId>('day')
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, boolean>>({})

  // Fenêtre de fetch pour Google/Outlook (±60j autour de la date courante,
  // aligné sur useCalendarSugar pour cohérence)
  const calRange = useMemo(() => {
    const start = new Date(currentDate)
    start.setDate(start.getDate() - 60)
    const end = new Date(currentDate)
    end.setDate(end.getDate() + 60)
    return { start, end }
  }, [currentDate])

  const {
    isConnected: gcalConnected,
    googleEvents,
  } = useGoogleCalendar(calRange)
  const {
    isConnected: ocalConnected,
    outlookEvents,
  } = useOutlookCalendar(calRange)

  // Merge MEGGA events + Google + Outlook (en évitant les duplicats : les
  // visites synchronisées MEGGA->Google portent un visit_id en metadata Google
  // mais leur id reste "gcal_xxx" donc pas de collision avec les UUIDs MEGGA)
  const events = useMemo<CalEvent[]>(() => {
    const merged = [...meggaEvents]
    if (googleEvents.length > 0) {
      merged.push(...googleEvents.map(e => externalEventToCalEvent(e, 'gcal')))
    }
    if (outlookEvents.length > 0) {
      merged.push(...outlookEvents.map(e => externalEventToCalEvent(e, 'ocal')))
    }
    return merged.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [meggaEvents, googleEvents, outlookEvents])

  const filtered = useMemo(
    () => events.filter(e => filters[e.type] !== false),
    [events, filters],
  )
  const selected = filtered.find(e => e.id === selectedId)

  // Live clock simulé
  const [liveNow, setLiveNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => {
      setLiveNow(prev => {
        const n = new Date(prev)
        n.setMinutes(n.getMinutes() + 1)
        return n
      })
    }, 30000)
    return () => window.clearInterval(id)
  }, [])

  const headerLabel = (() => {
    if (view === 'day') return fmtDate(currentDate)
    if (view === 'week') {
      const monday = new Date(currentDate)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      return `Semaine du ${monday.getDate()} ${CAL_MONTHS[
        monday.getMonth()
      ].toLowerCase()} – ${sunday.getDate()} ${CAL_MONTHS[sunday.getMonth()].toLowerCase()}`
    }
    if (view === 'month')
      return `${CAL_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    return 'Agenda complet'
  })()

  const navDate = (delta: number) => {
    const d = new Date(currentDate)
    if (view === 'day') d.setDate(d.getDate() + delta)
    else if (view === 'week') d.setDate(d.getDate() + delta * 7)
    else if (view === 'month') d.setMonth(d.getMonth() + delta)
    setCurrentDate(d)
  }

  const renderView = () => {
    if (view === 'day')
      return (
        <CalDayView
          events={filtered}
          currentDate={currentDate}
          now={liveNow}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )
    if (view === 'week')
      return (
        <CalWeekView
          events={filtered}
          currentDate={currentDate}
          now={liveNow}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDateChange={setCurrentDate}
        />
      )
    if (view === 'month')
      return (
        <CalMonthView
          events={filtered}
          currentDate={currentDate}
          now={liveNow}
          onDateChange={setCurrentDate}
        />
      )
    return (
      <CalAgendaView
        events={filtered}
        now={liveNow}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    )
  }

  const isAgendaOrMonth = view === 'agenda' || view === 'month'

  const onCmd = () => {
    /* placeholder */
  }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':
        navigate('/dashboard'); break
      case 'pipeline':
        navigate('/dashboard/pipeline'); break
      case 'matching':
        navigate('/dashboard/matching'); break
      case 'contacts':
        navigate('/dashboard/contacts'); break
      case 'biens':
        navigate('/dashboard/listings'); break
      case 'biens-new':
        navigate('/dashboard/listings/new'); break
      case 'parcours':
        navigate('/dashboard/parcours'); break
      case 'calendar':
        break
      case 'docs':
        navigate('/dashboard/documents'); break
      case 'inbox': navigate('/dashboard/inbox'); break
      case 'kyc':
        navigate('/dashboard/kyc'); break
      case 'reseau':
        navigate('/dashboard/reseau'); break
      case 'ai':
      case 'julien':
        navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard':
        navigate('/dashboard/analytics'); break
      case 'settings':
        navigate('/dashboard/settings'); break
      default:
    }
  }

  const remainingToday = filtered.filter(
    e => sameDay(e.start, liveNow) && e.start > liveNow,
  ).length

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: sp.pageBg,
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        @keyframes calPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>

      <SugarTopNav
        active="calendar"
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="calendar"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 40px 24px 0',
            gap: 14,
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: SP.card,
              borderRadius: 18,
              padding: '12px 16px',
              boxShadow: SP.shadowSm,
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SP.muted,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                Calendrier
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: SP.ink,
                  letterSpacing: -0.4,
                  marginTop: 4,
                  lineHeight: 1.1,
                }}
              >
                {headerLabel}
              </div>
            </div>

            <div
              style={{
                width: 1,
                height: 32,
                background: SP.line,
                marginLeft: 4,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalCircleBtn
                icon={<CalIcon name="chevL" size={14} stroke={SP.inkSoft} />}
                onClick={() => navDate(-1)}
                title="Précédent"
                size={34}
              />
              <button
                onClick={() => setCurrentDate(new Date())}
                style={{
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: 0,
                  background: SP.cardSubtle,
                  color: SP.ink,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Aujourd'hui
              </button>
              <CalCircleBtn
                icon={<CalIcon name="chevR" size={14} stroke={SP.inkSoft} />}
                onClick={() => navDate(1)}
                title="Suivant"
                size={34}
              />
            </div>

            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <CalViewToggle value={view} onChange={setView} />
            </div>

            {/* Status calendriers externes */}
            {(gcalConnected || ocalConnected) && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: SP.cardSubtle,
                  flexShrink: 0,
                }}
                title="Calendriers synchronisés en lecture seule"
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: '#10B981',
                  }}
                />
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: SP.ink,
                    letterSpacing: 0.1,
                  }}
                >
                  {[gcalConnected && 'Google', ocalConnected && 'Outlook']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            )}

            <button
              onClick={() => navigate('/dashboard/visites/nouveau')}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                border: 0,
                background: SP.black,
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 6px 18px rgba(11,12,14,0.18)',
                flexShrink: 0,
              }}
            >
              <CalIcon name="plus" size={14} stroke="#fff" sw={2.4} />
              Nouvel événement
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              gap: 14,
            }}
          >
            <CalLeftPanel
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              events={events}
              filters={filters}
              onFilters={setFilters}
              hotBuyers={hotBuyers}
              aiInsights={CAL_AI_INSIGHTS}
              onSelectEvent={setSelectedId}
            />

            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              {renderView()}
            </div>

            {!isAgendaOrMonth && <CalRightPanel event={selected} />}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                borderRadius: 999,
                background: SP.card,
                boxShadow: SP.shadowSm,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: '#10B981',
                  animation: 'calPulseDot 1.6s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: SP.ink,
                  letterSpacing: 0.2,
                }}
              >
                {fmtTime(liveNow)}
              </span>
              <span style={{ fontSize: 11.5, color: SP.muted, fontWeight: 500 }}>
                · {remainingToday} RDV restants aujourd'hui
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 8px 8px 18px',
                borderRadius: 999,
                background: SP.card,
                boxShadow: SP.shadow,
                minWidth: 360,
              }}
            >
              <CalIcon name="sparkle" size={14} stroke={SP.muted} sw={2} />
              <input
                placeholder='Demander à MEGGA AI · ex : "visite Marie demain 14h"'
                style={{
                  flex: 1,
                  border: 0,
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: SP.ink,
                  background: 'transparent',
                }}
              />
              <CalCircleBtn
                icon={<CalIcon name="mic" size={14} stroke={SP.inkSoft} />}
                title="Voix"
                size={32}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
