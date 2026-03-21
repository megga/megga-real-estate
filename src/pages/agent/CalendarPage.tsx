import { useState, useMemo, useCallback } from 'react'
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, X,
  MapPin, Clock, User, Building2, FileText,
  Eye, Phone, Star, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
// Button replaced by inline ghost buttons
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, getHours, getMinutes, addDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'

/* ─── Event Types ─── */

const EVENT_TYPES = ['visit', 'meeting', 'reminder', 'deadline', 'estimation'] as const
type EventType = typeof EVENT_TYPES[number]

interface CalendarEvent {
  id: string
  type: EventType
  title: string
  date: Date
  endDate: Date
  contact?: string
  property?: string
  address?: string
  notes?: string
}

const EVENT_CONFIG: Record<EventType, { label: string; color: string; bg: string; dot: string; icon: React.ElementType }> = {
  visit:      { label: 'Visite',      color: 'text-accent',  bg: 'bg-accent/10 border-accent/30',   dot: 'bg-accent',  icon: Eye },
  meeting:    { label: 'RDV client',  color: 'text-success', bg: 'bg-success/10 border-success/30', dot: 'bg-success', icon: User },
  reminder:   { label: 'Rappel',      color: 'text-warning', bg: 'bg-warning/10 border-warning/30', dot: 'bg-warning', icon: Phone },
  deadline:   { label: 'Deadline',    color: 'text-danger',  bg: 'bg-danger/10 border-danger/30',   dot: 'bg-danger',  icon: AlertTriangle },
  estimation: { label: 'Estimation',  color: 'text-purple-600', bg: 'bg-purple-50 border-purple-300/30', dot: 'bg-purple-500', icon: Star },
}

/* ─── Mock Events (Mars 2026) ─── */

const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: '1', type: 'visit', title: 'Visite Appartement Eaux-Vives',
    date: new Date(2026, 2, 2, 10, 0), endDate: new Date(2026, 2, 2, 11, 0),
    contact: 'Famille Rochat', property: '4 pièces Eaux-Vives', address: 'Rue du Lac 14, 1207 Genève',
    notes: 'Deuxième visite, intéressés par le balcon sud',
  },
  {
    id: '2', type: 'meeting', title: 'RDV Marie Rochat — signature mandat',
    date: new Date(2026, 2, 3, 14, 0), endDate: new Date(2026, 2, 3, 15, 30),
    contact: 'Marie Rochat', property: 'Studio Plainpalais', address: 'Agence MEGGA, Rue du Rhône 42',
    notes: 'Apporter le mandat exclusif signé + copie pièce identité',
  },
  {
    id: '3', type: 'reminder', title: 'Relance Jean-Marc Weber',
    date: new Date(2026, 2, 5, 9, 0), endDate: new Date(2026, 2, 5, 9, 30),
    contact: 'Jean-Marc Weber', notes: 'Relancer pour confirmation visite du 3 pièces Carouge',
  },
  {
    id: '4', type: 'visit', title: 'Visite Villa Cologny',
    date: new Date(2026, 2, 7, 11, 0), endDate: new Date(2026, 2, 7, 12, 30),
    contact: 'Pierre Müller', property: 'Villa 7 pièces Cologny', address: 'Chemin de la Colline 8, 1223 Cologny',
    notes: 'Client VIP, prévoir documentation complète + plan cadastral',
  },
  {
    id: '5', type: 'deadline', title: 'Expiration mandat Villa Cologny',
    date: new Date(2026, 2, 10, 18, 0), endDate: new Date(2026, 2, 10, 18, 0),
    property: 'Villa 7 pièces Cologny', notes: 'Mandat exclusif expire — renouveler ou archiver',
  },
  {
    id: '6', type: 'estimation', title: 'Estimation 3 pièces Carouge',
    date: new Date(2026, 2, 12, 14, 0), endDate: new Date(2026, 2, 12, 15, 0),
    contact: 'Sophie Dubois', property: '3 pièces Carouge', address: 'Place du Marché 6, 1227 Carouge',
    notes: 'Première estimation, propriétaire souhaite vendre avant été',
  },
  {
    id: '7', type: 'visit', title: 'Visite 2 pièces Servette',
    date: new Date(2026, 2, 14, 10, 30), endDate: new Date(2026, 2, 14, 11, 30),
    contact: 'Amina Bensalah', property: '2 pièces Servette', address: 'Rue de la Servette 78, 1202 Genève',
  },
  {
    id: '8', type: 'meeting', title: 'RDV Notaire — acte de vente',
    date: new Date(2026, 2, 17, 10, 0), endDate: new Date(2026, 2, 17, 12, 0),
    contact: 'Famille Rochat', property: '4 pièces Eaux-Vives', address: 'Étude Notariale Perrin, Rue Verdaine 3',
    notes: 'Acte de vente final — vérifier que tous les documents KYC sont validés',
  },
  {
    id: '9', type: 'reminder', title: 'Rappel offre Famille Keller',
    date: new Date(2026, 2, 17, 15, 0), endDate: new Date(2026, 2, 17, 15, 30),
    contact: 'Famille Keller', property: 'Duplex Champel', notes: 'Réponse attendue sur contre-offre',
  },
  {
    id: '10', type: 'visit', title: 'Visite Loft Pâquis',
    date: new Date(2026, 2, 19, 16, 0), endDate: new Date(2026, 2, 19, 17, 0),
    contact: 'Lucas Fernandez', property: 'Loft 3 pièces Pâquis', address: 'Rue de Berne 22, 1201 Genève',
  },
  {
    id: '11', type: 'estimation', title: 'Estimation Maison Thônex',
    date: new Date(2026, 2, 21, 9, 0), endDate: new Date(2026, 2, 21, 10, 30),
    contact: 'Marc Bianchi', property: 'Maison 5 pièces Thônex', address: 'Route de Jussy 45, 1226 Thônex',
    notes: 'Maison des années 70, potentiel de rénovation',
  },
  {
    id: '12', type: 'deadline', title: 'Deadline dossier KYC — Pierre Müller',
    date: new Date(2026, 2, 24, 17, 0), endDate: new Date(2026, 2, 24, 17, 0),
    contact: 'Pierre Müller', notes: 'Documents manquants : attestation de provenance des fonds',
  },
  {
    id: '13', type: 'meeting', title: 'RDV signature compromis',
    date: new Date(2026, 2, 26, 11, 0), endDate: new Date(2026, 2, 26, 12, 30),
    contact: 'Sophie Dubois', property: '3 pièces Carouge', address: 'Agence MEGGA, Rue du Rhône 42',
    notes: 'Compromis de vente — vérifier clauses suspensives',
  },
  {
    id: '14', type: 'visit', title: 'Visite Attique Champel',
    date: new Date(2026, 2, 28, 14, 0), endDate: new Date(2026, 2, 28, 15, 0),
    contact: 'Nadia Schmid', property: 'Attique 5 pièces Champel', address: 'Avenue de Champel 31, 1206 Genève',
    notes: 'Vue lac, terrasse 40m² — client avec budget confirmé',
  },
  {
    id: '15', type: 'reminder', title: 'Relance dossier financement',
    date: new Date(2026, 2, 30, 9, 0), endDate: new Date(2026, 2, 30, 9, 30),
    contact: 'Famille Rochat', notes: 'Vérifier avancement dossier hypothécaire auprès de la banque',
  },
]

/* ─── View Types ─── */

type ViewMode = 'month' | 'week' | 'day'

const VIEW_LABELS: Record<ViewMode, string> = {
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8h-20h

/* ─── Helpers ─── */

function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter(e => isSameDay(e.date, day)).sort((a, b) => a.date.getTime() - b.date.getTime())
}

function formatTime(date: Date): string {
  return format(date, 'HH:mm')
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

/* ─── Event Detail Panel ─── */

function EventDetailPanel({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const config = EVENT_CONFIG[event.type]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-theme-card rounded-card shadow-modal w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-theme-border">
          <div className="flex-1 min-w-0">
            <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-md', config.color)}>
              {config.label}
            </span>
            <h3 className="text-base font-semibold text-theme-primary mt-1.5 truncate">{event.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <CalendarDays className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-primary font-medium">
              {format(event.date, 'EEEE d MMMM yyyy', { locale: fr })}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-primary">
              {formatTime(event.date)} — {formatTime(event.endDate)}
              <span className="text-theme-tertiary ml-2">({formatDuration(event.date, event.endDate)})</span>
            </span>
          </div>

          {event.contact && (
            <div className="flex items-center gap-3 text-sm">
              <User className="w-4 h-4 text-theme-tertiary shrink-0" />
              <span className="text-theme-primary">{event.contact}</span>
            </div>
          )}

          {event.property && (
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="w-4 h-4 text-theme-tertiary shrink-0" />
              <span className="text-theme-primary">{event.property}</span>
            </div>
          )}

          {event.address && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-theme-tertiary shrink-0" />
              <span className="text-theme-secondary">{event.address}</span>
            </div>
          )}

          {event.notes && (
            <div className="flex gap-3 text-sm">
              <FileText className="w-4 h-4 text-theme-tertiary shrink-0 mt-0.5" />
              <p className="text-theme-secondary leading-relaxed">{event.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t border-theme-border">
          <button className="flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
            Modifier
          </button>
          <button className="flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-tertiary hover:text-danger hover:border-danger/30 transition-colors">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Mock Contacts & Properties for dropdowns ─── */

const MOCK_CONTACTS = [
  'Famille Rochat', 'Marie Rochat', 'Jean-Marc Weber', 'Pierre Müller',
  'Sophie Dubois', 'Amina Bensalah', 'Famille Keller', 'Lucas Fernandez',
  'Marc Bianchi', 'Nadia Schmid',
]

const MOCK_PROPERTIES = [
  '4 pièces Eaux-Vives', 'Studio Plainpalais', 'Villa 7 pièces Cologny',
  '3 pièces Carouge', '2 pièces Servette', 'Duplex Champel',
  'Loft 3 pièces Pâquis', 'Maison 5 pièces Thônex', 'Attique 5 pièces Champel',
]

/* ─── Create Event Modal ─── */

interface CreateEventForm {
  title: string
  type: EventType
  date: string
  startTime: string
  endTime: string
  contact: string
  property: string
  notes: string
}

const INITIAL_FORM: CreateEventForm = {
  title: '',
  type: 'visit',
  date: '2026-03-17',
  startTime: '10:00',
  endTime: '11:00',
  contact: '',
  property: '',
  notes: '',
}

function CreateEventModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (event: CalendarEvent) => void
}) {
  const [form, setForm] = useState<CreateEventForm>(INITIAL_FORM)

  const updateField = <K extends keyof CreateEventForm>(key: K, value: CreateEventForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const isValid = form.title.trim().length > 0 && form.date && form.startTime && form.endTime

  const handleSubmit = () => {
    if (!isValid) return
    const [y, m, d] = form.date.split('-').map(Number)
    const [sh, sm] = form.startTime.split(':').map(Number)
    const [eh, em] = form.endTime.split(':').map(Number)

    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      type: form.type,
      title: form.title.trim(),
      date: new Date(y, m - 1, d, sh, sm),
      endDate: new Date(y, m - 1, d, eh, em),
      contact: form.contact || undefined,
      property: form.property || undefined,
      notes: form.notes.trim() || undefined,
    }
    onCreate(event)
    onClose()
  }

  const selectClasses = 'w-full h-11 px-3 rounded-input border border-theme-border bg-theme-card text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors appearance-none'
  const inputClasses = 'w-full h-11 px-3 rounded-input border border-theme-border bg-theme-card text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-theme-card rounded-card shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="text-lg font-semibold text-theme-primary">Nouveau rendez-vous</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-active transition-colors">
            <X className="w-5 h-5 text-theme-tertiary" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Titre</label>
            <input
              type="text"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="Ex: Visite Appartement Eaux-Vives"
              className={inputClasses}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Type d&apos;événement</label>
            <select
              value={form.type}
              onChange={e => updateField('type', e.target.value as EventType)}
              className={selectClasses}
            >
              {EVENT_TYPES.map(type => (
                <option key={type} value={type}>{EVENT_CONFIG[type].label}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Date</label>
            <input
              type="text"
              value={form.date.split('-').reverse().join('.')}
              onChange={e => {
                const parts = e.target.value.split('.')
                if (parts.length === 3) updateField('date', `${parts[2]}-${parts[1]}-${parts[0]}`)
              }}
              placeholder="JJ.MM.AAAA"
              className={inputClasses}
            />
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1.5">Heure début</label>
              <input
                type="text"
                value={form.startTime}
                onChange={e => updateField('startTime', e.target.value)}
                placeholder="10:00"
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1.5">Heure fin</label>
              <input
                type="text"
                value={form.endTime}
                onChange={e => updateField('endTime', e.target.value)}
                placeholder="11:00"
                className={inputClasses}
              />
            </div>
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Contact lié</label>
            <select
              value={form.contact}
              onChange={e => updateField('contact', e.target.value)}
              className={selectClasses}
            >
              <option value="">— Aucun —</option>
              {MOCK_CONTACTS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Property */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Bien lié</label>
            <select
              value={form.property}
              onChange={e => updateField('property', e.target.value)}
              className={selectClasses}
            >
              <option value="">— Aucun —</option>
              {MOCK_PROPERTIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder="Informations complémentaires..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-input border border-theme-border bg-theme-card text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex-1 h-9 rounded-lg text-sm font-medium bg-accent hover:bg-accent/90 text-white transition-colors disabled:opacity-50"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Month View ─── */

function MonthView({ currentDate, events, onSelectEvent }: {
  currentDate: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
}) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div className="bg-theme-card rounded-xl shadow-card border border-theme-border overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-theme-border">
        {weekDays.map(day => (
          <div key={day} className="px-2 py-3 text-center text-xs font-medium text-theme-tertiary uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(events, day)
          const inMonth = isSameMonth(day, currentDate)
          const today = isToday(day)

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[100px] lg:min-h-[120px] border-b border-r border-theme-border/50 p-1.5 transition-colors',
                !inMonth && 'bg-theme-hover/50',
                today && 'bg-accent/10 rounded-lg',
              )}
            >
              <div className={cn(
                'text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full',
                today && 'bg-accent text-white',
                !today && inMonth && 'text-theme-primary',
                !today && !inMonth && 'text-theme-tertiary',
              )}>
                {format(day, 'd')}
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => {
                  const config = EVENT_CONFIG[event.type]
                  return (
                    <button
                      key={event.id}
                      onClick={() => onSelectEvent(event)}
                      className={cn(
                        'w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded-lg truncate border transition-all hover:shadow-card',
                        config.bg, config.color,
                      )}
                    >
                      {formatTime(event.date)} {event.title.split(' — ')[0].split(' ').slice(0, 3).join(' ')}
                    </button>
                  )
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-theme-tertiary px-1.5">+{dayEvents.length - 3} de plus</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Week View ─── */

function WeekView({ currentDate, events, onSelectEvent }: {
  currentDate: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="bg-theme-card rounded-xl shadow-card border border-theme-border overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-theme-border">
        <div className="border-r border-theme-border" />
        {weekDays.map((day, i) => (
          <div key={i} className={cn(
            'px-2 py-3 text-center border-r border-theme-border/50',
            isToday(day) && 'bg-accent/5',
          )}>
            <div className="text-xs text-theme-tertiary uppercase">{format(day, 'EEE', { locale: fr })}</div>
            <div className={cn(
              'text-lg font-semibold mt-0.5 w-9 h-9 mx-auto flex items-center justify-center rounded-full',
              isToday(day) && 'bg-accent text-white',
              !isToday(day) && 'text-theme-primary',
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] overflow-y-auto max-h-[600px]">
        {HOURS.map(hour => (
          <div key={hour} className="contents">
            <div className="h-16 border-r border-b border-theme-border/50 flex items-start justify-end pr-2 pt-0.5">
              <span className="text-xs text-theme-tertiary">{hour}:00</span>
            </div>
            {weekDays.map((day, di) => {
              const dayEvents = getEventsForDay(events, day)
              const hourEvents = dayEvents.filter(e => getHours(e.date) === hour)

              return (
                <div key={di} className={cn(
                  'h-16 border-r border-b border-theme-border/50 relative',
                  isToday(day) && 'bg-accent/[0.02]',
                )}>
                  {hourEvents.map(event => {
                    const config = EVENT_CONFIG[event.type]
                    const startMin = getMinutes(event.date)
                    const durationMin = (event.endDate.getTime() - event.date.getTime()) / 60000
                    const topPx = (startMin / 60) * 64
                    const heightPx = Math.max((durationMin / 60) * 64, 20)

                    return (
                      <button
                        key={event.id}
                        onClick={() => onSelectEvent(event)}
                        style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                        className={cn(
                          'absolute left-0.5 right-0.5 px-1.5 py-0.5 rounded border text-[10px] leading-tight overflow-hidden z-10 transition-all hover:shadow-md hover:z-20',
                          config.bg, config.color,
                        )}
                      >
                        <div className="font-medium truncate">{formatTime(event.date)}</div>
                        <div className="truncate opacity-80">{event.title.split(' — ')[0]}</div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Day View ─── */

function DayView({ currentDate, events, onSelectEvent }: {
  currentDate: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
}) {
  const dayEvents = getEventsForDay(events, currentDate)

  return (
    <div className="bg-theme-card rounded-xl shadow-card border border-theme-border overflow-hidden">
      {/* Header */}
      <div className={cn(
        'px-5 py-4 border-b border-theme-border',
        isToday(currentDate) && 'bg-accent/5',
      )}>
        <div className="text-sm text-theme-tertiary capitalize">{format(currentDate, 'EEEE', { locale: fr })}</div>
        <div className={cn(
          'text-2xl font-bold',
          isToday(currentDate) ? 'text-accent' : 'text-theme-primary',
        )}>
          {format(currentDate, 'd MMMM yyyy', { locale: fr })}
        </div>
        <div className="text-sm text-theme-tertiary mt-1">
          {dayEvents.length === 0 ? 'Aucun événement' : `${dayEvents.length} événement${dayEvents.length > 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Timeline */}
      <div className="max-h-[600px] overflow-y-auto">
        {HOURS.map(hour => {
          const hourEvents = dayEvents.filter(e => getHours(e.date) === hour)

          return (
            <div key={hour} className="flex border-b border-theme-border/30">
              <div className="w-16 shrink-0 py-3 pr-3 text-right">
                <span className="text-xs text-theme-tertiary">{hour}:00</span>
              </div>
              <div className="flex-1 py-1.5 pr-4 min-h-[64px] border-l border-theme-border/50 pl-3 space-y-1.5">
                {hourEvents.map(event => {
                  const config = EVENT_CONFIG[event.type]
                  const Icon = config.icon

                  return (
                    <button
                      key={event.id}
                      onClick={() => onSelectEvent(event)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-all hover:shadow-md',
                        config.bg,
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn('w-4 h-4 shrink-0', config.color)} />
                        <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
                        <span className="text-xs text-theme-tertiary ml-auto">
                          {formatTime(event.date)} — {formatTime(event.endDate)}
                        </span>
                      </div>
                      <div className="font-medium text-sm text-theme-primary mt-1">{event.title}</div>
                      {event.contact && (
                        <div className="text-xs text-theme-tertiary mt-0.5 flex items-center gap-1">
                          <User className="w-3 h-3" /> {event.contact}
                        </div>
                      )}
                      {event.address && (
                        <div className="text-xs text-theme-tertiary mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {event.address}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Mobile List View ─── */

function MobileListView({ events, onSelectEvent }: {
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
}) {
  const upcoming = [...events]
    .filter(e => e.date >= new Date(2026, 2, 1))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  let lastDate = ''

  return (
    <div className="space-y-2">
      {upcoming.map(event => {
        const config = EVENT_CONFIG[event.type]
        const Icon = config.icon
        const dateStr = format(event.date, 'EEEE d MMMM', { locale: fr })
        const showHeader = dateStr !== lastDate
        lastDate = dateStr // eslint-disable-line react-hooks/immutability

        return (
          <div key={event.id}>
            {showHeader && (
              <div className={cn(
                'text-sm font-semibold capitalize px-1 pt-3 pb-1',
                isToday(event.date) ? 'text-accent' : 'text-theme-primary',
              )}>
                {isToday(event.date) ? "Aujourd'hui" : dateStr}
              </div>
            )}
            <button
              onClick={() => onSelectEvent(event)}
              className="w-full text-left bg-theme-card rounded-card shadow-card p-3 flex items-start gap-3 hover:shadow-card-hover transition-shadow"
            >
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', config.bg)}>
                <Icon className={cn('w-5 h-5', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge', config.bg, config.color)}>
                    {config.label}
                  </span>
                  <span className="text-xs text-theme-tertiary ml-auto shrink-0">
                    {formatTime(event.date)} — {formatTime(event.endDate)}
                  </span>
                </div>
                <div className="font-medium text-sm text-theme-primary mt-1 truncate">{event.title}</div>
                {event.contact && (
                  <div className="text-xs text-theme-tertiary mt-0.5 truncate">{event.contact}</div>
                )}
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main Component ─── */

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 17)) // 17 mars 2026
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [events, setEvents] = useState<CalendarEvent[]>(MOCK_EVENTS)

  const handleCreateEvent = useCallback((event: CalendarEvent) => {
    setEvents(prev => [...prev, event])
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

  const navigateToday = () => setCurrentDate(new Date(2026, 2, 17))

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: fr })
    if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = addDays(weekStart, 6)
      return `${format(weekStart, 'd', { locale: fr })} — ${format(weekEnd, 'd MMMM yyyy', { locale: fr })}`
    }
    return format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })
  }, [currentDate, viewMode])

  /* Event type legend */
  const legend = (
    <div className="hidden lg:flex items-center gap-4 text-xs text-theme-tertiary">
      {EVENT_TYPES.map(type => {
        const config = EVENT_CONFIG[type]
        return (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('w-2.5 h-2.5 rounded-full', config.dot)} />
            <span>{config.label}</span>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Calendrier</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouveau RDV
        </button>
      </div>

      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button onClick={navigateToday} className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
            Aujourd&apos;hui
          </button>
          <button
            onClick={navigatePrev}
            className="p-1.5 rounded-lg hover:bg-theme-active transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-theme-secondary" />
          </button>
          <h2 className="text-lg font-semibold text-theme-primary capitalize min-w-[180px] text-center">
            {headerLabel}
          </h2>
          <button
            onClick={navigateNext}
            className="p-1.5 rounded-lg hover:bg-theme-active transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>

        {/* View toggle — hidden on mobile, show list view instead */}
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

        {legend}
      </div>

      {/* Legend on mobile */}
      <div className="flex lg:hidden flex-wrap items-center gap-3 text-xs text-theme-tertiary">
        {EVENT_TYPES.map(type => {
          const config = EVENT_CONFIG[type]
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div className={cn('w-2.5 h-2.5 rounded-full', config.dot)} />
              <span>{config.label}</span>
            </div>
          )
        })}
      </div>

      {/* Calendar views */}
      {/* Desktop/tablet: grid views */}
      <div className="hidden md:block">
        {viewMode === 'month' && (
          <MonthView currentDate={currentDate} events={events} onSelectEvent={setSelectedEvent} />
        )}
        {viewMode === 'week' && (
          <WeekView currentDate={currentDate} events={events} onSelectEvent={setSelectedEvent} />
        )}
        {viewMode === 'day' && (
          <DayView currentDate={currentDate} events={events} onSelectEvent={setSelectedEvent} />
        )}
      </div>

      {/* Mobile: list view */}
      <div className="md:hidden">
        <MobileListView events={events} onSelectEvent={setSelectedEvent} />
      </div>

      {/* Event detail modal */}
      {selectedEvent && (
        <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* Create event modal */}
      {showCreateModal && (
        <CreateEventModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateEvent} />
      )}
    </div>
  )
}
