import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react'

const STORAGE_KEY = 'megga-help-feedback'

function loadFeedback(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const arr: { slug: string; helpful: boolean }[] = JSON.parse(raw)
    const map: Record<string, boolean> = {}
    arr.forEach(f => { map[f.slug] = f.helpful })
    return map
  } catch { return {} }
}

function saveFeedback(slug: string, helpful: boolean, comment?: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr: { slug: string; helpful: boolean; comment?: string; timestamp: string }[] = raw ? JSON.parse(raw) : []
    const existing = arr.findIndex(f => f.slug === slug)
    const entry = { slug, helpful, comment, timestamp: new Date().toISOString() }
    if (existing >= 0) arr[existing] = entry
    else arr.push(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch { /* ignore */ }
}

export default function ArticleFeedback({ slug }: { slug: string }) {
  const existing = loadFeedback()
  const [voted, setVoted] = useState<boolean | null>(existing[slug] ?? null)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleVote(helpful: boolean) {
    setVoted(helpful)
    saveFeedback(slug, helpful)
    if (!helpful) setShowComment(true)
    else setSubmitted(true)
  }

  function handleSubmitComment() {
    saveFeedback(slug, false, comment)
    setSubmitted(true)
    setShowComment(false)
  }

  if (submitted) {
    return (
      <div className="border-t border-gray-100 pt-6">
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <Check className="h-4 w-4" />
          Merci pour votre retour !
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-100 pt-6">
      <p className="text-sm text-gray-600 mb-3">Cet article vous a été utile ?</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleVote(true)}
          disabled={voted !== null}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <ThumbsUp className="h-4 w-4" />
          Oui
        </button>
        <button
          onClick={() => handleVote(false)}
          disabled={voted !== null}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <ThumbsDown className="h-4 w-4" />
          Non
        </button>
      </div>

      {showComment && (
        <div className="mt-4 space-y-2">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Qu'est-ce qui pourrait être amélioré ?"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
          />
          <button
            onClick={handleSubmitComment}
            className="h-8 px-4 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            Envoyer
          </button>
        </div>
      )}
    </div>
  )
}
