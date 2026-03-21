import {
  Check, Clock, X, RotateCcw, Mail, MessageCircle, Bell,
  ClipboardList,
} from 'lucide-react'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import type { Reminder, ReminderChannel } from '@/hooks/useReminders'

const CHANNEL_CONFIG: Record<ReminderChannel, { icon: typeof Mail; label: string; color: string }> = {
  email:        { icon: Mail,          label: 'Email',        color: 'text-blue-600 bg-blue-100' },
  whatsapp:     { icon: MessageCircle, label: 'WhatsApp',     color: 'text-green-600 bg-green-100' },
  notification: { icon: Bell,          label: 'Notification', color: 'text-amber-600 bg-amber-100' },
  task:         { icon: ClipboardList, label: 'Tâche',        color: 'text-purple-600 bg-purple-100' },
}

interface ReminderListProps {
  reminders: Reminder[]
  onDone: (id: string) => void
  onSnooze: (id: string) => void
  onCancel: (id: string) => void
}

export default function ReminderList({ reminders, onDone, onSnooze, onCancel }: ReminderListProps) {
  if (reminders.length === 0) {
    return (
      <div className="text-center py-8">
        <Check className="h-8 w-8 text-success mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Aucune relance en attente</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {reminders.map((rem) => {
        const ch = CHANNEL_CONFIG[rem.channel]
        const ChIcon = ch.icon
        const isTriggered = rem.status === 'triggered'
        const isPast = new Date(rem.triggerAt) < new Date()

        return (
          <div
            key={rem.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border transition-colors',
              isTriggered
                ? 'bg-amber-50/50 border-amber-200'
                : 'bg-white border-border hover:bg-section/50'
            )}
          >
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', ch.color)}>
              <ChIcon className="h-4 w-4" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-primary-900 truncate">{rem.title}</p>
                {isTriggered && (
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-badge flex-shrink-0">
                    À traiter
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{rem.description}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3 inline mr-0.5" />
                  {isPast ? `Déclenché ${formatRelativeDate(rem.triggerAt)}` : `Prévu le ${formatDate(rem.triggerAt)}`}
                </span>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge', ch.color)}>
                  {ch.label}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onDone(rem.id)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-primary-400 hover:text-success hover:bg-success/10 transition-colors"
                title="Marquer comme fait"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onSnooze(rem.id)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-primary-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                title="Reporter (+3 jours)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onCancel(rem.id)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-primary-400 hover:text-danger hover:bg-danger/10 transition-colors"
                title="Annuler"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
