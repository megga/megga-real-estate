import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTickets, type TicketRow } from '@/hooks/useTickets'
import PageTransition from '@/components/layout/PageTransition'
import EmptyTicketsIllustration from '@/components/illustrations/EmptyTicketsIllustration'

const STATUS_TABS = [
  { key: '', label: 'Tous' },
  { key: 'new', label: 'Nouveaux' },
  { key: 'open', label: 'Ouverts' },
  { key: 'resolved', label: 'Résolus' },
]

const STATUS_STYLES: Record<string, { label: string; dot: string }> = {
  new: { label: 'Nouveau', dot: 'bg-blue-500' },
  open: { label: 'Ouvert', dot: 'bg-amber-500' },
  pending: { label: 'En attente', dot: 'bg-gray-400' },
  on_hold: { label: 'En pause', dot: 'bg-gray-400' },
  resolved: { label: 'Résolu', dot: 'bg-emerald-500' },
  closed: { label: 'Fermé', dot: 'bg-gray-300' },
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'text-red-500',
  high: 'text-amber-500',
  medium: 'text-theme-secondary',
  low: 'text-theme-muted',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'Haut',
  medium: 'Moyen',
  low: 'Bas',
}

function slaRemaining(ticket: TicketRow): string {
  if (ticket.resolved_at || ticket.status === 'resolved' || ticket.status === 'closed') return '\u2014'
  const due = ticket.sla_resolution_due
  if (!due) return '\u2014'
  const remaining = new Date(due).getTime() - Date.now()
  if (remaining < 0) return 'D\u00e9pass\u00e9'
  const hours = Math.floor(remaining / 3600000)
  if (hours < 1) return `${Math.floor(remaining / 60000)}min`
  return `${hours}h`
}

function slaClass(ticket: TicketRow): string {
  if (ticket.sla_breached) return 'text-red-500 font-medium'
  const due = ticket.sla_resolution_due
  if (!due) return 'text-theme-muted'
  const remaining = new Date(due).getTime() - Date.now()
  if (remaining < 0) return 'text-red-500 font-medium'
  if (remaining < 3600000) return 'text-amber-500 font-medium'
  return 'text-theme-muted'
}

export default function SupportPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data: tickets = [], isLoading } = useTickets(statusFilter ? { status: statusFilter } : undefined)
  const navigate = useNavigate()

  const counts = {
    '': tickets.length,
    new: tickets.filter(t => t.status === 'new').length,
    open: tickets.filter(t => t.status === 'open').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  }

  return (
    <PageTransition>
      <div className="px-2 py-2">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-theme-primary">Tickets support</h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6">
          {STATUS_TABS.map(tab => {
            const count = counts[tab.key as keyof typeof counts] ?? 0
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  'h-8 px-3 rounded-lg text-sm transition-colors flex items-center gap-1.5',
                  statusFilter === tab.key
                    ? 'bg-theme-active text-theme-primary font-medium'
                    : 'text-theme-secondary hover:text-theme-primary'
                )}
              >
                {tab.label}
                <span className="text-xs text-theme-muted">({count})</span>
              </button>
            )
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-40 h-28 mx-auto mb-4"><EmptyTicketsIllustration /></div>
            <p className="text-sm font-medium text-theme-secondary mb-1">Aucun ticket de support</p>
            <p className="text-xs text-theme-muted">Tout est traité. Vos clients sont satisfaits.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-theme-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-theme-section">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-theme-muted uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-theme-muted uppercase tracking-wider">Sujet</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-theme-muted uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-theme-muted uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-theme-muted uppercase tracking-wider">SLA</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-theme-muted uppercase tracking-wider">Prio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border-subtle">
                {tickets.map(ticket => {
                  const st = STATUS_STYLES[ticket.status] || STATUS_STYLES.new
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => navigate(`/dashboard/support/${ticket.id}`)}
                      className="hover:bg-theme-hover cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-theme-muted font-mono text-xs">{ticket.ticket_number.replace('MEGGA-', '')}</td>
                      <td className="px-4 py-3 text-theme-primary font-medium truncate max-w-[200px]">{ticket.subject}</td>
                      <td className="px-4 py-3 text-theme-secondary truncate max-w-[120px]">{ticket.submitter_name}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className={cn('w-2 h-2 rounded-full', st.dot)} />
                          {st.label}
                        </span>
                      </td>
                      <td className={cn('px-4 py-3 text-xs', slaClass(ticket))}>{slaRemaining(ticket)}</td>
                      <td className={cn('px-4 py-3 text-xs font-medium', PRIORITY_STYLES[ticket.priority])}>{PRIORITY_LABELS[ticket.priority] || ticket.priority}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
