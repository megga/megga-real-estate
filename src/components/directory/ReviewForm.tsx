import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSubmitReview } from '@/hooks/useAgentReviews'

interface ReviewFormProps {
  agentProfileId: string
  onSuccess?: () => void
}

const AXES = [
  { key: 'rating_local_knowledge' as const, i18n: 'review.localKnowledge' },
  { key: 'rating_process_expertise' as const, i18n: 'review.processExpertise' },
  { key: 'rating_responsiveness' as const, i18n: 'review.responsiveness' },
  { key: 'rating_negotiation' as const, i18n: 'review.negotiation' },
]

export default function ReviewForm({ agentProfileId, onSuccess }: ReviewFormProps) {
  const { t } = useTranslation('directory')
  const submitReview = useSubmitReview()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [comment, setComment] = useState('')
  const [ratings, setRatings] = useState({
    rating_local_knowledge: 0,
    rating_process_expertise: 0,
    rating_responsiveness: 0,
    rating_negotiation: 0,
  })
  const [submitted, setSubmitted] = useState(false)

  const allRated = Object.values(ratings).every(v => v > 0)
  const canSubmit = name.trim() && email.trim() && allRated && !submitReview.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    submitReview.mutate(
      { agent_profile_id: agentProfileId, reviewer_name: name, reviewer_email: email, comment, ...ratings },
      { onSuccess: () => { setSubmitted(true); onSuccess?.() } }
    )
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-theme-border p-5 text-center">
        <p className="text-sm text-emerald-600">{t('review.submitted')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-theme-border p-5 space-y-4">
      {/* Ratings */}
      {AXES.map(axis => (
        <div key={axis.key}>
          <label className="text-xs text-theme-secondary mb-1 block">{t(axis.i18n)}</label>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRatings(prev => ({ ...prev, [axis.key]: i + 1 }))}
                className="p-0.5"
              >
                <Star className={cn('h-5 w-5 transition-colors', i < ratings[axis.key] ? 'fill-amber-400 text-amber-400' : 'text-theme-border hover:text-amber-300')} />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Text fields */}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={t('review.yourName')}
        className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
      />
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder={t('review.yourEmail')}
        className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
      />
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder={t('review.yourComment')}
        rows={3}
        className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="h-9 px-4 text-sm font-medium rounded-lg border border-theme-border text-theme-primary hover:border-theme-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {submitReview.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t('review.submit')}
      </button>
    </form>
  )
}
