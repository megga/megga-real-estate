import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Send, ArrowLeft } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useMessaging, type MessageThread } from '@/hooks/useMessaging'
import { useAuth } from '@/hooks/useAuth'
import PageTransition from '@/components/layout/PageTransition'

type FilterType = 'all' | 'unread' | 'buyer' | 'seller'

function ThreadAvatar({ initials, type }: { initials: string; type: 'buyer' | 'seller' }) {
  return (
    <div className={cn(
      'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold',
      type === 'buyer' ? 'bg-accent/10 text-accent' : 'bg-emerald-500/10 text-emerald-400'
    )}>
      {initials}
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

  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [threads, selectedThreadId])

  const filteredThreads = useMemo(() => {
    let result = threads
    if (filter === 'unread') result = result.filter((t) => t.unread_count > 0)
    if (filter === 'buyer') result = result.filter((t) => t.contact_type === 'buyer')
    if (filter === 'seller') result = result.filter((t) => t.contact_type === 'seller')
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) => t.contact_name.toLowerCase().includes(q) || (t.property_title && t.property_title.toLowerCase().includes(q)))
    }
    return result
  }, [threads, filter, search])

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [selectedThreadId, threadMessages.length])

  function handleSelectThread(thread: MessageThread) {
    setSelectedThreadId(thread.id)
    markAsRead()
  }

  async function handleSend() {
    if (!messageText.trim() || !selectedThreadId) return
    try {
      await sendMessage({ content: messageText.trim(), senderType: 'agent', senderName: profile?.full_name ?? 'Agent' })
      setMessageText('')
    } catch { /* handled */ }
  }

  return (
    <PageTransition>
      <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 14rem)' }}>
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <h1 className="text-2xl font-semibold text-theme-primary">Messages</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {threads.length} conversation{threads.length > 1 ? 's' : ''} · {threads.filter((t) => t.unread_count > 0).length} non lue{threads.filter((t) => t.unread_count > 0).length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Inbox — bento transparent */}
        <div className="flex-1 rounded-xl border border-theme-border overflow-hidden flex min-h-0">

          {/* ── Thread list (left) ── */}
          <div className={cn(
            'w-full md:w-72 lg:w-80 border-r border-theme-border flex-shrink-0 flex flex-col',
            selectedThreadId !== null ? 'hidden md:flex' : 'flex'
          )}>
            {/* Search */}
            <div className="p-3 border-b border-theme-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 bg-transparent border border-theme-border rounded-lg text-sm text-theme-primary placeholder:text-theme-tertiary outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-0.5 px-3 py-2 border-b border-theme-border">
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
                    'text-[11px] font-medium px-2 py-1 rounded-md transition-colors',
                    filter === f.value ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Threads */}
            <div className="flex-1 overflow-y-auto">
              {filteredThreads.length === 0 && (
                <div className="p-6 text-center text-xs text-theme-tertiary">Aucune conversation.</div>
              )}
              {filteredThreads.map((thread, i) => (
                <button
                  key={thread.id}
                  onClick={() => handleSelectThread(thread)}
                  className={cn(
                    'w-full text-left px-3 py-3 flex gap-3 transition-colors hover:bg-theme-hover',
                    selectedThreadId === thread.id && 'bg-theme-hover',
                    i < filteredThreads.length - 1 && 'border-b border-theme-border'
                  )}
                >
                  <ThreadAvatar initials={thread.avatar_initials} type={thread.contact_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm truncate', thread.unread_count > 0 ? 'font-semibold text-theme-primary' : 'font-medium text-theme-secondary')}>
                        {thread.contact_name}
                      </span>
                      <span className="text-[10px] text-theme-tertiary flex-shrink-0">
                        {formatRelativeDate(thread.last_message_at)}
                      </span>
                    </div>
                    <p className="text-xs text-theme-tertiary truncate mt-0.5">{thread.last_message}</p>
                  </div>
                  {thread.unread_count > 0 && (
                    <span className="h-5 min-w-[20px] px-1 bg-accent text-white text-[10px] font-semibold rounded-full flex items-center justify-center flex-shrink-0 self-center">
                      {thread.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Conversation (right) ── */}
          <div className={cn(
            'flex-1 flex flex-col min-w-0',
            selectedThreadId === null ? 'hidden md:flex' : 'flex'
          )}>
            {selectedThread ? (
              <>
                {/* Conversation header */}
                <div className="h-14 border-b border-theme-border flex items-center gap-3 px-4 flex-shrink-0">
                  <button onClick={() => setSelectedThreadId(null)} className="md:hidden p-1 -ml-1 rounded-md hover:bg-theme-hover">
                    <ArrowLeft className="h-4 w-4 text-theme-secondary" />
                  </button>
                  <ThreadAvatar initials={selectedThread.avatar_initials} type={selectedThread.contact_type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-theme-primary">{selectedThread.contact_name}</p>
                    {selectedThread.property_title && (
                      <p className="text-[11px] text-theme-tertiary truncate">{selectedThread.property_title}</p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {threadMessages.map((msg) => {
                    const isAgent = msg.sender_type === 'agent'
                    return (
                      <div key={msg.id} className={cn('flex', isAgent ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[70%]')}>
                          <div
                            className={cn(
                              'rounded-2xl px-4 py-2.5 text-sm',
                              isAgent
                                ? 'bg-accent/15 text-theme-primary border border-accent/20 rounded-br-md'
                                : 'border border-theme-border text-theme-primary rounded-bl-md'
                            )}
                          >
                            {msg.content}
                          </div>
                          <p className={cn('text-[10px] text-theme-tertiary mt-1', isAgent && 'text-right')}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input bar */}
                <div className="border-t border-theme-border p-3 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder="Écrire un message..."
                      className="flex-1 h-9 px-3 bg-transparent border border-theme-border rounded-lg text-sm text-theme-primary placeholder:text-theme-tertiary outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                    />
                    <button
                      onClick={handleSend}
                      disabled={isSending || !messageText.trim()}
                      className={cn(
                        'h-9 w-9 rounded-lg flex items-center justify-center transition-colors border border-theme-border',
                        messageText.trim() ? 'text-accent hover:bg-accent/10 border-accent/30' : 'text-theme-tertiary'
                      )}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-theme-tertiary text-sm">Sélectionnez une conversation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
