import { useState, useMemo, useCallback } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, startOfWeek, addDays, addMonths, subMonths, parse } from 'date-fns'
import { fr } from 'date-fns/locale'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core'

import { EVENT_TYPES, VIEW_LABELS, type CalendarEvent, type ViewMode, type EventType } from '@/components/calendar/calendar.types'
import { getConflicts } from '@/components/calendar/calendarHelpers'
import { MOCK_EVENTS } from '@/components/calendar/calendarMockData'
import MonthView from '@/components/calendar/MonthView'
import WeekView from '@/components/calendar/WeekView'
import CalendarDragOverlay from '@/components/calendar/CalendarDragOverlay'
import DayView from '@/components/calendar/DayView'
import MobileListView from '@/components/calendar/MobileListView'
import EventDetailPanel from '@/components/calendar/EventDetailPanel'
import CreateEventModal from '@/components/calendar/CreateEventModal'
import EventTypeFilter from '@/components/calendar/EventTypeFilter'

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | undefined>(undefined)
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>(undefined)
  const [events, setEvents] = useState<CalendarEvent[]>(MOCK_EVENTS)
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(() => new Set(EVENT_TYPES))
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null)
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Filtered events
  const filteredEvents = useMemo(
    () => events.filter(e => activeFilters.has(e.type)),
    [events, activeFilters]
  )

  const handleCreateEvent = useCallback((newEvents: CalendarEvent[]) => {
    setEvents(prev => [...prev, ...newEvents])
  }, [])

  const handleUpdateEvent = useCallback((updated: CalendarEvent) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
  }, [])

  const handleDeleteEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId))
  }, [])

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    setEditEvent(event)
    setShowCreateModal(true)
  }, [])

  const handleClickSlot = useCallback((date: Date) => {
    setCreateInitialDate(date)
    setEditEvent(undefined)
    setShowCreateModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false)
    setEditEvent(undefined)
    setCreateInitialDate(undefined)
  }, [])

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const event = e.active.data.current?.event as CalendarEvent | undefined
    if (event) setDraggedEvent(event)
  }, [])

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setDraggedEvent(null)
    const event = e.active.data.current?.event as CalendarEvent | undefined
    const overId = e.over?.id as string | undefined
    if (!event || !overId) return

    let newDate: Date | null = null

    if (overId.startsWith('month-')) {
      // month-YYYY-MM-DD → change date, keep time
      const dateStr = overId.replace('month-', '')
      const parsed = parse(dateStr, 'yyyy-MM-dd', new Date())
      newDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), event.date.getHours(), event.date.getMinutes())
    } else if (overId.startsWith('week-')) {
      // week-YYYY-MM-DD-HH-mm → change date and hour
      const parts = overId.replace('week-', '').split('-')
      const y = Number(parts[0]), mo = Number(parts[1]) - 1, d = Number(parts[2])
      const h = Number(parts[3]), m = Number(parts[4])
      newDate = new Date(y, mo, d, h, m)
    } else if (overId.startsWith('day-')) {
      // day-HH-mm → change hour only
      const parts = overId.replace('day-', '').split('-')
      const h = Number(parts[0]), m = Number(parts[1])
      newDate = new Date(event.date.getFullYear(), event.date.getMonth(), event.date.getDate(), h, m)
    }

    if (!newDate || newDate.getTime() === event.date.getTime()) return

    // Preserve duration
    const durationMs = event.endDate.getTime() - event.date.getTime()
    const newEndDate = new Date(newDate.getTime() + durationMs)

    const updatedEvent: CalendarEvent = { ...event, date: newDate, endDate: newEndDate }

    // Check conflicts
    const conflicts = getConflicts(events, updatedEvent)
    if (conflicts.length > 0) {
      setConflictWarning(`Conflit avec : ${conflicts.map(c => c.title).join(', ')}`)
      setTimeout(() => setConflictWarning(null), 4000)
    }

    setEvents(prev => prev.map(ev => ev.id === event.id ? updatedEvent : ev))
  }, [events])

  const toggleFilter = useCallback((type: EventType) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(prev => subMonths(prev, 1))
    else if (viewMode === 'week') setCurrentDate(prev => addDays(prev, -7))
    else setCurrentDate(prev => addDays(prev, -1))
  }

  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(prev => addMonths(prev, 1))
    else if (viewMode === 'week') setCurrentDate(prev => addDays(prev, 7))
    else setCurrentDate(prev => addDays(prev, 1))
  }

  const navigateToday = () => setCurrentDate(new Date())

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: fr })
    if (viewMode === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
      const we = addDays(ws, 6)
      return `${format(ws, 'd', { locale: fr })} — ${format(we, 'd MMMM yyyy', { locale: fr })}`
    }
    return format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })
  }, [currentDate, viewMode])

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-theme-primary">Calendrier</h1>
        <button
          onClick={() => { setEditEvent(undefined); setShowCreateModal(true) }}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouveau RDV
        </button>
      </div>

      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={navigateToday} className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
            Aujourd&apos;hui
          </button>
          <button onClick={navigatePrev} className="p-1.5 rounded-lg hover:bg-theme-active transition-colors">
            <ChevronLeft className="w-5 h-5 text-theme-secondary" />
          </button>
          <h2 className="text-lg font-semibold text-theme-primary capitalize min-w-[180px] text-center">
            {headerLabel}
          </h2>
          <button onClick={navigateNext} className="p-1.5 rounded-lg hover:bg-theme-active transition-colors">
            <ChevronRight className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>

        {/* View toggle */}
        <div className="hidden md:flex items-center border border-theme-border rounded-lg p-0.5 sm:ml-auto">
          {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                viewMode === mode
                  ? 'bg-theme-active text-theme-primary'
                  : 'text-theme-tertiary hover:text-theme-secondary',
              )}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Desktop legend/filter */}
        <EventTypeFilter activeFilters={activeFilters} onToggle={toggleFilter} className="hidden lg:flex" />
      </div>

      {/* Mobile legend/filter */}
      <EventTypeFilter activeFilters={activeFilters} onToggle={toggleFilter} className="flex lg:hidden flex-wrap" />

      {/* Conflict warning toast */}
      {conflictWarning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg border border-warning/30 bg-warning/10 text-warning text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-4">
          {conflictWarning}
        </div>
      )}

      {/* Calendar views with DnD */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="hidden md:block">
          {viewMode === 'month' && (
            <MonthView currentDate={currentDate} events={filteredEvents} onSelectEvent={setSelectedEvent} onClickSlot={handleClickSlot} />
          )}
          {viewMode === 'week' && (
            <WeekView currentDate={currentDate} events={filteredEvents} onSelectEvent={setSelectedEvent} onClickSlot={handleClickSlot} />
          )}
          {viewMode === 'day' && (
            <DayView currentDate={currentDate} events={filteredEvents} onSelectEvent={setSelectedEvent} onClickSlot={handleClickSlot} />
          )}
        </div>

        <DragOverlay>
          {draggedEvent && <CalendarDragOverlay event={draggedEvent} />}
        </DragOverlay>
      </DndContext>

      {/* Mobile: list view (no DnD) */}
      <div className="md:hidden">
        <MobileListView events={filteredEvents} onSelectEvent={setSelectedEvent} />
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={handleEditEvent}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Create/Edit event modal */}
      {showCreateModal && (
        <CreateEventModal
          onClose={handleCloseModal}
          onCreate={handleCreateEvent}
          onUpdate={handleUpdateEvent}
          editEvent={editEvent}
          initialDate={createInitialDate}
        />
      )}
    </div>
  )
}
