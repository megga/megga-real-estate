import { useMemo } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { X, Phone, Mail, ExternalLink, MapPin, Clock, Star, Check, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCHF, formatSurface } from '@/lib/utils'
import { getContactById, MOCK_AGENT_LISTINGS } from '@/lib/mockData'
import type { CalendarEvent, VisitStatus } from '@/components/calendar/week-view-types'

// ── Status config ──

const STATUS_CONFIG: Record<VisitStatus, { label: string; dotClass: string }> = {
  planned:   { label: 'Planifiée',  dotClass: 'bg-gray-400' },
  confirmed: { label: 'Confirmée',  dotClass: 'bg-emerald-400' },
  done:      { label: 'Effectuée',  dotClass: 'bg-green-600' },
  cancelled: { label: 'Annulée',    dotClass: 'bg-red-400' },
  no_show:   { label: 'No-show',    dotClass: 'bg-red-600' },
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  buyer: 'Acheteur',
  seller: 'Vendeur',
  both: 'Acheteur/Vendeur',
  lead: 'Lead',
}

const SCORE_CONFIG: Record<string, { label: string; dotClass: string }> = {
  hot:  { label: 'Chaud',  dotClass: 'bg-red-500' },
  warm: { label: 'Tiède',  dotClass: 'bg-amber-400' },
  cold: { label: 'Froid',  dotClass: 'bg-blue-400' },
}

// ── Props ──

interface EventDetailSidebarProps {
  event: CalendarEvent
  onClose: () => void
  onEventChange?: (event: CalendarEvent) => void
}

export default function EventDetailSidebar({ event, onClose, onEventChange }: EventDetailSidebarProps) {
  const contact = useMemo(
    () => event.contactId ? getContactById(event.contactId) : undefined,
    [event.contactId]
  )

  const property = useMemo(
    () => event.propertyId ? MOCK_AGENT_LISTINGS.find((p) => p.id === event.propertyId) : undefined,
    [event.propertyId]
  )

  const durationMinutes = differenceInMinutes(event.end, event.start)
  const durationLabel = durationMinutes >= 60
    ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? String(durationMinutes % 60).padStart(2, '0') : ''}`
    : `${durationMinutes} min`

  const status = event.visitStatus ?? 'planned'
  const statusConfig = STATUS_CONFIG[status]

  const handleStatusChange = (newStatus: VisitStatus) => {
    onEventChange?.({ ...event, visitStatus: newStatus })
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-theme-border bg-theme-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border">
        <h3 className="text-sm font-semibold text-theme-primary">Détail</h3>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Event info ── */}
        <div className="px-4 py-3 space-y-2">
          <h4 className="text-sm font-medium text-theme-primary">{event.title}</h4>
          <div className="flex items-center gap-2 text-xs text-theme-secondary">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              {format(event.start, "EEEE d MMMM", { locale: fr })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-theme-secondary">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              {format(event.start, "HH:mm")} — {format(event.end, "HH:mm")} ({durationLabel})
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-xs text-theme-secondary">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
          {event.description && (
            <p className="text-xs text-theme-tertiary mt-1">{event.description}</p>
          )}
        </div>

        {/* ── Visit status ── */}
        <div className="px-4 py-3 border-t border-theme-border-subtle">
          <div className="text-xs font-medium text-theme-secondary mb-2">Statut</div>
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', statusConfig.dotClass)} />
            <span className="text-sm text-theme-primary">{statusConfig.label}</span>
          </div>
          {/* Quick status actions */}
          <div className="flex gap-1.5 mt-3">
            {(['confirmed', 'done', 'cancelled'] as VisitStatus[]).map((s) => {
              const cfg = STATUS_CONFIG[s]
              const isActive = status === s
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    'h-7 px-2.5 rounded-md text-xs font-medium transition-colors border',
                    isActive
                      ? 'border-theme-border-focus bg-accent/10 text-accent'
                      : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
                  )}
                >
                  {s === 'done' && <Check className="h-3 w-3 inline mr-1" />}
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Contact section ── */}
        {contact && (
          <div className="px-4 py-3 border-t border-theme-border-subtle">
            <div className="text-xs font-medium text-theme-secondary mb-3">Contact</div>
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-semibold shrink-0">
                {contact.first_name[0]}{contact.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-theme-primary">
                  {contact.first_name} {contact.last_name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-theme-secondary">
                    {CONTACT_TYPE_LABELS[contact.type] ?? contact.type}
                  </span>
                  {SCORE_CONFIG[contact.score] && (
                    <>
                      <span className={cn('h-1.5 w-1.5 rounded-full', SCORE_CONFIG[contact.score].dotClass)} />
                      <span className="text-xs text-theme-tertiary">{SCORE_CONFIG[contact.score].label}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Contact actions */}
            <div className="flex gap-2 mt-3">
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                >
                  <Phone className="h-3 w-3" />
                  Appeler
                </a>
              )}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                >
                  <Mail className="h-3 w-3" />
                  Email
                </a>
              )}
              <a
                href={`/dashboard/contacts/${contact.id}`}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Fiche
              </a>
            </div>
          </div>
        )}

        {/* ── Property section ── */}
        {property && (
          <div className="px-4 py-3 border-t border-theme-border-subtle">
            <div className="text-xs font-medium text-theme-secondary mb-3">Bien</div>
            {/* Property photo */}
            {property.photo && (
              <div className="rounded-lg overflow-hidden mb-3">
                <img
                  src={property.photo}
                  alt={property.title}
                  className="w-full h-32 object-cover"
                />
              </div>
            )}
            <div className="text-sm font-medium text-theme-primary">{property.title}</div>
            <div className="text-xs text-theme-secondary mt-0.5">{property.address}, {property.city}</div>
            <div className="flex items-center gap-3 mt-2 text-xs text-theme-secondary">
              <span className="font-medium text-theme-primary">{formatCHF(property.price)}</span>
              <span>{property.rooms}p</span>
              <span>{formatSurface(property.surface_m2)}</span>
            </div>
          </div>
        )}

        {/* ── Feedback section (only for done visits) ── */}
        {status === 'done' && (event.feedbackBuyer || event.feedbackAgent || event.rating) && (
          <div className="px-4 py-3 border-t border-theme-border-subtle">
            <div className="text-xs font-medium text-theme-secondary mb-3">Feedback</div>
            {/* Rating */}
            {event.rating && event.rating > 0 && (
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'h-3.5 w-3.5',
                      event.rating && event.rating >= star
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-theme-tertiary'
                    )}
                  />
                ))}
                <span className="text-xs text-theme-secondary ml-1">{event.rating}/5</span>
              </div>
            )}
            {/* Buyer feedback */}
            {event.feedbackBuyer && (
              <div className="mb-2">
                <div className="text-xxs text-theme-tertiary mb-1">Acheteur</div>
                <p className="text-xs text-theme-secondary leading-relaxed">{event.feedbackBuyer}</p>
              </div>
            )}
            {/* Agent notes */}
            {event.feedbackAgent && (
              <div>
                <div className="text-xxs text-theme-tertiary mb-1">Agent</div>
                <p className="text-xs text-theme-secondary leading-relaxed">{event.feedbackAgent}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state for events without contact/property ── */}
        {!contact && !property && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-theme-tertiary">
              Aucun contact ou bien lié à cet événement
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
