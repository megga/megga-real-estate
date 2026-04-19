import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MessageSquare, X, CheckCircle2, ArrowRight, TrendingUp, TrendingDown,
  Sparkles, Clock, XCircle, Minus,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import type { SellerOffer } from '@/lib/mockSellerData'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'

// ─── Shared tokens (mirror of MonDossierPage / MesVisitesPage) ──────────

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 dark:focus-visible:ring-white/30'
const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500'
const CARD = 'rounded-2xl bg-white border border-gray-100 dark:bg-gray-900 dark:border-gray-800'
const CARD_HOVER = 'transition-all duration-200 hover:border-gray-200 dark:hover:border-gray-700'

function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-CH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'il y a 1 semaine'
  return `il y a ${weeks} semaines`
}

// ─── Status config ───────────────────────────────────────────────────────
// Tones kept on-palette: emerald for accepted, amber for pending, indigo
// for counter-offers (unique enough to distinguish from pending), gray for
// rejected/expired.

const STATUS_CONFIG: Record<SellerOffer['status'], {
  label: string
  icon: React.ElementType
  tone: string
  pill: string
}> = {
  pending: {
    label: 'En analyse',
    icon: Clock,
    tone: 'text-amber-600 dark:text-amber-500',
    pill: 'bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/30 dark:text-amber-500 dark:border-amber-900/50',
  },
  counter_offer: {
    label: 'Contre-proposition',
    icon: ArrowRight,
    tone: 'text-indigo-600 dark:text-indigo-400',
    pill: 'bg-indigo-50 text-indigo-700 border-indigo-200/70 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50',
  },
  accepted: {
    label: 'Acceptée',
    icon: CheckCircle2,
    tone: 'text-emerald-600 dark:text-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-500 dark:border-emerald-900/50',
  },
  rejected: {
    label: 'Refusée',
    icon: XCircle,
    tone: 'text-gray-400 dark:text-gray-600',
    pill: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-500 dark:border-gray-700',
  },
  expired: {
    label: 'Expirée',
    icon: Minus,
    tone: 'text-gray-400 dark:text-gray-600',
    pill: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-500 dark:border-gray-700',
  },
}

// ─── Offer card ──────────────────────────────────────────────────────────
// Three-layer card: header row (amount + status pill), visual ratio bar
// with emerald/amber/red delta treatment, optional conditions block, and
// finally the reply CTA for active offers only.

function OfferCard({
  offer,
  askingPrice,
  isBest,
  onReply,
}: {
  offer: SellerOffer
  askingPrice: number
  isBest: boolean
  onReply: (offer: SellerOffer) => void
}) {
  const status = STATUS_CONFIG[offer.status]
  const StatusIcon = status.icon
  const diffAmount = offer.amount - askingPrice
  const diffPercent = (diffAmount / askingPrice) * 100
  const isBelow = diffAmount < 0
  const isEqual = diffAmount === 0
  const isActive = offer.status === 'pending' || offer.status === 'counter_offer'

  // Ratio bar colour — emerald when at/above, amber for ≤ 5% below, red beyond.
  const ratioTone = isEqual || !isBelow
    ? 'from-emerald-500 to-emerald-400'
    : Math.abs(diffPercent) <= 5
      ? 'from-amber-500 to-amber-400'
      : 'from-rose-500 to-rose-400'

  const DiffIcon = isBelow ? TrendingDown : isEqual ? Minus : TrendingUp
  const diffTone = isBelow
    ? 'text-rose-600 dark:text-rose-500'
    : isEqual
      ? 'text-gray-500 dark:text-gray-400'
      : 'text-emerald-600 dark:text-emerald-500'

  return (
    <div className={cn(CARD, CARD_HOVER, 'p-5 md:p-6 relative overflow-hidden')}>
      {/* "Meilleure offre" ribbon — subtle, on the card's top-right */}
      {isBest && (
        <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-500 border border-emerald-200/70 dark:border-emerald-900/50">
          <Sparkles className="w-2.5 h-2.5" />
          Meilleure
        </div>
      )}

      {/* Amount + received date */}
      <div className="flex items-start justify-between gap-4 pr-24">
        <div className="min-w-0">
          <p className="text-[28px] md:text-[32px] font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight leading-none">
            {formatCHF(offer.amount)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Reçue le {formatDateLong(offer.received_at)} · {timeAgo(offer.received_at)}
          </p>
        </div>
      </div>

      {/* Ratio vs asking price */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-gray-500 dark:text-gray-400">
            Prix demandé : <span className="text-gray-700 dark:text-gray-300 tabular-nums">{formatCHF(askingPrice)}</span>
          </span>
          <span className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', diffTone)}>
            <DiffIcon className="w-3.5 h-3.5" />
            {isBelow ? '' : isEqual ? '' : '+'}
            {diffPercent.toFixed(1)}%
            <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
              ({isBelow ? '−' : isEqual ? '' : '+'}{formatCHF(Math.abs(diffAmount)).replace('CHF ', '')} CHF)
            </span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out', ratioTone)}
            style={{ width: `${Math.min(100, (offer.amount / askingPrice) * 100)}%` }}
          />
        </div>
      </div>

      {/* Status + optional conditions + action */}
      <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 h-6 pl-2 pr-2.5 rounded-full border text-[11px] font-medium',
              status.pill,
            )}
          >
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>

          {isActive && (
            <button
              onClick={() => onReply(offer)}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors',
                FOCUS_RING,
              )}
            >
              <MessageSquare className="w-3 h-3" />
              Répondre à mon agent
            </button>
          )}
        </div>

        {offer.conditions && (
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500 mb-1">
              Conditions
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{offer.conditions}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Reply modal ─────────────────────────────────────────────────────────

function ReplyModal({
  offer,
  onClose,
  onSend,
}: {
  offer: SellerOffer
  onClose: () => void
  onSend: (message: string) => void
}) {
  const [message, setMessage] = useState(
    `Concernant l'offre de ${formatCHF(offer.amount)}, je souhaite `,
  )
  const [sent, setSent] = useState(false)

  function handleSend() {
    if (!message.trim()) return
    onSend(message)
    setSent(true)
    setTimeout(onClose, 2000)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in-0 duration-150" />
      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800',
          'p-6 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] animate-in fade-in-0 zoom-in-95 duration-200',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              Répondre à votre agent
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
              Offre de {formatCHF(offer.amount)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className={cn(
              'h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
              FOCUS_RING,
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="py-8 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Message envoyé</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Votre agent vous répondra dans les meilleurs délais.
            </p>
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className={cn(
                'w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl resize-none text-gray-900 dark:text-white placeholder:text-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-300 dark:focus:border-gray-600',
              )}
              placeholder="Votre message…"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Ce message sera envoyé à Gregory Lyonnet via la messagerie du portail.
            </p>
            <div className="flex justify-end mt-5">
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className={cn(
                  'inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm font-medium transition-all',
                  FOCUS_RING,
                  message.trim()
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.3)]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed',
                )}
              >
                Envoyer
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function MesOffresPage() {
  const { property, offers } = useSellerPortalData()
  const [replyOffer, setReplyOffer] = useState<SellerOffer | null>(null)

  // Active offers (pending / counter_offer) come first, then by date DESC.
  const sortedOffers = [...offers].sort((a, b) => {
    const activePriority = (s: string) => (s === 'pending' || s === 'counter_offer' ? 0 : 1)
    const pDiff = activePriority(a.status) - activePriority(b.status)
    if (pDiff !== 0) return pDiff
    return new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  })

  const activeOffers = offers.filter((o) => o.status === 'pending' || o.status === 'counter_offer')
  const bestOffer = offers.length > 0
    ? offers.reduce((max, o) => (o.amount > max.amount ? o : max), offers[0])
    : null
  const bestDiffPct = bestOffer ? ((bestOffer.amount - property.price) / property.price) * 100 : 0

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <p className={SECTION_LABEL}>Offres</p>
        <h1 className="mt-1.5 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
          Vos offres, en toute transparence
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
          Chaque proposition est analysée par votre agent avant qu'une réponse ne soit formulée.
        </p>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={cn(CARD, CARD_HOVER, 'p-5')}>
          <p className={SECTION_LABEL}>Reçues</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight">
            {offers.length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            offre{offers.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <div className={cn(CARD, CARD_HOVER, 'p-5')}>
          <p className={SECTION_LABEL}>En cours</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight">
            {activeOffers.length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            en analyse par l'agent
          </p>
        </div>
        <div className={cn(CARD, CARD_HOVER, 'p-5')}>
          <p className={SECTION_LABEL}>Meilleure offre</p>
          <p className="mt-3 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight">
            {bestOffer ? formatCHF(bestOffer.amount) : '—'}
          </p>
          {bestOffer && (
            <p
              className={cn(
                'text-xs mt-1 tabular-nums font-medium',
                bestDiffPct >= 0
                  ? 'text-emerald-600 dark:text-emerald-500'
                  : 'text-rose-600 dark:text-rose-500',
              )}
            >
              {bestDiffPct >= 0 ? '+' : ''}
              {bestDiffPct.toFixed(1)}% vs prix demandé
            </p>
          )}
        </div>
        <div className={cn(CARD, CARD_HOVER, 'p-5')}>
          <p className={SECTION_LABEL}>Prix demandé</p>
          <p className="mt-3 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight">
            {formatCHF(property.price)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {property.rooms} pièces · {property.surface_m2} m²
          </p>
        </div>
      </div>

      {/* ── Active offers callout ─────────────────────────────────────── */}
      {activeOffers.length > 0 && (
        <section
          className={cn(
            CARD,
            'p-5 md:p-6 flex items-start gap-4 border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/10 dark:to-gray-900 dark:border-emerald-900/40',
          )}
        >
          <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {activeOffers.length} offre{activeOffers.length > 1 ? 's' : ''} en cours d'analyse
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Gregory Lyonnet vous contactera pour discuter de la stratégie de réponse.
            </p>
          </div>
        </section>
      )}

      {/* ── Offer list ────────────────────────────────────────────────── */}
      {sortedOffers.length > 0 ? (
        <div className="space-y-4">
          {sortedOffers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              askingPrice={property.price}
              isBest={!!bestOffer && offer.id === bestOffer.id && offers.length > 1}
              onReply={setReplyOffer}
            />
          ))}
        </div>
      ) : (
        <section className={cn(CARD, 'p-10 flex flex-col items-center text-center')}>
          <img
            src="/illustrations/maggy/EmptyState.svg"
            alt=""
            className="w-40 h-32 mb-3 opacity-70"
            loading="lazy"
            decoding="async"
          />
          <p className="text-sm font-medium text-gray-900 dark:text-white">Aucune offre pour le moment</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            Les offres apparaîtront ici dès qu'un acquéreur potentiel en soumettra une à votre agent.
          </p>
        </section>
      )}

      {/* ── Confidentiality note ──────────────────────────────────────── */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Les informations sur les acquéreurs sont anonymisées pour protéger la confidentialité des parties.
      </p>

      {/* Reply modal */}
      {replyOffer && (
        <ReplyModal
          offer={replyOffer}
          onClose={() => setReplyOffer(null)}
          onSend={() => { /* mock — in production, persists to messages */ }}
        />
      )}
    </div>
  )
}
