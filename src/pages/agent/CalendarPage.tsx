import { useState } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Clock, MapPin, User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock events
const MOCK_EVENTS = [
  {
    id: '1',
    title: 'Visite — Appartement Eaux-Vives',
    contact: 'Laurent Berset',
    address: 'Rue du Lac 12, Genève',
    time: '09:00',
    duration: '45 min',
    type: 'visit' as const,
    day: 17,
  },
  {
    id: '2',
    title: 'RDV KYC — Claudine Thévenaz',
    contact: 'Claudine Thévenaz',
    address: 'Bureau MEGGA, Genève',
    time: '11:00',
    duration: '30 min',
    type: 'meeting' as const,
    day: 17,
  },
  {
    id: '3',
    title: 'Estimation — Villa Cologny',
    contact: 'Sophie Müller',
    address: 'Ch. de la Gradelle 8, Cologny',
    time: '14:30',
    duration: '1h',
    type: 'estimation' as const,
    day: 18,
  },
  {
    id: '4',
    title: 'Visite — Maison Carouge',
    contact: 'Hans Zimmermann',
    address: 'Rue Ancienne 34, Carouge',
    time: '10:00',
    duration: '1h',
    type: 'visit' as const,
    day: 19,
  },
  {
    id: '5',
    title: 'Signature — Duplex Champel',
    contact: 'Andreas Huber',
    address: 'Étude Notariale Dupont, Genève',
    time: '16:00',
    duration: '1h30',
    type: 'signature' as const,
    day: 20,
  },
  {
    id: '6',
    title: 'Visite — Studio Plainpalais',
    contact: 'Brigitte Zufferey',
    address: 'Rue de Carouge 78, Genève',
    time: '09:30',
    duration: '30 min',
    type: 'visit' as const,
    day: 21,
  },
]

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  visit: { bg: 'bg-accent/10', text: 'text-accent', dot: 'bg-accent' },
  meeting: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  estimation: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success' },
  signature: { bg: 'bg-danger/10', text: 'text-danger', dot: 'bg-danger' },
}

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

export default function CalendarPage() {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDay, setSelectedDay] = useState(today.getDate())

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const selectedEvents = MOCK_EVENTS.filter(
    (e) => e.day === selectedDay && currentMonth === today.getMonth() && currentYear === today.getFullYear()
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Calendrier</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gérez vos visites et rendez-vous</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-button transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 focus:ring-offset-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouveau RDV
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Calendar grid */}
        <div className="bg-card rounded-card shadow-card border border-border p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-primary-900">
              {MONTHS[currentMonth]} {currentYear}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-button hover:bg-section transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
                aria-label="Mois précédent"
              >
                <ChevronLeft className="h-4 w-4 text-primary-600" aria-hidden="true" />
              </button>
              <button
                onClick={() => {
                  setCurrentMonth(today.getMonth())
                  setCurrentYear(today.getFullYear())
                  setSelectedDay(today.getDate())
                }}
                className="px-3 py-1 text-xs font-medium text-accent hover:bg-accent/10 rounded-button transition-colors"
              >
                Aujourd&apos;hui
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-button hover:bg-section transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
                aria-label="Mois suivant"
              >
                <ChevronRight className="h-4 w-4 text-primary-600" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-primary-400 uppercase tracking-wider py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-12 border-t border-border" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()
              const isSelected = day === selectedDay
              const dayEvents = MOCK_EVENTS.filter(
                (e) => e.day === day && currentMonth === today.getMonth() && currentYear === today.getFullYear()
              )

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    'h-12 flex flex-col items-center justify-center border-t border-border relative transition-colors',
                    isSelected && 'bg-accent/5',
                    !isSelected && 'hover:bg-section/50'
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full',
                      isToday && !isSelected && 'bg-accent text-white',
                      isToday && isSelected && 'bg-accent text-white',
                      isSelected && !isToday && 'bg-primary-900 text-white',
                      !isToday && !isSelected && 'text-primary-900',
                    )}
                  >
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className={cn('h-1 w-1 rounded-full', EVENT_COLORS[e.type].dot)}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Events sidebar */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-primary-900">
            {selectedDay} {MONTHS[currentMonth]} {currentYear}
          </h3>

          {selectedEvents.length === 0 ? (
            <div className="bg-card rounded-card shadow-card border border-border p-6 text-center">
              <Clock className="h-8 w-8 text-primary-200 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Aucun événement ce jour</p>
            </div>
          ) : (
            selectedEvents.map((event) => {
              const colors = EVENT_COLORS[event.type]
              return (
                <div
                  key={event.id}
                  className="bg-card rounded-card shadow-card border border-border p-4 hover:shadow-card-hover transition-shadow duration-200 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('h-2 w-2 rounded-full mt-1.5 flex-shrink-0', colors.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-primary-900">{event.title}</p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>{event.time} · {event.duration}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" aria-hidden="true" />
                          <span>{event.contact}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          <span>{event.address}</span>
                        </div>
                      </div>
                    </div>
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge', colors.bg, colors.text)}>
                      {event.time}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
