import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Contact, ContactType } from '@/types/contact'
import type { ContactScore } from '@/lib/constants'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

const TYPE_OPTIONS: { value: ContactType; labelKey: string }[] = [
  { value: 'buyer', labelKey: 'type.buyer' },
  { value: 'seller', labelKey: 'type.seller' },
  { value: 'both', labelKey: 'type.both' },
  { value: 'lead', labelKey: 'type.lead' },
]

const SCORE_OPTIONS: { value: ContactScore; labelKey: string }[] = [
  { value: 'hot', labelKey: 'score.hot' },
  { value: 'warm', labelKey: 'score.warm' },
  { value: 'cold', labelKey: 'score.cold' },
]

const SOURCE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'manual', labelKey: 'editDialog.source.manual' },
  { value: 'website', labelKey: 'editDialog.source.website' },
  { value: 'referral', labelKey: 'editDialog.source.referral' },
  { value: 'portal', labelKey: 'editDialog.source.portal' },
  { value: 'social', labelKey: 'editDialog.source.social' },
]

const inputClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'
const selectClasses = cn(inputClasses, 'appearance-none')

interface EditContactDialogProps {
  open: boolean
  onClose: () => void
  contact: Contact
}

export default function EditContactDialog({ open, onClose, contact }: EditContactDialogProps) {
  const { t } = useTranslation('contacts')
  const [firstName, setFirstName] = useState(contact.first_name)
  const [lastName, setLastName] = useState(contact.last_name)
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [type, setType] = useState<ContactType>(contact.type)
  const [score, setScore] = useState<ContactScore>(contact.score ?? 'cold')
  const [source, setSource] = useState(contact.source ?? 'manual')
  const [notes, setNotes] = useState(contact.notes || '')

  // Reset form when contact changes — setState in effect is intentional (sync with prop)
  useEffect(() => {
    setFirstName(contact.first_name) // eslint-disable-line react-hooks/set-state-in-effect
    setLastName(contact.last_name)
    setEmail(contact.email ?? '')
    setPhone(contact.phone ?? '')
    setType(contact.type)
    setScore(contact.score ?? 'cold')
    setSource(contact.source ?? 'manual')
    setNotes(contact.notes || '')
  }, [contact])

  const isValid = firstName.trim() !== '' && lastName.trim() !== ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    // In production: call update mutation
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md bg-theme-card border border-theme-border">
        <DialogHeader>
          <DialogTitle className="text-theme-primary">{t('editDialog.title')}</DialogTitle>
          <DialogDescription className="text-theme-tertiary">
            {t('editDialog.description', { name: `${contact.first_name} ${contact.last_name}` })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('field.firstName')}</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClasses} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('field.lastName')}</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClasses} required />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('field.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} />
          </div>

          {/* Téléphone */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('field.phone')}</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+41 22 000 00 00" className={inputClasses} />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('field.type')}</label>
            <div className="flex items-center gap-4">
              {TYPE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <div className={cn(
                    'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                    type === opt.value ? 'border-accent' : 'border-theme-border'
                  )}>
                    {type === opt.value && <div className="h-2 w-2 rounded-full bg-accent" />}
                  </div>
                  <span
                    className={cn('text-sm', type === opt.value ? 'text-theme-primary' : 'text-theme-secondary')}
                    onClick={() => setType(opt.value)}
                  >
                    {t(opt.labelKey)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Score */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('field.score')}</label>
            <div className="flex items-center gap-4">
              {SCORE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <div className={cn(
                    'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                    score === opt.value ? 'border-accent' : 'border-theme-border'
                  )}>
                    {score === opt.value && <div className="h-2 w-2 rounded-full bg-accent" />}
                  </div>
                  <span
                    className={cn('text-sm', score === opt.value ? 'text-theme-primary' : 'text-theme-secondary')}
                    onClick={() => setScore(opt.value)}
                  >
                    {t(opt.labelKey)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('field.source')}</label>
            <div className="relative">
              <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClasses}>
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('field.notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('editDialog.notesPlaceholder')}
              className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={cn(
                'flex-1 h-9 rounded-lg text-sm font-medium transition-colors',
                isValid
                  ? 'border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
                  : 'border border-theme-border text-theme-tertiary cursor-not-allowed'
              )}
            >
              {t('editDialog.save')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
