import { useState } from 'react'
import { CalendarDays, Clock, User, Building2, MapPin, FileText, X } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { EVENT_CONFIG, type CalendarEvent } from './calendar.types'
import { formatTime, formatDuration } from './calendarHelpers'

interface EventDetailPanelProps {
  event: CalendarEvent
  onClose: () => void
  onEdit: (event: CalendarEvent) => void
  onDelete: (eventId: string) => void
}

export default function EventDetailPanel({ event, onClose, onEdit, onDelete }: EventDetailPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const config = EVENT_CONFIG[event.type]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-theme-card rounded-xl border border-theme-border w-full max-w-md" onClick={e => e.stopPropagation()}>
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
          {confirmDelete ? (
            <>
              <span className="text-sm text-theme-secondary flex-1">Confirmer la suppression ?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-9 px-3 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => { onDelete(event.id); onClose() }}
                className="h-9 px-3 rounded-lg text-sm font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
              >
                Confirmer
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { onEdit(event); onClose() }}
                className="flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
              >
                Modifier
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-tertiary hover:text-danger hover:border-danger/30 transition-colors"
              >
                Supprimer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
