import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EVENT_CONFIG, EVENT_TYPES, type CalendarEvent, type EventType } from './calendar.types'
import { addMinutesToTime } from './calendarHelpers'

/* ─── Mock data for dropdowns ─── */

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

/* ─── Types ─── */

interface CreateEventForm {
  title: string
  type: EventType
  date: string
  startTime: string
  duration: '30' | '60' | '90' | '120' | 'custom'
  endTime: string
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  contact: string
  property: string
  notes: string
}

const DURATION_OPTIONS = [
  { value: '30', label: '30min' },
  { value: '60', label: '1h' },
  { value: '90', label: '1h30' },
  { value: '120', label: '2h' },
  { value: 'custom', label: 'Autre' },
] as const

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Aucune' },
  { value: 'daily', label: 'Quotidien' },
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'monthly', label: 'Mensuel' },
] as const

/* ─── Helpers ─── */

function formatDateToInput(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

function formatTimeToInput(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function guessDurationFromDates(start: Date, end: Date): CreateEventForm['duration'] {
  const diffMin = Math.round((end.getTime() - start.getTime()) / 60000)
  if (diffMin === 30) return '30'
  if (diffMin === 60) return '60'
  if (diffMin === 90) return '90'
  if (diffMin === 120) return '120'
  return 'custom'
}

/* ─── Props ─── */

interface CreateEventModalProps {
  onClose: () => void
  onCreate: (events: CalendarEvent[]) => void
  onUpdate?: (event: CalendarEvent) => void
  editEvent?: CalendarEvent
  initialDate?: Date
  initialContact?: string
  initialProperty?: string
}

/* ─── Pill button ─── */

function PillButton({ selected, onClick, children, className }: {
  selected: boolean; onClick: () => void; children: React.ReactNode; className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
        selected
          ? 'bg-theme-active text-theme-primary border-theme-active'
          : 'border-theme-border text-theme-tertiary hover:text-theme-secondary hover:border-theme-border',
        className
      )}
    >
      {children}
    </button>
  )
}

/* ─── Component ─── */

export default function CreateEventModal({
  onClose,
  onCreate,
  onUpdate,
  editEvent,
  initialDate,
  initialContact,
  initialProperty,
}: CreateEventModalProps) {
  const isEditMode = !!editEvent

  const getInitialForm = (): CreateEventForm => {
    if (editEvent) {
      const startTimeStr = formatTimeToInput(editEvent.date)
      const endTimeStr = formatTimeToInput(editEvent.endDate)
      const duration = guessDurationFromDates(editEvent.date, editEvent.endDate)
      return {
        title: editEvent.title,
        type: editEvent.type,
        date: formatDateToInput(editEvent.date),
        startTime: startTimeStr,
        duration,
        endTime: endTimeStr,
        recurrence: 'none',
        contact: editEvent.contact || '',
        property: editEvent.property || '',
        notes: editEvent.notes || '',
      }
    }

    const defaultDate = initialDate
      ? formatDateToInput(initialDate)
      : formatDateToInput(new Date())
    const defaultStart = initialDate
      ? formatTimeToInput(initialDate)
      : '10:00'

    return {
      title: '',
      type: 'visit',
      date: defaultDate,
      startTime: defaultStart,
      duration: '60',
      endTime: addMinutesToTime(defaultStart, 60),
      recurrence: 'none',
      contact: initialContact || '',
      property: initialProperty || '',
      notes: '',
    }
  }

  const [form, setForm] = useState<CreateEventForm>(getInitialForm)

  const updateField = <K extends keyof CreateEventForm>(key: K, value: CreateEventForm[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if ((key === 'startTime' || key === 'duration') && next.duration !== 'custom') {
        next.endTime = addMinutesToTime(next.startTime, Number(next.duration))
      }
      return next
    })
  }

  const isValid = form.title.trim().length > 0 && form.date.length > 0 && form.startTime.length > 0

  const handleSubmit = () => {
    if (!isValid) return
    const [y, mo, d] = form.date.split('-').map(Number)
    const [sh, sm] = form.startTime.split(':').map(Number)
    const [eh, em] = form.endTime.split(':').map(Number)

    if (isEditMode && editEvent && onUpdate) {
      const updatedEvent: CalendarEvent = {
        ...editEvent,
        type: form.type,
        title: form.title.trim(),
        date: new Date(y, mo - 1, d, sh, sm),
        endDate: new Date(y, mo - 1, d, eh, em),
        contact: form.contact || undefined,
        property: form.property || undefined,
        notes: form.notes.trim() || undefined,
      }
      onUpdate(updatedEvent)
      onClose()
      return
    }

    const events: CalendarEvent[] = []
    const recurrenceCount = form.recurrence === 'none' ? 1 : form.recurrence === 'daily' ? 14 : 4

    for (let i = 0; i < recurrenceCount; i++) {
      const dayOffset = form.recurrence === 'daily' ? i : form.recurrence === 'weekly' ? i * 7 : 0
      const monthOffset = form.recurrence === 'monthly' ? i : 0
      const startDate = new Date(y, mo - 1 + monthOffset, d + dayOffset, sh, sm)
      const endDate = new Date(y, mo - 1 + monthOffset, d + dayOffset, eh, em)

      events.push({
        id: crypto.randomUUID(),
        type: form.type,
        title: form.title.trim(),
        date: startDate,
        endDate,
        contact: form.contact || undefined,
        property: form.property || undefined,
        notes: form.notes.trim() || undefined,
      })
    }
    onCreate(events)
    onClose()
  }

  const labelClasses = 'block text-sm font-medium text-theme-primary mb-1.5'
  const selectClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none'
  const inputClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors placeholder:text-theme-tertiary'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-theme-card rounded-xl border border-theme-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="text-base font-semibold text-theme-primary">
            {isEditMode ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-5">
          {/* ── Section 1: Quoi ── */}
          <div>
            <label className={labelClasses}>Titre</label>
            <input
              type="text"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="Ex: Visite Appartement Eaux-Vives"
              className={inputClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>Type</label>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPES.map(type => (
                <PillButton
                  key={type}
                  selected={form.type === type}
                  onClick={() => updateField('type', type)}
                >
                  {EVENT_CONFIG[type].label}
                </PillButton>
              ))}
            </div>
          </div>

          <div className="border-t border-theme-border-subtle" />

          {/* ── Section 2: Quand ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Date</label>
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
            <div>
              <label className={labelClasses}>Heure</label>
              <input
                type="text"
                value={form.startTime}
                onChange={e => updateField('startTime', e.target.value)}
                placeholder="10:00"
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <label className={labelClasses}>Durée</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_OPTIONS.map(opt => (
                <PillButton
                  key={opt.value}
                  selected={form.duration === opt.value}
                  onClick={() => updateField('duration', opt.value as CreateEventForm['duration'])}
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>
          </div>

          {form.duration === 'custom' && (
            <div className="max-w-[200px]">
              <label className={labelClasses}>Heure de fin</label>
              <input
                type="text"
                value={form.endTime}
                onChange={e => updateField('endTime', e.target.value)}
                placeholder="11:00"
                className={inputClasses}
              />
            </div>
          )}

          {!isEditMode && (
            <div>
              <label className={labelClasses}>Récurrence</label>
              <div className="flex gap-1.5">
                {RECURRENCE_OPTIONS.map(opt => (
                  <PillButton
                    key={opt.value}
                    selected={form.recurrence === opt.value}
                    onClick={() => updateField('recurrence', opt.value as CreateEventForm['recurrence'])}
                  >
                    {opt.label}
                  </PillButton>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-theme-border-subtle" />

          {/* ── Section 3: Qui / Où ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Contact</label>
              <select
                value={form.contact}
                onChange={e => updateField('contact', e.target.value)}
                className={selectClasses}
              >
                <option value="">Sélectionner...</option>
                {MOCK_CONTACTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClasses}>Bien</label>
              <select
                value={form.property}
                onChange={e => updateField('property', e.target.value)}
                className={selectClasses}
              >
                <option value="">Sélectionner...</option>
                {MOCK_PROPERTIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* ── Section 4: Notes ── */}
          <div>
            <label className={labelClasses}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              placeholder="Informations complémentaires..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none placeholder:text-theme-tertiary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-theme-border">
          <button
            onClick={onClose}
            className="text-sm text-theme-secondary hover:text-theme-primary transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={cn(
              'h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors',
              !isValid && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isEditMode ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
