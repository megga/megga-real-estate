import {
  Check, X, RotateCcw,
} from 'lucide-react'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import type { Reminder, ReminderChannel } from '@/hooks/useReminders'

const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  email: 'Email',
  notification: 'Notification',
  task: 'Tâche',
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
      <div className="flex flex-col items-center text-center py-8">
        <img src="/illustrations/maggy/Succes.svg" alt="" className="w-44 h-36 mx-auto mb-3" loading="lazy" decoding="async" />
        <p className="text-sm text-theme-tertiary">Aucune relance en attente</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-theme-border">
      {reminders.map((rem, i) => {
        const isTriggered = rem.status === 'triggered'
        const isPast = new Date(rem.triggerAt) < new Date()

        return (
          <div
            key={rem.id}
            className={cn(
              'flex items-center gap-3 px-4 py-3 group hover:bg-theme-hover transition-colors',
              i < reminders.length - 1 && 'border-b border-theme-border'
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-theme-primary truncate">{rem.title}</p>
                {isTriggered && (
                  <span className="text-xs font-medium text-amber-500 shrink-0">À traiter</span>
                )}
              </div>
              {rem.description && (
                <p className="text-xs text-theme-tertiary mt-0.5 truncate">{rem.description}</p>
              )}
            </div>

            {/* Channel */}
            <span className="text-xs text-theme-tertiary shrink-0 hidden sm:block">
              {CHANNEL_LABEL[rem.channel]}
            </span>

            {/* Date */}
            <span className="text-xs text-theme-tertiary shrink-0 w-20 text-right hidden sm:block">
              {isPast ? formatRelativeDate(rem.triggerAt) : formatDate(rem.triggerAt)}
            </span>

            {/* Actions — visible on hover */}
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onDone(rem.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-theme-tertiary hover:text-emerald-500 hover:bg-theme-active transition-colors"
                title="Marquer comme fait"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onSnooze(rem.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-theme-tertiary hover:text-amber-500 hover:bg-theme-active transition-colors"
                title="Reporter (+3 jours)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onCancel(rem.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-theme-tertiary hover:text-red-500 hover:bg-theme-active transition-colors"
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
