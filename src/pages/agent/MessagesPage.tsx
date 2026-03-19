import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Send, Paperclip, ArrowLeft, Building2 } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useMessaging, type MessageThread } from '@/hooks/useMessaging'
import { useAuth } from '@/hooks/useAuth'

type FilterType = 'all' | 'unread' | 'buyer' | 'seller'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'unread', label: 'Non lus' },
  { value: 'buyer', label: 'Acheteurs' },
  { value: 'seller', label: 'Vendeurs' },
]

function ThreadAvatar({ initials, type }: { initials: string; type: 'buyer' | 'seller' }) {
  return (
    <div className={cn(
      'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
      type === 'buyer' ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'
    )}>
      <span className="text-xs font-semibold">{initials}</span>
    </div>
  )
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground font-medium">{formatRelativeDate(date)}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export default function MessagesPage() {
  const { profile } = useAuth()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { threads, messages: threadMessages, sendMessage, isSending, markAsRead } = useMessaging(selectedThreadId)

  // Auto-select first thread
  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id)
    }
  }, [threads, selectedThreadId])

  const filteredThreads = useMemo(() => {
    let result = threads
    if (filter === 'unread') result = result.filter((t) => t.unread_count > 0)
    if (filter === 'buyer') result = result.filter((t) => t.contact_type === 'buyer')
    if (filter === 'seller') result = result.filter((t) => t.contact_type === 'seller')
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) =>
        t.contact_name.toLowerCase().includes(q) ||
        (t.property_title && t.property_title.toLowerCase().includes(q))
      )
    }
    return result
  }, [threads, filter, search])

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null

  // Scroll to bottom on thread change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [selectedThreadId])

  // Group messages by date for separators
  const messagesWithSeparators = useMemo(() => {
    const items: ({ type: 'separator'; date: string } | { type: 'message'; message: typeof threadMessages[0] })[] = []
    let lastDate = ''
    for (const msg of threadMessages) {
      const d = new Date(msg.created_at).toDateString()
      if (d !== lastDate) {
        items.push({ type: 'separator', date: msg.created_at })
        lastDate = d
      }
      items.push({ type: 'message', message: msg })
    }
    return items
  }, [threadMessages])

  function handleSelectThread(thread: MessageThread) {
    setSelectedThreadId(thread.id)
    markAsRead()
  }

  async function handleSend() {
    if (!messageText.trim() || !selectedThreadId) return
    try {
      await sendMessage({
        content: messageText.trim(),
        senderType: 'agent',
        senderName: profile?.full_name ?? 'Agent',
      })
      setMessageText('')
    } catch {
      // Error handled by React Query
    }
  }

  // ─── Thread List ───
  const threadList = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-section rounded-input text-sm outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 px-3 py-2 border-b border-border">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-badge transition-colors',
              filter === f.value
                ? 'bg-accent text-white'
                : 'text-muted-foreground hover:bg-section'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {filteredThreads.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Aucune conversation trouvée.
          </div>
        )}
        {filteredThreads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => handleSelectThread(thread)}
            className={cn(
              'w-full text-left p-3 flex gap-3 transition-colors hover:bg-section/80',
              selectedThreadId === thread.id && 'bg-accent/5'
            )}
          >
            <ThreadAvatar initials={thread.avatar_initials} type={thread.contact_type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-sm truncate', thread.unread_count > 0 ? 'font-semibold text-primary-900' : 'font-medium text-primary-700')}>
                  {thread.contact_name}
                </span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {formatRelativeDate(thread.last_message_at)}
                </span>
              </div>
              {thread.property_title && (
                <p className="text-[10px] text-accent truncate mt-0.5">{thread.property_title}</p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <p className={cn('text-xs truncate flex-1', thread.unread_count > 0 ? 'text-primary-700' : 'text-muted-foreground')}>
                  {thread.last_message}
                </p>
                {thread.unread_count > 0 && (
                  <span className="h-5 min-w-[20px] px-1.5 bg-accent text-white text-[10px] font-semibold rounded-full flex items-center justify-center flex-shrink-0">
                    {thread.unread_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  // ─── Conversation View ───
  const conversationView = selectedThread ? (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center gap-3 px-4 flex-shrink-0">
        {/* Mobile back button */}
        <button
          onClick={() => setSelectedThreadId(null)}
          className="md:hidden p-1.5 -ml-1.5 rounded-md hover:bg-section"
        >
          <ArrowLeft className="h-5 w-5 text-primary-600" />
        </button>

        <ThreadAvatar initials={selectedThread.avatar_initials} type={selectedThread.contact_type} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary-900">{selectedThread.contact_name}</p>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-badge',
              selectedThread.contact_type === 'buyer' ? 'bg-accent/10 text-accent' : 'bg-success/10 text-success'
            )}>
              {selectedThread.contact_type === 'buyer' ? 'Acheteur' : 'Vendeur'}
            </span>
            {selectedThread.property_title && (
              <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {selectedThread.property_title}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messagesWithSeparators.map((item, i) => {
          if (item.type === 'separator') {
            return <DateSeparator key={`sep-${i}`} date={item.date} />
          }
          const msg = item.message
          const isAgent = msg.sender_type === 'agent'
          return (
            <div key={msg.id} className={cn('flex', isAgent ? 'justify-end' : 'justify-start')}>
              <div className="max-w-[75%] space-y-0.5">
                <div
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-sm',
                    isAgent
                      ? 'bg-accent text-white rounded-br-md'
                      : 'bg-gray-100 text-primary-900 rounded-bl-md'
                  )}
                >
                  {msg.content}
                </div>
                <p className={cn('text-[10px] text-muted-foreground', isAgent && 'text-right')}>
                  {new Date(msg.created_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-md hover:bg-section text-muted-foreground hover:text-primary-600 transition-colors">
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Écrire un message..."
            className="flex-1 h-10 px-4 bg-gray-50 rounded-xl border-0 text-sm text-primary-900 placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/20"
          />
          <button
            onClick={handleSend}
            disabled={isSending || !messageText.trim()}
            className={cn(
              'h-10 w-10 rounded-button bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-colors',
              (!messageText.trim() || isSending) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Sélectionnez une conversation</p>
    </div>
  )

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.8))] lg:h-[calc(100vh-theme(spacing.16))] flex flex-col">
      {/* Page header */}
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-semibold text-primary-900">Messages</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {threads.length} conversations · {threads.filter((t) => t.unread_count > 0).length} non lues
        </p>
      </div>

      {/* Inbox container */}
      <div className="flex-1 bg-white rounded-card border border-border overflow-hidden flex min-h-0">
        {/* Thread list — left panel (hidden on mobile when a thread is selected) */}
        <div className={cn(
          'w-full md:w-80 lg:w-96 border-r border-border flex-shrink-0',
          selectedThreadId !== null ? 'hidden md:flex md:flex-col' : 'flex flex-col'
        )}>
          {threadList}
        </div>

        {/* Conversation — right panel (hidden on mobile when no thread is selected) */}
        <div className={cn(
          'flex-1 flex flex-col min-w-0',
          selectedThreadId === null ? 'hidden md:flex' : 'flex'
        )}>
          {conversationView}
        </div>
      </div>
    </div>
  )
}
