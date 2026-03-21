import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useContacts } from '@/hooks/useContacts'
import { useAgencyListings } from '@/hooks/useListings'
import { useCreateTransaction } from '@/hooks/useTransactions'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

const MANDATE_OPTIONS = [
  { value: '', label: 'Aucun' },
  { value: 'simple', label: 'Simple' },
  { value: 'exclusive', label: 'Exclusif' },
  { value: 'semi_exclusive', label: 'Semi-exclusif' },
] as const

const selectClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors appearance-none'

interface NewTransactionDialogProps {
  open: boolean
  onClose: () => void
}

export default function NewTransactionDialog({ open, onClose }: NewTransactionDialogProps) {
  const { profile } = useAuth()
  const { contacts } = useContacts()
  const { data: listings } = useAgencyListings()
  const createTransaction = useCreateTransaction()

  const [contactId, setContactId] = useState('')
  const [contactRole, setContactRole] = useState<'buyer' | 'seller'>('buyer')
  const [propertyId, setPropertyId] = useState('')
  const [mandateType, setMandateType] = useState('')
  const [notes, setNotes] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  const isValid = contactId !== ''

  function resetForm() {
    setContactId('')
    setContactRole('buyer')
    setPropertyId('')
    setMandateType('')
    setNotes('')
    setShowDetails(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !profile) return

    try {
      await createTransaction.mutateAsync({
        agency_id: profile.agency_id || '',
        assigned_to: profile.id,
        stage: 'new_lead',
        ...(contactRole === 'buyer'
          ? { contact_buyer_id: contactId }
          : { contact_seller_id: contactId }
        ),
        ...(propertyId ? { property_id: propertyId } : {}),
        ...(mandateType ? { mandate_type: mandateType as 'simple' | 'exclusive' | 'semi_exclusive' } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
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
          <DialogTitle className="text-theme-primary">Nouvelle transaction</DialogTitle>
          <DialogDescription className="text-theme-tertiary">
            Créez un deal dans votre pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Contact</label>
            <div className="relative">
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className={selectClasses}
                required
              >
                <option value="">Sélectionner un contact...</option>
                {(contacts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
            </div>
          </div>

          {/* Rôle — inline radio */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Rôle</label>
            <div className="flex items-center gap-4">
              {(['buyer', 'seller'] as const).map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <div className={cn(
                    'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors',
                    contactRole === role ? 'border-accent' : 'border-theme-border'
                  )}>
                    {contactRole === role && (
                      <div className="h-2 w-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <span
                    className={cn('text-sm', contactRole === role ? 'text-theme-primary' : 'text-theme-secondary')}
                    onClick={() => setContactRole(role)}
                  >
                    {role === 'buyer' ? 'Acheteur' : 'Vendeur'}
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
              {/* Bien */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-theme-primary mb-1.5">
                  Bien immobilier <span className="text-theme-tertiary font-normal">(optionnel)</span>
                </label>
                <div className="relative">
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    className={selectClasses}
                  >
                    <option value="">Aucun bien lié</option>
                    {(listings ?? []).map((l) => (
                      <option key={l.id} value={l.property_id || l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
                </div>
              </div>

              {/* Mandat */}
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1.5">
                  Type de mandat <span className="text-theme-tertiary font-normal">(optionnel)</span>
                </label>
                <div className="relative">
                  <select
                    value={mandateType}
                    onChange={(e) => setMandateType(e.target.value)}
                    className={selectClasses}
                  >
                    {MANDATE_OPTIONS.map((opt) => (
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
                  placeholder="Contexte, détails importants..."
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
              disabled={!isValid || createTransaction.isPending}
              className="flex-1 h-9 rounded-lg text-sm font-medium bg-accent hover:bg-accent/90 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createTransaction.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Créer
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
