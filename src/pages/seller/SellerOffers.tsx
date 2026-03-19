import { CheckCircle2, XCircle, Clock, AlertTriangle, TrendingDown } from 'lucide-react'
import { cn, formatCHF, formatDate } from '@/lib/utils'
import { SELLER_OFFERS, SELLER_PROPERTY, type SellerOffer } from './sellerMockData'

const ASKING_PRICE = SELLER_PROPERTY.price

function statusConfig(status: SellerOffer['status']) {
  switch (status) {
    case 'pending':  return { label: 'En attente', icon: Clock, cls: 'bg-warning/10 text-warning' }
    case 'accepted': return { label: 'Acceptée', icon: CheckCircle2, cls: 'bg-success/10 text-success' }
    case 'refused':  return { label: 'Refusée', icon: XCircle, cls: 'bg-danger/10 text-danger' }
    case 'counter':  return { label: 'Contre-offre', icon: AlertTriangle, cls: 'bg-accent/10 text-accent' }
  }
}

export default function SellerOffers() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Offres reçues</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {SELLER_OFFERS.length} offre{SELLER_OFFERS.length > 1 ? 's' : ''} · Prix demandé : {formatCHF(ASKING_PRICE)}
        </p>
      </div>

      <div className="space-y-4">
        {SELLER_OFFERS.map((offer) => {
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
                    par {offer.buyer_name} · {formatDate(offer.date)}
                  </p>
                </div>
                <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-badge', sc.cls)}>
                  <Icon className="h-3.5 w-3.5" />
                  {sc.label}
                </span>
              </div>

              {/* Progress bar — comparison to asking price */}
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
            </div>
          )
        })}
      </div>

      {SELLER_OFFERS.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucune offre reçue pour le moment.</p>
        </div>
      )}
    </div>
  )
}
