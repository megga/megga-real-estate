import { X, User, Building2, Calendar, Banknote } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'
import NegotiationCopilot from '@/components/ai-copilot/NegotiationCopilot'

// Mock enrichment data for deals that have offers
const DEAL_OFFER_DATA: Record<string, { offerPrice: number; daysOnMarket: number; totalVisits: number; buyerInterest: 'very_high' | 'high' | 'medium' | 'low' }> = {
  'd3': { offerPrice: 2800000, daysOnMarket: 45, totalVisits: 8, buyerInterest: 'high' },
  'd5': { offerPrice: 1200000, daysOnMarket: 12, totalVisits: 3, buyerInterest: 'very_high' },
}

interface DealDetailModalProps {
  deal: {
    id: string
    contact_name: string
    property_title: string
    price: number
    stage: string
    updated_at: string
    contact_id?: string
  }
  onClose: () => void
}

export default function DealDetailModal({ deal, onClose }: DealDetailModalProps) {
  const stageLabel = TRANSACTION_STAGE_LABELS[deal.stage as TransactionStage] || deal.stage
  const showNegotiation = deal.stage === 'offer' || deal.stage === 'negotiation'
  const offerData = DEAL_OFFER_DATA[deal.id]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-theme-card rounded-xl border border-theme-border w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-theme-primary truncate">{deal.property_title}</h3>
            <p className="text-sm text-theme-tertiary mt-0.5">{deal.contact_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors ml-3"
          >
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        {/* Deal info */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Banknote className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-secondary">Prix demandé</span>
            <span className="ml-auto font-semibold text-theme-primary">{formatCHF(deal.price)}</span>
          </div>

          {offerData && (
            <div className="flex items-center gap-3 text-sm">
              <Banknote className="w-4 h-4 text-accent shrink-0" />
              <span className="text-theme-secondary">Offre reçue</span>
              <span className="ml-auto font-semibold text-accent">{formatCHF(offerData.offerPrice)}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm">
            <User className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-secondary">Contact</span>
            <span className="ml-auto text-theme-primary">{deal.contact_name}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Building2 className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-secondary">Étape</span>
            <span className="ml-auto text-theme-primary">{stageLabel}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-secondary">Dernière mise à jour</span>
            <span className="ml-auto text-theme-tertiary">{deal.updated_at}</span>
          </div>
        </div>

        {/* Negotiation Copilot — shown only for offer/negotiation stages */}
        {showNegotiation && offerData && (
          <div className="px-5 pb-5">
            <NegotiationCopilot
              askingPrice={deal.price}
              offerPrice={offerData.offerPrice}
              daysOnMarket={offerData.daysOnMarket}
              totalVisits={offerData.totalVisits}
              buyerInterestLevel={offerData.buyerInterest}
            />
          </div>
        )}

        {showNegotiation && !offerData && (
          <div className="px-5 pb-5">
            <div className="rounded-xl border border-theme-border p-4 text-center">
              <p className="text-sm text-theme-tertiary">Aucune offre enregistrée pour cette transaction.</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t border-theme-border">
          {deal.contact_id && (
            <a
              href={`/dashboard/contacts/${deal.contact_id}`}
              className={cn(
                'flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border',
                'text-theme-secondary hover:text-theme-primary hover:border-theme-active',
                'transition-colors flex items-center justify-center'
              )}
            >
              Voir le contact
            </a>
          )}
          <button
            onClick={onClose}
            className={cn(
              'flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border',
              'text-theme-secondary hover:text-theme-primary hover:border-theme-active',
              'transition-colors'
            )}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
