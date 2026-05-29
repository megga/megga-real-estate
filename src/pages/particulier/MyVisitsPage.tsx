import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays, Star, Clock, CheckCircle2, XCircle, AlertCircle, X,
  MessageSquare, ArrowRight, Quote,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'
import type { SellerVisit } from '@/lib/mockSellerData'

// ─── Shared tokens (mirror of MonDossierPage) ────────────────────────────
// Kept inline so a future `dark` class toggle on SellerLayout flips the page.

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 dark:focus-visible:ring-white/30'
const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500'
const CARD = 'rounded-2xl bg-white border border-gray-100 dark:bg-gray-900 dark:border-gray-800'
const CARD_HOVER = 'transition-all duration-200 hover:border-gray-200 dark:hover:border-gray-700'

// Status colors use light text rather than filled pills — same restraint as
// the badges on MonDossierPage. Emerald = positive, amber = pending agent
// action, gray/red = neutral/negative.
const STATUS_CONFIG: Record<
  SellerVisit['status'],
  { label: string; icon: React.ElementType; tone: string; dot: string }
> = {
  planned: { label: 'Planifiée', icon: Clock, tone: 'text-amber-600 dark:text-amber-500', dot: 'bg-amber-500' },
  confirmed: { label: 'Confirmée', icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-500', dot: 'bg-emerald-500' },
  done: { label: 'Effectuée', icon: CalendarDays, tone: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
  cancelled: { label: 'Annulée', icon: XCircle, tone: 'text-gray-400 dark:text-gray-600', dot: 'bg-gray-300' },
  no_show: { label: 'Absent', icon: AlertCircle, tone: 'text-red-600 dark:text-red-500', dot: 'bg-red-500' },
}

// ─── Modals ──────────────────────────────────────────────────────────────
// Both modals follow the same rhythm: header with contextual date, textarea,
// helper line, single ghost CTA. On send we swap the body for a "success"
// state and auto-close after 2s — the seller gets feedback without needing
// a separate toast.

function ModalShell({ title, subtitle, onClose, children }: {
  title: string
  subtitle: string
  onClose: () => void
  children: React.ReactNode
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in-0 duration-150" />
      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800',
          'p-6 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] animate-in fade-in-0 zoom-in-95 duration-200',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className={cn(
              'h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
              FOCUS_RING,
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function PostponeModal({ visit, onClose }: { visit: SellerVisit; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const visitDate = new Date(visit.date)

  function handleSend() {
    setSent(true)
    setTimeout(onClose, 2000)
  }

  return (
    <ModalShell
      title="Reporter la visite"
      subtitle={`${visitDate.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })} à ${visitDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`}
      onClose={onClose}
    >
      {sent ? (
        <div className="py-8 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Demande envoyée</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Votre agent vous proposera un nouveau créneau.</p>
        </div>
      ) : (
        <>
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl resize-none text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-300 dark:focus:border-gray-600"
            placeholder="Indiquez vos disponibilités ou la raison du report…"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Votre agent sera notifié et vous proposera un nouveau créneau.</p>
          <div className="flex justify-end mt-5">
            <button
              onClick={handleSend}
              className={cn(
                'inline-flex items-center gap-2 h-10 px-5 rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.3)]',
                FOCUS_RING,
              )}
            >
              Envoyer la demande
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

function FeedbackModal({ visit, onClose }: { visit: SellerVisit; onClose: () => void }) {
  const [feedback, setFeedback] = useState('')
  const [sent, setSent] = useState(false)

  function handleSend() {
    if (!feedback.trim()) return
    setSent(true)
    setTimeout(onClose, 2000)
  }

  return (
    <ModalShell
      title="Votre impression"
      subtitle={`Visite du ${formatDate(visit.date)}`}
      onClose={onClose}
    >
      {sent ? (
        <div className="py-8 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Merci pour votre retour</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Votre agent en tiendra compte dans sa stratégie.</p>
        </div>
      ) : (
        <>
          <textarea
            autoFocus
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl resize-none text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 focus:border-gray-300 dark:focus:border-gray-600"
            placeholder="Comment s'est passée la visite de votre côté ?"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Votre retour est confidentiel — seul votre agent le verra.</p>
          <div className="flex justify-end mt-5">
            <button
              onClick={handleSend}
              disabled={!feedback.trim()}
              className={cn(
                'inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm font-medium transition-all',
                FOCUS_RING,
                feedback.trim()
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.3)]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed',
              )}
            >
              Envoyer
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

// ─── Date tile ───────────────────────────────────────────────────────────
// Used in the upcoming-visit cards. Calendar-style block: month on top in
// emerald, day number big, day-of-week bottom. Compact but scannable.

function DateTile({ date, accent = 'emerald' }: { date: Date; accent?: 'emerald' | 'gray' }) {
  const month = date.toLocaleDateString('fr-CH', { month: 'short' }).replace('.', '')
  const weekday = date.toLocaleDateString('fr-CH', { weekday: 'short' }).replace('.', '')
  const isEmerald = accent === 'emerald'
  return (
    <div
      className={cn(
        'shrink-0 w-14 rounded-xl overflow-hidden border text-center',
        isEmerald
          ? 'border-emerald-200/70 dark:border-emerald-900/50'
          : 'border-gray-200 dark:border-gray-700',
      )}
    >
      <div
        className={cn(
          'text-[10px] font-semibold uppercase tracking-[0.08em] py-1',
          isEmerald
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-500'
            : 'bg-gray-50 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400',
        )}
      >
        {month}
      </div>
      <div className="py-1.5 bg-white dark:bg-gray-900">
        <p className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums leading-none">
          {date.getDate()}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 capitalize mt-0.5">{weekday}</p>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function MyVisitsPage() {
  const { visits, kpis } = useSellerPortalData()
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [postponeVisit, setPostponeVisit] = useState<SellerVisit | null>(null)
  const [feedbackVisit, setFeedbackVisit] = useState<SellerVisit | null>(null)

  const upcoming = visits
    .filter((v) => v.status === 'planned' || v.status === 'confirmed')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const past = visits
    .filter((v) => v.status === 'done' || v.status === 'cancelled' || v.status === 'no_show')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const ratedVisits = past.filter((v) => v.rating != null)
  const avgRating = ratedVisits.length > 0
    ? ratedVisits.reduce((sum, v) => sum + (v.rating || 0), 0) / ratedVisits.length
    : null

  function handleConfirm(visitId: string) {
    setConfirmedIds((prev) => new Set(prev).add(visitId))
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <p className={SECTION_LABEL}>Visites</p>
        <h1 className="mt-1.5 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
          Chaque visite rapproche de la vente
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
          Suivez les créneaux planifiés et les retours des acquéreurs potentiels.
        </p>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Au total', value: kpis.visits_total, sub: 'depuis publication' },
          { label: 'Ce mois', value: kpis.visits_this_month, sub: 'créneaux réalisés' },
          { label: 'À venir', value: upcoming.length, sub: upcoming.length > 0 ? 'planifiées' : 'aucune' },
          {
            label: 'Note moyenne',
            value: avgRating != null ? avgRating.toFixed(1) : '—',
            sub: avgRating != null ? `${ratedVisits.length} retour${ratedVisits.length > 1 ? 's' : ''}` : 'pas encore',
          },
        ].map((kpi) => (
          <div key={kpi.label} className={cn(CARD, CARD_HOVER, 'p-5')}>
            <p className={SECTION_LABEL}>{kpi.label}</p>
            <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight">
              {kpi.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Upcoming visits ───────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section className={cn(CARD, 'p-6 md:p-7')}>
          <div className="flex items-center justify-between mb-5">
            <p className={SECTION_LABEL}>Prochaines visites</p>
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
              {upcoming.length} créneau{upcoming.length > 1 ? 'x' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {upcoming.map((visit) => {
              const config = STATUS_CONFIG[visit.status]
              const Icon = config.icon
              const visitDate = new Date(visit.date)
              const isConfirmed = confirmedIds.has(visit.id) || visit.status === 'confirmed'
              const justConfirmed = confirmedIds.has(visit.id)
              return (
                <div
                  key={visit.id}
                  className={cn(
                    'flex items-center gap-4 rounded-xl border border-gray-100 dark:border-gray-800 p-4 md:p-5',
                    CARD_HOVER,
                  )}
                >
                  <DateTile date={visitDate} accent={isConfirmed ? 'emerald' : 'gray'} />

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight">
                      {visitDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {isConfirmed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                      ) : (
                        <Icon className={cn('w-3.5 h-3.5', config.tone)} />
                      )}
                      <span
                        className={cn(
                          'text-xs font-medium',
                          isConfirmed ? 'text-emerald-600 dark:text-emerald-500' : config.tone,
                        )}
                      >
                        {justConfirmed ? 'Disponibilité confirmée' : isConfirmed ? 'Confirmée' : config.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isConfirmed && (
                      <button
                        onClick={() => handleConfirm(visit.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.3)]',
                          FOCUS_RING,
                        )}
                      >
                        Confirmer
                      </button>
                    )}
                    <button
                      onClick={() => setPostponeVisit(visit)}
                      className={cn(
                        'h-9 px-3 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors',
                        FOCUS_RING,
                      )}
                    >
                      Reporter
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Past visits ───────────────────────────────────────────────── */}
      <section className={cn(CARD, 'p-6 md:p-7')}>
        <div className="flex items-center justify-between mb-5">
          <p className={SECTION_LABEL}>Visites passées</p>
          {past.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
              {past.length} visite{past.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {past.length === 0 ? (
          <div className="flex flex-col items-center text-center py-8">
            <img
              src="/illustrations/maggy/Planning.svg"
              alt=""
              className="w-40 h-32 mb-3 opacity-70"
              loading="lazy"
              decoding="async"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">Aucune visite passée pour le moment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {past.map((visit) => {
              const config = STATUS_CONFIG[visit.status]
              const Icon = config.icon
              const visitDate = new Date(visit.date)
              return (
                <div
                  key={visit.id}
                  className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 md:p-5"
                >
                  <div className="flex items-start gap-4">
                    <DateTile date={visitDate} accent="gray" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {visitDate.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                          <span className="text-gray-300 dark:text-gray-700">·</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                            {visitDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn('w-3.5 h-3.5', config.tone)} />
                            <span className={cn('text-xs font-medium', config.tone)}>{config.label}</span>
                          </div>
                          {visit.status === 'done' && (
                            <button
                              onClick={() => setFeedbackVisit(visit)}
                              className={cn(
                                'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                                FOCUS_RING,
                              )}
                            >
                              <MessageSquare className="w-3 h-3" />
                              Mon impression
                            </button>
                          )}
                        </div>
                      </div>

                      {visit.feedback && (
                        <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 p-4">
                          <div className="flex items-start gap-2">
                            <Quote className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500 mb-1">
                                Retour acquéreur
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {visit.feedback}
                              </p>
                              {visit.rating != null && (
                                <div className="flex items-center gap-0.5 mt-2.5">
                                  {Array.from({ length: 5 }).map((_, starIdx) => (
                                    <Star
                                      key={starIdx}
                                      className={cn(
                                        'w-3.5 h-3.5',
                                        starIdx < visit.rating!
                                          ? 'text-amber-400 fill-amber-400'
                                          : 'text-gray-200 dark:text-gray-700',
                                      )}
                                    />
                                  ))}
                                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1.5 tabular-nums">
                                    {visit.rating}/5
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {visit.status === 'cancelled' && !visit.feedback && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">
                          L'acquéreur n'a pas pu se présenter.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Confidentiality note ──────────────────────────────────────── */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Les retours sont anonymisés pour protéger la confidentialité des acquéreurs potentiels.
      </p>

      {/* Modals */}
      {postponeVisit && <PostponeModal visit={postponeVisit} onClose={() => setPostponeVisit(null)} />}
      {feedbackVisit && <FeedbackModal visit={feedbackVisit} onClose={() => setFeedbackVisit(null)} />}
    </div>
  )
}
