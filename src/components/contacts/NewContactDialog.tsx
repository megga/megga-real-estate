import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreateContact } from '@/hooks/useContacts'
import type { ContactType } from '@/types/contact'
import type { ContactScore } from '@/lib/constants'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

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

const inputClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'
const selectClasses = cn(inputClasses, 'appearance-none')

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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); onClose() } }}>
      <DialogContent className="max-w-md bg-theme-card border border-theme-border">
        <DialogHeader>
          <DialogTitle className="text-theme-primary">Nouveau contact</DialogTitle>
          <DialogDescription className="text-theme-tertiary">
            Ajoutez un contact à votre CRM.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1.5">Prénom</label>
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
              <label className="block text-sm font-medium text-theme-primary mb-1.5">Nom</label>
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
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean.dupont@email.ch"
              className={inputClasses}
            />
          </div>

          {/* Type — inline radio */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Type</label>
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
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Expandable details */}
          {!showDetails ? (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="text-sm text-theme-tertiary hover:text-theme-primary transition-colors"
            >
              + Ajouter des détails
            </button>
          ) : (
            <div className="space-y-4 pt-1 border-t border-theme-border">
              {/* Téléphone */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-theme-primary mb-1.5">
                  Téléphone <span className="text-theme-tertiary font-normal">(optionnel)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+41 22 000 00 00"
                  className={inputClasses}
                />
              </div>

              {/* Score */}
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1.5">Score</label>
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
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1.5">
                  Source <span className="text-theme-tertiary font-normal">(optionnel)</span>
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
                <label className="block text-sm font-medium text-theme-primary mb-1.5">
                  Notes <span className="text-theme-tertiary font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Contexte, remarques..."
                  className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none placeholder:text-theme-tertiary"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => { resetForm(); onClose() }}
              className="flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!isValid || createContact.isPending}
              className="flex-1 h-9 rounded-lg text-sm font-medium bg-accent hover:bg-accent/90 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createContact.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Créer
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
