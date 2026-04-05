import { useTranslation } from 'react-i18next'
import { Star, ShieldCheck } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import type { AgentReview } from '@/hooks/useAgentReviews'

interface ReviewCardProps {
  review: AgentReview
}

const AXES = [
  { key: 'rating_local_knowledge', i18n: 'review.localKnowledge' },
  { key: 'rating_process_expertise', i18n: 'review.processExpertise' },
  { key: 'rating_responsiveness', i18n: 'review.responsiveness' },
  { key: 'rating_negotiation', i18n: 'review.negotiation' },
] as const

export default function ReviewCard({ review }: ReviewCardProps) {
  const { t } = useTranslation('directory')

  return (
    <div className="rounded-xl border border-theme-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-theme-primary">{review.reviewer_name}</span>
          {review.is_verified && (
            <span className="inline-flex items-center gap-1 text-xs text-accent">
              <ShieldCheck className="h-3 w-3" />
              {t('badge.verifiedClient')}
            </span>
          )}
        </div>
        <span className="text-xs text-theme-muted">{formatRelativeDate(review.created_at)}</span>
      </div>

      {/* 4-axis ratings */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {AXES.map(axis => {
          const value = review[axis.key]
          return (
            <div key={axis.key} className="flex items-center justify-between">
              <span className="text-xs text-theme-secondary">{t(axis.i18n)}</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={cn('h-2.5 w-2.5', i < value ? 'fill-amber-400 text-amber-400' : 'text-theme-border')} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-theme-primary">{review.comment}</p>
      )}

      {/* Agent response */}
      {review.agent_response && (
        <div className="mt-3 pl-4 border-l-2 border-theme-border">
          <p className="text-xs font-medium text-theme-secondary mb-1">{t('review.agentResponse')}</p>
          <p className="text-sm text-theme-primary">{review.agent_response}</p>
        </div>
      )}
    </div>
  )
}
