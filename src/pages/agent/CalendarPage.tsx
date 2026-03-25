import { useState, useCallback, useMemo } from 'react'
import { addDays, addMonths, subMonths, startOfWeek, startOfMonth, endOfMonth, endOfWeek, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, PanelRight } from 'lucide-react'
import { cn } from '@/lib/utils'

import { WeekView } from '@/components/calendar/week-view'
import { MonthView } from '@/components/calendar/month-view'
import type { CalendarEvent, EventColor, ViewType } from '@/components/calendar/week-view-types'
import { MOCK_EVENTS } from '@/components/calendar/mock-events'
import CreateVisitDialog from '@/components/calendar/CreateVisitDialog'
import { detectConflicts, expandRecurringEvents } from '@/lib/event-utils'
import VisitFeedbackDialog from '@/components/calendar/VisitFeedbackDialog'
import EventDetailSidebar from '@/components/calendar/EventDetailSidebar'
import { useVisits } from '@/hooks/useVisits'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'

/** Event category config for MEGGA real estate */
const EVENT_CATEGORIES: Record<EventColor, { label: string }> = {
  blue: { label: 'Visite' },
  purple: { label: 'Google Calendar' },
  orange: { label: 'Relance' },
  green: { label: 'Signature' },
  red: { label: 'Échéance' },
  yellow: { label: 'Autre' },
  gray: { label: 'Personnel' },
}

const ALL_COLORS = Object.keys(EVENT_CATEGORIES) as EventColor[]

export default function CalendarPage() {
  const { visits: supabaseVisits, createVisit, updateVisit, deleteVisit } = useVisits()

  const [currentDate, setCurrentDate] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  // Local events = all mock events initially (drag/edit works on all of them)
  // When Supabase visits exist, mock visits are replaced by real ones.
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(() => [...MOCK_EVENTS])

  // Compute visible range for Google Calendar fetch
  const gcalRange = useMemo(() => {
    const start = addDays(currentDate, -7)
    const end = addDays(currentDate, 35)
    return { start, end }
  }, [currentDate])

  // Google Calendar integration
  const {
    isConnected: gcalConnected,
    googleEvents,
    syncVisitToGoogle,
    updateVisitInGoogle,
    removeFromGoogle,
  } = useGoogleCalendar(gcalRange)

  // Merge: Supabase visits + Google events + local events
  const events = useMemo(() => {
    const merged: CalendarEvent[] = []

    if (supabaseVisits.length > 0) {
      merged.push(...supabaseVisits)
      // Exclude mock visits (blue with visitStatus) — replaced by Supabase visits
      const nonVisitLocal = localEvents.filter((e) => !(e.color === 'blue' && e.visitStatus))
      merged.push(...nonVisitLocal)
    } else {
      merged.push(...localEvents)
    }

    // Add Google Calendar events (purple, read-only)
    if (googleEvents.length > 0) {
      // Exclude Google events that are already synced MEGGA visits (to avoid duplicates)
      const meggaVisitIds = new Set(supabaseVisits.map(v => v.id))
      const filteredGoogleEvents = googleEvents.filter(ge => {
        // Google events have id like "gcal_xxx" — no overlap with MEGGA UUIDs
        return !meggaVisitIds.has(ge.id)
      })
      merged.push(...filteredGoogleEvents)
    }

    return merged
  }, [supabaseVisits, localEvents, googleEvents])

  const [selectedEventId, setSelectedEventId] = useState<string | undefined>()
  const [view, setView] = useState<ViewType>('week')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Filter state — all colors active by default
  const [activeFilters, setActiveFilters] = useState<Set<EventColor>>(() => new Set(ALL_COLORS))

  // Compute visible range for recurring event expansion
  const visibleRange = useMemo(() => {
    if (view === 'month') {
      const ms = startOfMonth(currentDate)
      return { start: startOfWeek(ms, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(ms), { weekStartsOn: 1 }) }
    }
    if (view === 'day') {
      return { start: currentDate, end: addDays(currentDate, 1) }
    }
    // week: show 2 weeks buffer
    return { start: addDays(currentDate, -7), end: addDays(currentDate, 14) }
  }, [view, currentDate])

  const filteredEvents = useMemo(() => {
    const colorFiltered = events.filter((e) => activeFilters.has(e.color ?? 'blue'))
    return expandRecurringEvents(colorFiltered, visibleRange.start, visibleRange.end)
  }, [events, activeFilters, visibleRange])

  const conflictIds = useMemo(
    () => detectConflicts(filteredEvents),
    [filteredEvents]
  )

  const toggleFilter = useCallback((color: EventColor) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(color)) {
        if (next.size > 1) next.delete(color)
      } else {
        next.add(color)
      }
      return next
    })
  }, [])

  // Create event dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>()

  // Feedback dialog state
  const [feedbackEvent, setFeedbackEvent] = useState<CalendarEvent | null>(null)

  const handlePrev = useCallback(() => {
    if (view === 'month') setCurrentDate((d) => subMonths(d, 1))
    else if (view === 'day') setCurrentDate((d) => addDays(d, -1))
    else setCurrentDate((d) => addDays(d, -7))
  }, [view])

  const handleNext = useCallback(() => {
    if (view === 'month') setCurrentDate((d) => addMonths(d, 1))
    else if (view === 'day') setCurrentDate((d) => addDays(d, 1))
    else setCurrentDate((d) => addDays(d, 7))
  }, [view])

  const handleToday = useCallback(() => {
    const today = new Date()
    if (view === 'month') setCurrentDate(startOfMonth(today))
    else if (view === 'day') setCurrentDate(today)
    else setCurrentDate(startOfWeek(today, { weekStartsOn: 1 }))
  }, [view])

  const handleViewChange = useCallback((newView: ViewType) => {
    const today = new Date()
    if (newView === 'month') setCurrentDate(startOfMonth(today))
    else if (newView === 'day') setCurrentDate(today)
    else setCurrentDate(startOfWeek(today, { weekStartsOn: 1 }))
    setView(newView)
  }, [])

  // Click event → open sidebar directly (toggle if same event)
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEventId((prev) => {
      if (prev === event.id) {
        // Re-click same event → close sidebar
        setIsSidebarOpen(false)
        return undefined
      }
      // Click new event → open sidebar
      setIsSidebarOpen(true)
      return event.id
    })
  }, [])

  const handleEventChange = useCallback((updated: CalendarEvent) => {
    // Check if this is a Supabase visit (UUID format) vs mock event
    const isSupabaseVisit = updated.visitStatus && !updated.id.startsWith('evt-')

    if (isSupabaseVisit) {
      // Persist to Supabase
      const oldVisit = supabaseVisits.find((e) => e.id === updated.id)
      if (updated.visitStatus === 'done' && oldVisit?.visitStatus !== 'done') {
        setFeedbackEvent(updated)
      }
      updateVisit(updated)
        .then(() => {
          if (gcalConnected) updateVisitInGoogle(updated.id).catch(() => {})
        })
        .catch(() => {})
    } else {
      // Local event — update in local state
      setLocalEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
      if (updated.visitStatus === 'done') {
        const old = localEvents.find((e) => e.id === updated.id)
        if (old?.visitStatus !== 'done') setFeedbackEvent(updated)
      }
    }
  }, [supabaseVisits, localEvents, updateVisit, gcalConnected, updateVisitInGoogle])

  const handleFeedbackSubmit = useCallback((event: CalendarEvent, feedback: { feedbackBuyer: string; feedbackAgent: string; rating: number }) => {
    const updated: CalendarEvent = {
      ...event,
      visitStatus: 'done' as const,
      feedbackBuyer: feedback.feedbackBuyer,
      feedbackAgent: feedback.feedbackAgent,
      rating: feedback.rating,
    }

    const isSupabaseVisit = !event.id.startsWith('evt-')
    if (isSupabaseVisit) {
      updateVisit(updated).catch(() => {})
    } else {
      setLocalEvents((prev) => prev.map((e) => (e.id === event.id ? updated : e)))
    }
  }, [updateVisit])

  // Click background → deselect event + close sidebar
  const handleBackgroundClick = useCallback(() => {
    setSelectedEventId(undefined)
    setIsSidebarOpen(false)
  }, [])

  // Toggle sidebar open/close via header button
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  // Slot click → open create dialog with pre-filled date/time
  const handleSlotClick = useCallback((date: Date) => {
    setCreateInitialDate(date)
    setShowCreateDialog(true)
  }, [])

  // "+" button → open create dialog with current time
  const handleCreateNew = useCallback(() => {
    setCreateInitialDate(undefined)
    setShowCreateDialog(true)
  }, [])

  // Add new event from dialog
  const handleCreateEvent = useCallback((newEvent: CalendarEvent) => {
    // If it's a visit with contact + property, persist to Supabase
    const isVisit = newEvent.color === 'blue' && newEvent.contactId && newEvent.propertyId
    if (isVisit) {
      createVisit(newEvent)
        .then((created) => {
          // Sync to Google Calendar if connected
          if (gcalConnected && created?.id) syncVisitToGoogle(created.id).catch(() => {})
        })
        .catch(() => {
          // Fallback: add to local state if DB save fails
          setLocalEvents((prev) => [...prev, newEvent])
        })
    } else {
      setLocalEvents((prev) => [...prev, newEvent])
    }
  }, [createVisit, gcalConnected, syncVisitToGoogle])

  // Duplicate event (1h later, new ID)
  const handleDuplicate = useCallback((event: CalendarEvent) => {
    const offset = 60 * 60 * 1000 // 1h
    const duplicate: CalendarEvent = {
      ...event,
      id: `evt-${Date.now()}`,
      start: new Date(event.start.getTime() + offset),
      end: new Date(event.end.getTime() + offset),
      title: `${event.title} (copie)`,
    }
    const isVisit = duplicate.color === 'blue' && duplicate.contactId && duplicate.propertyId
    if (isVisit) {
      createVisit(duplicate).catch(() => {
        setLocalEvents((prev) => [...prev, duplicate])
      })
    } else {
      setLocalEvents((prev) => [...prev, duplicate])
    }
  }, [createVisit])

  // Delete event
  const handleDelete = useCallback((eventId: string) => {
    // Don't allow deleting Google Calendar events
    if (eventId.startsWith('gcal_')) return

    const isSupabaseVisit = !eventId.startsWith('evt-')
    if (isSupabaseVisit) {
      // Remove from Google first, then delete locally
      if (gcalConnected) removeFromGoogle(eventId).catch(() => {})
      deleteVisit(eventId).catch(() => {})
    } else {
      setLocalEvents((prev) => prev.filter((e) => e.id !== eventId))
    }
    setSelectedEventId((prev) => prev === eventId ? undefined : prev)
    setIsSidebarOpen((prev) => {
      if (selectedEventId === eventId) return false
      return prev
    })
  }, [selectedEventId, deleteVisit, gcalConnected, removeFromGoogle])

  // Computed selected event for sidebar
  const selectedEvent = useMemo(
    () => selectedEventId ? events.find((e) => e.id === selectedEventId) : undefined,
    [selectedEventId, events]
  )

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false)
    setSelectedEventId(undefined)
  }, [])

  // Format header date for French locale
  const headerDate = useMemo(() => {
    if (view === 'day') {
      const formatted = format(currentDate, "EEEE d MMMM yyyy", { locale: fr })
      return formatted.charAt(0).toUpperCase() + formatted.slice(1)
    }
    const formatted = format(currentDate, 'MMMM yyyy', { locale: fr })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }, [currentDate, view])

  return (
    <div className="flex h-full flex-col">
      {/* Calendar header */}
      <div className="flex items-center justify-between border-b border-theme-border px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-theme-primary">
            {headerDate}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="flex h-7 w-7 items-center justify-center rounded-md text-theme-secondary hover:bg-theme-hover hover:text-theme-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              className="flex h-7 w-7 items-center justify-center rounded-md text-theme-secondary hover:bg-theme-hover hover:text-theme-primary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={handleToday}
            className="h-7 rounded-md border border-theme-border px-3 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={handleCreateNew}
            className="flex h-7 items-center gap-1.5 rounded-md border border-theme-border px-3 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouveau
          </button>
          {/* View toggle */}
          <div className="flex h-7 rounded-md border border-theme-border overflow-hidden">
            {(['day', 'week', 'month'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => handleViewChange(v)}
                className={cn(
                  'px-2.5 text-xs font-medium transition-colors',
                  v !== 'day' && 'border-l border-theme-border',
                  view === v
                    ? 'bg-accent/10 text-accent'
                    : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
                )}
              >
                {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
        </div>

        {/* Legend — clickable filters + sidebar toggle */}
        <div className="flex items-center gap-1">
          {(Object.entries(EVENT_CATEGORIES) as [EventColor, { label: string }][]).map(([color, config]) => {
            const isActive = activeFilters.has(color)
            return (
              <button
                key={color}
                type="button"
                onClick={() => toggleFilter(color)}
                className={cn(
                  'flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs transition-all border',
                  isActive
                    ? 'border-theme-border text-theme-primary'
                    : 'border-transparent text-theme-tertiary opacity-50'
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full transition-opacity',
                    `bg-event-${color}-border`,
                    !isActive && 'opacity-40'
                  )}
                />
                {config.label}
              </button>
            )
          })}
          {/* Sidebar toggle button */}
          <button
            onClick={handleToggleSidebar}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md ml-2 transition-colors',
              isSidebarOpen
                ? 'text-accent bg-accent/10'
                : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
            )}
            title="Panneau de détail"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar body + sidebar overlay */}
      <div className="relative flex-1 overflow-hidden">
        {view === 'month' ? (
          <MonthView
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={handleEventClick}
            onEventChange={handleEventChange}
            selectedEventId={selectedEventId}
            onBackgroundClick={handleBackgroundClick}
            onSlotClick={handleSlotClick}
            className="h-full"
          />
        ) : (
          <WeekView
            view={view}
            currentDate={currentDate}
            events={filteredEvents}
            onEventClick={handleEventClick}
            selectedEventId={selectedEventId}
            onBackgroundClick={handleBackgroundClick}
            onDateChange={setCurrentDate}
            onEventChange={handleEventChange}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            conflictIds={conflictIds}
            onSlotClick={handleSlotClick}
            className="h-full"
          />
        )}

        {/* Detail sidebar — absolute overlay with slide animation */}
        <div
          className={cn(
            'absolute top-0 right-0 bottom-0 z-30 transition-transform duration-200 ease-out',
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <EventDetailSidebar
            event={selectedEvent}
            allEvents={filteredEvents}
            onClose={handleCloseSidebar}
            onEventChange={handleEventChange}
            onDateSelect={(date) => {
              if (view === 'day') setCurrentDate(date)
              else if (view === 'week') setCurrentDate(startOfWeek(date, { weekStartsOn: 1 }))
              else setCurrentDate(startOfMonth(date))
            }}
            onEventClick={handleEventClick}
          />
        </div>
      </div>

      {/* Create event dialog */}
      <CreateVisitDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        initialDate={createInitialDate}
        onCreateEvent={handleCreateEvent}
      />

      {/* Feedback dialog — opens when visit is marked as "done" */}
      <VisitFeedbackDialog
        open={!!feedbackEvent}
        onOpenChange={(open) => { if (!open) setFeedbackEvent(null) }}
        event={feedbackEvent}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  )
}
