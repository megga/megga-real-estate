import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Search, Send, ArrowLeft, Plus, Paperclip, X, FileText, ChevronDown, Pin, Archive, CheckCheck } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useMessaging, type MessageThread } from '@/hooks/useMessaging'
import { useAuth } from '@/hooks/useAuth'
import MessageIntentBadge from '@/components/messaging/MessageIntentBadge'
import SmartReplies from '@/components/messaging/SmartReplies'

type FilterType = 'all' | 'unread' | 'buyer' | 'seller' | 'archived'

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

// ── Compose New Message Modal ───────────────────────────────────────────────

const MOCK_CONTACTS_LIST = [
  { id: 'c1', name: 'Marie Dupont', type: 'buyer' as const },
  { id: 'c2', name: 'Pierre Müller', type: 'seller' as const },
  { id: 'c3', name: 'Sophie Favre', type: 'buyer' as const },
  { id: 'c4', name: 'Hans Zimmermann', type: 'buyer' as const },
  { id: 'c5', name: 'Isabelle Rochat', type: 'both' as const },
  { id: 'c6', name: 'Jean-Marc Bonvin', type: 'buyer' as const },
  { id: 'c7', name: 'Nathalie Schmid', type: 'buyer' as const },
  { id: 'c8', name: 'Thomas Wenger', type: 'buyer' as const },
  { id: 'c9', name: 'Claudine Thévenaz', type: 'seller' as const },
  { id: 'c10', name: 'Marc Delarue', type: 'buyer' as const },
]

function ComposeModal({ onClose, onSend }: { onClose: () => void; onSend: (contactName: string, message: string) => void }) {
  const [contactId, setContactId] = useState('')
  const [message, setMessage] = useState('')

  const selectedContact = MOCK_CONTACTS_LIST.find(c => c.id === contactId)
  const isValid = contactId && message.trim()

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-theme-card border border-theme-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="text-base font-semibold text-theme-primary">Nouveau message</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Destinataire</label>
            <div className="relative">
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none"
              >
                <option value="">Sélectionner un contact...</option>
                {MOCK_CONTACTS_LIST.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Écrire votre message..."
              className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none placeholder:text-theme-tertiary"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">
            Annuler
          </button>
          <button
            onClick={() => { if (selectedContact && message.trim()) { onSend(selectedContact.name, message.trim()); onClose() } }}
            disabled={!isValid}
            className={cn(
              'h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors',
              !isValid && 'opacity-50 cursor-not-allowed'
            )}
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Attachment indicator ────────────────────────────────────────────────────

function AttachmentBubble({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5 bg-theme-hover rounded-lg px-2.5 py-1.5 text-xs text-theme-secondary">
      <FileText className="w-3 h-3 text-theme-tertiary" />
      <span className="truncate max-w-[150px]">{name}</span>
      <button onClick={onRemove} className="p-0.5 rounded hover:bg-theme-active transition-colors">
        <X className="w-3 h-3 text-theme-tertiary" />
      </button>
    </div>
  )
}

// ── Typing indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="border border-theme-border rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-theme-tertiary animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-theme-tertiary animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-theme-tertiary animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { profile } = useAuth()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [messageText, setMessageText] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])
  const [showTyping, setShowTyping] = useState(false)
  const [archivedThreadIds, setArchivedThreadIds] = useState<Set<string>>(new Set())
  const [pinnedMessages, setPinnedMessages] = useState<Map<string, { id: string; content: string }>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { threads, messages: threadMessages, sendMessage, isSending, markAsRead } = useMessaging(selectedThreadId)

  // Auto-select first thread when threads load
  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [threads, selectedThreadId])

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

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [selectedThreadId, threadMessages.length])

  function handleSelectThread(thread: MessageThread) {
    setSelectedThreadId(thread.id)
    setAttachments([])
    markAsRead()
  }

  function toggleArchive(threadId: string) {
    setArchivedThreadIds(prev => {
      const next = new Set(prev)
      if (next.has(threadId)) next.delete(threadId)
      else next.add(threadId)
      return next
    })
  }

  function togglePin(threadId: string, msgId: string, content: string) {
    setPinnedMessages(prev => {
      const next = new Map(prev)
      if (next.get(threadId)?.id === msgId) next.delete(threadId)
      else next.set(threadId, { id: msgId, content })
      return next
    })
  }

  function handleAttachFile() {
    fileInputRef.current?.click()
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const names = Array.from(files).map(f => f.name)
    setAttachments(prev => [...prev, ...names])
    e.target.value = ''
  }

  async function handleSend() {
    if (!messageText.trim() || !selectedThreadId) return
    const content = attachments.length > 0
      ? `${messageText.trim()}\n\n📎 ${attachments.join(', ')}`
      : messageText.trim()
    try {
      // Simulate typing indicator
      setShowTyping(true)
      await sendMessage({ content, senderType: 'agent', senderName: profile?.full_name ?? 'Agent' })
      setMessageText('')
      setAttachments([])
      // Simulate contact typing response after a delay
      setTimeout(() => setShowTyping(false), 2000)
    } catch { /* handled */ }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Messages</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {threads.length} conversation{threads.length > 1 ? 's' : ''} · {threads.filter((t) => t.unread_count > 0).length} non lue{threads.filter((t) => t.unread_count > 0).length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouveau
        </button>
      </div>

      {/* Inbox */}
      <div className="flex-1 rounded-xl border border-theme-border overflow-hidden flex min-h-0 max-h-[calc(100vh-12rem)]">

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
              { value: 'archived' as FilterType, label: 'Archivés' },
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
              <div
                key={thread.id}
                onClick={() => handleSelectThread(thread)}
                className={cn(
                  'w-full text-left px-3 py-3 flex gap-3 transition-colors hover:bg-theme-hover group cursor-pointer',
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
                <div className="flex items-center gap-1 shrink-0 self-center">
                  {thread.unread_count > 0 && (
                    <span className="h-5 min-w-[20px] px-1 bg-accent text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                      {thread.unread_count}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleArchive(thread.id) }}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-theme-active transition-all"
                    title={archivedThreadIds.has(thread.id) ? 'Désarchiver' : 'Archiver'}
                  >
                    <Archive className="w-3 h-3 text-theme-tertiary" />
                  </button>
                </div>
              </div>
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
              {/* Conversation header — with link to contact */}
              <div className="h-14 border-b border-theme-border flex items-center gap-3 px-4 flex-shrink-0">
                <button onClick={() => setSelectedThreadId(null)} className="md:hidden p-1 -ml-1 rounded-md hover:bg-theme-hover">
                  <ArrowLeft className="h-4 w-4 text-theme-secondary" />
                </button>
                <ThreadAvatar initials={selectedThread.avatar_initials} type={selectedThread.contact_type} />
                <div className="min-w-0 flex-1">
                  {selectedThread.contact_id ? (
                    <Link
                      to={`/dashboard/contacts/${selectedThread.contact_id}`}
                      className="text-sm font-medium text-theme-primary hover:text-accent transition-colors"
                    >
                      {selectedThread.contact_name}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-theme-primary">{selectedThread.contact_name}</p>
                  )}
                  {selectedThread.property_title && (
                    <p className="text-[11px] text-theme-tertiary truncate">{selectedThread.property_title}</p>
                  )}
                </div>
                <button
                  onClick={() => toggleArchive(selectedThread.id)}
                  className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors shrink-0"
                  title={archivedThreadIds.has(selectedThread.id) ? 'Désarchiver' : 'Archiver'}
                >
                  <Archive className="w-4 h-4 text-theme-tertiary" />
                </button>
              </div>

              {/* Pinned message banner */}
              {selectedThreadId && pinnedMessages.has(selectedThreadId) && (
                <div className="px-4 py-2 border-b border-theme-border-subtle flex items-center gap-2 bg-theme-hover/50">
                  <Pin className="w-3 h-3 text-theme-tertiary rotate-45 shrink-0" />
                  <p className="text-xs text-theme-secondary truncate flex-1">{pinnedMessages.get(selectedThreadId)?.content}</p>
                  <button
                    onClick={() => { const next = new Map(pinnedMessages); next.delete(selectedThreadId!); setPinnedMessages(next) }}
                    className="p-0.5 rounded hover:bg-theme-active transition-colors shrink-0"
                  >
                    <X className="w-3 h-3 text-theme-tertiary" />
                  </button>
                </div>
              )}

              {/* Messages — day grouped */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {threadMessages.map((msg, idx) => {
                  const isAgent = msg.sender_type === 'agent'
                  const msgDate = new Date(msg.created_at)
                  const prevDate = idx > 0 ? new Date(threadMessages[idx - 1].created_at) : null
                  const showDaySeparator = !prevDate || msgDate.toDateString() !== prevDate.toDateString()

                  const today = new Date()
                  const yesterday = new Date(today)
                  yesterday.setDate(yesterday.getDate() - 1)
                  const dayLabel = msgDate.toDateString() === today.toDateString()
                    ? "Aujourd'hui"
                    : msgDate.toDateString() === yesterday.toDateString()
                    ? 'Hier'
                    : msgDate.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })

                  const isPinned = selectedThreadId ? pinnedMessages.get(selectedThreadId)?.id === msg.id : false

                  return (
                    <div key={msg.id}>
                      {/* Day separator */}
                      {showDaySeparator && (
                        <div className="flex items-center gap-3 py-2">
                          <div className="flex-1 h-px bg-theme-border-subtle" />
                          <span className="text-[10px] text-theme-muted font-medium">{dayLabel}</span>
                          <div className="flex-1 h-px bg-theme-border-subtle" />
                        </div>
                      )}

                      {/* Message */}
                      <div className={cn('flex group/msg', isAgent ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[70%] relative')}>
                          <div
                            className={cn(
                              'rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line',
                              isAgent
                                ? 'bg-accent/15 text-theme-primary border border-accent/20 rounded-br-md'
                                : 'border border-theme-border text-theme-primary rounded-bl-md',
                              isPinned && 'ring-1 ring-theme-tertiary/30'
                            )}
                          >
                            {msg.content}
                          </div>
                          <div className={cn('flex items-center gap-1 mt-1', isAgent ? 'justify-end' : 'justify-start')}>
                            <span className="text-[10px] text-theme-tertiary">
                              {msgDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {/* Read status — double check for agent messages */}
                            {isAgent && msg.read_at && (
                              <CheckCheck className="w-3 h-3 text-accent" />
                            )}
                            {isAgent && !msg.read_at && (
                              <CheckCheck className="w-3 h-3 text-theme-muted" />
                            )}
                          </div>
                          {/* Intent detection badge for client messages */}
                          {!isAgent && msg.content.length > 10 && (
                            <MessageIntentBadge messageContent={msg.content} className="mt-1" />
                          )}

                          {/* Pin action on hover */}
                          <button
                            onClick={() => selectedThreadId && togglePin(selectedThreadId, msg.id, msg.content)}
                            className={cn(
                              'absolute -top-1 p-1 rounded-md hover:bg-theme-active transition-all',
                              isAgent ? '-left-7' : '-right-7',
                              isPinned ? 'opacity-100 text-theme-secondary' : 'opacity-0 group-hover/msg:opacity-100 text-theme-tertiary'
                            )}
                            title={isPinned ? 'Désépingler' : 'Épingler'}
                          >
                            <Pin className="w-3 h-3 rotate-45" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {showTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Attachments preview */}
              {attachments.length > 0 && (
                <div className="px-3 pt-2 flex flex-wrap gap-1.5">
                  {attachments.map((name, i) => (
                    <AttachmentBubble
                      key={i}
                      name={name}
                      onRemove={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    />
                  ))}
                </div>
              )}

              {/* Smart reply suggestions */}
              {(() => {
                const clientMsgs = threadMessages.filter(m => m.sender_type !== 'agent')
                const lastClientMsg = clientMsgs.length > 0 ? clientMsgs[clientMsgs.length - 1] : null
                const thread = threads.find(t => t.id === selectedThreadId)
                return lastClientMsg ? (
                  <SmartReplies
                    lastClientMessage={lastClientMsg.content}
                    contactName={thread?.contact_name?.split(' ')[0] ?? 'Client'}
                    onSelect={(text) => setMessageText(text)}
                  />
                ) : null
              })()}

              {/* Input bar */}
              <div className="border-t border-theme-border p-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {/* Attach button */}
                  <button
                    onClick={handleAttachFile}
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover transition-colors"
                    title="Joindre un fichier"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelected}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />

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
                      messageText.trim() ? 'text-theme-primary hover:bg-theme-hover border-theme-active' : 'text-theme-tertiary'
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

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSend={() => {
            // Future: create thread + send first message
          }}
        />
      )}
    </div>
  )
}
