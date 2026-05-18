import { useState, useEffect } from 'react'
import { X, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

const NPS_STORAGE_KEY = 'megga-nps-dismissed'
const NPS_SUBMITTED_KEY = 'megga-nps-submitted'

export default function NpsSurvey() {
  const { profile } = useAuth()
  const [visible, setVisible] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)

  useEffect(() => {
    if (!profile) return
    // Don't show for super_admin
    if (profile.role === 'super_admin') return
    // Don't show if already submitted or dismissed
    if (localStorage.getItem(NPS_SUBMITTED_KEY)) return
    if (localStorage.getItem(NPS_STORAGE_KEY)) {
      const dismissed = new Date(localStorage.getItem(NPS_STORAGE_KEY)!)
      // Don't show again for 30 days after dismissal
      if (Date.now() - dismissed.getTime() < 30 * 24 * 60 * 60 * 1000) return
    }
    // Check if account is 30+ days old
    const created = new Date(profile.created_at)
    const daysSinceCreation = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceCreation >= 30) {
      // Delay showing by 5 seconds
      const timer = setTimeout(() => setVisible(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [profile])

  async function handleSubmit() {
    if (rating === null) return
    try {
      await supabase.from('admin_nps_responses').insert({
        rating,
        comment,
        user_id: profile?.id ?? null,
        user_email: profile?.email ?? null,
        user_name: profile?.full_name ?? null,
        agency_id: profile?.agency_id ?? null,
        role: profile?.role ?? null,
      })
    } catch {
      /* silently fail */
    }
    localStorage.setItem(NPS_SUBMITTED_KEY, 'true')
    setSubmitted(true)
    setTimeout(() => setVisible(false), 2000)
  }

  function handleDismiss() {
    localStorage.setItem(NPS_STORAGE_KEY, new Date().toISOString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-theme-card rounded-xl border border-theme-border p-5 animate-in slide-in-from-bottom-4 duration-300">
      {submitted ? (
        <div className="text-center py-4">
          <p className="text-sm font-medium text-theme-primary">Merci pour votre retour !</p>
          <p className="text-xs text-theme-secondary mt-1">Votre avis nous aide a ameliorer MEGGA</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-theme-primary">Comment evaluez-vous MEGGA ?</p>
            <button
              onClick={handleDismiss}
              aria-label="Fermer"
              className="h-6 w-6 rounded-full flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-hover transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Star rating */}
          <div className="flex items-center justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(null)}
                aria-label={`${star} etoile${star > 1 ? 's' : ''}`}
                className="p-1 transition-colors"
              >
                <Star className={cn(
                  'h-7 w-7 transition-colors',
                  (hoveredStar !== null ? star <= hoveredStar : star <= (rating ?? 0))
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-theme-border'
                )} />
              </button>
            ))}
          </div>

          {/* Comment (appears after rating) */}
          {rating !== null && (
            <div className="space-y-3">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={rating >= 4 ? "Qu'est-ce qui vous plait le plus ?" : 'Comment pouvons-nous nous ameliorer ?'}
                rows={2}
                className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder:text-theme-muted"
              />
              <button
                onClick={handleSubmit}
                className="w-full h-9 text-sm font-medium border border-theme-border text-theme-primary rounded-lg hover:border-accent hover:text-accent transition-colors"
              >
                Envoyer
              </button>
            </div>
          )}

          <p className="text-xs text-theme-muted mt-3 text-center">1 = Pas du tout satisfait · 5 = Tres satisfait</p>
        </>
      )}
    </div>
  )
}
