import { cn } from '@/lib/utils'
import { MOCK_SELLER_DATA, type SellerOffer } from '@/lib/mockSellerData'

// ── Helpers ──────────────────────────────────────────────────────────────

function formatCHF(amount: number): string {
  return `CHF ${amount.toLocaleString('fr-CH').replace(/,/g, "'")}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Aujourd\'hui'
  if (days === 1) return 'Hier'
  return `il y a ${days} jours`
}

const STATUS_CONFIG: Record<SellerOffer['status'], { label: string; color: string; dotColor: string }> = {
  pending: { label: 'En cours d\'analyse', color: 'text-amber-500', dotColor: 'bg-amber-500' },
  accepted: { label: 'Acceptée', color: 'text-emerald-500', dotColor: 'bg-emerald-500' },
  rejected: { label: 'Refusée', color: 'text-red-500', dotColor: 'bg-red-500' },
  counter_offer: { label: 'Contre-proposition', color: 'text-accent', dotColor: 'bg-accent' },
  expired: { label: 'Expirée', color: 'text-theme-muted', dotColor: 'bg-theme-muted' },
}

// ── Offer card ───────────────────────────────────────────────────────────

function OfferCard({ offer, askingPrice }: { offer: SellerOffer; askingPrice: number }) {
  const status = STATUS_CONFIG[offer.status]
  const diffPercent = ((offer.amount - askingPrice) / askingPrice * 100).toFixed(1)
  const diffAmount = offer.amount - askingPrice
  const isBelow = diffAmount < 0

  return (
    <div className="rounded-xl border border-theme-border p-5 hover:border-theme-active transition-colors">
      {/* Header: montant + statut */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold text-theme-primary">{formatCHF(offer.amount)}</p>
          <p className="text-xs text-theme-tertiary mt-0.5">
            Reçue le {formatDate(offer.received_at)} · {timeAgo(offer.received_at)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('w-2 h-2 rounded-full', status.dotColor)} />
          <span className={cn('text-xs font-medium', status.color)}>{status.label}</span>
        </div>
      </div>

      {/* Comparaison avec prix demandé */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-theme-tertiary">vs prix demandé ({formatCHF(askingPrice)})</span>
            <span className={cn('font-medium', isBelow ? 'text-red-500' : 'text-emerald-500')}>
              {isBelow ? '' : '+'}{diffPercent}%
            </span>
          </div>
          {/* Barre de progression */}
          <div className="h-1.5 rounded-full bg-theme-hover overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                offer.amount >= askingPrice ? 'bg-emerald-500' :
                offer.amount >= askingPrice * 0.95 ? 'bg-amber-500' : 'bg-red-500'
              )}
              style={{ width: `${Math.min(100, (offer.amount / askingPrice) * 100)}%` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={cn('text-sm font-semibold', isBelow ? 'text-red-500' : 'text-emerald-500')}>
            {isBelow ? '' : '+'}{formatCHF(Math.abs(diffAmount))}
          </p>
        </div>
      </div>

      {/* Conditions */}
      {offer.conditions && (
        <div className="mt-4 pt-3 border-t border-theme-border-subtle">
          <p className="text-[10px] text-theme-muted uppercase tracking-wider mb-1">Conditions</p>
          <p className="text-sm text-theme-secondary leading-relaxed">{offer.conditions}</p>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────

export default function MesOffresPage() {
  const { property, offers } = MOCK_SELLER_DATA

  // Tri : pending et counter_offer d'abord, puis par date décroissante
  const sortedOffers = [...offers].sort((a, b) => {
    const activePriority = (s: string) => s === 'pending' || s === 'counter_offer' ? 0 : 1
    const pDiff = activePriority(a.status) - activePriority(b.status)
    if (pDiff !== 0) return pDiff
    return new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  })

  const activeOffers = offers.filter(o => o.status === 'pending' || o.status === 'counter_offer')
  const bestOffer = offers.reduce((max, o) => o.amount > max.amount ? o : max, offers[0])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Offres</h1>
        <p className="text-sm text-theme-secondary mt-1">
          Suivez les offres reçues pour votre bien
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-theme-border p-4">
          <p className="text-2xl font-bold text-theme-primary">{offers.length}</p>
          <p className="text-xs text-theme-tertiary mt-0.5">Offres reçues</p>
        </div>
        <div className="rounded-xl border border-theme-border p-4">
          <p className="text-2xl font-bold text-theme-primary">{activeOffers.length}</p>
          <p className="text-xs text-theme-tertiary mt-0.5">En cours</p>
        </div>
        <div className="rounded-xl border border-theme-border p-4">
          <p className="text-2xl font-bold text-emerald-500">{formatCHF(bestOffer?.amount || 0)}</p>
          <p className="text-xs text-theme-tertiary mt-0.5">Meilleure offre</p>
        </div>
        <div className="rounded-xl border border-theme-border p-4">
          <p className="text-2xl font-bold text-theme-primary">{formatCHF(property.price)}</p>
          <p className="text-xs text-theme-tertiary mt-0.5">Prix demandé</p>
        </div>
      </div>

      {/* Info banner si offre active */}
      {activeOffers.length > 0 && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
          <p className="text-sm text-theme-primary">
            <span className="font-medium">{activeOffers.length} offre{activeOffers.length > 1 ? 's' : ''} en cours d'analyse.</span>
            {' '}Votre agent Gregory Lyonnet vous contactera pour discuter de la stratégie de réponse.
          </p>
        </div>
      )}

      {/* Liste des offres */}
      <div className="space-y-3">
        {sortedOffers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} askingPrice={property.price} />
        ))}
      </div>

      {/* Note de transparence */}
      <p className="text-[10px] text-theme-muted text-center pt-2">
        Les informations sur les acquéreurs sont anonymisées pour protéger la confidentialité des parties.
      </p>
    </div>
  )
}
