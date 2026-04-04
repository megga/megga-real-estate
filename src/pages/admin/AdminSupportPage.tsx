import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, MessageSquare, Send, Inbox, Clock } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useAdminSupport, useTicketMessages, useSendTicketReply } from '@/hooks/useAdminSupport'
import type { SupportTicket } from '@/hooks/useAdminSupport'
import PageTransition from '@/components/layout/PageTransition'

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'open', label: 'Ouverts' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Resolus' },
]

const STATUS_OPTIONS = [
  { value: 'open', label: 'Ouvert' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Resolu' },
  { value: 'closed', label: 'Ferme' },
]

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'Haute' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'low', label: 'Basse' },
]

const PRIORITY_DOT_COLOR: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Resolu',
  closed: 'Ferme',
}

const STATUS_COLOR: Record<string, string> = {
  open: 'text-red-500',
  in_progress: 'text-amber-500',
  resolved: 'text-emerald-500',
  closed: 'text-theme-tertiary',
}

function isStale(ticket: SupportTicket): boolean {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return false
  const ref = ticket.last_message_at ?? ticket.created_at
  const hoursSince = (Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60)
  return hoursSince > 24
}

function TicketListSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn('px-4 py-3.5 space-y-2', i < 5 && 'border-b border-theme-border')}>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-theme-hover animate-pulse" />
            <div className="h-3.5 flex-1 rounded bg-theme-hover animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-24 rounded bg-theme-hover animate-pulse" />
            <div className="h-2.5 w-16 rounded bg-theme-hover animate-pulse" />
          </div>
        </div>
      ))}
    </>
  )
}

function MessagesSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
          <div className="space-y-1.5" style={{ maxWidth: '70%' }}>
            <div className={cn('h-16 rounded-lg animate-pulse', i % 2 === 0 ? 'bg-theme-hover w-64' : 'bg-admin-accent/10 w-48')} />
            <div className="h-2.5 w-20 rounded bg-theme-hover animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TicketDetail({ ticket }: { ticket: SupportTicket }) {
  const { updateStatus, updatePriority } = useAdminSupport()
  const { data: messages, isLoading: messagesLoading } = useTicketMessages(ticket.id)
  const sendReply = useSendTicketReply()
  const [reply, setReply] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const content = reply.trim()
    if (!content) return
    sendReply.mutate({ ticketId: ticket.id, content })
    setReply('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-theme-border space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-theme-primary truncate">{ticket.subject}</h2>
            {ticket.agency_name && (
              <p className="text-xs text-theme-tertiary mt-0.5">{ticket.agency_name}</p>
            )}
          </div>
          {isStale(ticket) && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock className="h-3 w-3 text-red-500" />
              <span className="text-[11px] text-red-500 font-medium">+24h</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-theme-tertiary">Priorite</span>
            <select
              value={ticket.priority}
              onChange={(e) => updatePriority.mutate({ id: ticket.id, priority: e.target.value })}
              className="h-7 px-2 text-xs bg-transparent border border-theme-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-primary"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-theme-tertiary">Statut</span>
            <select
              value={ticket.status}
              onChange={(e) => updateStatus.mutate({ id: ticket.id, status: e.target.value })}
              className="h-7 px-2 text-xs bg-transparent border border-theme-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-primary"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <span className="text-xs text-theme-tertiary ml-auto">
            {ticket.message_count} message{ticket.message_count !== 1 ? 's' : ''}
          </span>
        </div>

        {ticket.description && (
          <p className="text-xs text-theme-secondary leading-relaxed">{ticket.description}</p>
        )}
      </div>

      {/* Messages thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {messagesLoading ? (
          <MessagesSkeleton />
        ) : !messages || messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <MessageSquare className="h-6 w-6 mx-auto text-theme-tertiary mb-2" />
              <p className="text-sm text-theme-secondary">Aucun message</p>
              <p className="text-xs text-theme-tertiary mt-0.5">Redigez une reponse ci-dessous</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.sender_type === 'admin'
            const isSystem = msg.sender_type === 'system'
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex',
                  isAdmin ? 'justify-end' : 'justify-start'
                )}
              >
                {isSystem ? (
                  <div className="w-full text-center py-1">
                    <span className="text-[11px] text-theme-tertiary italic">{msg.content}</span>
                  </div>
                ) : (
                  <div className={cn('max-w-[70%] space-y-1')}>
                    <div
                      className={cn(
                        'px-3.5 py-2.5 rounded-xl text-sm leading-relaxed',
                        isAdmin
                          ? 'bg-admin-accent/10 text-theme-primary rounded-br-md'
                          : 'bg-theme-hover text-theme-primary rounded-bl-md'
                      )}
                    >
                      {msg.content}
                    </div>
                    <div className={cn('flex items-center gap-1.5', isAdmin ? 'justify-end' : 'justify-start')}>
                      <span className="text-[10px] text-theme-tertiary">
                        {isAdmin ? 'Admin' : 'Agent'}
                      </span>
                      <span className="text-[10px] text-theme-tertiary">
                        {formatRelativeDate(msg.created_at)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply input */}
      <div className="px-4 py-3 border-t border-theme-border">
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Redigez une reponse..."
            rows={1}
            className="flex-1 min-h-[36px] max-h-[120px] px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim() || sendReply.isPending}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active disabled:opacity-40 transition-colors flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminSupportPage() {
  const { tickets, isLoading, stats, statsLoading } = useAdminSupport()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = [...tickets]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        t =>
          t.subject.toLowerCase().includes(q) ||
          (t.agency_name ?? '').toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter) list = list.filter(t => t.status === statusFilter)
    return list
  }, [tickets, search, statusFilter])

  const selectedTicket = useMemo(
    () => tickets.find(t => t.id === selectedId) ?? null,
    [tickets, selectedId]
  )

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Admin badge + title */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-medium text-admin-accent">Admin MEGGA</span>
          </div>
          <h1 className="text-2xl font-semibold text-theme-primary">Support</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {isLoading
              ? 'Chargement...'
              : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* 2-column layout */}
        <div className="flex rounded-xl border border-theme-border overflow-hidden" style={{ height: 'calc(100vh - 240px)', minHeight: 480 }}>
          {/* Left panel: ticket list */}
          <div className="w-[380px] flex-shrink-0 border-r border-theme-border flex flex-col">
            {/* List header */}
            <div className="px-4 py-3 border-b border-theme-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-theme-primary">Tickets</span>
                {stats && stats.openCount > 0 && (
                  <span className="text-[11px] font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                    {stats.openCount} ouvert{stats.openCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>

              <div className="flex items-center gap-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      'h-7 px-3 rounded-md text-xs transition-colors',
                      statusFilter === f.value
                        ? 'bg-theme-active text-theme-primary font-medium'
                        : 'text-theme-secondary hover:text-theme-primary'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ticket list */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {isLoading ? (
                <TicketListSkeleton />
              ) : filtered.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Inbox className="h-6 w-6 mx-auto text-theme-tertiary mb-2" />
                  <p className="text-sm text-theme-secondary">
                    {search || statusFilter ? 'Aucun ticket trouve' : 'Aucun ticket'}
                  </p>
                  <p className="text-xs text-theme-tertiary mt-0.5">
                    {search || statusFilter
                      ? 'Modifiez vos filtres'
                      : 'Les tickets apparaitront ici'}
                  </p>
                </div>
              ) : (
                filtered.map((ticket, i) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedId(ticket.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 transition-colors',
                      selectedId === ticket.id ? 'bg-theme-active' : 'hover:bg-theme-hover',
                      i < filtered.length - 1 && 'border-b border-theme-border'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Priority dot + stale indicator */}
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', PRIORITY_DOT_COLOR[ticket.priority] ?? 'bg-gray-400')} />
                        {isStale(ticket) && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate">
                          {ticket.subject}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {ticket.agency_name && (
                            <span className="text-xs text-theme-tertiary truncate max-w-[140px]">
                              {ticket.agency_name}
                            </span>
                          )}
                          <span className={cn('text-[11px] font-medium', STATUS_COLOR[ticket.status] ?? 'text-theme-tertiary')}>
                            {STATUS_LABEL[ticket.status] ?? ticket.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                        <span className="text-[11px] text-theme-tertiary">
                          {formatRelativeDate(ticket.updated_at)}
                        </span>
                        {ticket.message_count > 0 && (
                          <span className="text-[10px] text-theme-tertiary">
                            {ticket.message_count} msg
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel: ticket detail */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedTicket ? (
              <TicketDetail ticket={selectedTicket} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-8 w-8 mx-auto text-theme-tertiary mb-3" />
                  <p className="text-sm text-theme-secondary font-medium">Selectionnez un ticket</p>
                  <p className="text-xs text-theme-tertiary mt-0.5">
                    Choisissez un ticket dans la liste pour voir les details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {!statsLoading && stats && (
          <div className="flex items-center gap-3 text-xs text-theme-tertiary">
            <span>{stats.openCount} ouvert{stats.openCount !== 1 ? 's' : ''}</span>
            <span className="text-theme-border">|</span>
            <span>{stats.resolvedThisWeek} resolu{stats.resolvedThisWeek !== 1 ? 's' : ''} cette semaine</span>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
