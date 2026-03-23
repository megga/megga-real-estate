import { useState, useCallback, useMemo } from 'react'
import { addDays, startOfWeek, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

import { WeekView } from '@/components/calendar/week-view'
import type { CalendarEvent, ViewType } from '@/components/calendar/week-view-types'
import { MOCK_EVENTS } from '@/components/calendar/mock-events'
import CreateVisitDialog from '@/components/calendar/CreateVisitDialog'

/** Event category config for MEGGA real estate */
const EVENT_CATEGORIES = {
  blue: { label: 'Visite' },
  purple: { label: 'Rendez-vous' },
  orange: { label: 'Relance' },
  green: { label: 'Signature' },
  red: { label: 'Échéance' },
  gray: { label: 'Personnel' },
} as const

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [events, setEvents] = useState<CalendarEvent[]>(MOCK_EVENTS)
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>()
  const [view] = useState<ViewType>('week')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Create event dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createInitialDate, setCreateInitialDate] = useState<Date | undefined>()

  const handlePrevWeek = useCallback(() => {
    setCurrentDate((d) => addDays(d, -7))
  }, [])

  const handleNextWeek = useCallback(() => {
    setCurrentDate((d) => addDays(d, 7))
  }, [])

  const handleToday = useCallback(() => {
    setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }, [])

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEventId((prev) => (prev === event.id ? undefined : event.id))
  }, [])

  const handleEventChange = useCallback((updated: CalendarEvent) => {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }, [])

  const handleBackgroundClick = useCallback(() => {
    setSelectedEventId(undefined)
  }, [])

  const handleClosePopover = useCallback(() => {
    setSelectedEventId(undefined)
  }, [])

  const handleDockToSidebar = useCallback(() => {
    setIsSidebarOpen(true)
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
    setEvents((prev) => [...prev, newEvent])
  }, [])

  // Format header date for French locale
  const headerDate = useMemo(() => {
    const formatted = format(currentDate, 'MMMM yyyy', { locale: fr })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }, [currentDate])

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
              onClick={handlePrevWeek}
              className="flex h-7 w-7 items-center justify-center rounded-md text-theme-secondary hover:bg-theme-hover hover:text-theme-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNextWeek}
              className="flex h-7 w-7 items-center justify-center rounded-md text-theme-secondary hover:bg-theme-hover hover:text-theme-primary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={handleToday}
            className="h-7 rounded-md border border-theme-border px-3 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
          >
            Aujourd'hui
          </button>
          <button
            onClick={handleCreateNew}
            className="flex h-7 items-center gap-1.5 rounded-md border border-theme-border px-3 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouveau
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          {Object.entries(EVENT_CATEGORIES).map(([color, config]) => (
            <div key={color} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  `bg-event-${color}-border`
                )}
              />
              <span className="text-xs text-theme-secondary">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-hidden">
        <WeekView
          view={view}
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
          selectedEventId={selectedEventId}
          onBackgroundClick={handleBackgroundClick}
          onDateChange={setCurrentDate}
          onEventChange={handleEventChange}
          isSidebarOpen={isSidebarOpen}
          onDockToSidebar={handleDockToSidebar}
          onClosePopover={handleClosePopover}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onSlotClick={handleSlotClick}
          className="h-full"
        />
      </div>

      {/* Create event dialog */}
      <CreateVisitDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        initialDate={createInitialDate}
        onCreateEvent={handleCreateEvent}
      />
    </div>
  )
}
