import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, Trash2, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModerationActionDialogProps {
  open: boolean
  onClose: () => void
  propertyTitle: string
  propertyPhoto?: string
  action: 'flag' | 'remove'
  onConfirm: (reason: string) => void
}

const REASON_OPTIONS = [
  'Photo trompeuse',
  'Prix irrealiste',
  'Doublon',
  'Contenu inapproprie',
]

export default function ModerationActionDialog({
  open,
  onClose,
  propertyTitle,
  propertyPhoto,
  action,
  onConfirm,
}: ModerationActionDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')

  if (!open) return null

  const isFlag = action === 'flag'
  const actionLabel = isFlag ? 'Signaler ce bien' : 'Retirer ce bien'
  const ActionIcon = isFlag ? AlertTriangle : Trash2

  const finalReason = selectedReason === '__custom' ? customReason.trim() : selectedReason ?? ''

  function handleConfirm() {
    if (!finalReason) return
    onConfirm(finalReason)
    setSelectedReason(null)
    setCustomReason('')
  }

  function handleClose() {
    setSelectedReason(null)
    setCustomReason('')
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-theme-card rounded-xl border border-theme-border p-6 max-w-md w-full mx-4">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-md text-theme-tertiary hover:text-theme-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Property preview */}
        <div className="flex items-center gap-3 mb-5">
          {propertyPhoto ? (
            <img
              src={propertyPhoto}
              alt=""
              className="h-12 w-20 rounded-lg object-cover flex-shrink-0"
              decoding="async"
            />
          ) : (
            <div className="h-12 w-20 rounded-lg bg-theme-hover flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-theme-tertiary" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-theme-primary truncate">{propertyTitle}</p>
          </div>
        </div>

        {/* Action label */}
        <div className="flex items-center gap-2 mb-4">
          <ActionIcon className={cn('h-4 w-4', isFlag ? 'text-amber-500' : 'text-red-500')} />
          <h3 className="text-sm font-semibold text-theme-primary">{actionLabel}</h3>
        </div>

        {/* Reason pills */}
        <p className="text-xs text-theme-secondary mb-2">Raison</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {REASON_OPTIONS.map((reason) => (
            <button
              key={reason}
              onClick={() => setSelectedReason(selectedReason === reason ? null : reason)}
              className={cn(
                'h-8 px-3 rounded-lg text-xs transition-colors',
                selectedReason === reason
                  ? 'bg-theme-active text-theme-primary font-medium'
                  : 'text-theme-secondary border border-theme-border hover:text-theme-primary hover:border-theme-active'
              )}
            >
              {reason}
            </button>
          ))}
          <button
            onClick={() => setSelectedReason(selectedReason === '__custom' ? null : '__custom')}
            className={cn(
              'h-8 px-3 rounded-lg text-xs transition-colors',
              selectedReason === '__custom'
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'text-theme-secondary border border-theme-border hover:text-theme-primary hover:border-theme-active'
            )}
          >
            Autre...
          </button>
        </div>

        {/* Custom reason textarea */}
        {selectedReason === '__custom' && (
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Decrivez la raison..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none mb-3"
          />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={handleClose}
            className="h-9 px-4 text-sm text-theme-secondary hover:text-theme-primary transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!finalReason}
            className={cn(
              'h-9 px-4 text-sm font-medium border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              isFlag
                ? 'border-amber-500/30 text-amber-500 hover:border-amber-500'
                : 'border-red-500/30 text-red-500 hover:border-red-500'
            )}
          >
            {isFlag ? 'Signaler' : 'Retirer'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
