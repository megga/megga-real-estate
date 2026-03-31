import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Star, Clock, CheckCircle2, XCircle, AlertCircle, X, MessageSquare } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'
import type { SellerVisit } from '@/lib/mockSellerData'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'

const STATUS_CONFIG: Record<SellerVisit['status'], { label: string; icon: React.ElementType; color: string }> = {
  planned: { label: 'Planifiée', icon: Clock, color: 'text-theme-secondary' },
  confirmed: { label: 'Confirmée', icon: CalendarDays, color: 'text-theme-secondary' },
  done: { label: 'Effectuée', icon: CheckCircle2, color: 'text-theme-primary' },
  cancelled: { label: 'Annulée', icon: XCircle, color: 'text-theme-muted' },
  no_show: { label: 'Absent', icon: AlertCircle, color: 'text-theme-tertiary' },
}

// ── Postpone modal ──────────────────────────────────────────────────────

function PostponeModal({ visit, onClose }: { visit: SellerVisit; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const visitDate = new Date(visit.date)

  function handleSend() {
    setSent(true)
    setTimeout(onClose, 2000)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-150" />
      <div
        className="relative bg-theme-elevated rounded-xl border border-theme-border ring-1 ring-white/5 w-full max-w-md mx-4 p-6 animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-theme-primary">Reporter la visite</h3>
            <p className="text-xs text-theme-muted mt-0.5">
              {visitDate.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })} à {visitDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={onClose} className={cn('h-7 w-7 flex items-center justify-center rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-hover transition-colors', FOCUS_RING)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center">
            <p className="text-sm text-theme-primary font-medium">Demande envoyée</p>
            <p className="text-xs text-theme-muted mt-1">Votre agent vous proposera un nouveau créneau.</p>
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 text-sm bg-transparent border border-theme-border rounded-lg resize-none text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              placeholder="Indiquez vos disponibilités ou la raison du report..."
            />
            <p className="text-[10px] text-theme-muted mt-1.5">Votre agent sera notifié et vous proposera un nouveau créneau.</p>
            <div className="flex justify-end mt-4">
              <button onClick={handleSend} className={cn('h-8 px-4 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors', FOCUS_RING)}>
                Envoyer la demande
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Feedback modal ──────────────────────────────────────────────────────

function FeedbackModal({ visit, onClose }: { visit: SellerVisit; onClose: () => void }) {
  const [feedback, setFeedback] = useState('')
  const [sent, setSent] = useState(false)

  function handleSend() {
    if (!feedback.trim()) return
    setSent(true)
    setTimeout(onClose, 2000)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-150" />
      <div
        className="relative bg-theme-elevated rounded-xl border border-theme-border ring-1 ring-white/5 w-full max-w-md mx-4 p-6 animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-theme-primary">Votre impression</h3>
            <p className="text-xs text-theme-muted mt-0.5">Visite du {formatDate(visit.date)}</p>
          </div>
          <button onClick={onClose} className={cn('h-7 w-7 flex items-center justify-center rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-hover transition-colors', FOCUS_RING)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center">
            <p className="text-sm text-theme-primary font-medium">Merci pour votre retour</p>
            <p className="text-xs text-theme-muted mt-1">Votre agent en tiendra compte dans sa stratégie.</p>
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 text-sm bg-transparent border border-theme-border rounded-lg resize-none text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              placeholder="Comment s'est passée la visite de votre côté ?"
            />
            <p className="text-[10px] text-theme-muted mt-1.5">Votre retour est confidentiel — seul votre agent le verra.</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={handleSend}
                disabled={!feedback.trim()}
                className={cn(
                  'h-8 px-4 rounded-lg text-xs font-medium border border-theme-border transition-colors',
                  FOCUS_RING,
                  feedback.trim() ? 'text-theme-secondary hover:text-theme-primary hover:border-theme-active' : 'text-theme-muted cursor-not-allowed'
                )}
              >
                Envoyer
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Main page ───────────────────────────────────────────────────────────

export default function MesVisitesPage() {
  const { visits, kpis } = useSellerPortalData()
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [postponeVisit, setPostponeVisit] = useState<SellerVisit | null>(null)
  const [feedbackVisit, setFeedbackVisit] = useState<SellerVisit | null>(null)

  const upcoming = visits.filter(v => v.status === 'planned' || v.status === 'confirmed')
  const past = visits.filter(v => v.status === 'done' || v.status === 'cancelled' || v.status === 'no_show')

  function handleConfirm(visitId: string) {
    setConfirmedIds(prev => new Set(prev).add(visitId))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-theme-primary">Visites</h1>
        <p className="text-sm text-theme-tertiary mt-1">
          {kpis.visits_total} visite{kpis.visits_total > 1 ? 's' : ''} au total · {kpis.visits_this_month} ce mois
        </p>
      </div>

      {/* Upcoming visits */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-theme-border p-5">
          <h2 className="text-[10px] text-theme-muted uppercase tracking-wider mb-3">
            Prochaines visites
          </h2>
          <div className="space-y-3">
            {upcoming.map((visit) => {
              const config = STATUS_CONFIG[visit.status]
              const Icon = config.icon
              const visitDate = new Date(visit.date)
              const isConfirmed = confirmedIds.has(visit.id) || visit.status === 'confirmed'
              return (
                <div key={visit.id} className="flex items-center gap-3 rounded-lg border border-theme-border p-4">
                  <div className="shrink-0 text-center">
                    <p className="text-2xl font-semibold text-theme-primary">{visitDate.getDate()}</p>
                    <p className="text-[10px] text-theme-tertiary uppercase">
                      {visitDate.toLocaleDateString('fr-CH', { month: 'short' })}
                    </p>
                  </div>
                  <div className="h-10 w-px bg-theme-border" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-theme-primary">
                      {visitDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Icon className={cn('w-3.5 h-3.5', isConfirmed ? 'text-theme-primary' : config.color)} />
                      <span className={cn('text-xs font-medium', isConfirmed ? 'text-theme-primary' : config.color)}>
                        {isConfirmed && !confirmedIds.has(visit.id) ? 'Confirmée' : isConfirmed ? 'Disponibilité confirmée' : config.label}
                      </span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isConfirmed && (
                      <button
                        onClick={() => handleConfirm(visit.id)}
                        className={cn('h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors', FOCUS_RING)}
                      >
                        Confirmer
                      </button>
                    )}
                    <button
                      onClick={() => setPostponeVisit(visit)}
                      className={cn('h-8 px-3 rounded-lg text-xs text-theme-muted hover:text-theme-secondary transition-colors', FOCUS_RING)}
                    >
                      Reporter
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Past visits */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-[10px] text-theme-muted uppercase tracking-wider mb-4">
          Visites passées
        </h2>

        {past.length === 0 ? (
          <p className="text-sm text-theme-muted text-center py-8">Aucune visite passée</p>
        ) : (
          <div className="space-y-0">
            {past.map((visit, i) => {
              const config = STATUS_CONFIG[visit.status]
              const Icon = config.icon
              return (
                <div key={visit.id} className={cn('py-4', i < past.length - 1 && 'border-b border-theme-border-subtle')}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('w-4 h-4', config.color)} />
                      <p className="text-sm font-medium text-theme-primary">{formatDate(visit.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
                      {visit.status === 'done' && (
                        <button
                          onClick={() => setFeedbackVisit(visit)}
                          className={cn('h-7 px-2.5 rounded-md text-[10px] text-theme-muted hover:text-theme-secondary border border-theme-border-subtle hover:border-theme-active transition-colors flex items-center gap-1', FOCUS_RING)}
                        >
                          <MessageSquare className="w-3 h-3" />
                          Mon impression
                        </button>
                      )}
                    </div>
                  </div>

                  {visit.feedback && (
                    <div className="ml-6 mt-2">
                      <p className="text-[10px] text-theme-muted mb-1">Retour de l'acquéreur potentiel :</p>
                      <p className="text-sm text-theme-secondary italic leading-relaxed">
                        "{visit.feedback}"
                      </p>
                      {visit.rating != null && (
                        <div className="flex items-center gap-0.5 mt-2">
                          {Array.from({ length: 5 }).map((_, starIdx) => (
                            <Star
                              key={starIdx}
                              className={cn(
                                'w-3.5 h-3.5',
                                starIdx < visit.rating! ? 'text-amber-400 fill-amber-400' : 'text-theme-border'
                              )}
                            />
                          ))}
                          <span className="text-xs text-theme-muted ml-1">{visit.rating}/5</span>
                        </div>
                      )}
                    </div>
                  )}

                  {visit.status === 'cancelled' && (
                    <p className="ml-6 mt-1 text-xs text-theme-muted italic">Visite annulée</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-theme-muted text-center">
        Les retours sont anonymisés pour protéger la confidentialité des acquéreurs potentiels.
      </p>

      {/* Modals */}
      {postponeVisit && <PostponeModal visit={postponeVisit} onClose={() => setPostponeVisit(null)} />}
      {feedbackVisit && <FeedbackModal visit={feedbackVisit} onClose={() => setFeedbackVisit(null)} />}
    </div>
  )
}
