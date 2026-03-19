import { useState } from 'react'
import { CheckCircle2, XCircle, Clock, TrendingDown, Loader2, MessageSquare } from 'lucide-react'
import { cn, formatCHF, formatDate } from '@/lib/utils'
import { SELLER_PROPERTY } from './sellerMockData'
import { useOffers, type Offer } from '@/hooks/useOffers'
import { Button } from '@/components/ui/button'

const ASKING_PRICE = SELLER_PROPERTY.price

function statusConfig(status: Offer['status']) {
  switch (status) {
    case 'pending':  return { label: 'En attente', icon: Clock, cls: 'bg-warning/10 text-warning' }
    case 'accepted': return { label: 'Acceptée', icon: CheckCircle2, cls: 'bg-success/10 text-success' }
    case 'refused':  return { label: 'Refusée', icon: XCircle, cls: 'bg-danger/10 text-danger' }
    case 'counter':  return { label: 'Contre-offre', icon: MessageSquare, cls: 'bg-accent/10 text-accent' }
    case 'expired':  return { label: 'Expirée', icon: Clock, cls: 'bg-gray-100 text-gray-500' }
  }
}

interface ConfirmModalProps {
  action: 'accepted' | 'refused'
  amount: number
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function ConfirmModal({ action, amount, onConfirm, onCancel, isLoading }: ConfirmModalProps) {
  const actionLabel = action === 'accepted' ? 'accepter' : 'refuser'
  const actionColor = action === 'accepted' ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-primary-900 mb-2">
          Confirmer votre réponse
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Confirmez-vous vouloir <span className="font-medium">{actionLabel}</span> cette offre de{' '}
          <span className="font-semibold text-primary-900">{formatCHF(amount)}</span> ?
        </p>
        <div className="flex items-center gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-button"
          >
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn('rounded-button text-white', actionColor)}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              action === 'accepted' ? 'Accepter' : 'Refuser'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface CounterOfferModalProps {
  originalAmount: number
  onConfirm: (amount: number, message: string) => void
  onCancel: () => void
  isLoading: boolean
}

function CounterOfferModal({ originalAmount, onConfirm, onCancel, isLoading }: CounterOfferModalProps) {
  const [counterAmount, setCounterAmount] = useState(originalAmount.toString())
  const [counterMessage, setCounterMessage] = useState('')

  const parsedAmount = parseInt(counterAmount.replace(/\D/g, ''), 10) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-primary-900 mb-1">
          Faire une contre-offre
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          Offre initiale : <span className="font-semibold text-primary-900">{formatCHF(originalAmount)}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Montant de la contre-offre (CHF)
            </label>
            <input
              type="text"
              value={counterAmount}
              onChange={(e) => setCounterAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="ex: 1320000"
              className="w-full h-11 px-4 bg-white border border-gray-200 rounded-lg text-sm text-primary-900 placeholder:text-muted-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            {parsedAmount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatCHF(parsedAmount)}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Message (optionnel)
            </label>
            <textarea
              value={counterMessage}
              onChange={(e) => setCounterMessage(e.target.value)}
              placeholder="Conditions, remarques..."
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-primary-900 placeholder:text-muted-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end mt-6">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-button"
          >
            Annuler
          </Button>
          <Button
            onClick={() => onConfirm(parsedAmount, counterMessage)}
            disabled={isLoading || parsedAmount <= 0}
            className="rounded-button bg-accent hover:bg-accent/90 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Envoyer la contre-offre'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function SellerOffers() {
  const { offers, isLoading, respondToOffer, isResponding, counterOffer, isCountering } = useOffers('mock-property')
  const [confirmState, setConfirmState] = useState<{
    offerId: string
    action: 'accepted' | 'refused'
    amount: number
  } | null>(null)
  const [counterState, setCounterState] = useState<{
    offerId: string
    amount: number
  } | null>(null)

  async function handleConfirm() {
    if (!confirmState) return
    try {
      await respondToOffer({ offerId: confirmState.offerId, status: confirmState.action })
      setConfirmState(null)
    } catch {
      // Error handled by React Query
    }
  }

  async function handleCounter(amount: number, message: string) {
    if (!counterState) return
    try {
      await counterOffer({ offerId: counterState.offerId, counterAmount: amount, counterMessage: message })
      setCounterState(null)
    } catch {
      // Error handled by React Query
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Offres reçues</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {offers.length} offre{offers.length > 1 ? 's' : ''} · Prix demandé : {formatCHF(ASKING_PRICE)}
        </p>
      </div>

      <div className="space-y-4">
        {offers.map((offer) => {
          const sc = statusConfig(offer.status)
          const Icon = sc.icon
          const pct = Math.round((offer.amount / ASKING_PRICE) * 100)
          const diff = offer.amount - ASKING_PRICE

          return (
            <div key={offer.id} className="bg-white rounded-card border border-border p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-primary-900">{formatCHF(offer.amount)}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    par {offer.buyer_name} · {formatDate(offer.created_at)}
                  </p>
                </div>
                <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-badge', sc.cls)}>
                  <Icon className="h-3.5 w-3.5" />
                  {sc.label}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{pct}% du prix demandé</span>
                  <span className="inline-flex items-center gap-1">
                    {diff < 0 && <TrendingDown className="h-3 w-3 text-danger" />}
                    <span className={diff < 0 ? 'text-danger' : 'text-success'}>
                      {diff < 0 ? '−' : '+'} {formatCHF(Math.abs(diff))}
                    </span>
                  </span>
                </div>
                <div className="h-2.5 bg-primary-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      pct >= 95 ? 'bg-success' : pct >= 85 ? 'bg-warning' : 'bg-danger'
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>CHF 0</span>
                  <span>{formatCHF(ASKING_PRICE)}</span>
                </div>
              </div>

              {/* Conditions */}
              {offer.conditions && (
                <div className="mt-4 bg-section rounded-lg p-3">
                  <p className="text-xs font-medium text-primary-700 mb-1">Conditions :</p>
                  <p className="text-xs text-muted-foreground">{offer.conditions}</p>
                </div>
              )}

              {/* Counter-offer details */}
              {offer.status === 'counter' && offer.counter_amount && (
                <div className="mt-4 bg-accent/5 border border-accent/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-accent mb-1">
                    Contre-offre envoyée : {formatCHF(offer.counter_amount)}
                  </p>
                  {offer.counter_message && (
                    <p className="text-xs text-muted-foreground">{offer.counter_message}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Envoyée le {formatDate(offer.responded_at ?? '')}
                  </p>
                </div>
              )}

              {/* Action buttons for pending offers */}
              {offer.status === 'pending' && (
                <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
                  <Button
                    onClick={() => setConfirmState({ offerId: offer.id, action: 'accepted', amount: offer.amount })}
                    className="rounded-button bg-success hover:bg-success/90 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Accepter
                  </Button>
                  <Button
                    onClick={() => setCounterState({ offerId: offer.id, amount: offer.amount })}
                    variant="outline"
                    className="rounded-button border-accent/30 text-accent hover:bg-accent/5"
                  >
                    <MessageSquare className="h-4 w-4 mr-1.5" />
                    Contre-offre
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmState({ offerId: offer.id, action: 'refused', amount: offer.amount })}
                    className="rounded-button border-danger/30 text-danger hover:bg-danger/5"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Refuser
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {offers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucune offre reçue pour le moment.</p>
        </div>
      )}

      {/* Confirmation modal */}
      {confirmState && (
        <ConfirmModal
          action={confirmState.action}
          amount={confirmState.amount}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmState(null)}
          isLoading={isResponding}
        />
      )}

      {/* Counter-offer modal */}
      {counterState && (
        <CounterOfferModal
          originalAmount={counterState.amount}
          onConfirm={handleCounter}
          onCancel={() => setCounterState(null)}
          isLoading={isCountering}
        />
      )}
    </div>
  )
}
