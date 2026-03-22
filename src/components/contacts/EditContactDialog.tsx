import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MockContact } from '@/lib/mockData'
import type { ContactScore } from '@/lib/constants'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

type ContactType = MockContact['type']

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

interface EditContactDialogProps {
  open: boolean
  onClose: () => void
  contact: MockContact
}

export default function EditContactDialog({ open, onClose, contact }: EditContactDialogProps) {
  const [firstName, setFirstName] = useState(contact.first_name)
  const [lastName, setLastName] = useState(contact.last_name)
  const [email, setEmail] = useState(contact.email)
  const [phone, setPhone] = useState(contact.phone)
  const [type, setType] = useState<ContactType>(contact.type)
  const [score, setScore] = useState<ContactScore>(contact.score)
  const [source, setSource] = useState(contact.source)
  const [notes, setNotes] = useState(contact.notes || '')

  // Reset form when contact changes — setState in effect is intentional (sync with prop)
  useEffect(() => {
    setFirstName(contact.first_name) // eslint-disable-line react-hooks/set-state-in-effect
    setLastName(contact.last_name)
    setEmail(contact.email)
    setPhone(contact.phone)
    setType(contact.type)
    setScore(contact.score)
    setSource(contact.source)
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
          <DialogTitle className="text-theme-primary">Modifier le contact</DialogTitle>
          <DialogDescription className="text-theme-tertiary">
            Modifiez les informations de {contact.first_name} {contact.last_name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1.5">Prénom</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClasses} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1.5">Nom</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClasses} required />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} />
          </div>

          {/* Téléphone */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Téléphone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+41 22 000 00 00" className={inputClasses} />
          </div>

          {/* Type */}
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
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Source</label>
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
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes sur le contact..."
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
              Annuler
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
              Sauvegarder
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
