import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast, type ToastVariant } from '@/hooks/useToast'

const variantStyles: Record<ToastVariant, { container: string; icon: typeof CheckCircle2 }> = {
  default: { container: 'bg-white border-border', icon: Info },
  success: { container: 'bg-white border-success/30', icon: CheckCircle2 },
  error:   { container: 'bg-white border-danger/30', icon: AlertCircle },
  warning: { container: 'bg-white border-warning/30', icon: AlertTriangle },
  info:    { container: 'bg-white border-accent/30', icon: Info },
}

const iconColors: Record<ToastVariant, string> = {
  default: 'text-primary-400',
  success: 'text-success',
  error:   'text-danger',
  warning: 'text-warning',
  info:    'text-accent',
}

export default function Toaster() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)]"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const variant = t.variant || 'default'
        const styles = variantStyles[variant]
        const Icon = styles.icon

        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-card border p-4 shadow-dropdown animate-in slide-in-from-bottom-2 fade-in duration-200',
              styles.container
            )}
            role="status"
          >
            <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconColors[variant])} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-900">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 p-0.5 rounded text-primary-300 hover:text-primary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
              aria-label="Fermer la notification"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
