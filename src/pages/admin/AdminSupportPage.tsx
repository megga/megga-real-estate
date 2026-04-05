import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search, MessageSquare, Send, Inbox, Clock, AlertTriangle, Sparkles, Loader2 } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAdminSupport, useTicketMessages, useSendTicketReply } from '@/hooks/useAdminSupport'
import type { SupportTicket } from '@/hooks/useAdminSupport'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import type { AdminUser } from '@/hooks/useAdminUsers'
import { useAuth } from '@/hooks/useAuth'
import { useTicketAiSuggestion } from '@/hooks/useTicketAiSuggestion'
import PageTransition from '@/components/layout/PageTransition'

const PRIORITY_DOT_COLOR: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-theme-muted',
}

const STATUS_COLOR: Record<string, string> = {
  open: 'text-red-500',
  in_progress: 'text-amber-500',
  resolved: 'text-emerald-500',
  closed: 'text-theme-tertiary',
}

const ASSIGNABLE_ROLES = ['agent', 'admin', 'manager', 'super_admin']

function isStale(ticket: SupportTicket): boolean {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return false
  const ref = ticket.last_message_at ?? ticket.created_at
  const hoursSince = (Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60)
  return hoursSince > 24
}

function SlaIndicator({ ticket }: { ticket: SupportTicket }) {
  const { t } = useTranslation('admin')
  if (ticket.status === 'resolved' || ticket.status === 'closed') return null
  if (!ticket.sla_first_response_due) return null

  if (!ticket.first_responded_at) {
    const due = new Date(ticket.sla_first_response_due)
    const now = new Date()
    const diffMs = due.getTime() - now.getTime()

    if (diffMs < 0) {
      return <span className="text-xs font-medium text-red-500">{t('support.slaExceeded')}</span>
    }

    const hours = Math.floor(diffMs / 3600000)
    const minutes = Math.floor((diffMs % 3600000) / 60000)

    if (hours < 1) {
      return <span className="text-xs font-medium text-amber-500">SLA {minutes}min</span>
    }

    return <span className="text-xs text-theme-muted">SLA {hours}h{minutes > 0 ? `${minutes}m` : ''}</span>
  }

  if (ticket.sla_resolution_due) {
    const due = new Date(ticket.sla_resolution_due)
    const now = new Date()
    const diffMs = due.getTime() - now.getTime()

    if (diffMs < 0) {
      return <span className="text-xs font-medium text-red-500">{t('support.resolutionSlaExceeded')}</span>
    }
  }

  return null
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

const messageBubbleMaxWidth = { maxWidth: '70%' } as const;
const supportLayoutStyle = { height: 'calc(100vh - 240px)', minHeight: 480 } as const;

function MessagesSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
          <div className="space-y-1.5" style={messageBubbleMaxWidth}>
            <div className={cn('h-16 rounded-lg animate-pulse', i % 2 === 0 ? 'bg-theme-hover w-64' : 'bg-admin-accent/10 w-48')} />
            <div className="h-2.5 w-20 rounded bg-theme-hover animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TicketDetail({ ticket, agents }: { ticket: SupportTicket; agents: AdminUser[] }) {
  const { t } = useTranslation('admin')
  const { updateStatus, updatePriority, assignTicket } = useAdminSupport()
  const { data: messages, isLoading: messagesLoading } = useTicketMessages(ticket.id)
  const sendReply = useSendTicketReply()
  const eventsQuery = useQuery({
    queryKey: ['admin-support', ticket.id, 'events'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ticket_events')
        .select('id, action, actor_type, old_value, new_value, created_at')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true })
      return data ?? []
    },
    enabled: !!ticket.id,
  })
  const [reply, setReply] = useState('')
  const ai = useTicketAiSuggestion()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const STATUS_OPTIONS = [
    { value: 'open', label: t('common.status.open') },
    { value: 'in_progress', label: t('common.status.inProgress') },
    { value: 'resolved', label: t('common.status.resolved') },
    { value: 'closed', label: t('common.status.closed') },
  ]

  const PRIORITY_OPTIONS = [
    { value: 'urgent', label: t('common.priority.urgent') },
    { value: 'high', label: t('common.priority.high') },
    { value: 'medium', label: t('common.priority.medium') },
    { value: 'low', label: t('common.priority.low') },
  ]

  const EVENT_LABELS: Record<string, string> = {
    status_change: t('support.event.statusChange'),
    priority_change: t('support.event.priorityChange'),
    assignment_change: t('support.event.assignmentChange'),
    message_added: t('support.event.messageAdded'),
    note_added: t('support.event.noteAdded'),
    csat_submitted: t('support.event.csatSubmitted'),
  }

  const STATUS_LABEL: Record<string, string> = {
    open: t('common.status.open'),
    in_progress: t('common.status.inProgress'),
    resolved: t('common.status.resolved'),
    closed: t('common.status.closed'),
  }

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
              <span className="text-xs text-red-500 font-medium">{t('support.stale')}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-theme-tertiary">{t('support.priority')}</span>
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
            <span className="text-xs text-theme-tertiary">{t('support.status')}</span>
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

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-theme-tertiary">{t('support.assigned')}</span>
            <select
              value={ticket.assigned_to ?? ''}
              onChange={(e) => assignTicket.mutate({ id: ticket.id, assignedTo: e.target.value || null })}
              className="h-7 px-2 pr-6 text-xs bg-transparent border border-theme-border rounded-lg text-theme-secondary focus:outline-none appearance-none"
            >
              <option value="">{t('support.notAssigned')}</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </div>

          <span className="text-xs text-theme-tertiary ml-auto">
            {t('support.messages', { count: ticket.message_count })}
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
              <p className="text-sm text-theme-secondary">{t('support.noMessages')}</p>
              <p className="text-xs text-theme-tertiary mt-0.5">{t('support.writeReply')}</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.author_type === 'agent'
            const isSystem = msg.author_type === 'system'
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
                    <span className="text-xs text-theme-tertiary italic">{msg.body}</span>
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
                      {msg.body}
                    </div>
                    <div className={cn('flex items-center gap-1.5', isAdmin ? 'justify-end' : 'justify-start')}>
                      <span className="text-xs text-theme-tertiary">
                        {msg.author_name || (isAdmin ? 'Support' : 'Client')}
                      </span>
                      <span className="text-xs text-theme-tertiary">
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

      {/* Audit trail */}
      {eventsQuery.data && eventsQuery.data.length > 0 && (
        <div className="px-4 py-2 border-t border-theme-border">
          <p className="text-xs tracking-wide text-theme-tertiary font-medium mb-2">{t('support.history')}</p>
          <div className="space-y-1">
            {eventsQuery.data.map(evt => (
              <div key={evt.id} className="flex items-center gap-2 text-xs text-theme-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-admin-accent/50 flex-shrink-0" />
                <span>{EVENT_LABELS[evt.action] ?? evt.action}</span>
                {evt.new_value && <span className="text-theme-secondary">{'\u2192'} {STATUS_LABEL[evt.new_value] ?? evt.new_value}</span>}
                <span className="ml-auto">{formatRelativeDate(evt.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reply input */}
      <div className="px-4 py-3 border-t border-theme-border space-y-2">
        {/* AI suggestion bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              ai.generateSuggestion(ticket.id)
            }}
            disabled={ai.loading}
            className="h-7 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1.5 border border-admin-accent/30 text-admin-accent hover:bg-admin-accent/5 transition-colors disabled:opacity-50"
          >
            {ai.loading ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> {t('support.generating')}</>
            ) : (
              <><Sparkles className="h-3 w-3" /> {t('support.suggestAiReply')}</>
            )}
          </button>
          {ai.suggestion && (
            <button
              onClick={() => { setReply(ai.suggestion); ai.clear() }}
              className="h-7 px-2.5 text-xs font-medium rounded-lg border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
            >
              {t('support.insert')}
            </button>
          )}
          {ai.error && (
            <span className="text-xs text-red-500">{ai.error}</span>
          )}
        </div>

        {/* AI suggestion preview */}
        {ai.suggestion && (
          <div className="p-3 rounded-lg bg-admin-accent/5 border border-admin-accent/20 text-sm text-theme-primary leading-relaxed">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3 w-3 text-admin-accent" />
              <span className="text-xs font-medium text-admin-accent tracking-wide">{t('support.aiSuggestion')}</span>
            </div>
            <p className="whitespace-pre-line">{ai.suggestion}</p>
          </div>
        )}

        {/* Reply textarea + send */}
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('support.replyPlaceholder')}
            rows={1}
            className="flex-1 min-h-[36px] max-h-[120px] px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim() || sendReply.isPending}
            aria-label={t('support.sendReply')}
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
  'use no memo'
  const { t } = useTranslation('admin')
  const { tickets, isLoading, stats, statsLoading } = useAdminSupport()
  const { users } = useAdminUsers()
  const { profile } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [myTickets, setMyTickets] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const STATUS_FILTERS = [
    { value: '', label: t('support.filter.all') },
    { value: 'open', label: t('support.filter.open') },
    { value: 'in_progress', label: t('support.filter.inProgress') },
    { value: 'resolved', label: t('support.filter.resolved') },
  ]

  const STATUS_LABEL: Record<string, string> = {
    open: t('common.status.open'),
    in_progress: t('common.status.inProgress'),
    resolved: t('common.status.resolved'),
    closed: t('common.status.closed'),
  }

  const agents = useMemo(
    () => users.filter(u => ASSIGNABLE_ROLES.includes(u.role)),
    [users]
  )

  const agentNameMap = useMemo(
    () => Object.fromEntries(agents.map(a => [a.id, a.full_name])),
    [agents]
  )

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
    if (myTickets && profile?.id) list = list.filter(t => t.assigned_to === profile.id)
    return list
  }, [tickets, search, statusFilter, myTickets, profile?.id])

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
            <span className="text-xs font-medium text-admin-accent">{t('common.adminBadge')}</span>
          </div>
          <h1 className="text-2xl font-semibold text-theme-primary">{t('support.title')}</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {isLoading
              ? t('common.loading')
              : t('support.subtitle', { count: tickets.length })}
          </p>
        </div>

        {/* SLA breach banner */}
        {stats && stats.slaBreach > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">
              <strong>{stats.slaBreach}</strong> {t('support.slaBreach', { count: stats.slaBreach })}
            </p>
          </div>
        )}

        {/* 2-column layout */}
        <div className="flex rounded-xl border border-theme-border overflow-hidden" style={supportLayoutStyle}>
          {/* Left panel: ticket list */}
          <div className="w-[380px] flex-shrink-0 border-r border-theme-border flex flex-col">
            {/* List header */}
            <div className="px-4 py-3 border-b border-theme-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-theme-primary">{t('support.tickets')}</span>
                {stats && stats.openCount > 0 && (
                  <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                    {t('support.openCount', { count: stats.openCount })}
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary" />
                <input
                  type="text"
                  placeholder={t('common.search')}
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
                <div className="w-px h-4 bg-theme-border mx-1" />
                <button
                  onClick={() => setMyTickets(prev => !prev)}
                  className={cn(
                    'h-7 px-3 rounded-md text-xs transition-colors',
                    myTickets
                      ? 'bg-theme-active text-admin-accent font-medium'
                      : 'text-theme-secondary hover:text-theme-primary'
                  )}
                >
                  {t('support.myTickets')}
                </button>
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
                    {search || statusFilter || myTickets ? t('support.empty.titleFiltered') : t('support.empty.title')}
                  </p>
                  <p className="text-xs text-theme-tertiary mt-0.5">
                    {search || statusFilter || myTickets
                      ? t('support.empty.subtitleFiltered')
                      : t('support.empty.subtitle')}
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
                        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', PRIORITY_DOT_COLOR[ticket.priority] ?? 'bg-theme-muted')} />
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
                          <span className={cn('text-xs font-medium', STATUS_COLOR[ticket.status] ?? 'text-theme-tertiary')}>
                            {STATUS_LABEL[ticket.status] ?? ticket.status}
                          </span>
                          <SlaIndicator ticket={ticket} />
                        </div>
                        {ticket.assigned_to && agentNameMap[ticket.assigned_to] && (
                          <span className="text-xs text-admin-accent">
                            {agentNameMap[ticket.assigned_to]}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                        <span className="text-xs text-theme-tertiary">
                          {formatRelativeDate(ticket.updated_at)}
                        </span>
                        {ticket.message_count > 0 && (
                          <span className="text-xs text-theme-tertiary">
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
              <TicketDetail ticket={selectedTicket} agents={agents} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-8 w-8 mx-auto text-theme-tertiary mb-3" />
                  <p className="text-sm text-theme-secondary font-medium">{t('support.selectTicket')}</p>
                  <p className="text-xs text-theme-tertiary mt-0.5">
                    {t('support.selectTicketSubtitle')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {!statsLoading && stats && (
          <div className="flex items-center gap-3 text-xs text-theme-tertiary">
            <span>{t('support.openCount', { count: stats.openCount })}</span>
            <span className="text-theme-border">|</span>
            <span>{t('support.newCount', { count: stats.newCount })}</span>
            <span className="text-theme-border">|</span>
            {stats.slaBreach > 0 ? (
              <span className="text-red-500 font-medium">{stats.slaBreach} SLA breach</span>
            ) : (
              <span>0 SLA breach</span>
            )}
            <span className="text-theme-border">|</span>
            <span>{t('support.resolvedThisWeek', { count: stats.resolvedThisWeek })}</span>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
