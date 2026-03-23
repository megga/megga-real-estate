import { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { CalendarEvent, EventColor, RecurrenceFrequency } from '@/components/calendar/week-view-types'
import { MOCK_CONTACTS, MOCK_AGENT_LISTINGS } from '@/lib/mockData'

// ── Event type config ──

export type MeggaEventType = 'visit' | 'meeting' | 'reminder' | 'signing' | 'deadline' | 'personal'

const EVENT_TYPE_CONFIG: Record<MeggaEventType, { label: string; color: EventColor; defaultPrefix: string }> = {
  visit:    { label: 'Visite',      color: 'blue',   defaultPrefix: 'Visite' },
  meeting:  { label: 'Rendez-vous', color: 'purple', defaultPrefix: 'RDV' },
  reminder: { label: 'Relance',     color: 'orange', defaultPrefix: 'Rappel' },
  signing:  { label: 'Signature',   color: 'green',  defaultPrefix: 'Signature' },
  deadline: { label: 'Échéance',    color: 'red',    defaultPrefix: 'Échéance' },
  personal: { label: 'Personnel',   color: 'gray',   defaultPrefix: '' },
}

const DURATION_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1h30', minutes: 90 },
  { label: '2h', minutes: 120 },
]

const RECURRENCE_OPTIONS: { label: string; value: RecurrenceFrequency | 'none' }[] = [
  { label: 'Jamais', value: 'none' },
  { label: 'Chaque jour', value: 'daily' },
  { label: 'Chaque semaine', value: 'weekly' },
  { label: 'Toutes les 2 sem.', value: 'biweekly' },
  { label: 'Chaque mois', value: 'monthly' },
]

// ── Props ──

interface CreateVisitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  onCreateEvent: (event: CalendarEvent) => void
}

export default function CreateVisitDialog({
  open,
  onOpenChange,
  initialDate,
  onCreateEvent,
}: CreateVisitDialogProps) {
  // Key changes every time dialog opens → resets all inner state
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) setFormKey((k) => k + 1)
    onOpenChange(nextOpen)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg bg-theme-card border-theme-border">
        <DialogHeader>
          <DialogTitle className="text-theme-primary">Nouvel événement</DialogTitle>
          <DialogDescription className="text-theme-secondary">
            Planifier une visite, un rendez-vous ou une relance
          </DialogDescription>
        </DialogHeader>
        <CreateVisitForm
          key={formKey}
          initialDate={initialDate}
          onCreateEvent={onCreateEvent}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

// ── Inner form (remounted on each dialog open via key) ──

function CreateVisitForm({
  initialDate,
  onCreateEvent,
  onClose,
}: {
  initialDate?: Date
  onCreateEvent: (event: CalendarEvent) => void
  onClose: () => void
}) {
  const d = initialDate ?? new Date()

  const [eventType, setEventType] = useState<MeggaEventType>('visit')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(format(d, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(format(d, 'HH:mm'))
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [contactId, setContactId] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFrequency | 'none'>('none')

  // Handle property change → auto-fill location
  const handlePropertyChange = useCallback((newPropertyId: string) => {
    setPropertyId(newPropertyId)
    if (newPropertyId) {
      const property = MOCK_AGENT_LISTINGS.find((p) => p.id === newPropertyId)
      if (property) {
        setLocation(`${property.address}, ${property.city}`)
      }
    }
  }, [])

  // Build display title
  const displayTitle = useMemo(() => {
    const config = EVENT_TYPE_CONFIG[eventType]
    if (title) return title

    const contact = contactId
      ? MOCK_CONTACTS.find((c) => c.id === contactId)
      : null
    const property = propertyId
      ? MOCK_AGENT_LISTINGS.find((p) => p.id === propertyId)
      : null

    const parts: string[] = []
    if (config.defaultPrefix) parts.push(config.defaultPrefix)
    if (property) parts.push(`— ${property.title}`)
    else if (contact) parts.push(`— ${contact.first_name} ${contact.last_name}`)

    return parts.join(' ') || config.label
  }, [eventType, title, contactId, propertyId])

  const handleSubmit = useCallback(() => {
    const [year, month, day] = date.split('-').map(Number)
    const [hours, minutes] = startTime.split(':').map(Number)

    const start = new Date(year, month - 1, day, hours, minutes)
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

    const config = EVENT_TYPE_CONFIG[eventType]

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: displayTitle,
      start,
      end,
      color: config.color,
      location: location || undefined,
      description: notes || undefined,
      ...(recurrenceFreq !== 'none' && {
        recurrenceRule: {
          frequency: recurrenceFreq,
          count: recurrenceFreq === 'daily' ? 30 : recurrenceFreq === 'weekly' ? 12 : recurrenceFreq === 'biweekly' ? 12 : 6,
        },
        recurrence: RECURRENCE_OPTIONS.find((o) => o.value === recurrenceFreq)?.label,
      }),
    }

    onCreateEvent(newEvent)
    onClose()
  }, [date, startTime, durationMinutes, eventType, location, notes, recurrenceFreq, displayTitle, onCreateEvent, onClose])

  const isValid = date && startTime

  return (
    <div className="space-y-5 mt-2">
      {/* Event type pills */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-2 block">
          Type
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(EVENT_TYPE_CONFIG) as [MeggaEventType, typeof EVENT_TYPE_CONFIG[MeggaEventType]][]).map(
            ([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => setEventType(key)}
                className={cn(
                  'h-7 px-3 rounded-full text-xs font-medium transition-colors border',
                  eventType === key
                    ? 'border-theme-border-focus bg-accent/10 text-accent'
                    : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
                )}
              >
                {config.label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          Titre
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={displayTitle}
          className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      {/* Date + Time row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
            Heure
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>
      </div>

      {/* Duration presets */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-2 block">
          Durée
        </label>
        <div className="flex gap-1.5">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => setDurationMinutes(preset.minutes)}
              className={cn(
                'h-7 px-3 rounded-full text-xs font-medium transition-colors border',
                durationMinutes === preset.minutes
                  ? 'border-theme-border-focus bg-accent/10 text-accent'
                  : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recurrence */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-2 block">
          Récurrence
        </label>
        <div className="flex flex-wrap gap-1.5">
          {RECURRENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRecurrenceFreq(opt.value)}
              className={cn(
                'h-7 px-3 rounded-full text-xs font-medium transition-colors border',
                recurrenceFreq === opt.value
                  ? 'border-theme-border-focus bg-accent/10 text-accent'
                  : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact select */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          Contact
        </label>
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">— Aucun contact —</option>
          {MOCK_CONTACTS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name} ({c.type === 'buyer' ? 'Acheteur' : c.type === 'seller' ? 'Vendeur' : c.type})
            </option>
          ))}
        </select>
      </div>

      {/* Property select */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          Bien
        </label>
        <select
          value={propertyId}
          onChange={(e) => handlePropertyChange(e.target.value)}
          className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">— Aucun bien —</option>
          {MOCK_AGENT_LISTINGS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} — {p.address}, {p.city}
            </option>
          ))}
        </select>
      </div>

      {/* Location */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          Adresse
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Adresse du rendez-vous"
          className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes optionnelles..."
          rows={2}
          className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border-focus text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Créer
        </button>
      </div>
    </div>
  )
}
