import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, X, Pin, Archive, CheckCheck, Phone, Mail, ExternalLink, Building2, ChevronDown, ChevronUp, MapPin as MapPinIcon, Banknote, Clock, GitBranch, Flame, StickyNote, Sparkles, Reply, Copy, Trash2, PinOff } from 'lucide-react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { cn, formatCHF } from '@/lib/utils'
import type { MessageThread } from '@/hooks/useMessaging'
import { useProperty } from '@/hooks/useProperties'
import { useContact, useUpdateContact } from '@/hooks/useContacts'
import { useMatching } from '@/hooks/useMatching'
import PromptInputBar from './PromptInputBar'

interface Message {
  id: string
  thread_id: string
  sender_id: string
  sender_type: 'agent' | 'contact'
  sender_name: string
  content: string
  read_at: string | null
  created_at: string
}

function ThreadAvatar({ initials }: { initials: string; type: 'buyer' | 'seller' }) {
  return (
    <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold bg-theme-hover text-theme-secondary">
      {initials}
    </div>
  )
}

// Small avatar for message groups
function MiniAvatar({ initials }: { initials: string; type: 'buyer' | 'seller' }) {
  return (
    <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold bg-theme-hover text-theme-secondary">
      {initials}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 pl-9">
      <div className="bg-theme-elevated rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-theme-muted animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-theme-muted animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-theme-muted animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

function BubbleContent({ content, isAgent }: { content: string; isAgent: boolean }) {
  if (!content.startsWith('> ')) return <>{content}</>
  const lines = content.split('\n\n')
  const quoteLine = lines[0].replace(/^>\s*/, '')
  const rest = lines.slice(1).join('\n\n')
  return (
    <>
      <div className={cn(
        'text-[12px] leading-snug mb-1.5 px-2.5 py-1.5 rounded-md border-l-2',
        isAgent ? 'bg-white/10 border-white/40 text-white/80' : 'bg-theme-section border-accent/40 text-theme-secondary'
      )}>
        {quoteLine}
      </div>
      {rest}
    </>
  )
}

const msgAnim: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

// ─── Context Menu ────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number
  y: number
  msg: { id: string; content: string; senderName: string; senderType: 'agent' | 'contact' }
  isPinned: boolean
}

function MessageContextMenu({ state, onClose, onReply, onCopy, onPin, onTransferAi, onDelete }: {
  state: ContextMenuState
  onClose: () => void
  onReply: () => void
  onCopy: () => void
  onPin: () => void
  onTransferAi?: () => void
  onDelete?: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey) }
  }, [onClose])

  // Adjust position via callback ref to avoid setState in effect
  const adjustPosition = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    menuRef.current = el
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth) el.style.left = `${Math.max(4, state.x - rect.width)}px`
    if (rect.bottom > window.innerHeight) el.style.top = `${Math.max(4, state.y - rect.height)}px`
  }, [state.x, state.y])

  const items = [
    { label: 'Répondre', icon: Reply, action: onReply },
    { label: 'Copier le texte', icon: Copy, action: onCopy },
    { label: state.isPinned ? 'Désépingler' : 'Épingler', icon: state.isPinned ? PinOff : Pin, action: onPin },
    ...(onTransferAi && state.msg.senderType === 'contact' ? [{ label: 'Transférer à MEGGA AI', icon: Sparkles, action: onTransferAi }] : []),
    ...(onDelete && state.msg.senderType === 'agent' ? [{ label: 'Supprimer', icon: Trash2, action: onDelete, danger: true }] : []),
  ]

  return createPortal(
    <div
      ref={adjustPosition}
      className="fixed z-[110] min-w-[180px] rounded-xl border border-theme-border bg-theme-card py-1 overflow-hidden"
      style={{ left: state.x, top: state.y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose() }}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
            'danger' in item && item.danger
              ? 'text-red-500 hover:bg-red-500/10'
              : 'text-theme-primary hover:bg-theme-hover'
          )}
        >
          <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}

interface ContactChatPaneProps {
  thread: MessageThread
  messages: Message[]
  threads: MessageThread[]
  onSendMessage: (params: { content: string; senderType: 'agent' | 'contact'; senderName: string }) => Promise<unknown>
  isSending: boolean
  agentName: string
  onBack: () => void
  onArchive: (threadId: string) => void
  isArchived: boolean
  onSwitchToAi?: (contextMessage?: string) => void
}

export default function ContactChatPane({
  thread, messages, onSendMessage, isSending, agentName, onBack, onArchive, isArchived, onSwitchToAi,
}: ContactChatPaneProps) {
  const [showTyping, setShowTyping] = useState(false)
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; senderName: string } | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [propertyExpanded, setPropertyExpanded] = useState(false)
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [pinnedMessages, setPinnedMessages] = useState<Map<string, { id: string; content: string }>>(new Map())

  // Load full data when panel is open
  const { data: propertyData } = useProperty(showInfoPanel && thread.property_id ? thread.property_id : undefined)
  const { data: contactData } = useContact(showInfoPanel && thread.contact_id ? thread.contact_id : undefined)
  const { matches: allMatches = [], sent: sentMatches = [] } = useMatching(showInfoPanel && thread.contact_id ? thread.contact_id : undefined)
  const updateContact = useUpdateContact()

  // Sync notes draft when contact data loads — derive initial value
  if (contactData && noteDraft === null) {
    setNoteDraft(contactData.notes || '')
  }

  const saveNote = useCallback(async () => {
    if (!thread.contact_id || noteDraft === null) return
    setIsSavingNote(true)
    try {
      await updateContact.mutateAsync({ id: thread.contact_id, notes: noteDraft })
    } catch { /* silent */ }
    setIsSavingNote(false)
  }, [thread.contact_id, noteDraft, updateContact])

  const addTag = useCallback(async () => {
    if (!thread.contact_id || !contactData || !newTag.trim()) return
    const currentTags = contactData.tags || []
    if (currentTags.includes(newTag.trim())) { setNewTag(''); return }
    await updateContact.mutateAsync({ id: thread.contact_id, tags: [...currentTags, newTag.trim()] })
    setNewTag('')
    setShowTagInput(false)
  }, [thread.contact_id, contactData, newTag, updateContact])

  const removeTag = useCallback(async (tag: string) => {
    if (!thread.contact_id || !contactData) return
    await updateContact.mutateAsync({ id: thread.contact_id, tags: (contactData.tags || []).filter(t => t !== tag) })
  }, [thread.contact_id, contactData, updateContact])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [thread.id, messages.length])

  function togglePin(msgId: string, content: string) {
    setPinnedMessages(prev => {
      const next = new Map(prev)
      if (next.get(thread.id)?.id === msgId) next.delete(thread.id)
      else next.set(thread.id, { id: msgId, content })
      return next
    })
  }

  async function handleSend(text: string) {
    const content = text.trim()
    if (!content) return
    try {
      setShowTyping(true)
      const fullContent = replyTo
        ? `> ${replyTo.senderName}: ${replyTo.content.slice(0, 100)}${replyTo.content.length > 100 ? '...' : ''}\n\n${content}`
        : content
      await onSendMessage({ content: fullContent, senderType: 'agent', senderName: agentName })
      setReplyTo(null)
      setTimeout(() => setShowTyping(false), 2000)
    } catch { /* handled */ }
  }

  const pinnedMsg = pinnedMessages.get(thread.id)

  return (
    <div className="flex h-full bg-theme-page">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="h-14 border-b border-theme-border flex items-center gap-3 px-6 flex-shrink-0">
        <button onClick={onBack} aria-label="Retour" className="md:hidden p-1 -ml-1 rounded-md hover:bg-theme-hover">
          <ArrowLeft className="h-4 w-4 text-theme-secondary" />
        </button>
        <ThreadAvatar initials={thread.avatar_initials} type={thread.contact_type} />
        <button onClick={() => setShowInfoPanel(p => !p)} aria-label="Afficher le profil" className="min-w-0 flex-1 text-left">
          <p className={cn('text-sm font-semibold transition-colors', showInfoPanel ? 'text-accent' : 'text-theme-primary hover:text-accent')}>
            {thread.contact_name}
          </p>
          {thread.property_title && (
            <p className="text-xs text-theme-muted truncate mt-0.5">{thread.property_title}</p>
          )}
        </button>
        <button
          onClick={() => onArchive(thread.id)}
          aria-label={isArchived ? 'Désarchiver' : 'Archiver'}
          className="p-2 rounded-lg hover:bg-theme-hover transition-colors shrink-0"
          title={isArchived ? 'Désarchiver' : 'Archiver'}
        >
          <Archive className="w-4 h-4 text-theme-muted" />
        </button>
      </div>

      {/* Pinned message */}
      {pinnedMsg && (
        <div className="px-6 py-2 border-b border-theme-border-subtle flex items-center gap-2">
          <Pin className="w-3.5 h-3.5 text-theme-muted rotate-45 shrink-0" />
          <p className="text-xs text-theme-secondary truncate flex-1">{pinnedMsg.content}</p>
          <button onClick={() => { const next = new Map(pinnedMessages); next.delete(thread.id); setPinnedMessages(next) }} aria-label="Retirer l'épingle" className="p-0.5 rounded hover:bg-theme-active transition-colors shrink-0">
            <X className="w-3 h-3 text-theme-muted" />
          </button>
        </div>
      )}

      {/* Messages — Messenger style */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-3xl mx-auto px-6 py-4 space-y-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-theme-muted">Aucun message pour l'instant</p>
              <p className="text-xs text-theme-muted mt-1">Envoyez un message pour démarrer la conversation</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isAgent = msg.sender_type === 'agent'
            const msgDate = new Date(msg.created_at)
            const prevMsg = idx > 0 ? messages[idx - 1] : null
            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null
            const prevDate = prevMsg ? new Date(prevMsg.created_at) : null
            const showDaySeparator = !prevDate || msgDate.toDateString() !== prevDate.toDateString()

            // Grouping: same sender in sequence
            const isFirstInGroup = !prevMsg || prevMsg.sender_type !== msg.sender_type || showDaySeparator
            const isLastInGroup = !nextMsg || nextMsg.sender_type !== msg.sender_type || (nextMsg && new Date(nextMsg.created_at).toDateString() !== msgDate.toDateString())

            const today = new Date()
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            const dayLabel = msgDate.toDateString() === today.toDateString()
              ? "Aujourd'hui"
              : msgDate.toDateString() === yesterday.toDateString()
              ? 'Hier'
              : msgDate.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })

            const isPinned = pinnedMessages.get(thread.id)?.id === msg.id

            // Bubble radius — Messenger style (rounded except where connected)
            const agentRadius = isFirstInGroup
              ? 'rounded-[20px] rounded-br-md'
              : isLastInGroup
              ? 'rounded-[20px] rounded-tr-md'
              : 'rounded-[20px] rounded-r-md'

            const contactRadius = isFirstInGroup
              ? 'rounded-[20px] rounded-bl-md'
              : isLastInGroup
              ? 'rounded-[20px] rounded-tl-md'
              : 'rounded-[20px] rounded-l-md'

            return (
              <div key={msg.id}>
                {/* Day separator */}
                {showDaySeparator && (
                  <div className="flex justify-center py-4">
                    <span className="text-[10px] text-theme-muted font-medium uppercase tracking-wider px-3 py-1 rounded-full bg-theme-section">{dayLabel}</span>
                  </div>
                )}

                {/* Extra spacing between groups */}
                {isFirstInGroup && idx > 0 && !showDaySeparator && <div className="h-3" />}

                <motion.div
                  variants={msgAnim}
                  initial={idx >= messages.length - 2 ? 'hidden' : false}
                  animate="visible"
                  className={cn('flex group/msg items-end gap-2', isAgent ? 'justify-end' : 'justify-start')}
                >
                  {/* Contact avatar — only on last message of group */}
                  {!isAgent && (
                    <div className="w-7 flex-shrink-0">
                      {isLastInGroup && <MiniAvatar initials={thread.avatar_initials} type={thread.contact_type} />}
                    </div>
                  )}

                  <div
                    className={cn('relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%] group/bubble')}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({
                        x: e.clientX, y: e.clientY,
                        msg: { id: msg.id, content: msg.content, senderName: msg.sender_name, senderType: msg.sender_type },
                        isPinned,
                      })
                    }}
                  >
                    <div
                      className={cn(
                        'px-3.5 py-2 text-sm leading-[1.4] whitespace-pre-line cursor-default',
                        isAgent
                          ? cn('bg-accent text-white', agentRadius)
                          : cn('bg-theme-elevated text-theme-primary', contactRadius),
                        isPinned && 'ring-1 ring-accent/40'
                      )}
                    >
                      <BubbleContent content={msg.content} isAgent={isAgent} />
                    </div>

                    {/* Time + read status — only on last in group */}
                    {isLastInGroup && (
                      <div className={cn('flex items-center gap-1 mt-0.5 px-1', isAgent ? 'justify-end' : 'justify-start')}>
                        <time className="text-xs text-theme-muted">
                          {msgDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                        </time>
                        {isAgent && msg.read_at && <CheckCheck className="w-3 h-3 text-accent" />}
                        {isAgent && !msg.read_at && <CheckCheck className="w-3 h-3 text-theme-muted" />}
                      </div>
                    )}

                    {/* Actions: reply + pin */}
                    {/* Actions — hidden on mobile (use context menu instead), visible on hover desktop */}
                    <div className={cn(
                      'absolute top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 transition-opacity duration-150',
                      isAgent ? '-left-14' : '-right-14',
                      'opacity-0 group-hover/bubble:opacity-100'
                    )}>
                      <button
                        onClick={() => setReplyTo({ id: msg.id, content: msg.content, senderName: msg.sender_name })}
                        aria-label="Répondre"
                        className="p-1.5 rounded-md hover:bg-theme-hover text-theme-muted"
                      >
                        <Reply className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => togglePin(msg.id, msg.content)}
                        aria-label={isPinned ? 'Désépingler' : 'Épingler'}
                        className={cn(
                          'p-1.5 rounded-md hover:bg-theme-hover',
                          isPinned ? 'text-theme-secondary' : 'text-theme-muted'
                        )}
                      >
                        <Pin className="w-3 h-3 rotate-45" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )
          })}
          {showTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-6 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          {/* Reply preview */}
          {replyTo && (
            <div className="flex items-center gap-2 mb-1.5 px-3 py-2 rounded-lg bg-theme-section border-l-2 border-accent">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-accent">{replyTo.senderName}</p>
                <p className="text-[12px] text-theme-secondary truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} aria-label="Annuler la réponse" className="p-1 rounded-md hover:bg-theme-hover flex-shrink-0">
                <X className="w-3 h-3 text-theme-muted" />
              </button>
            </div>
          )}
          <PromptInputBar
            onSend={(text) => handleSend(text)}
            isLoading={isSending}
            placeholder={replyTo ? `Répondre à ${replyTo.senderName}...` : `Message à ${thread.contact_name.split(' ')[0]}...`}
          />
        </div>
      </div>
      </div>{/* end main chat area */}

      {/* ── Info Panel (slide-in from right) ── */}
      <AnimatePresence>
        {showInfoPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex-shrink-0 border-l border-theme-border overflow-hidden"
          >
            <div className="w-72 h-full overflow-y-auto scrollbar-hide p-4 space-y-4">
              {/* Close */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-theme-muted uppercase tracking-wider">Profil</p>
                <button onClick={() => setShowInfoPanel(false)} aria-label="Fermer le profil" className="p-1 rounded-md hover:bg-theme-hover transition-colors">
                  <X className="w-3.5 h-3.5 text-theme-muted" />
                </button>
              </div>

              {/* Contact card */}
              <div className="flex flex-col items-center text-center">
                <div className={cn(
                  'h-16 w-16 rounded-full flex items-center justify-center text-lg font-semibold mb-3',
                  'bg-theme-hover text-theme-secondary'
                )}>
                  {thread.avatar_initials}
                </div>
                <p className="text-base font-semibold text-theme-primary">{thread.contact_name}</p>
                <p className="text-xs text-theme-muted mt-0.5 capitalize">{thread.contact_type === 'buyer' ? 'Acheteur' : 'Vendeur'}</p>

                {/* Score badge */}
                {contactData?.score && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      contactData.score === 'hot' ? 'bg-red-500' :
                      contactData.score === 'warm' ? 'bg-amber-500' :
                      'bg-blue-400'
                    )} />
                    <span className={cn(
                      'text-xs font-medium',
                      contactData.score === 'hot' ? 'text-red-500' :
                      contactData.score === 'warm' ? 'text-amber-500' :
                      'text-blue-400'
                    )}>
                      {contactData.score === 'hot' ? 'Hot' : contactData.score === 'warm' ? 'Warm' : 'Cold'}
                    </span>
                  </div>
                )}
              </div>

              {/* 1. Score bar — AI seriousness */}
              {contactData?.ai_seriousness_score != null && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-theme-muted flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      Score sérieux
                    </span>
                    <span className="text-xs font-semibold text-theme-primary">{contactData.ai_seriousness_score}/100</span>
                  </div>
                  <div className="h-1.5 bg-theme-section rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        contactData.ai_seriousness_score >= 70 ? 'bg-emerald-500' :
                        contactData.ai_seriousness_score >= 40 ? 'bg-amber-500' :
                        'bg-red-500'
                      )}
                      style={{ width: `${contactData.ai_seriousness_score}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-theme-muted mt-1 italic">estimation IA</p>
                </div>
              )}

              {/* 2. Phone + Email — clickable */}
              <div className="space-y-2">
                {(contactData?.phone || contactData?.email) && (
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wider">Contact</p>
                )}
                {contactData?.phone && (
                  <a href={`tel:${contactData.phone}`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-theme-hover transition-colors group">
                    <div className="h-8 w-8 rounded-full bg-theme-section flex items-center justify-center flex-shrink-0">
                      <Phone className="w-3.5 h-3.5 text-theme-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-theme-primary group-hover:text-accent transition-colors">{contactData.phone}</p>
                      <p className="text-[10px] text-theme-muted">Téléphone</p>
                    </div>
                  </a>
                )}
                {contactData?.email && (
                  <a href={`mailto:${contactData.email}`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-theme-hover transition-colors group">
                    <div className="h-8 w-8 rounded-full bg-theme-section flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3.5 h-3.5 text-theme-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-theme-primary group-hover:text-accent transition-colors truncate">{contactData.email}</p>
                      <p className="text-[10px] text-theme-muted">Email</p>
                    </div>
                  </a>
                )}
                {!contactData && (
                  <div className="flex justify-center gap-3">
                    <button className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-theme-hover transition-colors">
                      <div className="h-9 w-9 rounded-full bg-theme-section flex items-center justify-center">
                        <Phone className="w-4 h-4 text-theme-secondary" />
                      </div>
                      <span className="text-[10px] text-theme-muted">Appeler</span>
                    </button>
                    <button className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-theme-hover transition-colors">
                      <div className="h-9 w-9 rounded-full bg-theme-section flex items-center justify-center">
                        <Mail className="w-4 h-4 text-theme-secondary" />
                      </div>
                      <span className="text-[10px] text-theme-muted">Email</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Pipeline stage */}
              {contactData && (
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">Pipeline</p>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-theme-section">
                    <GitBranch className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" />
                    <span className="text-xs text-theme-secondary">Aucun deal actif</span>
                  </div>
                </div>
              )}

              {/* 4. Last interaction */}
              {contactData?.last_interaction_at && (
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">Dernière interaction</p>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-theme-section">
                    <Clock className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" />
                    <span className="text-xs text-theme-secondary">
                      {new Date(contactData.last_interaction_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              )}

              {/* 5. Budget (buyers only) */}
              {contactData && thread.contact_type === 'buyer' && (contactData.budget_announced || contactData.budget_estimated_ai) && (
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">Budget</p>
                  <div className="space-y-1.5">
                    {contactData.budget_announced != null && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-theme-section">
                        <span className="text-xs text-theme-secondary flex items-center gap-1.5">
                          <Banknote className="w-3.5 h-3.5" />
                          Annoncé
                        </span>
                        <span className="text-xs font-semibold text-theme-primary">{formatCHF(contactData.budget_announced)}</span>
                      </div>
                    )}
                    {contactData.budget_estimated_ai != null && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-theme-section">
                        <span className="text-xs text-theme-secondary flex items-center gap-1.5">
                          <Banknote className="w-3.5 h-3.5" />
                          Estimé IA
                        </span>
                        <span className="text-xs font-semibold text-theme-primary">{formatCHF(contactData.budget_estimated_ai)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. Tags contact */}
              {contactData && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-theme-muted uppercase tracking-wider">Tags</p>
                    <button
                      onClick={() => setShowTagInput(p => !p)}
                      className="text-[10px] text-theme-muted hover:text-theme-primary transition-colors"
                    >
                      + Ajouter
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(contactData.tags || []).map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-theme-active text-theme-primary">
                        {tag}
                        <button onClick={() => removeTag(tag)} aria-label={`Retirer le tag ${tag}`} className="hover:text-red-500 transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    {(contactData.tags || []).length === 0 && !showTagInput && (
                      <span className="text-[10px] text-theme-muted">Aucun tag</span>
                    )}
                  </div>
                  <AnimatePresence>
                    {showTagInput && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="flex gap-1.5 mt-2">
                          <input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addTag()}
                            placeholder="Nouveau tag..."
                            aria-label="Ajouter un tag"
                            className="flex-1 h-7 px-2 text-xs bg-transparent border border-theme-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-primary placeholder:text-theme-muted"
                            autoFocus
                          />
                          <button
                            onClick={addTag}
                            disabled={!newTag.trim()}
                            className="h-7 px-2 rounded-md text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary disabled:opacity-40 transition-colors"
                          >
                            OK
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* 7. Notes rapides */}
              {contactData && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-theme-muted uppercase tracking-wider flex items-center gap-1">
                      <StickyNote className="w-3 h-3" />
                      Notes
                    </p>
                    {isSavingNote && <span className="text-[10px] text-theme-muted">Sauvegarde...</span>}
                  </div>
                  <textarea
                    value={noteDraft ?? ''}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onBlur={saveNote}
                    rows={3}
                    placeholder="Notes sur ce contact..."
                    className="w-full px-3 py-2 text-xs bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-y text-theme-primary placeholder:text-theme-muted"
                  />
                </div>
              )}

              {/* 8. Next Best Action IA */}
              {contactData?.ai_seriousness_score != null && (
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Prochaine action
                  </p>
                  <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
                    <p className="text-xs text-theme-primary">
                      {contactData.ai_seriousness_score >= 70
                        ? 'Proposer une visite — ce contact est très engagé'
                        : contactData.ai_seriousness_score >= 40
                        ? 'Envoyer des biens similaires pour maintenir l\'intérêt'
                        : 'Relancer avec un nouveau bien ou une baisse de prix'}
                    </p>
                    <p className="text-[10px] text-theme-muted mt-1 italic">estimation IA</p>
                  </div>
                </div>
              )}

              {/* 9. Historique rapide — 3 derniers événements */}
              <div>
                <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Activité récente
                </p>
                <div className="space-y-1">
                  {messages.slice(-3).reverse().map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2 py-1.5">
                      <div className={cn(
                        'w-1 h-1 rounded-full mt-1.5 flex-shrink-0',
                        msg.sender_type === 'agent' ? 'bg-accent' : 'bg-theme-muted'
                      )} />
                      <div className="min-w-0">
                        <p className="text-[10px] text-theme-secondary truncate">{msg.content}</p>
                        <p className="text-[9px] text-theme-muted">
                          {new Date(msg.created_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })}
                          {' · '}
                          {msg.sender_type === 'agent' ? 'Vous' : thread.contact_name.split(' ')[0]}
                        </p>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <p className="text-[10px] text-theme-muted">Aucune activité</p>
                  )}
                </div>
              </div>

              {/* 10. Compatibilité matching */}
              {allMatches.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">Matching</p>
                  <Link
                    to={thread.contact_id ? `/dashboard/matching?contact=${thread.contact_id}` : '/dashboard/matching'}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-theme-section hover:bg-theme-hover transition-colors group"
                  >
                    <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-accent">{allMatches.length}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-theme-primary group-hover:text-accent transition-colors">
                        {allMatches.length} bien{allMatches.length > 1 ? 's' : ''} compatible{allMatches.length > 1 ? 's' : ''}
                      </p>
                      {allMatches[0] && (
                        <p className="text-[10px] text-theme-muted truncate">
                          Meilleur : {allMatches[0].score}% — {allMatches[0].listing?.title || 'Bien'}
                        </p>
                      )}
                    </div>
                  </Link>
                </div>
              )}

              {/* 11. Biens envoyés */}
              {sentMatches.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-2">Biens envoyés</p>
                  <div className="space-y-1.5">
                    {sentMatches.slice(0, 3).map((match) => {
                      const title = match.listing?.title || 'Bien'
                      const price = match.listing?.price
                      return (
                        <div key={match.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-theme-section">
                          <div className="h-8 w-8 rounded-md bg-theme-hover flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-theme-muted" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-theme-primary truncate">{title}</p>
                            {price ? <p className="text-[10px] text-theme-muted">{formatCHF(price)}</p> : null}
                          </div>
                          <span className={cn(
                            'text-[9px] font-medium px-1.5 py-0.5 rounded-full',
                            match.status === 'interested' ? 'bg-emerald-500/10 text-emerald-500' :
                            match.status === 'visit_planned' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-theme-active text-theme-secondary'
                          )}>
                            {match.status === 'interested' ? 'Intéressé' :
                             match.status === 'visit_planned' ? 'Visite' :
                             'Envoyé'}
                          </span>
                        </div>
                      )
                    })}
                    {sentMatches.length > 3 && (
                      <p className="text-[10px] text-theme-muted text-center">+{sentMatches.length - 3} autre{sentMatches.length - 3 > 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
              )}

              {/* 12. Demander à MEGGA AI */}
              {onSwitchToAi && (
                <button
                  onClick={() => onSwitchToAi(`Résume-moi le client ${thread.contact_name}`)}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-medium text-white hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Demander à MEGGA AI
                </button>
              )}

              {/* Quick link to full profile */}
              {thread.contact_id && (
                <Link
                  to={`/dashboard/contacts/${thread.contact_id}`}
                  className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-theme-border text-xs font-medium text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Voir le profil complet
                </Link>
              )}

              {/* Divider */}
              <div className="h-px bg-theme-border" />

              {/* Property info — expandable mini-fiche */}
              {thread.property_title && (
                <div>
                  <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-3">Bien lié</p>
                  <button
                    onClick={() => setPropertyExpanded(p => !p)}
                    className="w-full rounded-xl border border-theme-border hover:border-theme-active transition-colors overflow-hidden text-left"
                  >
                    {/* Collapsed: icon + title */}
                    <div className="flex items-center gap-3 p-3">
                      <div className="h-9 w-9 rounded-lg bg-theme-section flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-theme-secondary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-theme-primary truncate">{thread.property_title}</p>
                        {propertyData && (
                          <p className="text-xs text-theme-muted mt-0.5">
                            {formatCHF(propertyData.price)} · {propertyData.rooms}p · {propertyData.surface_m2} m²
                          </p>
                        )}
                      </div>
                      {propertyExpanded ? (
                        <ChevronUp className="w-4 h-4 text-theme-muted flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-theme-muted flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Expanded: full mini-fiche */}
                  <AnimatePresence>
                    {propertyExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl border border-theme-border mt-2 overflow-hidden">
                          {/* Photo */}
                          {propertyData?.photos && propertyData.photos.length > 0 ? (
                            <div className="aspect-[16/9] bg-theme-section">
                              <img
                                src={propertyData.photos[0]}
                                alt={propertyData.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="aspect-[16/9] bg-theme-section flex items-center justify-center">
                              <Building2 className="w-8 h-8 text-theme-muted" />
                            </div>
                          )}

                          {/* Details */}
                          <div className="p-3 space-y-2">
                            {propertyData ? (
                              <>
                                <p className="text-base font-semibold text-theme-primary">{formatCHF(propertyData.price)}</p>
                                <p className="text-sm text-theme-primary">{propertyData.title}</p>

                                <div className="flex items-center gap-1 text-xs text-theme-muted">
                                  <MapPinIcon className="w-3 h-3" />
                                  <span>{propertyData.address}, {propertyData.postal_code} {propertyData.city}</span>
                                </div>

                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-theme-secondary">
                                  {propertyData.rooms > 0 && <span>{propertyData.rooms} pièces</span>}
                                  {propertyData.surface_m2 > 0 && <span>{propertyData.surface_m2} m²</span>}
                                  {propertyData.bedrooms > 0 && <span>{propertyData.bedrooms} ch.</span>}
                                  {propertyData.floor != null && <span>{propertyData.floor}e étage</span>}
                                </div>

                                {/* Status badge */}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <span className={cn(
                                    'w-1.5 h-1.5 rounded-full',
                                    propertyData.status === 'active' ? 'bg-emerald-500' :
                                    propertyData.status === 'reserved' ? 'bg-amber-500' :
                                    propertyData.status === 'sold' ? 'bg-red-500' :
                                    'bg-theme-muted'
                                  )} />
                                  <span className="text-[10px] text-theme-muted capitalize">
                                    {propertyData.status === 'active' ? 'Actif' :
                                     propertyData.status === 'reserved' ? 'Réservé' :
                                     propertyData.status === 'sold' ? 'Vendu' :
                                     propertyData.status === 'draft' ? 'Brouillon' :
                                     propertyData.status}
                                  </span>
                                </div>

                                {/* Link to full listing */}
                                <Link
                                  to={`/dashboard/listings/${propertyData.id}/edit`}
                                  className="flex items-center gap-1.5 text-xs text-accent hover:underline pt-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Voir la fiche complète
                                </Link>
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-theme-primary">{thread.property_title}</p>
                                <p className="text-xs text-theme-muted">Bien lié à cette conversation</p>
                                {thread.property_id && (
                                  <Link
                                    to={`/dashboard/listings/${thread.property_id}/edit`}
                                    className="flex items-center gap-1.5 text-xs text-accent hover:underline pt-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Voir la fiche complète
                                  </Link>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Conversation stats */}
              <div>
                <p className="text-xs font-medium text-theme-muted uppercase tracking-wider mb-3">Conversation</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-theme-secondary">Messages</span>
                    <span className="text-xs font-medium text-theme-primary">{messages.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-theme-secondary">Premier message</span>
                    <span className="text-xs font-medium text-theme-primary">
                      {messages.length > 0 ? new Date(messages[0].created_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' }) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-theme-secondary">Dernier message</span>
                    <span className="text-xs font-medium text-theme-primary">
                      {messages.length > 0 ? new Date(messages[messages.length - 1].created_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' }) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context menu */}
      {contextMenu && (
        <MessageContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onReply={() => setReplyTo({ id: contextMenu.msg.id, content: contextMenu.msg.content, senderName: contextMenu.msg.senderName })}
          onCopy={() => navigator.clipboard.writeText(contextMenu.msg.content)}
          onPin={() => togglePin(contextMenu.msg.id, contextMenu.msg.content)}
          onTransferAi={onSwitchToAi ? () => onSwitchToAi(`Analyse ce message de ${contextMenu.msg.senderName} : "${contextMenu.msg.content.slice(0, 200)}"`) : undefined}
        />
      )}
    </div>
  )
}
