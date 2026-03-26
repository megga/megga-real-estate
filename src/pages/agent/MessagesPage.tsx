import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Search, Send, ArrowLeft, Plus, Paperclip, X, FileText, ChevronDown, Pin, Archive, CheckCheck } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useMessaging, type MessageThread } from '@/hooks/useMessaging'
import { useAuth } from '@/hooks/useAuth'
import MessageIntentBadge from '@/components/messaging/MessageIntentBadge'
import SmartReplies from '@/components/messaging/SmartReplies'
import { useContacts } from '@/hooks/useContacts'

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

type ComposeContact = { id: string; name: string; type: string }

function ComposeModal({ onClose, onSend, contacts }: { onClose: () => void; onSend: (contactName: string, message: string) => void; contacts: ComposeContact[] }) {
  const [contactId, setContactId] = useState('')
  const [message, setMessage] = useState('')

  const selectedContact = contacts.find(c => c.id === contactId)
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
                {contacts.map(c => (
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
  const { contacts: rawContacts } = useContacts()
  const composeContacts = rawContacts.map(c => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' '),
    type: c.type,
  }))

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
    <div className="flex justify-center px-4 py-4">
      <div className="w-full max-w-5xl h-[calc(100vh-8rem)] flex gap-0 rounded-2xl overflow-hidden">

        {/* ── Thread list (left) — solid sidebar bg ── */}
        <div className={cn(
          'w-full md:w-80 flex-shrink-0 flex flex-col bg-theme-sidebar rounded-l-2xl',
          selectedThreadId !== null ? 'hidden md:flex' : 'flex'
        )}>
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-theme-primary">Messages</h1>
              <p className="text-xs text-theme-muted mt-0.5">
                {threads.filter(t => t.unread_count > 0).length > 0
                  ? `${threads.filter(t => t.unread_count > 0).length} non lu${threads.filter(t => t.unread_count > 0).length > 1 ? 's' : ''}`
                  : 'Tout est lu'
                }
              </p>
            </div>
            <button
              onClick={() => setShowCompose(true)}
              className="h-8 w-8 rounded-lg bg-theme-card flex items-center justify-center text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
              title="Nouveau message"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-muted" />
              <input
                type="text"
                placeholder="Rechercher une conversation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-theme-card border border-theme-border rounded-lg text-sm text-theme-primary placeholder:text-theme-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-1 px-5 pb-3">
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
                  'text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors',
                  filter === f.value ? 'bg-theme-card text-theme-primary border border-theme-border' : 'text-theme-muted hover:text-theme-secondary'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Threads */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {filteredThreads.length === 0 && (
              <div className="p-8 text-center text-xs text-theme-muted">Aucune conversation.</div>
            )}
            {filteredThreads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => handleSelectThread(thread)}
                className={cn(
                  'w-full text-left px-5 py-3.5 flex gap-3 transition-all cursor-pointer group relative',
                  selectedThreadId === thread.id
                    ? 'bg-theme-card'
                    : 'hover:bg-theme-section'
                )}
              >
                {/* Unread indicator — left edge accent bar */}
                {thread.unread_count > 0 && (
                  <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-accent" />
                )}
                <ThreadAvatar initials={thread.avatar_initials} type={thread.contact_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-sm truncate', thread.unread_count > 0 ? 'font-semibold text-theme-primary' : 'font-medium text-theme-secondary')}>
                      {thread.contact_name}
                    </span>
                    <span className="text-[10px] text-theme-muted flex-shrink-0">
                      {formatRelativeDate(thread.last_message_at)}
                    </span>
                  </div>
                  <p className="text-xs text-theme-muted truncate mt-1">{thread.last_message}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleArchive(thread.id) }}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-theme-hover transition-all self-center shrink-0"
                  title={archivedThreadIds.has(thread.id) ? 'Désarchiver' : 'Archiver'}
                >
                  <Archive className="w-3.5 h-3.5 text-theme-muted" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Conversation (right) — card bg ── */}
        <div className={cn(
          'flex-1 flex flex-col min-w-0 bg-theme-card rounded-r-2xl border-l border-theme-border',
          selectedThreadId === null ? 'hidden md:flex' : 'flex'
        )}>
          {selectedThread ? (
            <>
              {/* Conversation header */}
              <div className="h-16 border-b border-theme-border flex items-center gap-3 px-5 flex-shrink-0">
                <button onClick={() => setSelectedThreadId(null)} className="md:hidden p-1 -ml-1 rounded-md hover:bg-theme-hover">
                  <ArrowLeft className="h-4 w-4 text-theme-secondary" />
                </button>
                <ThreadAvatar initials={selectedThread.avatar_initials} type={selectedThread.contact_type} />
                <div className="min-w-0 flex-1">
                  {selectedThread.contact_id ? (
                    <Link
                      to={`/dashboard/contacts/${selectedThread.contact_id}`}
                      className="text-sm font-semibold text-theme-primary hover:text-accent transition-colors"
                    >
                      {selectedThread.contact_name}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-theme-primary">{selectedThread.contact_name}</p>
                  )}
                  {selectedThread.property_title && (
                    <p className="text-xs text-theme-muted truncate mt-0.5">{selectedThread.property_title}</p>
                  )}
                </div>
                <button
                  onClick={() => toggleArchive(selectedThread.id)}
                  className="p-2 rounded-lg hover:bg-theme-hover transition-colors shrink-0"
                  title={archivedThreadIds.has(selectedThread.id) ? 'Désarchiver' : 'Archiver'}
                >
                  <Archive className="w-4 h-4 text-theme-muted" />
                </button>
              </div>

              {/* Pinned message banner */}
              {selectedThreadId && pinnedMessages.has(selectedThreadId) && (
                <div className="px-5 py-2.5 border-b border-theme-border-subtle flex items-center gap-2 bg-theme-section">
                  <Pin className="w-3.5 h-3.5 text-theme-muted rotate-45 shrink-0" />
                  <p className="text-xs text-theme-secondary truncate flex-1">{pinnedMessages.get(selectedThreadId)?.content}</p>
                  <button
                    onClick={() => { const next = new Map(pinnedMessages); next.delete(selectedThreadId!); setPinnedMessages(next) }}
                    className="p-0.5 rounded hover:bg-theme-active transition-colors shrink-0"
                  >
                    <X className="w-3 h-3 text-theme-muted" />
                  </button>
                </div>
              )}

              {/* Messages — day grouped */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 scrollbar-hide">
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
                        <div className="flex items-center gap-4 py-3">
                          <div className="flex-1 h-px bg-theme-border-subtle" />
                          <span className="text-[10px] text-theme-muted font-medium uppercase tracking-wider">{dayLabel}</span>
                          <div className="flex-1 h-px bg-theme-border-subtle" />
                        </div>
                      )}

                      {/* Message */}
                      <div className={cn('flex group/msg', isAgent ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[60%] relative')}>
                          <div
                            className={cn(
                              'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line',
                              isAgent
                                ? 'bg-accent/12 text-theme-primary rounded-br-sm'
                                : 'bg-theme-section text-theme-primary rounded-bl-sm',
                              isPinned && 'ring-1 ring-accent/30'
                            )}
                          >
                            {msg.content}
                          </div>
                          <div className={cn('flex items-center gap-1.5 mt-1.5 px-1', isAgent ? 'justify-end' : 'justify-start')}>
                            <span className="text-[10px] text-theme-muted">
                              {msgDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
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
                              'absolute -top-1 p-1 rounded-md hover:bg-theme-hover transition-all',
                              isAgent ? '-left-8' : '-right-8',
                              isPinned ? 'opacity-100 text-theme-secondary' : 'opacity-0 group-hover/msg:opacity-100 text-theme-muted'
                            )}
                            title={isPinned ? 'Désépingler' : 'Épingler'}
                          >
                            <Pin className="w-3.5 h-3.5 rotate-45" />
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
                <div className="px-5 pt-2 flex flex-wrap gap-2">
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

              {/* Input bar — elevated feel */}
              <div className="px-5 py-4 flex-shrink-0">
                <div className="flex items-center gap-3 bg-theme-section rounded-xl px-3 py-2 border border-theme-border">
                  <button
                    onClick={handleAttachFile}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-theme-muted hover:text-theme-primary hover:bg-theme-hover transition-colors shrink-0"
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
                    className="flex-1 h-8 bg-transparent text-sm text-theme-primary placeholder:text-theme-muted outline-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={isSending || !messageText.trim()}
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center transition-colors shrink-0',
                      messageText.trim() ? 'bg-accent/15 text-accent hover:bg-accent/25' : 'text-theme-muted'
                    )}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-theme-section flex items-center justify-center">
                <Send className="h-5 w-5 text-theme-muted" />
              </div>
              <p className="text-theme-muted text-sm">Sélectionnez une conversation</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          contacts={composeContacts}
          onClose={() => setShowCompose(false)}
          onSend={() => {
            // Future: create thread + send first message
          }}
        />
      )}
    </div>
  )
}
