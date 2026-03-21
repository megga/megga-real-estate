import { useState } from 'react'
import { Loader2 } from 'lucide-react'
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

const CONTACT_ROLE_OPTIONS = [
  { value: 'buyer', label: 'Acheteur' },
  { value: 'seller', label: 'Vendeur' },
] as const

const inputClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors'
const labelClasses = 'block text-sm font-medium text-theme-primary mb-1.5'
const selectClasses = cn(inputClasses, 'appearance-none')

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

  const isValid = contactId !== ''

  function resetForm() {
    setContactId('')
    setContactRole('buyer')
    setPropertyId('')
    setMandateType('')
    setNotes('')
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
      <DialogContent className="max-w-lg bg-theme-card border border-theme-border">
        <DialogHeader>
          <DialogTitle className="text-theme-primary">Nouvelle transaction</DialogTitle>
          <DialogDescription className="text-theme-tertiary">
            Créez une transaction pour suivre un deal dans votre pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Contact selection */}
          <div>
            <label className={labelClasses}>Contact *</label>
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
                  {c.type ? ` — ${c.type === 'buyer' ? 'Acheteur' : c.type === 'seller' ? 'Vendeur' : c.type}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Contact role */}
          <div>
            <label className={labelClasses}>Rôle dans la transaction</label>
            <div className="flex gap-2">
              {CONTACT_ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setContactRole(opt.value)}
                  className={cn(
                    'flex-1 h-10 rounded-lg text-sm font-medium border transition-colors',
                    contactRole === opt.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Property selection */}
          <div>
            <label className={labelClasses}>Bien immobilier <span className="text-theme-tertiary font-normal">(optionnel)</span></label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className={selectClasses}
            >
              <option value="">Aucun bien lié</option>
              {(listings ?? []).map((l) => (
                <option key={l.id} value={l.property_id || l.id}>
                  {l.title} — {l.price_display || ''}
                </option>
              ))}
            </select>
          </div>

          {/* Mandate type */}
          <div>
            <label className={labelClasses}>Type de mandat <span className="text-theme-tertiary font-normal">(optionnel)</span></label>
            <select
              value={mandateType}
              onChange={(e) => setMandateType(e.target.value)}
              className={selectClasses}
            >
              {MANDATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClasses}>Notes <span className="text-theme-tertiary font-normal">(optionnel)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Contexte, détails importants..."
              className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none placeholder:text-theme-tertiary"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => { resetForm(); onClose() }}
              className="flex-1 h-10 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!isValid || createTransaction.isPending}
              className="flex-1 h-10 rounded-lg text-sm font-medium bg-accent hover:bg-accent/90 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {createTransaction.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer la transaction
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
