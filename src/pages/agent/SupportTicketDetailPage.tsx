import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Send, Lock, Loader2, Star } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTicket, useUpdateTicket, useAddMessage, useCannedResponses } from '@/hooks/useTickets'
import PageTransition from '@/components/layout/PageTransition'

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nouveau' },
  { value: 'open', label: 'Ouvert' },
  { value: 'pending', label: 'En attente' },
  { value: 'on_hold', label: 'En pause' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Fermé' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Bas' },
  { value: 'medium', label: 'Moyen' },
  { value: 'high', label: 'Haut' },
  { value: 'urgent', label: 'Urgent' },
]

export default function SupportTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { data, isLoading } = useTicket(id)
  const updateTicket = useUpdateTicket()
  const addMessage = useAddMessage()
  const { data: cannedResponses = [] } = useCannedResponses()

  const [replyText, setReplyText] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)

  if (isLoading || !data) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      </PageTransition>
    )
  }

  const { ticket, messages } = data

  async function handleSendReply() {
    if (!replyText.trim() || !id || !profile) return
    await addMessage.mutateAsync({
      ticketId: id,
      authorType: 'agent',
      authorName: profile.full_name || 'Agent',
      authorId: profile.id,
      body: replyText.trim(),
      isInternalNote,
    })
    setReplyText('')
    setIsInternalNote(false)
  }

  function handleStatusChange(status: string) {
    if (!id) return
    updateTicket.mutate({ id, status })
  }

  function handlePriorityChange(priority: string) {
    if (!id) return
    updateTicket.mutate({ id, priority })
  }

  function insertCanned(body: string) {
    setReplyText(prev => prev ? `${prev}\n\n${body}` : body)
  }

  return (
    <PageTransition>
      <div className="px-2 py-2">
        <Link to="/dashboard/support" className="flex items-center gap-1 text-sm text-theme-secondary hover:text-theme-primary mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Tickets
        </Link>

        <h1 className="text-xl font-semibold text-theme-primary mb-1">{ticket.ticket_number}</h1>
        <p className="text-sm text-theme-secondary mb-6">{ticket.subject}</p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Left: Conversation */}
          <div className="space-y-4">
            <div className="rounded-xl border border-theme-border p-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
              {messages.map(msg => {
                const isAgent = msg.author_type === 'agent'
                const isNote = msg.is_internal_note

                return (
                  <div key={msg.id} className={cn(
                    'rounded-lg p-3.5',
                    isNote
                      ? 'bg-amber-50 border border-amber-200/50'
                      : isAgent
                        ? 'bg-theme-section border border-theme-border-subtle ml-8'
                        : 'bg-theme-card border border-theme-border mr-8'
                  )}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {isNote && <Lock className="h-3 w-3 text-amber-600" />}
                      <span className="text-xs font-medium text-theme-primary">{msg.author_name}</span>
                      <span className="text-[10px] text-theme-muted">{formatRelativeDate(msg.created_at)}</span>
                      {isNote && <span className="text-[10px] text-amber-600 font-medium">Note interne</span>}
                    </div>
                    <p className="text-sm text-theme-secondary whitespace-pre-wrap">{msg.body}</p>
                  </div>
                )
              })}

              {messages.length === 0 && (
                <p className="text-sm text-theme-muted text-center py-4">Aucun message</p>
              )}
            </div>

            {/* Reply area */}
            <div className="rounded-xl border border-theme-border p-4">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={4}
                placeholder={isInternalNote ? 'Note interne (invisible au client)...' : 'Votre réponse...'}
                className={cn(
                  'w-full text-sm bg-transparent border border-theme-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none',
                  isInternalNote && 'border-amber-300 bg-amber-50/30'
                )}
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setIsInternalNote(false); handleSendReply() }}
                    disabled={addMessage.isPending || !replyText.trim()}
                    className="h-8 px-3.5 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {addMessage.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Répondre au client
                  </button>
                  <button
                    onClick={() => { setIsInternalNote(true); handleSendReply() }}
                    disabled={addMessage.isPending || !replyText.trim()}
                    className="h-8 px-3.5 rounded-lg text-xs font-medium text-theme-muted hover:text-theme-secondary transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Lock className="h-3 w-3" />
                    Note interne
                  </button>
                </div>

                {/* Canned responses */}
                {cannedResponses.length > 0 && (
                  <select
                    onChange={e => { const cr = cannedResponses.find(c => c.id === e.target.value); if (cr) insertCanned(cr.body); e.target.value = '' }}
                    className="h-8 px-2 text-xs bg-transparent border border-theme-border rounded-lg text-theme-muted"
                    defaultValue=""
                  >
                    <option value="" disabled>Réponses prédéfinies</option>
                    {cannedResponses.map(cr => (
                      <option key={cr.id} value={cr.id}>{cr.shortcut || cr.title}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Right: Details sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-theme-border p-4 space-y-4">
              <div>
                <label className="text-[10px] text-theme-muted uppercase tracking-wider mb-1 block">Statut</label>
                <select
                  value={ticket.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  className="w-full h-9 px-2 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary"
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-theme-muted uppercase tracking-wider mb-1 block">Priorité</label>
                <select
                  value={ticket.priority}
                  onChange={e => handlePriorityChange(e.target.value)}
                  className="w-full h-9 px-2 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary"
                >
                  {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-theme-muted uppercase tracking-wider mb-1 block">Catégorie</label>
                <p className="text-sm text-theme-primary">{ticket.category}</p>
              </div>
            </div>

            {/* SLA */}
            <div className="rounded-xl border border-theme-border p-4">
              <label className="text-[10px] text-theme-muted uppercase tracking-wider mb-2 block">SLA</label>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-theme-muted">1ère réponse</span>
                  <span className={cn('font-medium', ticket.first_responded_at ? 'text-emerald-500' : 'text-theme-secondary')}>
                    {ticket.first_responded_at ? 'Fait' : '\u2014'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-theme-muted">Résolution</span>
                  <span className={cn('font-medium', ticket.resolved_at ? 'text-emerald-500' : ticket.sla_breached ? 'text-red-500' : 'text-theme-secondary')}>
                    {ticket.resolved_at ? 'Résolu' : ticket.sla_breached ? 'Dépassé' : '\u2014'}
                  </span>
                </div>
              </div>
            </div>

            {/* Client info */}
            <div className="rounded-xl border border-theme-border p-4">
              <label className="text-[10px] text-theme-muted uppercase tracking-wider mb-2 block">Client</label>
              <p className="text-sm font-medium text-theme-primary">{ticket.submitter_name}</p>
              <p className="text-xs text-theme-muted">{ticket.submitter_email}</p>
              <p className="text-xs text-theme-muted mt-1">Créé {formatRelativeDate(ticket.created_at)}</p>
            </div>

            {/* CSAT */}
            {ticket.csat_rating && (
              <div className="rounded-xl border border-theme-border p-4">
                <label className="text-[10px] text-theme-muted uppercase tracking-wider mb-2 block">CSAT</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={cn('h-4 w-4', n <= ticket.csat_rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200')} />
                  ))}
                  <span className="text-xs text-theme-muted ml-1">{ticket.csat_rating}/5</span>
                </div>
                {ticket.csat_comment && <p className="text-xs text-theme-secondary mt-1">{ticket.csat_comment}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
