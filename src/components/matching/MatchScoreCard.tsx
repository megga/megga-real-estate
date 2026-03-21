import { Send, Calendar, X, Check } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import type { MatchResult } from '@/lib/matching'

interface MatchScoreCardProps {
  match: MatchResult
  onSend: () => void
  onIgnore: () => void
  className?: string
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-success' : score >= 60 ? 'bg-accent' : 'bg-warning'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn(
        'text-xs font-bold',
        score >= 80 ? 'text-success' : score >= 60 ? 'text-accent' : 'text-warning'
      )}>
        {score}%
      </span>
    </div>
  )
}

function ReasonBadge({ label, match }: { label: string; match: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-badge',
      match ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-400'
    )}>
      {match ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      {label}
    </span>
  )
}

export default function MatchScoreCard({ match, onSend, onIgnore, className }: MatchScoreCardProps) {
  const listing = match.listing
  const isSent = match.status === 'sent'

  return (
    <div className={cn(
      'bg-white rounded-card shadow-card border border-border overflow-hidden transition-shadow hover:shadow-card-hover',
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
              <p className="text-sm font-medium text-primary-900 truncate">{listing.title}</p>
              <p className="text-xs text-muted-foreground truncate">{listing.address}, {listing.city}</p>
            </div>
            <span className="text-sm font-bold text-primary-900 flex-shrink-0">{formatCHF(listing.price)}</span>
          </div>

          {/* Score bar */}
          <div className="my-2">
            <ScoreBar score={match.score} />
          </div>

          {/* Reason badges */}
          <div className="flex flex-wrap gap-1 mb-2">
            <ReasonBadge label="Budget" match={match.reasons.budget.match} />
            <ReasonBadge label="Zone" match={match.reasons.zone.match} />
            <ReasonBadge label="Type" match={match.reasons.type.match} />
            <ReasonBadge label="Surface" match={match.reasons.rooms.match} />
            <ReasonBadge label="Extras" match={match.reasons.features.match} />
          </div>

          {/* Actions */}
          {isSent ? (
            <div className="flex items-center gap-1 text-xs text-success">
              <Check className="h-3.5 w-3.5" />
              Envoyé via {match.sentVia}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onSend}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-button bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                <Send className="h-3 w-3" />
                Envoyer au client
              </button>
              <button
                onClick={onIgnore}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary-600 px-2 py-1.5 rounded-button hover:bg-section transition-colors"
              >
                <Calendar className="h-3 w-3" />
                Planifier visite
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
