/**
 * Bloc de vote « Cet article vous a-t-il aidé ? » en pied d'article du centre d'aide.
 *
 * Enregistre une vue (`article_views`) au montage puis un vote (`article_feedback`).
 * Un vote négatif déroule un champ commentaire ; positif = remerciement immédiat.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ThumbsUp, Check } from 'lucide-react'
import { ThumbDislike as ThumbsDown } from '@/components/icons'
import { supabase } from '@/lib/supabase'

export default function ArticleFeedback({ slug }: { slug: string }) {
  const { t } = useTranslation('common')
  const [voted, setVoted] = useState<boolean | null>(null)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Track article view
  useEffect(() => {
    supabase.from('article_views').insert({ article_slug: slug }).then()
  }, [slug])

  async function handleVote(helpful: boolean) {
    setVoted(helpful)

    // Save to Supabase
    const { data: user } = await supabase.auth.getUser()
    supabase.from('article_feedback').insert({
      article_slug: slug,
      helpful,
      user_id: user.user?.id || null,
    }).then()

    if (!helpful) setShowComment(true)
    else setSubmitted(true)
  }

  async function handleSubmitComment() {
    // Update the feedback with comment
    const { data: user } = await supabase.auth.getUser()
    supabase.from('article_feedback').insert({
      article_slug: slug,
      helpful: false,
      comment,
      user_id: user.user?.id || null,
    }).then()

    setSubmitted(true)
    setShowComment(false)
  }

  if (submitted) {
    return (
      <div className="border-t border-gray-100 pt-6">
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <Check className="h-4 w-4" />
          {t('help.feedbackThanks')}
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-100 pt-6">
      <p className="text-sm text-gray-600 mb-3">{t('help.feedbackPrompt')}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleVote(true)}
          disabled={voted !== null}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <ThumbsUp className="h-4 w-4" />
          {t('help.feedbackYes')}
        </button>
        <button
          onClick={() => handleVote(false)}
          disabled={voted !== null}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <ThumbsDown className="h-4 w-4" />
          {t('help.feedbackNo')}
        </button>
      </div>

      {showComment && (
        <div className="mt-4 space-y-2">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={t('help.feedbackPlaceholder')}
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
          />
          <button
            onClick={handleSubmitComment}
            className="h-8 px-4 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            {t('help.feedbackSend')}
          </button>
        </div>
      )}
    </div>
  )
}
