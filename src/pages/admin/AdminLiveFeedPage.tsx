import { useState, useMemo, useRef, useEffect } from 'react'
import { Radio, Pause, Play, Filter, ChevronDown } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useAdminLiveFeed, type LiveEvent } from '@/hooks/useAdminLiveFeed'

// ─── ACTION LABELS ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  contact_created: 'Contact cree',
  contact_updated: 'Contact modifie',
  property_created: 'Bien cree',
  property_updated: 'Bien modifie',
  transaction_stage_change: 'Pipeline change',
  transaction_created: 'Transaction creee',
  kyc_screening_match: 'Alerte PEP/Sanctions',
  kyc_case_created: 'Dossier KYC cree',
  kyc_case_validated: 'KYC valide',
  email_sent: 'Email envoye',
  visit_created: 'Visite planifiee',
  visit_completed: 'Visite effectuee',
  match_created: 'Match cree',
  match_sent: 'Match envoye',
  agency_created: 'Agence inscrite',
  edge_function_error: 'Erreur systeme',
  document_uploaded: 'Document uploade',
  login: 'Connexion',
  logout: 'Deconnexion',
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ')
}

// ─── ENTITY TYPE COLORS ────────────────────────────────────────────────────

const ENTITY_COLORS: Record<string, string> = {
  contact: 'bg-blue-500',
  property: 'bg-emerald-500',
  transaction: 'bg-amber-500',
  kyc: 'bg-red-500',
  email: 'bg-gray-400',
  visit: 'bg-cyan-500',
  match: 'bg-admin-accent',
  agency: 'bg-purple-500',
}

function getEntityColor(entityType: string): string {
  return ENTITY_COLORS[entityType] ?? 'bg-gray-300'
}

// ─── ALL ENTITY TYPES FOR FILTER ───────────────────────────────────────────

const ENTITY_TYPES = [
  { value: 'all', label: 'Tous' },
  { value: 'contact', label: 'Contacts' },
  { value: 'property', label: 'Biens' },
  { value: 'transaction', label: 'Transactions' },
  { value: 'kyc', label: 'KYC' },
  { value: 'email', label: 'Emails' },
  { value: 'visit', label: 'Visites' },
  { value: 'match', label: 'Matchs' },
  { value: 'agency', label: 'Agences' },
]

// ─── HELPER: format HH:MM:SS ───────────────────────────────────────────────

function formatTime(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── HELPER: summarize metadata ─────────────────────────────────────────────

function summarizeMetadata(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return ''
  const entries = Object.entries(metadata).slice(0, 3)
  return entries.map(([k, v]) => {
    const val = typeof v === 'string' ? v : JSON.stringify(v)
    const truncated = val.length > 40 ? val.slice(0, 40) + '...' : val
    return `${k}: ${truncated}`
  }).join(' | ')
}

// ─── STAT CARD ──────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-theme-border p-4">
      <span className="text-[10px] font-medium text-theme-secondary uppercase">{label}</span>
      <p className="text-lg font-bold text-theme-primary mt-1">{value}</p>
    </div>
  )
}

// ─── EVENT ROW ──────────────────────────────────────────────────────────────

function EventRow({ event, isNew }: { event: LiveEvent; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const metaSummary = summarizeMetadata(event.metadata)
  const hasMetadata = metaSummary.length > 0

  return (
    <div
      className={cn(
        'border-b border-theme-border-subtle hover:bg-theme-hover transition-colors',
        hasMetadata && 'cursor-pointer',
        isNew && 'animate-in slide-in-from-top-2 fade-in duration-300'
      )}
      onClick={() => hasMetadata && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3 px-4 py-2.5">
        {/* Timestamp */}
        <span className="text-xs font-mono text-theme-muted shrink-0 w-[72px] pt-0.5 tabular-nums">
          {formatTime(event.created_at)}
        </span>

        {/* Entity dot */}
        <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', getEntityColor(event.entity_type))} />

        {/* Action */}
        <span className="text-sm text-theme-primary font-medium shrink-0 min-w-[140px]">
          {getActionLabel(event.action)}
        </span>

        {/* Entity type badge */}
        <span className="text-[10px] font-mono text-theme-secondary bg-theme-hover px-2 py-0.5 rounded shrink-0">
          {event.entity_type}
        </span>

        {/* Metadata summary */}
        <span className="text-xs text-theme-muted truncate flex-1">
          {metaSummary || <span className="text-theme-tertiary">-</span>}
        </span>

        {/* Expand indicator */}
        {hasMetadata && (
          <ChevronDown className={cn(
            'h-3.5 w-3.5 text-theme-tertiary shrink-0 mt-0.5 transition-transform',
            expanded && 'rotate-180'
          )} />
        )}
      </div>

      {/* Expanded metadata */}
      {expanded && hasMetadata && (
        <div className="px-4 pb-3 pl-[100px]" onClick={(e) => e.stopPropagation()}>
          <pre className="text-[11px] font-mono text-theme-secondary bg-theme-section rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function AdminLiveFeedPage() {
  const { events, isLoading } = useAdminLiveFeed(100)
  const [paused, setPaused] = useState(false)
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const [prevCount, setPrevCount] = useState(0)

  // Track new events for animation
  const newEventIds = useRef(new Set<string>())
  useEffect(() => {
    if (events.length > prevCount) {
      const newOnes = events.slice(0, events.length - prevCount)
      newOnes.forEach(e => newEventIds.current.add(e.id))
      // Clear "new" flag after animation
      const timer = setTimeout(() => { newEventIds.current.clear() }, 400)
      setPrevCount(events.length)
      return () => clearTimeout(timer)
    }
    setPrevCount(events.length)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length, prevCount])

  // Display events (paused = freeze the current list)
  const displayEvents = paused ? events : events

  // Filter by entity type
  const filteredByEntity = useMemo(() => {
    if (entityFilter === 'all') return displayEvents
    return displayEvents.filter(e => e.entity_type === entityFilter)
  }, [displayEvents, entityFilter])

  // Filter by action
  const filteredEvents = useMemo(() => {
    if (!actionFilter) return filteredByEntity
    const q = actionFilter.toLowerCase()
    return filteredByEntity.filter(e =>
      e.action.toLowerCase().includes(q) ||
      getActionLabel(e.action).toLowerCase().includes(q)
    )
  }, [filteredByEntity, actionFilter])

  // Unique action types for dropdown
  const uniqueActions = useMemo(() => {
    const set = new Set(events.map(e => e.action))
    return Array.from(set).sort()
  }, [events])

  // Stats
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const todayCount = events.filter(e => new Date(e.created_at) >= todayStart).length
  const hourCount = events.filter(e => new Date(e.created_at) >= oneHourAgo).length
  const uniqueTypes = new Set(events.map(e => e.action)).size
  const lastEvent = events[0] ? formatRelativeDate(events[0].created_at) : '-'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-semibold text-admin-accent">Admin MEGGA</span>
        </div>
        <h1 className="text-xl font-semibold text-theme-primary">Live Feed</h1>
        <div className="flex items-center gap-1.5 ml-1">
          <span className={cn(
            'w-2 h-2 rounded-full',
            paused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
          )} />
          <span className={cn(
            'text-[10px] font-medium',
            paused ? 'text-amber-600' : 'text-emerald-600'
          )}>
            {paused ? 'En pause' : 'Temps reel'}
          </span>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setPaused(!paused)}
            className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? 'Reprendre' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-4 animate-pulse">
              <div className="h-3 bg-theme-hover rounded w-24 mb-3" />
              <div className="h-6 bg-theme-hover rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Aujourd'hui" value={todayCount} />
          <StatCard label="Cette heure" value={hourCount} />
          <StatCard label="Types uniques" value={uniqueTypes} />
          <StatCard label="Dernier evenement" value={lastEvent} />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Entity type pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {ENTITY_TYPES.map((et) => (
            <button
              key={et.value}
              onClick={() => setEntityFilter(et.value)}
              className={cn(
                'h-7 px-3 rounded-lg text-xs transition-colors',
                entityFilter === et.value
                  ? 'bg-theme-active text-theme-primary font-medium'
                  : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
              )}
            >
              {et.value !== 'all' && (
                <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5', getEntityColor(et.value))} />
              )}
              {et.label}
            </button>
          ))}
        </div>

        {/* Action filter dropdown */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Filter className="h-3.5 w-3.5 text-theme-tertiary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-secondary appearance-none cursor-pointer"
            >
              <option value="">Toutes les actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{getActionLabel(a)}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-theme-muted">
            {filteredEvents.length} evenement{filteredEvents.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        className="rounded-xl border border-theme-border overflow-hidden"
      >
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-theme-border bg-theme-section text-[10px] font-medium text-theme-tertiary uppercase">
          <span className="w-[72px] shrink-0">Heure</span>
          <span className="w-2 shrink-0" />
          <span className="min-w-[140px] shrink-0">Action</span>
          <span className="shrink-0">Type</span>
          <span className="flex-1">Details</span>
        </div>

        {/* Events list */}
        <div className="max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-hide">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="h-5 w-5 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-12 text-center">
              <Radio className="h-8 w-8 text-theme-tertiary mx-auto mb-3" />
              <p className="text-sm text-theme-secondary">Aucun evenement</p>
              <p className="text-xs text-theme-muted mt-1">Les evenements apparaitront ici en temps reel</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isNew={newEventIds.current.has(event.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
