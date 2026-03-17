import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-card rounded-card shadow-modal p-6 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <div className="flex items-start gap-4">
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
              isDanger ? 'bg-danger/10' : 'bg-warning/10'
            )}>
              <AlertTriangle className={cn('h-5 w-5', isDanger ? 'text-danger' : 'text-warning')} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold text-primary-900">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground mt-1">
                {description}
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <DialogPrimitive.Close asChild>
              <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary-700 bg-card border border-border rounded-button hover:bg-section transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20">
                {cancelLabel}
              </button>
            </DialogPrimitive.Close>
            <button
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
              className={cn(
                'inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-button transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
                isDanger
                  ? 'bg-danger hover:bg-danger-dark focus:ring-danger/20'
                  : 'bg-warning hover:bg-warning-dark focus:ring-warning/20'
              )}
            >
              {confirmLabel}
            </button>
          </div>

          <DialogPrimitive.Close asChild>
            <button
              className="absolute top-4 right-4 p-1 rounded text-primary-300 hover:text-primary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
