import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateContact } from '@/hooks/useContacts'
import type { ContactType } from '@/types/contact'
import type { ContactScore } from '@/lib/constants'

const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: 'buyer', label: 'Acheteur' },
  { value: 'seller', label: 'Vendeur' },
  { value: 'both', label: 'Acheteur/Vendeur' },
  { value: 'lead', label: 'Lead' },
]

const SCORE_OPTIONS: { value: ContactScore; label: string }[] = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
]

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manuel' },
  { value: 'website', label: 'Site web' },
  { value: 'referral', label: 'Recommandation' },
  { value: 'portal', label: 'Portail' },
  { value: 'social', label: 'Réseaux sociaux' },
]

const inputClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors placeholder:text-theme-tertiary'
const selectClasses = cn(inputClasses, 'appearance-none')
const labelClasses = 'block text-sm font-medium text-theme-primary mb-1.5'

interface NewContactDialogProps {
  open: boolean
  onClose: () => void
}

export default function NewContactDialog({ open, onClose }: NewContactDialogProps) {
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
    } catch {
      // Error handled by React Query
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={handleClose}>
      <div
        className="bg-theme-card rounded-xl border border-theme-border w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <div>
            <h3 className="text-base font-semibold text-theme-primary">Nouveau contact</h3>
            <p className="text-xs text-theme-tertiary mt-0.5">Ajoutez un contact à votre CRM.</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Prénom</label>
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
              <label className={labelClasses}>Nom</label>
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
            <label className={labelClasses}>Email</label>
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
            <label className={labelClasses}>Type</label>
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
                  {opt.label}
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
              + Ajouter des détails
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="space-y-4 pt-3 border-t border-theme-border-subtle">
              {/* Téléphone */}
              <div>
                <label className={labelClasses}>
                  Téléphone <span className="text-theme-muted font-normal">(optionnel)</span>
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
                <label className={labelClasses}>Score</label>
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
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source */}
              <div>
                <label className={labelClasses}>
                  Source <span className="text-theme-muted font-normal">(optionnel)</span>
                </label>
                <div className="relative">
                  <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClasses}>
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClasses}>
                  Notes <span className="text-theme-muted font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Contexte, remarques..."
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
            Annuler
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
            {createContact.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Créer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
