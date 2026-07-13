import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Radio, Pause, Play, Filter, ChevronDown } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useAdminLiveFeed, type LiveEvent } from '@/hooks/useAdminLiveFeed'

// ─── ACTION LABELS ─────────────────────────────────────────────────────────

const ACTION_KEYS: Record<string, string> = {
  contact_created: 'liveFeed.action.contactCreated',
  contact_updated: 'liveFeed.action.contactUpdated',
  property_created: 'liveFeed.action.propertyCreated',
  property_updated: 'liveFeed.action.propertyUpdated',
  transaction_stage_change: 'liveFeed.action.pipelineChanged',
  transaction_created: 'liveFeed.action.transactionCreated',
  kyc_screening_match: 'liveFeed.action.kycScreeningMatch',
  kyc_case_created: 'liveFeed.action.kycCaseCreated',
  kyc_case_validated: 'liveFeed.action.kycValidated',
  email_sent: 'liveFeed.action.emailSent',
  visit_created: 'liveFeed.action.visitCreated',
  visit_completed: 'liveFeed.action.visitCompleted',
  match_created: 'liveFeed.action.matchCreated',
  match_sent: 'liveFeed.action.matchSent',
  agency_created: 'liveFeed.action.agencyCreated',
  edge_function_error: 'liveFeed.action.systemError',
  document_uploaded: 'liveFeed.action.documentUploaded',
  login: 'liveFeed.action.login',
  logout: 'liveFeed.action.logout',
}

// ─── ENTITY TYPE COLORS ────────────────────────────────────────────────────

const ENTITY_COLORS: Record<string, string> = {
  contact: 'bg-blue-500',
  property: 'bg-emerald-500',
  transaction: 'bg-amber-500',
  kyc: 'bg-red-500',
  email: 'bg-theme-muted',
  visit: 'bg-cyan-500',
  match: 'bg-admin-accent',
  agency: 'bg-purple-500',
}

function getEntityColor(entityType: string): string {
  return ENTITY_COLORS[entityType] ?? 'bg-theme-muted'
}

// ─── ALL ENTITY TYPES FOR FILTER ───────────────────────────────────────────

const ENTITY_TYPE_KEYS: Array<{ value: string; labelKey: string }> = [
  { value: 'all', labelKey: 'liveFeed.entityType.all' },
  { value: 'contact', labelKey: 'liveFeed.entityType.contacts' },
  { value: 'property', labelKey: 'liveFeed.entityType.properties' },
  { value: 'transaction', labelKey: 'liveFeed.entityType.transactions' },
  { value: 'kyc', labelKey: 'liveFeed.entityType.kyc' },
  { value: 'email', labelKey: 'liveFeed.entityType.emails' },
  { value: 'visit', labelKey: 'liveFeed.entityType.visits' },
  { value: 'match', labelKey: 'liveFeed.entityType.matches' },
  { value: 'agency', labelKey: 'liveFeed.entityType.agencies' },
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
      <span className="text-xs font-medium text-theme-secondary tracking-wide">{label}</span>
      <p className="text-lg font-bold text-theme-primary mt-1">{value}</p>
    </div>
  )
}

// ─── EVENT ROW ──────────────────────────────────────────────────────────────

function EventRow({ event, isNew, getActionLabel }: { event: LiveEvent; isNew: boolean; getActionLabel: (action: string) => string }) {
  const [expanded, setExpanded] = useState(false)
  const metaSummary = summarizeMetadata(event.metadata)
  const hasMetadata = metaSummary.length > 0

  return (
    <div
      role={hasMetadata ? 'button' : undefined}
      tabIndex={hasMetadata ? 0 : undefined}
      onKeyDown={hasMetadata ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } } : undefined}
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
        <span className="text-xs font-mono text-theme-secondary bg-theme-hover px-2 py-0.5 rounded shrink-0">
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
          <pre className="text-xs font-mono text-theme-secondary bg-theme-section rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function AdminLiveFeedPage() {
  const { t } = useTranslation('admin')
  const { events, isLoading } = useAdminLiveFeed(100)
  const [paused, setPaused] = useState(false)
  // Snapshot capturé à la mise en pause — le Realtime continue d'alimenter
  // `events`, mais l'affichage reste gelé tant que frozenEvents est posé.
  const [frozenEvents, setFrozenEvents] = useState<typeof events | null>(null)

  const togglePause = () => {
    if (paused) {
      setPaused(false)
      setFrozenEvents(null)
    } else {
      setFrozenEvents(events)
      setPaused(true)
    }
  }
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const [prevCount, setPrevCount] = useState(0)

  function getActionLabel(action: string): string {
    const key = ACTION_KEYS[action]
    return key ? t(key) : action.replace(/_/g, ' ')
  }

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
  const displayEvents = paused && frozenEvents ? frozenEvents : events

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredByEntity, actionFilter])

  // Unique action types for dropdown
  const uniqueActions = useMemo(() => {
    const set = new Set(events.map(e => e.action))
    return Array.from(set).sort()
  }, [events])

  // Stats
  const { todayCount, hourCount, uniqueTypes, lastEvent } = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    return {
      todayCount: events.filter(e => new Date(e.created_at) >= todayStart).length,
      hourCount: events.filter(e => new Date(e.created_at) >= oneHourAgo).length,
      uniqueTypes: new Set(events.map(e => e.action)).size,
      lastEvent: events[0] ? formatRelativeDate(events[0].created_at) : '-',
    }
  }, [events])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-semibold text-admin-accent">{t('common.adminBadge')}</span>
        </div>
        <h1 className="text-xl font-semibold text-theme-primary">{t('liveFeed.title')}</h1>
        <div className="flex items-center gap-1.5 ml-1">
          <span className={cn(
            'w-2 h-2 rounded-full',
            paused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
          )} />
          <span className={cn(
            'text-xs font-medium',
            paused ? 'text-amber-600' : 'text-emerald-600'
          )}>
            {paused ? t('liveFeed.paused') : t('liveFeed.realtime')}
          </span>
        </div>
        <div className="ml-auto">
          <button
            onClick={togglePause}
            className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? t('liveFeed.resume') : t('liveFeed.pause')}
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
          <StatCard label={t('liveFeed.stats.today')} value={todayCount} />
          <StatCard label={t('liveFeed.stats.thisHour')} value={hourCount} />
          <StatCard label={t('liveFeed.stats.uniqueTypes')} value={uniqueTypes} />
          <StatCard label={t('liveFeed.stats.lastEvent')} value={lastEvent} />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Entity type pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {ENTITY_TYPE_KEYS.map((et) => (
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
              {t(et.labelKey)}
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
              <option value="">{t('liveFeed.filter.allActions')}</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{getActionLabel(a)}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-theme-muted">
            {t('liveFeed.events', { count: filteredEvents.length })}
          </span>
        </div>
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        className="rounded-xl border border-theme-border overflow-hidden"
      >
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-theme-border bg-theme-section text-xs font-medium text-theme-tertiary tracking-wide">
          <span className="w-[72px] shrink-0">{t('liveFeed.column.time')}</span>
          <span className="w-2 shrink-0" />
          <span className="min-w-[140px] shrink-0">{t('liveFeed.column.action')}</span>
          <span className="shrink-0">{t('liveFeed.column.type')}</span>
          <span className="flex-1">{t('liveFeed.column.details')}</span>
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
              <p className="text-sm text-theme-secondary">{t('liveFeed.empty.title')}</p>
              <p className="text-xs text-theme-muted mt-1">{t('liveFeed.empty.subtitle')}</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isNew={newEventIds.current.has(event.id)}
                getActionLabel={getActionLabel}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
