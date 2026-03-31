import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SellerOffer } from '@/lib/mockSellerData'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'

// ── Helpers ──────────────────────────────────────────────────────────────

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'

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
  pending: { label: 'En cours d\'analyse', color: 'text-theme-secondary', dotColor: 'bg-amber-500' },
  accepted: { label: 'Acceptée', color: 'text-theme-primary', dotColor: 'bg-emerald-500' },
  rejected: { label: 'Refusée', color: 'text-theme-tertiary', dotColor: 'bg-red-500' },
  counter_offer: { label: 'Contre-proposition', color: 'text-theme-secondary', dotColor: 'bg-accent' },
  expired: { label: 'Expirée', color: 'text-theme-muted', dotColor: 'bg-theme-muted' },
}

// ── Offer card ───────────────────────────────────────────────────────────

function OfferCard({ offer, askingPrice, onReply }: { offer: SellerOffer; askingPrice: number; onReply: (offer: SellerOffer) => void }) {
  const status = STATUS_CONFIG[offer.status]
  const diffPercent = ((offer.amount - askingPrice) / askingPrice * 100).toFixed(1)
  const diffAmount = offer.amount - askingPrice
  const isBelow = diffAmount < 0
  const isActive = offer.status === 'pending' || offer.status === 'counter_offer'

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
            <span className="font-medium text-theme-secondary">
              {isBelow ? '' : '+'}{diffPercent}%
            </span>
          </div>
          {/* Barre de progression — monochrome */}
          <div className="h-1.5 rounded-full bg-theme-hover overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-theme-primary"
              style={{ width: `${Math.min(100, (offer.amount / askingPrice) * 100)}%` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-theme-secondary">
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

      {/* Action — Répondre à mon agent (only on active offers) */}
      {isActive && (
        <div className="mt-4 pt-3 border-t border-theme-border-subtle">
          <button
            onClick={() => onReply(offer)}
            className={cn('h-8 px-3.5 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-1.5', FOCUS_RING)}
          >
            <MessageSquare className="w-3 h-3" />
            Répondre à mon agent
          </button>
        </div>
      )}
    </div>
  )
}

// ── Reply modal ──────────────────────────────────────────────────────────

function ReplyModal({ offer, onClose, onSend }: { offer: SellerOffer; onClose: () => void; onSend: (message: string) => void }) {
  const [message, setMessage] = useState(
    `Concernant l'offre de ${formatCHF(offer.amount)}, je souhaite `
  )
  const [sent, setSent] = useState(false)

  function handleSend() {
    if (!message.trim()) return
    onSend(message)
    setSent(true)
    setTimeout(() => {
      onClose()
    }, 2000)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-150" />
      <div
        className="relative bg-theme-elevated rounded-xl border border-theme-border ring-1 ring-white/5 w-full max-w-md mx-4 p-6 animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-theme-primary">Répondre à votre agent</h3>
            <p className="text-xs text-theme-muted mt-0.5">
              Offre de {formatCHF(offer.amount)}
            </p>
          </div>
          <button
            onClick={onClose}
            className={cn('h-7 w-7 flex items-center justify-center rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-hover transition-colors', FOCUS_RING)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center">
            <p className="text-sm text-theme-primary font-medium">Message envoyé</p>
            <p className="text-xs text-theme-muted mt-1">Votre agent vous répondra dans les meilleurs délais.</p>
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className={cn(
                'w-full px-3 py-2.5 text-sm bg-transparent border border-theme-border rounded-lg resize-none text-theme-primary placeholder:text-theme-muted',
                'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent'
              )}
              placeholder="Votre message..."
            />
            <p className="text-[10px] text-theme-muted mt-1.5">
              Ce message sera envoyé à Gregory Lyonnet via la messagerie du portail.
            </p>
            <div className="flex justify-end mt-4">
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className={cn(
                  'h-8 px-4 rounded-lg text-xs font-medium border border-theme-border transition-colors',
                  FOCUS_RING,
                  message.trim()
                    ? 'text-theme-secondary hover:text-theme-primary hover:border-theme-active'
                    : 'text-theme-muted cursor-not-allowed'
                )}
              >
                Envoyer
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Main page ────────────────────────────────────────────────────────────

export default function MesOffresPage() {
  const { property, offers } = useSellerPortalData()
  const [replyOffer, setReplyOffer] = useState<SellerOffer | null>(null)

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
    <div className="max-w-4xl mx-auto space-y-6">
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
          <p className="text-2xl font-bold text-theme-primary">{formatCHF(bestOffer?.amount || 0)}</p>
          <p className="text-xs text-theme-tertiary mt-0.5">Meilleure offre</p>
        </div>
        <div className="rounded-xl border border-theme-border p-4">
          <p className="text-2xl font-bold text-theme-primary">{formatCHF(property.price)}</p>
          <p className="text-xs text-theme-tertiary mt-0.5">Prix demandé</p>
        </div>
      </div>

      {/* Info banner si offre active */}
      {activeOffers.length > 0 && (
        <div className="rounded-xl border border-theme-border p-4">
          <p className="text-sm text-theme-primary">
            <span className="font-medium">{activeOffers.length} offre{activeOffers.length > 1 ? 's' : ''} en cours d'analyse.</span>
            {' '}Votre agent Gregory Lyonnet vous contactera pour discuter de la stratégie de réponse.
          </p>
        </div>
      )}

      {/* Liste des offres */}
      <div className="space-y-3">
        {sortedOffers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} askingPrice={property.price} onReply={setReplyOffer} />
        ))}
      </div>

      {/* Note de transparence */}
      <p className="text-[10px] text-theme-muted text-center pt-2">
        Les informations sur les acquéreurs sont anonymisées pour protéger la confidentialité des parties.
      </p>

      {/* Reply modal */}
      {replyOffer && (
        <ReplyModal
          offer={replyOffer}
          onClose={() => setReplyOffer(null)}
          onSend={() => { /* mock — in production, sends to messages */ }}
        />
      )}
    </div>
  )
}
