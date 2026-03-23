import { Send, Calendar } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import type { MatchResult } from '@/hooks/useMatching'

interface MatchScoreCardProps {
  match: MatchResult
  onSend: () => void
  onIgnore: () => void
  className?: string
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-theme-border rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-theme-primary transition-all" style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-theme-primary tabular-nums">{score}%</span>
    </div>
  )
}

export default function MatchScoreCard({ match, onSend, onIgnore, className }: MatchScoreCardProps) {
  const listing = match.listing
  const isSent = match.status === 'sent'

  return (
    <div className={cn(
      'rounded-xl border border-theme-border overflow-hidden transition-colors hover:border-theme-active',
      isSent && 'opacity-60',
      className
    )}>
      <div className="flex">
        {/* Photo */}
        <div className="w-28 sm:w-36 flex-shrink-0">
          <img
            src={listing.photos[0]}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="text-sm font-medium text-theme-primary truncate">{listing.title}</p>
              <p className="text-xs text-theme-tertiary truncate">{listing.address}, {listing.city}</p>
            </div>
            <span className="text-sm font-semibold text-theme-primary flex-shrink-0">{formatCHF(listing.price)}</span>
          </div>

          {/* Score bar */}
          <div className="my-2">
            <ScoreBar score={match.score} />
          </div>

          {/* Reason badges */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {match.reasons.budget.match && <span className="text-[10px] text-emerald-500">Budget</span>}
            {match.reasons.zone.match && <span className="text-[10px] text-emerald-500">Zone</span>}
            {match.reasons.type.match && <span className="text-[10px] text-emerald-500">Type</span>}
            {match.reasons.rooms.match && <span className="text-[10px] text-emerald-500">Surface</span>}
            {match.reasons.features.match && <span className="text-[10px] text-emerald-500">Extras</span>}
          </div>

          {/* Actions */}
          {isSent ? (
            <p className="text-[11px] text-theme-muted">Envoyé · {match.sentVia}</p>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onSend}
                className="inline-flex items-center gap-1 text-xs font-medium h-7 px-2.5 rounded-lg border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
              >
                <Send className="h-3 w-3" />
                Envoyer
              </button>
              <button
                onClick={onIgnore}
                className="inline-flex items-center gap-1 text-xs text-theme-tertiary hover:text-theme-primary h-7 px-2 rounded-lg hover:bg-theme-hover transition-colors"
              >
                <Calendar className="h-3 w-3" />
                Visite
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
