import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { useCreateContact } from '@/hooks/useContacts'
import type { ContactType } from '@/types/contact'
import type { ContactScore } from '@/lib/constants'

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

const inputClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors placeholder:text-theme-tertiary'
const selectClasses = cn(inputClasses, 'appearance-none')
const labelClasses = 'block text-sm font-medium text-theme-primary mb-1.5'

interface NewContactDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export default function NewContactDialog({ open, onClose, onCreated }: NewContactDialogProps) {
  const { t } = useTranslation('contacts')
  const createContact = useCreateContact()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState<ContactType>('buyer')
  const [score, setScore] = useState<ContactScore>('cold')
  const [source, setSource] = useState('manual')
  const [notes, setNotes] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  const isValid = firstName.trim() !== '' && lastName.trim() !== ''

  function resetForm() {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setType('buyer')
    setScore('cold')
    setSource('manual')
    setNotes('')
    setShowDetails(false)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    try {
      await createContact.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        type,
        score,
        source,
        notes: notes.trim() || undefined,
      })
      resetForm()
      onClose()
      onCreated?.()
    } catch {
      // Error handled by React Query
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('newDialog.title')}
      description={t('newDialog.description')}
      size="md"
    >
      <>
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>{t('field.firstName')}</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jean"
                className={inputClasses}
                required
              />
            </div>
            <div>
              <label className={labelClasses}>{t('field.lastName')}</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Dupont"
                className={inputClasses}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelClasses}>{t('field.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean.dupont@email.ch"
              className={inputClasses}
            />
          </div>

          {/* Type — pill buttons */}
          <div>
            <label className={labelClasses}>{t('field.type')}</label>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    type === opt.value
                      ? 'bg-theme-active text-theme-primary border-theme-active'
                      : 'border-theme-border text-theme-tertiary hover:text-theme-secondary'
                  )}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Expandable details */}
          {!showDetails ? (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="flex items-center gap-1 text-sm text-theme-tertiary hover:text-theme-primary transition-colors"
            >
              {t('newDialog.addDetails')}
              <MEIcon name="chevron-right" className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="space-y-4 pt-3 border-t border-theme-border-subtle">
              {/* Téléphone */}
              <div>
                <label className={labelClasses}>
                  {t('field.phone')} <span className="text-theme-muted font-normal">{t('field.optional')}</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+41 22 000 00 00"
                  className={inputClasses}
                />
              </div>

              {/* Score — pill buttons */}
              <div>
                <label className={labelClasses}>{t('field.score')}</label>
                <div className="flex gap-1.5">
                  {SCORE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setScore(opt.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        score === opt.value
                          ? 'bg-theme-active text-theme-primary border-theme-active'
                          : 'border-theme-border text-theme-tertiary hover:text-theme-secondary'
                      )}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source */}
              <div>
                <label className={labelClasses}>
                  {t('field.source')} <span className="text-theme-muted font-normal">{t('field.optional')}</span>
                </label>
                <div className="relative">
                  <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClasses}>
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                  <MEIcon name="chevron-down" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClasses}>
                  {t('field.notes')} <span className="text-theme-muted font-normal">{t('field.optional')}</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t('newDialog.notesPlaceholder')}
                  className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none placeholder:text-theme-tertiary"
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-theme-border">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-theme-secondary hover:text-theme-primary transition-colors"
          >
            {t('action.cancel')}
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            disabled={!isValid || createContact.isPending}
            className={cn(
              'h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2',
              (!isValid || createContact.isPending) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {createContact.isPending && <MEIcon name="spinner" className="h-3.5 w-3.5 animate-spin" />}
            {t('newDialog.create')}
          </button>
        </div>
      </>
    </Modal>
  )
}
