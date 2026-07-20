/**
 * Page publique — retour de visite pour l'acheteur (sans login).
 *
 * Route : `/visit/:id/feedback` ; l'auth se fait via le `?token=` du lien
 * (le `:id` n'est qu'affichage). Formulaire note étoiles + points forts /
 * objections + intérêt d'offre ; le retour est anonymisé côté vendeur.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Star, Check } from 'lucide-react'
import { LoadingCircle1 as Loader2 } from '@/components/icons'
import { Location as MapPin } from '@/components/icons'
import { cn } from '@/lib/utils'
import { usePublicVisit, useSubmitFeedback } from '@/hooks/useVisits'
import PublicPageHeader from '@/components/layout/PublicPageHeader'

const STRENGTHS = [
  'Luminosité', 'Agencement', 'Quartier', 'État général', 'Vue', 'Calme', 'Surface', 'Rangements',
]

const OBJECTIONS = [
  'Prix trop élevé', 'Trop petit', 'Bruit', 'Travaux nécessaires', 'Étage', 'Pas de parking', 'Manque de lumière', 'Autre',
]

export default function VisitFeedbackPage() {
  // Visit ID from URL (used for display, token used for auth)
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || undefined

  const { data: visit, isLoading } = usePublicVisit(token)
  const submitFeedback = useSubmitFeedback()

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [strengths, setStrengths] = useState<string[]>([])
  const [objections, setObjections] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [offerInterest, setOfferInterest] = useState<'yes' | 'maybe' | 'no' | ''>('')
  const [submitted, setSubmitted] = useState(false)

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <PublicPageHeader />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="h-8 w-8 border-2 border-gray-200 border-t-accent rounded-full animate-spin mb-4" />
        </div>
      </div>
    )
  }

  if (!visit || !token) {
    return (
      <div className="min-h-screen bg-white">
        <PublicPageHeader />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-xl font-semibold text-gray-900 mb-2">Lien invalide</p>
          <p className="text-sm text-gray-500">Ce lien de feedback est expiré ou invalide.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white">
        <PublicPageHeader />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Merci pour votre retour</h2>
          <p className="text-sm text-gray-500 mt-2">
            Votre avis aide l'agent à mieux comprendre vos attentes.
          </p>
        </div>
      </div>
    )
  }

  const property = visit.property

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating || !offerInterest || !token) return
    await submitFeedback.mutateAsync({
      token,
      rating,
      strengths,
      objections,
      comment,
      offerInterest: offerInterest as 'yes' | 'maybe' | 'no',
    })
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicPageHeader />
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Property card */}
        <div className="rounded-xl border border-gray-200 overflow-hidden mb-8">
          {property?.photos?.[0] && (
            <div className="aspect-[16/9]">
              <img src={property.photos[0]} alt="" className="w-full h-full object-cover" decoding="async" />
            </div>
          )}
          <div className="p-4">
            <h2 className="text-base font-semibold text-gray-900">{property?.title || 'Bien visité'}</h2>
            {property?.address && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                <MapPin className="h-3.5 w-3.5" />
                {property.address}, {property.city}
              </div>
            )}
          </div>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-6">Comment s'est passée la visite ?</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Star rating */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">Note globale</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5 transition-transform hover:scale-110"
                  aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                >
                  <Star className={cn(
                    'h-8 w-8 transition-colors',
                    (hoverRating || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                  )} />
                </button>
              ))}
            </div>
          </div>

          {/* Strengths */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Points forts</label>
            <div className="flex flex-wrap gap-1.5">
              {STRENGTHS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleItem(strengths, setStrengths, s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs transition-colors',
                    strengths.includes(s) ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Objections */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Points à améliorer</label>
            <div className="flex flex-wrap gap-1.5">
              {OBJECTIONS.map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggleItem(objections, setObjections, o)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs transition-colors',
                    objections.includes(o) ? 'border-red-300 bg-red-50 text-red-600 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Commentaire libre</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Partagez vos impressions..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
            />
          </div>

          {/* Offer interest */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Seriez-vous intéressé par une offre ?</label>
            <div className="flex gap-2">
              {[
                { key: 'yes', label: 'Oui' },
                { key: 'maybe', label: 'Peut-être' },
                { key: 'no', label: 'Non' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOfferInterest(key as typeof offerInterest)}
                  className={cn(
                    'flex-1 h-10 rounded-lg border text-sm font-medium transition-colors',
                    offerInterest === key
                      ? 'border-accent bg-accent/5 text-accent'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!rating || !offerInterest || submitFeedback.isPending}
            className={cn(
              'w-full h-11 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2',
              rating && offerInterest && !submitFeedback.isPending
                ? 'border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
                : 'bg-gray-100 text-gray-500 cursor-not-allowed'
            )}
          >
            {submitFeedback.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {submitFeedback.isPending ? 'Envoi...' : 'Envoyer mon avis'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Votre retour est anonymisé et partagé avec le vendeur pour améliorer la présentation du bien.
          </p>
        </form>
      </div>
    </div>
  )
}
