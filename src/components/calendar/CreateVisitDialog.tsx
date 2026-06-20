import { useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { CalendarEvent, EventColor, RecurrenceFrequency } from '@/components/calendar/week-view-types'
import { useContacts } from '@/hooks/useContacts'
import { useAgencyProperties } from '@/hooks/useProperties'

// ── Event type config ──

export type MeggaEventType = 'visit' | 'meeting' | 'reminder' | 'signing' | 'deadline' | 'personal'

// Labels/préfixes traduits au render via t('createVisit.eventType.*' / 'createVisit.prefix.*').
// `hasPrefix` = false pour 'personal' (préfixe vide → titre = label).
const EVENT_TYPE_CONFIG: Record<MeggaEventType, { color: EventColor; hasPrefix: boolean }> = {
  visit:    { color: 'blue',   hasPrefix: true },
  meeting:  { color: 'purple', hasPrefix: true },
  reminder: { color: 'orange', hasPrefix: true },
  signing:  { color: 'green',  hasPrefix: true },
  deadline: { color: 'red',    hasPrefix: true },
  personal: { color: 'gray',   hasPrefix: false },
}

// Format heures/minutes (24h) — stable FR/EN, non traduit (cf. règle format heures).
const DURATION_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1h30', minutes: 90 },
  { label: '2h', minutes: 120 },
]

// Label traduit au render via t('createVisit.recurrence.*').
const RECURRENCE_OPTIONS: (RecurrenceFrequency | 'none')[] = [
  'none', 'daily', 'weekly', 'biweekly', 'monthly',
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
  const { t } = useTranslation('calendar')
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) setFormKey((k) => k + 1)
    onOpenChange(nextOpen)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg bg-theme-card border-theme-border">
        <DialogHeader>
          <DialogTitle className="text-theme-primary">{t('createVisit.title')}</DialogTitle>
          <DialogDescription className="text-theme-secondary">
            {t('createVisit.description')}
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
  const { t } = useTranslation('calendar')
  const d = initialDate ?? new Date()

  // Real Supabase data — replaces MOCK_CONTACTS / MOCK_AGENT_LISTINGS
  const { contacts } = useContacts()
  const { data: agencyProperties = [] } = useAgencyProperties()
  const properties = useMemo(
    () => agencyProperties.filter((p) => p.status === 'active'),
    [agencyProperties]
  )

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
      const property = properties.find((p) => p.id === newPropertyId)
      if (property) {
        setLocation(`${property.address}, ${property.city}`)
      }
    }
  }, [properties])

  // Build display title
  const displayTitle = useMemo(() => {
    const config = EVENT_TYPE_CONFIG[eventType]
    if (title) return title

    const contact = contactId
      ? contacts.find((c) => c.id === contactId)
      : null
    const property = propertyId
      ? properties.find((p) => p.id === propertyId)
      : null

    const parts: string[] = []
    if (config.hasPrefix) parts.push(t(`createVisit.prefix.${eventType}`))
    if (property) parts.push(`— ${property.title}`)
    else if (contact) parts.push(`— ${contact.first_name} ${contact.last_name}`)

    return parts.join(' ') || t(`createVisit.eventType.${eventType}`)
  }, [eventType, title, contactId, propertyId, contacts, properties, t])

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
      contactId: contactId || undefined,
      propertyId: propertyId || undefined,
      meggaType: eventType,
      ...(recurrenceFreq !== 'none' && {
        recurrenceRule: {
          frequency: recurrenceFreq,
          count: recurrenceFreq === 'daily' ? 30 : recurrenceFreq === 'weekly' ? 12 : recurrenceFreq === 'biweekly' ? 12 : 6,
        },
        recurrence: t(`createVisit.recurrence.${recurrenceFreq}`),
      }),
    }

    onCreateEvent(newEvent)
    onClose()
  }, [date, startTime, durationMinutes, eventType, location, notes, recurrenceFreq, displayTitle, onCreateEvent, onClose, t])

  const isValid = date && startTime

  return (
    <div className="space-y-5 mt-2">
      {/* Event type pills */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-2 block">
          {t('createVisit.field.type')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(EVENT_TYPE_CONFIG) as MeggaEventType[]).map(
            (key) => (
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
                {t(`createVisit.eventType.${key}`)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          {t('createVisit.field.title')}
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
            {t('createVisit.field.date')}
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
            {t('createVisit.field.time')}
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
          {t('createVisit.field.duration')}
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
          {t('createVisit.field.recurrence')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {RECURRENCE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRecurrenceFreq(opt)}
              className={cn(
                'h-7 px-3 rounded-full text-xs font-medium transition-colors border',
                recurrenceFreq === opt
                  ? 'border-theme-border-focus bg-accent/10 text-accent'
                  : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
              )}
            >
              {t(`createVisit.recurrence.${opt}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Contact select */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          {t('createVisit.field.contact')}
        </label>
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">{t('createVisit.noContact')}</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name} ({t(`contacts:type.${c.type}`, c.type)})
            </option>
          ))}
        </select>
      </div>

      {/* Property select */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          {t('createVisit.field.property')}
        </label>
        <select
          value={propertyId}
          onChange={(e) => handlePropertyChange(e.target.value)}
          className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">{t('createVisit.noProperty')}</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} — {p.address}, {p.city}
            </option>
          ))}
        </select>
      </div>

      {/* Location */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          {t('createVisit.field.location')}
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t('createVisit.locationPlaceholder')}
          className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          {t('createVisit.field.notes')}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('createVisit.notesPlaceholder')}
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
          {t('common:actions.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border-focus text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('common:actions.create')}
        </button>
      </div>
    </div>
  )
}
