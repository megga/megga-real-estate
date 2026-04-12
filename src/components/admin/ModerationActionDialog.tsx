import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/modal'

interface ModerationActionDialogProps {
  open: boolean
  onClose: () => void
  propertyTitle: string
  propertyPhoto?: string
  action: 'flag' | 'remove'
  onConfirm: (reason: string) => void
}

const REASON_KEYS = [
  'moderation.reason.misleadingPhoto',
  'moderation.reason.unrealisticPrice',
  'moderation.reason.duplicate',
  'moderation.reason.inappropriate',
]

export default function ModerationActionDialog({
  open,
  onClose,
  propertyTitle,
  propertyPhoto,
  action,
  onConfirm,
}: ModerationActionDialogProps) {
  const { t } = useTranslation('admin')
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')

  const isFlag = action === 'flag'
  const actionLabel = isFlag ? t('moderation.flagTitle') : t('moderation.removeTitle')

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

  return (
    <Modal open={open} onClose={handleClose} title={actionLabel} size="md">
      <div className="p-6">
        {/* Property preview */}
        <div className="flex items-center gap-3 mb-5">
          {propertyPhoto ? (
            <img
              src={propertyPhoto}
              alt=""
              className="h-12 w-20 rounded-lg object-cover flex-shrink-0"
              loading="lazy"
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

        {/* Reason pills */}
        <p className="text-xs text-theme-secondary mb-2">{t('moderation.reason')}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {REASON_KEYS.map((key) => {
            const label = t(key)
            return (
              <button
                key={key}
                onClick={() => setSelectedReason(selectedReason === label ? null : label)}
                className={cn(
                  'h-8 px-3 rounded-lg text-xs transition-colors',
                  selectedReason === label
                    ? 'bg-theme-active text-theme-primary font-medium'
                    : 'text-theme-secondary border border-theme-border hover:text-theme-primary hover:border-theme-active'
                )}
              >
                {label}
              </button>
            )
          })}
          <button
            onClick={() => setSelectedReason(selectedReason === '__custom' ? null : '__custom')}
            className={cn(
              'h-8 px-3 rounded-lg text-xs transition-colors',
              selectedReason === '__custom'
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'text-theme-secondary border border-theme-border hover:text-theme-primary hover:border-theme-active'
            )}
          >
            {t('moderation.reason.other')}
          </button>
        </div>

        {/* Custom reason textarea */}
        {selectedReason === '__custom' && (
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder={t('moderation.customReasonPlaceholder')}
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
            {t('common.cancel')}
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
            {isFlag ? t('moderation.action.flag') : t('moderation.action.remove')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
