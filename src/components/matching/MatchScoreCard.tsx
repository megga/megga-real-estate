import { useTranslation } from 'react-i18next'
import { Send, Calendar } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { optimizeImageUrl, IMAGE_PRESETS } from '@/lib/imageOptimizer'
interface MatchScoreCardProps {
  match: {
    id: string
    score: number
    status: string
    sent_via?: string | null
    reasons: Record<string, unknown> | null
    property?: { title?: string; price?: number; address?: string; city?: string; rooms?: number; surface_m2?: number; photos?: string[] | null } | null
    listing?: { title: string; price: number; address: string; city: string; rooms: number; surface_m2: number; photos: string[] }
  }
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
  const { t } = useTranslation('matching')
  // Support both shapes: match.property (MatchWithRelations) or match.listing (MatchResult)
  const property = match.property || match.listing
  if (!property) return null

  const isSent = match.status === 'sent'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reasons = match.reasons as Record<string, any> | null

  return (
    <div className={cn(
      'rounded-xl border border-theme-border overflow-hidden transition-colors hover:border-theme-active',
      isSent && 'opacity-60',
      className
    )}>
      <div className="flex">
        {/* Photo */}
        <div className="w-28 sm:w-36 flex-shrink-0">
          {property.photos?.[0] ? (
            <img
              src={optimizeImageUrl(property.photos[0], IMAGE_PRESETS.card)}
              alt={property.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-theme-section flex items-center justify-center">
              <span className="text-xs text-theme-muted">{t('card.noPhoto')}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="text-sm font-medium text-theme-primary truncate">{property.title}</p>
              <p className="text-xs text-theme-tertiary truncate">{property.address}, {property.city}</p>
            </div>
            <span className="text-sm font-semibold text-theme-primary flex-shrink-0">{formatCHF(property.price || 0)}</span>
          </div>

          {/* Score bar */}
          <div className="my-2">
            <ScoreBar score={match.score} />
          </div>

          {/* Reason badges */}
          {reasons && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {reasons.budget && <span className="text-xs text-emerald-500">{t('scoreCard.reason.budget')}</span>}
              {reasons.zone && <span className="text-xs text-emerald-500">{t('scoreCard.reason.zone')}</span>}
              {reasons.type && <span className="text-xs text-emerald-500">{t('scoreCard.reason.type')}</span>}
              {reasons.rooms_surface && <span className="text-xs text-emerald-500">{t('scoreCard.reason.surface')}</span>}
              {reasons.features && <span className="text-xs text-emerald-500">{t('scoreCard.reason.extras')}</span>}
              {reasons.distance_km != null && (
                <span className="text-xs text-theme-secondary">{reasons.distance_km} km</span>
              )}
              {reasons.must_have_missing?.length > 0 && (
                <span className="text-xs text-red-500">
                  {t('scoreCard.missing', { list: reasons.must_have_missing.join(', ') })}
                </span>
              )}
              {reasons.nice_to_have_matched?.length > 0 && (
                <span className="text-xs text-blue-500">
                  {t('scoreCard.niceToHave', { list: reasons.nice_to_have_matched.join(', ') })}
                </span>
              )}
              {reasons.days_on_market > 30 && (
                <span className="text-xs text-theme-muted">{t('scoreCard.daysOnMarket', { count: reasons.days_on_market })}</span>
              )}
            </div>
          )}

          {/* Actions */}
          {isSent ? (
            <p className="text-xs text-theme-muted">{t('scoreCard.sentVia', { channel: match.sent_via })}</p>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onSend}
                className="inline-flex items-center gap-1 text-xs font-medium h-7 px-2.5 rounded-lg border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
              >
                <Send className="h-3 w-3" />
                {t('common:actions.send')}
              </button>
              <button
                onClick={onIgnore}
                className="inline-flex items-center gap-1 text-xs text-theme-tertiary hover:text-theme-primary h-7 px-2 rounded-lg hover:bg-theme-hover transition-colors"
              >
                <Calendar className="h-3 w-3" />
                {t('scoreCard.visit')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
