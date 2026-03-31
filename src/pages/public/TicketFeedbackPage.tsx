import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useSubmitCsat } from '@/hooks/useTickets'

const FACES = [
  { rating: 1, emoji: '\ud83d\ude21', label: 'Très insatisfait' },
  { rating: 2, emoji: '\ud83d\ude15', label: 'Insatisfait' },
  { rating: 3, emoji: '\ud83d\ude10', label: 'Neutre' },
  { rating: 4, emoji: '\ud83d\ude42', label: 'Satisfait' },
  { rating: 5, emoji: '\ud83d\ude00', label: 'Très satisfait' },
]

export default function TicketFeedbackPage() {
  const { ticketNumber } = useParams<{ ticketNumber: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const preRating = searchParams.get('rating')

  const submitCsat = useSubmitCsat()
  const [rating, setRating] = useState<number>(preRating ? parseInt(preRating) : 0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (!ticketNumber || !token || !rating) return
    await submitCsat.mutateAsync({ ticketNumber, token, rating, comment: comment || undefined })
    setSubmitted(true)
  }

  if (!ticketNumber || !token) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <p className="text-gray-500">Lien invalide.</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Merci pour votre retour !</h1>
          <p className="text-sm text-gray-500">Votre avis nous aide à améliorer notre support.</p>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">MEGGA Support</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Votre avis sur le ticket {ticketNumber}</h1>
        <p className="text-sm text-gray-500 mb-8">Comment évaluez-vous le support reçu ?</p>

        {/* Faces */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {FACES.map(face => (
            <button
              key={face.rating}
              onClick={() => setRating(face.rating)}
              title={face.label}
              className={cn(
                'text-4xl transition-all hover:scale-110',
                rating === face.rating ? 'scale-125 opacity-100' : 'opacity-40 hover:opacity-70'
              )}
            >
              {face.emoji}
            </button>
          ))}
        </div>

        {rating > 0 && (
          <>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Commentaire (optionnel)"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none mb-4"
            />
            <button
              onClick={handleSubmit}
              disabled={submitCsat.isPending}
              className="h-10 px-6 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Envoyer
            </button>
          </>
        )}
      </div>
      <Footer />
    </div>
  )
}
