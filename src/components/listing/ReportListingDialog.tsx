import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Reason = 'wrong_price' | 'already_taken' | 'wrong_photos' | 'inaccurate_description' | 'spam_fraud' | 'other'

const REASONS: { value: Reason; label: string; hint: string }[] = [
  { value: 'wrong_price', label: 'Prix incorrect', hint: 'Le prix affiché ne correspond pas à la réalité' },
  { value: 'already_taken', label: 'Bien déjà loué / vendu', hint: 'L\'annonce devrait être retirée' },
  { value: 'wrong_photos', label: 'Photos incorrectes', hint: 'Les photos ne montrent pas le bon bien' },
  { value: 'inaccurate_description', label: 'Description inexacte', hint: 'Les informations ne correspondent pas' },
  { value: 'spam_fraud', label: 'Spam ou arnaque', hint: 'Tentative de fraude, phishing, etc.' },
  { value: 'other', label: 'Autre', hint: '' },
]

interface Props {
  listingId: string
  listingTitle?: string
  onClose: () => void
}

export default function ReportListingDialog({ listingId, listingTitle, onClose }: Props) {
  const [reason, setReason] = useState<Reason | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!reason || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: insertErr } = await supabase.from('listing_reports').insert({
        listing_id: listingId,
        user_id: user?.id ?? null,
        reason,
        comment: comment.trim() || null,
      })
      if (insertErr) throw insertErr
      setSubmitted(true)
    } catch (e) {
      setError((e as Error).message || 'Échec de l\'envoi, réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-500" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900">Signaler un problème</p>
            {listingTitle && (
              <p className="text-[12px] text-gray-500 truncate mt-0.5">{listingTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="px-5 pb-6 pt-2 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
              <Check className="h-6 w-6 text-green-500" strokeWidth={2.25} />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Merci pour ton signalement</p>
            <p className="text-[13px] text-gray-500 max-w-[280px] leading-relaxed">
              Notre équipe va vérifier cette annonce sous 24 h. Tu as aidé à améliorer la qualité de la marketplace.
            </p>
            <button
              onClick={onClose}
              className="mt-5 h-10 px-5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            {/* Reasons */}
            <div className="px-5 pb-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">Motif</p>
              {REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={cn(
                    'w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer',
                    reason === r.value
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                      reason === r.value ? 'border-gray-900' : 'border-gray-300'
                    )}>
                      {reason === r.value && <span className="h-2 w-2 rounded-full bg-gray-900" />}
                    </span>
                    <span className="text-[13px] font-medium text-gray-900">{r.label}</span>
                  </div>
                  {r.hint && (
                    <p className="text-[11px] text-gray-500 mt-0.5 ml-6">{r.hint}</p>
                  )}
                </button>
              ))}
            </div>

            {/* Comment */}
            <div className="px-5 pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">
                Commentaire <span className="normal-case tracking-normal text-gray-300">(optionnel)</span>
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ajoute des détails pour nous aider à traiter ton signalement..."
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-transparent rounded-xl focus:outline-none focus:border-gray-900 focus:bg-white transition-colors placeholder:text-gray-400 resize-none"
              />
            </div>

            {error && (
              <p className="px-5 text-xs text-red-500 mb-3">{error}</p>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/40">
              <button
                onClick={onClose}
                className="h-9 px-4 text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className={cn(
                  'h-9 px-5 rounded-full text-sm font-semibold transition-colors cursor-pointer',
                  !reason || submitting
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                )}
              >
                {submitting ? 'Envoi…' : 'Envoyer le signalement'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
