import { useState, useMemo } from 'react'
import { Search, Plus, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MessageThread } from '@/hooks/useMessaging'

const AI_THREAD_ID = 'megga-ai'

type FilterType = 'all' | 'unread' | 'buyer' | 'seller' | 'archived'

interface ChatThreadListProps {
  threads: MessageThread[]
  selectedThreadId: string | null
  onSelectThread: (threadId: string) => void
  onCompose: () => void
  archivedThreadIds: Set<string>
  onArchive: (threadId: string) => void
  aiLastMessage?: string
}

// Compact relative date: "2m", "3h", "5j", "2sem"
function compactDate(dateStr: string): string {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = Math.max(0, now - d)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}sem`
  const months = Math.floor(days / 30)
  return `${months}mo`
}

function ThreadAvatar({ initials, isActive }: {
  initials: string
  isActive: boolean
}) {
  return (
    <div className={cn(
      'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold bg-theme-hover text-theme-secondary transition-all',
      isActive && 'ring-1.5 ring-theme-primary/30'
    )}>
      {initials}
    </div>
  )
}

export { AI_THREAD_ID }

export default function ChatThreadList({
  threads, selectedThreadId, onSelectThread, onCompose, archivedThreadIds, onArchive, aiLastMessage,
}: ChatThreadListProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  const filteredThreads = useMemo(() => {
    let result = threads
    if (filter === 'archived') {
      result = result.filter((t) => archivedThreadIds.has(t.id))
    } else {
      result = result.filter((t) => !archivedThreadIds.has(t.id))
      if (filter === 'unread') result = result.filter((t) => t.unread_count > 0)
      if (filter === 'buyer') result = result.filter((t) => t.contact_type === 'buyer')
      if (filter === 'seller') result = result.filter((t) => t.contact_type === 'seller')
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) => t.contact_name.toLowerCase().includes(q) || (t.property_title && t.property_title.toLowerCase().includes(q)))
    }
    return result
  }, [threads, filter, search, archivedThreadIds])

  const unreadCount = threads.filter(t => t.unread_count > 0).length
  const isAiActive = selectedThreadId === AI_THREAD_ID

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-theme-primary">Chat</h1>
          {unreadCount > 0 && (
            <p className="text-[10px] text-accent font-medium mt-0.5">
              {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={onCompose}
          className="h-8 w-8 rounded-lg bg-theme-card flex items-center justify-center text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
          title="Nouveau message"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-muted" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-theme-card border border-theme-border rounded-lg text-sm text-theme-primary placeholder:text-theme-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 px-5 pb-3 flex-shrink-0">
        {([
          { value: 'all' as FilterType, label: 'Tous' },
          { value: 'unread' as FilterType, label: 'Non lus' },
          { value: 'buyer' as FilterType, label: 'Acheteurs' },
          { value: 'seller' as FilterType, label: 'Vendeurs' },
        ]).map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors',
              filter === f.value ? 'bg-theme-active text-theme-primary' : 'text-theme-muted hover:text-theme-secondary'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* MEGGA AI — pinned first */}
        <div
          onClick={() => onSelectThread(AI_THREAD_ID)}
          className={cn(
            'w-full text-left px-5 py-3 flex gap-3 transition-all cursor-pointer relative',
            isAiActive ? 'bg-theme-active' : 'hover:bg-theme-hover'
          )}
        >
          <div className={cn(
            'h-9 w-9 rounded-full bg-theme-hover flex items-center justify-center flex-shrink-0 transition-all overflow-hidden',
            isAiActive && 'ring-1.5 ring-theme-primary/30'
          )}>
            <img src="/megga-gg.svg" alt="GG" className="h-5 w-5" style={{ filter: 'var(--logo-filter, none)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-theme-primary">MEGGA AI</span>
            </div>
            <p className="text-xs text-theme-muted truncate mt-0.5">
              {aiLastMessage || 'Votre assistant intelligent'}
            </p>
          </div>
        </div>

        {/* Separator */}
        {filteredThreads.length > 0 && (
          <div className="mx-5 my-1">
            <div className="h-px bg-theme-border" />
          </div>
        )}

        {/* Contact threads */}
        {filteredThreads.length === 0 && filter !== 'all' && (
          <div className="p-8 text-center text-xs text-theme-muted">Aucune conversation.</div>
        )}
        {filteredThreads.map((thread) => {
          const isActive = selectedThreadId === thread.id
          const isUnread = thread.unread_count > 0

          return (
            <div
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={cn(
                'w-full text-left px-5 py-3 flex gap-3 transition-all cursor-pointer group relative',
                isActive ? 'bg-theme-active' : 'hover:bg-theme-hover'
              )}
            >

              <ThreadAvatar
                initials={thread.avatar_initials}
                isActive={isActive}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-sm',
                    isUnread ? 'font-semibold text-theme-primary' :
                    isActive ? 'font-medium text-theme-primary' :
                    'font-medium text-theme-secondary'
                  )}>
                    {thread.contact_name}
                  </span>
                  <span className={cn(
                    'text-[10px] flex-shrink-0 tabular-nums',
                    isUnread ? 'text-accent font-medium' : 'text-theme-muted'
                  )}>
                    {compactDate(thread.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className={cn(
                    'text-xs truncate flex-1',
                    isUnread ? 'text-theme-secondary font-medium' : 'text-theme-muted'
                  )}>
                    {thread.last_message}
                  </p>
                  {/* Unread count badge */}
                  {isUnread && (
                    <span className="h-4.5 min-w-[18px] px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center flex-shrink-0">
                      {thread.unread_count}
                    </span>
                  )}
                </div>
              </div>

              {/* Archive button on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); onArchive(thread.id) }}
                className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-theme-section transition-all self-center shrink-0"
                title={archivedThreadIds.has(thread.id) ? 'Désarchiver' : 'Archiver'}
              >
                <Archive className="w-3.5 h-3.5 text-theme-muted" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
