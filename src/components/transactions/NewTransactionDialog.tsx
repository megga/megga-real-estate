import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/hooks/useAuth'
import { useContacts } from '@/hooks/useContacts'
import { useAgencyListings } from '@/hooks/useListings'
import { useCreateTransaction } from '@/hooks/useTransactions'

const MANDATE_OPTIONS = [
  { value: '', label: 'Aucun' },
  { value: 'simple', label: 'Simple' },
  { value: 'exclusive', label: 'Exclusif' },
  { value: 'semi_exclusive', label: 'Semi-exclusif' },
] as const

const labelClasses = 'block text-sm font-medium text-theme-primary mb-1.5'
const selectClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none'

interface NewTransactionDialogProps {
  open: boolean
  onClose: () => void
  title?: string
}

export default function NewTransactionDialog({ open, onClose, title = 'Nouvelle transaction' }: NewTransactionDialogProps) {
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

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit() {
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
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      description="Créez un deal dans votre pipeline."
      size="md"
    >
      <>
        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Contact + Bien */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Contact</label>
              <div className="relative">
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Sélectionner...</option>
                  {(contacts ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Bien <span className="text-theme-muted font-normal">(optionnel)</span></label>
              <div className="relative">
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Sélectionner...</option>
                  {(listings ?? []).map((l) => (
                    <option key={l.id} value={l.property_id || l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Rôle — pill buttons */}
          <div>
            <label className={labelClasses}>Rôle</label>
            <div className="flex gap-1.5">
              {(['buyer', 'seller'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setContactRole(role)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    contactRole === role
                      ? 'bg-theme-active text-theme-primary border-theme-active'
                      : 'border-theme-border text-theme-tertiary hover:text-theme-secondary'
                  )}
                >
                  {role === 'buyer' ? 'Acheteur' : 'Vendeur'}
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
              {/* Mandat */}
              <div>
                <label className={labelClasses}>
                  Type de mandat <span className="text-theme-muted font-normal">(optionnel)</span>
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
                <label className={labelClasses}>
                  Notes <span className="text-theme-muted font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Contexte, détails importants..."
                  className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none placeholder:text-theme-tertiary"
                />
              </div>
            </div>
          )}
        </div>

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
            onClick={handleSubmit}
            disabled={!isValid || createTransaction.isPending}
            className={cn(
              'h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2',
              (!isValid || createTransaction.isPending) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {createTransaction.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Créer
          </button>
        </div>
      </>
    </Modal>
  )
}
