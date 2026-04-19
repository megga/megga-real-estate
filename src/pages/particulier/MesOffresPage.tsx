import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MessageSquare, X, CheckCircle2, ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SellerOffer } from '@/lib/mockSellerData'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'

// ─────────────────────────────────────────────────────────────────────────
// MES OFFRES — "Relevé éditorial suisse"
// ─────────────────────────────────────────────────────────────────────────
// Typographic direction: this page breaks from the rounded-card SaaS idiom
// of the rest of the portal and adopts the register of a private-bank
// quarterly statement crossed with an editorial magazine. Paper-warm ivory
// background, hairline rules instead of borders, huge Fraunces numerals
// for the amounts, Geist Mono for tabular subtotals, deep forest green as
// the single colour accent. Rationale: receiving offers on a home is a
// gravely financial moment for the seller — the UI should *feel* that.
//
// Fonts loaded via <link> in index.html. All usage scoped to this page via
// arbitrary Tailwind `font-[...]` utilities, so the rest of the app keeps
// its DM Sans baseline.
// ─────────────────────────────────────────────────────────────────────────

const DISPLAY = 'font-["Fraunces"] [font-variation-settings:"opsz"_144]'
const NUMERIC = 'font-["Geist_Mono"] tabular-nums'
const BODY = 'font-["Geist"]'
const LABEL = cn(BODY, 'text-[10px] font-medium uppercase tracking-[0.14em] text-ink/50')
const RULE = 'border-ink/10'
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30'

// Inline style tokens — named so the colour palette stays legible in JSX.
// Paper = warm off-white, Ink = warm near-black, Forest = accepted accent,
// Ochre = pending, Rust = rejected.
const palette = {
  paper: '#FAF8F4',
  ink: '#1A1714',
  forest: '#0F4C3A',
  ochre: '#A87421',
  rust: '#9E3B2A',
} as const

// Scoped CSS via a style tag — keeps the palette tokens accessible to
// descendant elements without bloating Tailwind's config globally.
const SCOPED_CSS = `
  .ledger { background: ${palette.paper}; color: ${palette.ink}; }
  .ledger .text-ink { color: ${palette.ink}; }
  .ledger .bg-ink { background: ${palette.ink}; }
  .ledger .text-forest { color: ${palette.forest}; }
  .ledger .bg-forest\\/5 { background: ${palette.forest}0d; }
  .ledger .text-ochre { color: ${palette.ochre}; }
  .ledger .text-rust { color: ${palette.rust}; }
  .ledger .border-ink\\/10 { border-color: ${palette.ink}1a; }
  .ledger .border-ink\\/20 { border-color: ${palette.ink}33; }
  .ledger .text-ink\\/50 { color: ${palette.ink}80; }
  .ledger .text-ink\\/70 { color: ${palette.ink}b3; }
  .ledger .text-ink\\/40 { color: ${palette.ink}66; }
  @keyframes ledger-rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .ledger-rise { animation: ledger-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
`

// ─── helpers ─────────────────────────────────────────────────────────────

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
  if (days < 7) return `il y a ${days} j`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'il y a 1 sem'
  return `il y a ${weeks} sem`
}

// Format a CHF amount *without* the currency prefix — useful when we want
// the huge display number with a small "CHF" mark on the side.
function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-CH').replace(/,/g, '\u2019')
}

// ─── status config ───────────────────────────────────────────────────────

type StatusKey = SellerOffer['status']
const STATUS: Record<StatusKey, { label: string; tone: string }> = {
  pending: { label: 'En analyse', tone: 'text-ochre' },
  counter_offer: { label: 'Contre-proposition', tone: 'text-ink' },
  accepted: { label: 'Acceptée', tone: 'text-forest' },
  rejected: { label: 'Refusée', tone: 'text-rust' },
  expired: { label: 'Expirée', tone: 'text-ink/40' },
}

// ─── Big amount display ──────────────────────────────────────────────────
// The hero of every offer line. Opsz axis of Fraunces lets us push the
// display weight without feeling heavy — variable fonts doing what they
// were built for.

function BigAmount({ amount, muted = false }: { amount: number; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline gap-2', muted && 'opacity-55')}>
      <span className={cn(BODY, 'text-[11px] font-medium uppercase tracking-[0.14em] text-ink/50')}>
        CHF
      </span>
      <span
        className={cn(
          DISPLAY,
          'text-[44px] md:text-[56px] leading-[0.92] tracking-[-0.035em] font-[500]',
        )}
      >
        {formatAmount(amount)}
      </span>
    </div>
  )
}

// ─── Delta scale ─────────────────────────────────────────────────────────
// A thin bracketed scale line — think financial chart, not SaaS progress
// bar. Tick at 100% reference mark. The offer position shows where it
// lands relative to asking price.

function RatioScale({
  offerAmount,
  askingPrice,
}: {
  offerAmount: number
  askingPrice: number
}) {
  const ratio = Math.min(1.25, Math.max(0.5, offerAmount / askingPrice))
  const position = ((ratio - 0.5) / (1.25 - 0.5)) * 100
  const anchor = ((1 - 0.5) / (1.25 - 0.5)) * 100
  const diffPct = ((offerAmount - askingPrice) / askingPrice) * 100
  const isAbove = diffPct > 0
  const isEqual = Math.abs(diffPct) < 0.05
  const tone = isEqual ? 'bg-ink' : isAbove ? 'bg-forest' : 'bg-rust'

  return (
    <div className="relative w-full" aria-hidden>
      {/* Labels above */}
      <div className={cn(BODY, 'flex justify-between text-[9px] uppercase tracking-[0.14em] text-ink/40 mb-1.5')}>
        <span>−50 %</span>
        <span className="tabular-nums">Prix demandé</span>
        <span>+25 %</span>
      </div>
      {/* Rail */}
      <div className="relative h-px bg-ink/20">
        {/* End ticks */}
        <span className="absolute -top-1 left-0 w-px h-2 bg-ink/30" />
        <span className="absolute -top-1 right-0 w-px h-2 bg-ink/30" />
        {/* Anchor tick (100%) */}
        <span
          className="absolute -top-1.5 w-px h-3 bg-ink/40"
          style={{ left: `${anchor}%` }}
        />
        {/* Offer marker */}
        <span
          className={cn('absolute -top-[5px] w-[11px] h-[11px] rounded-full ring-2 ring-[color:var(--paper,#FAF8F4)]', tone)}
          style={{ left: `calc(${position}% - 5.5px)`, ['--paper' as string]: palette.paper }}
        />
      </div>
    </div>
  )
}

// ─── Modal (reply to agent) ──────────────────────────────────────────────
// Carries the same editorial vocabulary: paper background, hairline rules,
// Fraunces title. The submit button is a ghost link-style button, no pill.

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
    `Concernant l'offre de CHF ${formatAmount(offer.amount)}, je souhaite `,
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
      className={cn(BODY, 'ledger fixed inset-0 z-[100] flex items-center justify-center px-4')}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ background: `${palette.ink}30`, backdropFilter: 'blur(8px)' }}
    >
      <style>{SCOPED_CSS}</style>
      <div
        className="ledger relative w-full max-w-lg p-8 ledger-rise"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.paper,
          boxShadow: `0 40px 80px -20px ${palette.ink}33`,
        }}
      >
        {/* Top rule with eyebrow label */}
        <div className={cn('flex items-center justify-between pb-3 border-b', RULE)}>
          <span className={LABEL}>Réponse confidentielle</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className={cn('text-ink/50 hover:text-ink transition-colors', FOCUS_RING)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          <h3 className={cn(DISPLAY, 'text-[32px] leading-[0.95] tracking-[-0.02em] font-[500]')}>
            Message à votre agent
          </h3>
          <p className={cn(BODY, 'text-sm text-ink/70 mt-2')}>
            À propos de l'offre de{' '}
            <span className={NUMERIC}>CHF {formatAmount(offer.amount)}</span>
          </p>
        </div>

        {sent ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto w-6 h-6 text-forest mb-3" strokeWidth={1.5} />
            <p className={cn(BODY, 'text-sm font-medium')}>Message transmis</p>
            <p className={cn(BODY, 'text-xs text-ink/50 mt-1')}>
              Votre agent vous répondra dans les meilleurs délais.
            </p>
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className={cn(
                BODY,
                'w-full mt-6 px-0 py-3 text-[15px] leading-relaxed bg-transparent border-0 border-b border-ink/20 resize-none text-ink placeholder:text-ink/30',
                'focus:outline-none focus:border-ink transition-colors',
              )}
              style={{ fontFamily: 'Geist, sans-serif' }}
              placeholder="Votre message…"
            />
            <p className={cn(BODY, 'text-[11px] text-ink/40 mt-3 uppercase tracking-[0.1em]')}>
              Transmis à Gregory Lyonnet via la messagerie chiffrée
            </p>
            <div className={cn('flex justify-end mt-6 pt-4 border-t', RULE)}>
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className={cn(
                  BODY,
                  'inline-flex items-center gap-2 text-sm font-medium transition-all',
                  FOCUS_RING,
                  message.trim()
                    ? 'text-ink hover:gap-3'
                    : 'text-ink/30 cursor-not-allowed',
                )}
              >
                Envoyer le message
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─── Offer ledger entry ──────────────────────────────────────────────────
// Each entry is a full-width "row" divided by hairlines — closer to a
// printed statement than to a SaaS card. The amount dominates the left
// column; delta, scale and status form the right column. Hover subtly
// brightens the row.

function OfferRow({
  offer,
  askingPrice,
  rank,
  isBest,
  onReply,
  delayMs,
}: {
  offer: SellerOffer
  askingPrice: number
  rank: number
  isBest: boolean
  onReply: (offer: SellerOffer) => void
  delayMs: number
}) {
  const statusCfg = STATUS[offer.status]
  const diffAmount = offer.amount - askingPrice
  const diffPercent = (diffAmount / askingPrice) * 100
  const isActive = offer.status === 'pending' || offer.status === 'counter_offer'
  const isMuted = offer.status === 'rejected' || offer.status === 'expired'

  return (
    <article
      className={cn('ledger-rise group py-8 md:py-10 border-b', RULE)}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Rank + meta (col 1–2) */}
        <div className="col-span-12 md:col-span-2">
          <div className="flex items-baseline gap-2">
            <span className={cn(DISPLAY, 'text-[14px] text-ink/40 tabular-nums')}>
              N°
            </span>
            <span className={cn(DISPLAY, 'text-[28px] leading-none tabular-nums text-ink/70')}>
              {String(rank).padStart(2, '0')}
            </span>
          </div>
          {isBest && (
            <span className={cn(LABEL, 'mt-2 inline-flex items-center gap-1.5 text-forest')}>
              <span className="w-1 h-1 rounded-full bg-forest" />
              Meilleure
            </span>
          )}
        </div>

        {/* Amount + date (col 3–7) */}
        <div className="col-span-12 md:col-span-6">
          <BigAmount amount={offer.amount} muted={isMuted} />
          <p className={cn(BODY, 'mt-3 text-[13px] text-ink/50')}>
            Reçue le {formatDateLong(offer.received_at)}
            <span className="text-ink/30"> · </span>
            {timeAgo(offer.received_at)}
          </p>
        </div>

        {/* Delta + scale + status (col 8–12) */}
        <div className="col-span-12 md:col-span-4 space-y-5">
          {/* Delta number — big enough to earn its place */}
          <div className="flex flex-col items-start md:items-end">
            <span className={LABEL}>Écart prix demandé</span>
            <span
              className={cn(
                DISPLAY,
                NUMERIC.replace('font-["Geist_Mono"]', ''),
                'mt-1 text-[26px] leading-none tabular-nums tracking-[-0.02em]',
                diffPercent > 0 ? 'text-forest' : diffPercent < 0 ? 'text-rust' : 'text-ink',
              )}
            >
              {diffPercent > 0 ? '+' : ''}
              {diffPercent.toFixed(1)}
              <span className="text-[16px] ml-0.5">%</span>
            </span>
            <span className={cn(NUMERIC, 'text-[12px] text-ink/50 mt-1')}>
              {diffAmount > 0 ? '+' : ''}
              {formatAmount(diffAmount)} CHF
            </span>
          </div>

          {/* Scale */}
          <RatioScale offerAmount={offer.amount} askingPrice={askingPrice} />

          {/* Status row */}
          <div className="flex items-center justify-between pt-1">
            <span className={cn(LABEL, statusCfg.tone)}>
              {statusCfg.label}
            </span>
            {isActive && (
              <button
                onClick={() => onReply(offer)}
                className={cn(
                  BODY,
                  'group/btn inline-flex items-center gap-1.5 text-[12px] font-medium text-ink hover:gap-2 transition-all',
                  FOCUS_RING,
                )}
              >
                <MessageSquare className="w-3 h-3" strokeWidth={1.75} />
                Répondre
                <span className="block h-px w-3 bg-ink opacity-0 group-hover/btn:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conditions — indented below, typeset like a footnote */}
      {offer.conditions && (
        <div className="mt-6 pl-0 md:pl-[16.666%]">
          <div className={cn('pl-4 border-l-2', RULE, 'border-l-ink/20')}>
            <span className={LABEL}>Conditions</span>
            <p className={cn(BODY, 'text-[14px] text-ink/70 leading-[1.65] mt-1.5')}>
              {offer.conditions}
            </p>
          </div>
        </div>
      )}
    </article>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function MesOffresPage() {
  const { property, offers } = useSellerPortalData()
  const [replyOffer, setReplyOffer] = useState<SellerOffer | null>(null)

  const sortedOffers = [...offers].sort((a, b) => {
    const rank = (s: string) => (s === 'pending' || s === 'counter_offer' ? 0 : 1)
    const d = rank(a.status) - rank(b.status)
    if (d !== 0) return d
    return new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  })

  const activeOffers = offers.filter((o) => o.status === 'pending' || o.status === 'counter_offer')
  const bestOffer = offers.length > 0
    ? offers.reduce((max, o) => (o.amount > max.amount ? o : max), offers[0])
    : null
  const avgOffer = offers.length > 0
    ? offers.reduce((sum, o) => sum + o.amount, 0) / offers.length
    : 0
  const bestDiffPct = bestOffer ? ((bestOffer.amount - property.price) / property.price) * 100 : 0

  return (
    <div
      className={cn('ledger', BODY, '-mx-4 md:-mx-6 -mt-6 px-4 md:px-10 pt-8 md:pt-12 pb-20 min-h-[calc(100vh-4rem)]')}
      style={{ background: palette.paper }}
    >
      <style>{SCOPED_CSS}</style>

      <div className="max-w-5xl mx-auto">
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <header className="ledger-rise">
          <div className="flex items-baseline justify-between flex-wrap gap-4">
            <span className={LABEL}>
              Relevé des offres
              <span className="text-ink/30 mx-2">—</span>
              <span className={NUMERIC}>
                {new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </span>
            <span className={cn(BODY, 'text-[11px] uppercase tracking-[0.14em] text-ink/40')}>
              Confidentiel
            </span>
          </div>

          <h1
            className={cn(
              DISPLAY,
              'mt-6 md:mt-8 text-[clamp(48px,8vw,96px)] leading-[0.9] tracking-[-0.045em] font-[400]',
            )}
          >
            Vos offres,
            <br />
            <em className="not-italic text-ink/50">en toute</em>{' '}
            <em className="italic font-[400] text-forest" style={{ fontVariationSettings: '"opsz" 144' }}>
              transparence
            </em>
            <span className="text-ink/50">.</span>
          </h1>

          <p className={cn(BODY, 'mt-6 md:mt-8 text-[15px] text-ink/70 max-w-xl leading-relaxed')}>
            Chaque proposition reçue sur votre bien est consignée ici. Votre agent l'analyse
            avant toute réponse — la stratégie reste la vôtre.
          </p>
        </header>

        {/* ── Thick rule then statement row ────────────────────────── */}
        <div className="ledger-rise mt-10 md:mt-14" style={{ animationDelay: '100ms' }}>
          <div className="h-px bg-ink" />

          {/* Statement of account — 4 columns with vertical hairlines */}
          <dl className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-ink/10">
            {[
              {
                label: 'Reçues',
                value: String(offers.length).padStart(2, '0'),
                hint: `offre${offers.length > 1 ? 's' : ''} au total`,
              },
              {
                label: 'En analyse',
                value: String(activeOffers.length).padStart(2, '0'),
                hint: activeOffers.length > 0 ? 'en cours' : 'aucune',
                tone: activeOffers.length > 0 ? 'text-ochre' : undefined,
              },
              {
                label: 'Meilleure',
                value: bestOffer ? formatAmount(bestOffer.amount) : '—',
                hint: bestOffer ? `${bestDiffPct >= 0 ? '+' : ''}${bestDiffPct.toFixed(1)} % vs demandé` : 'pas encore',
                currency: !!bestOffer,
                small: true,
                tone: bestDiffPct >= 0 ? 'text-forest' : 'text-rust',
              },
              {
                label: 'Moyenne',
                value: avgOffer > 0 ? formatAmount(Math.round(avgOffer)) : '—',
                hint: 'des offres reçues',
                currency: avgOffer > 0,
                small: true,
              },
            ].map((kpi, i) => (
              <div key={kpi.label} className={cn('py-6 md:py-7', i > 0 && 'pl-0 md:pl-6', 'pr-6')}>
                <dt className={LABEL}>{kpi.label}</dt>
                <dd className={cn('mt-3 flex items-baseline gap-2', kpi.tone)}>
                  {kpi.currency && (
                    <span className={cn(BODY, 'text-[10px] font-medium uppercase tracking-[0.14em] text-ink/50')}>
                      CHF
                    </span>
                  )}
                  <span
                    className={cn(
                      DISPLAY,
                      'tabular-nums leading-none tracking-[-0.035em] font-[500]',
                      kpi.small ? 'text-[26px] md:text-[30px]' : 'text-[42px] md:text-[52px]',
                    )}
                  >
                    {kpi.value}
                  </span>
                </dd>
                <p className={cn(BODY, 'mt-2 text-[12px] text-ink/50')}>{kpi.hint}</p>
              </div>
            ))}
          </dl>

          <div className="h-px bg-ink/20" />
        </div>

        {/* ── Active-offers note (sparse, typographic, not a banner) ── */}
        {activeOffers.length > 0 && (
          <div
            className="ledger-rise mt-10 md:mt-14 flex items-start gap-5 max-w-3xl"
            style={{ animationDelay: '200ms' }}
          >
            <span className={cn(DISPLAY, 'text-[64px] leading-[0.7] text-forest font-[300]')}>
              §
            </span>
            <div>
              <p className={cn(BODY, 'text-[15px] leading-[1.65]')}>
                <span className="text-forest font-medium">
                  {activeOffers.length} offre{activeOffers.length > 1 ? 's' : ''} en cours d'analyse
                  {' '}par Gregory Lyonnet.
                </span>{' '}
                <span className="text-ink/60">
                  Il vous recontactera avant toute contre-proposition ou signature.
                  Les offres inactives (refusées, expirées) sont conservées pour archive.
                </span>
              </p>
            </div>
          </div>
        )}

        {/* ── Ledger body ──────────────────────────────────────────── */}
        {sortedOffers.length > 0 ? (
          <div className="mt-10 md:mt-14">
            <div className="flex items-end justify-between pb-3 border-b border-ink">
              <h2 className={cn(DISPLAY, 'text-[22px] tracking-[-0.02em]')}>Détail des offres</h2>
              <span className={cn(NUMERIC, 'text-[11px] text-ink/50')}>
                {String(offers.length).padStart(2, '0')} ligne{offers.length > 1 ? 's' : ''}
              </span>
            </div>

            <div>
              {sortedOffers.map((offer, i) => (
                <OfferRow
                  key={offer.id}
                  offer={offer}
                  askingPrice={property.price}
                  rank={sortedOffers.length - i}
                  isBest={!!bestOffer && offer.id === bestOffer.id && offers.length > 1}
                  onReply={setReplyOffer}
                  delayMs={300 + i * 90}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="ledger-rise mt-14 py-20 text-center" style={{ animationDelay: '200ms' }}>
            <span className={cn(DISPLAY, 'text-[56px] text-ink/20 font-[300]')}>—</span>
            <p className={cn(BODY, 'mt-4 text-[15px] text-ink/60')}>
              Aucune offre consignée à ce jour.
            </p>
            <p className={cn(BODY, 'mt-1 text-[13px] text-ink/40 max-w-md mx-auto')}>
              Les propositions s'inscriront dans ce relevé dès leur réception par votre agent.
            </p>
          </div>
        )}

        {/* ── Footer plate ─────────────────────────────────────────── */}
        <footer className="mt-16 md:mt-20 pt-6 border-t border-ink/20 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className={cn(BODY, 'text-[11px] uppercase tracking-[0.14em] text-ink/40')}>
              MEGGA Real Estate
              <span className="mx-2 text-ink/20">·</span>
              Relevé confidentiel
            </p>
            <p className={cn(BODY, 'mt-2 text-[11px] text-ink/40 max-w-lg leading-relaxed')}>
              Les informations sur les acquéreurs potentiels sont anonymisées pour protéger
              la confidentialité des parties et satisfaire à la LPD.
            </p>
          </div>
          <p className={cn(NUMERIC, 'text-[11px] text-ink/40 uppercase tracking-[0.1em]')}>
            Réf. {property.id?.slice(0, 8) ?? '—'}
          </p>
        </footer>
      </div>

      {replyOffer && (
        <ReplyModal
          offer={replyOffer}
          onClose={() => setReplyOffer(null)}
          onSend={() => { /* mock — prod wire goes to messaging table */ }}
        />
      )}
    </div>
  )
}
