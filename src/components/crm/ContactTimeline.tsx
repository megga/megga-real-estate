import {
  Mail, MessageCircle, Phone, MapPin, Send, StickyNote,
  FileText, DollarSign, ArrowRight, Clock, Sparkles,
} from 'lucide-react'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'

export type TimelineEventType =
  | 'email' | 'whatsapp' | 'call' | 'visit' | 'property_sent'
  | 'note' | 'document' | 'offer' | 'stage_change' | 'reminder' | 'ai_action'

interface TimelineEvent {
  id: string
  type: TimelineEventType
  description: string
  date: string
  metadata?: Record<string, unknown>
}

const EVENT_CONFIG: Record<TimelineEventType, { icon: typeof Mail; color: string; bgColor: string }> = {
  email:         { icon: Mail,           color: 'text-blue-600',    bgColor: 'bg-blue-100' },
  whatsapp:      { icon: MessageCircle,  color: 'text-green-600',   bgColor: 'bg-green-100' },
  call:          { icon: Phone,          color: 'text-purple-600',  bgColor: 'bg-purple-100' },
  visit:         { icon: MapPin,         color: 'text-orange-600',  bgColor: 'bg-orange-100' },
  property_sent: { icon: Send,           color: 'text-cyan-600',    bgColor: 'bg-cyan-100' },
  note:          { icon: StickyNote,     color: 'text-yellow-600',  bgColor: 'bg-yellow-100' },
  document:      { icon: FileText,       color: 'text-gray-600',    bgColor: 'bg-gray-100' },
  offer:         { icon: DollarSign,     color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  stage_change:  { icon: ArrowRight,     color: 'text-indigo-600',  bgColor: 'bg-indigo-100' },
  reminder:      { icon: Clock,          color: 'text-amber-600',   bgColor: 'bg-amber-100' },
  ai_action:     { icon: Sparkles,       color: 'text-violet-600',  bgColor: 'bg-violet-100' },
}

// Map legacy activity actions to enriched timeline event types
function mapActionToType(action: string): TimelineEventType {
  const mapping: Record<string, TimelineEventType> = {
    contact_created: 'note',
    call: 'call',
    email: 'email',
    visit: 'visit',
    visit_planned: 'visit',
    offer_sent: 'offer',
    offer_received: 'offer',
    negotiation: 'stage_change',
    document: 'document',
    reserved: 'stage_change',
  }
  return mapping[action] || 'note'
}

interface ContactTimelineProps {
  activities: { id: string; action: string; description: string; date: string }[]
  className?: string
}

export default function ContactTimeline({ activities, className }: ContactTimelineProps) {
  // Convert legacy activities to enriched timeline events
  const events: TimelineEvent[] = activities.map((a) => ({
    id: a.id,
    type: mapActionToType(a.action),
    description: a.description,
    date: a.date,
  }))

  if (events.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <Clock className="h-8 w-8 text-primary-300 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Aucune activité enregistrée</p>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {/* Timeline vertical line */}
      <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {events.map((event, i) => {
          const config = EVENT_CONFIG[event.type]
          const Icon = config.icon
          const isFirst = i === 0

          return (
            <div key={event.id} className="relative flex gap-4">
              <div className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                isFirst ? config.bgColor : 'bg-white border-2 border-border'
              )}>
                <Icon className={cn('h-4 w-4', isFirst ? config.color : 'text-primary-400')} />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn(
                    'text-sm',
                    isFirst ? 'font-medium text-primary-900' : 'text-primary-700'
                  )}>
                    {event.description}
                  </p>
                  <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-badge flex-shrink-0 whitespace-nowrap',
                    config.bgColor, config.color
                  )}>
                    {event.type === 'email' && 'Email'}
                    {event.type === 'whatsapp' && 'WhatsApp'}
                    {event.type === 'call' && 'Appel'}
                    {event.type === 'visit' && 'Visite'}
                    {event.type === 'property_sent' && 'Bien envoyé'}
                    {event.type === 'note' && 'Note'}
                    {event.type === 'document' && 'Document'}
                    {event.type === 'offer' && 'Offre'}
                    {event.type === 'stage_change' && 'Pipeline'}
                    {event.type === 'reminder' && 'Relance'}
                    {event.type === 'ai_action' && 'IA'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(event.date)} · {formatRelativeDate(event.date)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
