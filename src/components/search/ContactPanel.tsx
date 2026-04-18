import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Send, Building2, CheckCheck, ArrowUp, MessageSquare, ShieldCheck, CalendarDays } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMessaging, type Message } from '@/hooks/useMessaging'
import { supabase } from '@/lib/supabase'
import { cn, formatCHF } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface Props {
  onBack: () => void
  selectedListing?: ListingCardData | null
}

// ─── Avatars ────────────────────────────────────────────────────────────────

function AgentAvatar({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  return (
    <div className={cn(s, 'rounded-full bg-accent/10 flex items-center justify-center shrink-0')}>
      <img src="/megga-gg.svg" alt="" className="h-3.5 w-3.5" />
    </div>
  )
}

// ─── Day separator ──────────────────────────────────────────────────────────

function DaySeparator({ date }: { date: Date }) {
  const { t } = useTranslation('common')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const label = date.toDateString() === today.toDateString()
    ? t('time.today')
    : date.toDateString() === yesterday.toDateString()
      ? t('time.yesterday')
      : date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })

  return (
    <div className="flex justify-center py-3">
      <span className="text-xs text-gray-500 font-medium capitalize px-3 py-0.5 rounded-full bg-gray-50">
        {label}
      </span>
    </div>
  )
}

// ─── Message bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg, isFirstInGroup, isLastInGroup }: {
  msg: Message
  isFirstInGroup: boolean
  isLastInGroup: boolean
}) {
  const isMe = msg.sender_type === 'contact'
  const time = new Date(msg.created_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })

  // Messenger-style connected corners
  const myRadius = isFirstInGroup
    ? 'rounded-[20px] rounded-br-md'
    : isLastInGroup
      ? 'rounded-[20px] rounded-tr-md'
      : 'rounded-[20px] rounded-r-md'

  const theirRadius = isFirstInGroup
    ? 'rounded-[20px] rounded-bl-md'
    : isLastInGroup
      ? 'rounded-[20px] rounded-tl-md'
      : 'rounded-[20px] rounded-l-md'

  return (
    <div className={cn('flex items-end gap-1.5', isMe ? 'justify-end' : 'justify-start')}>
      {/* Agent avatar — only on last of group */}
      {!isMe && (
        <div className="w-7 shrink-0">
          {isLastInGroup && <AgentAvatar size="sm" />}
        </div>
      )}

      <div className={cn('max-w-[82%]')}>
        <div
          className={cn(
            'px-3 py-2 text-sm leading-[1.45] whitespace-pre-line',
            isMe
              ? cn('bg-accent text-white', myRadius)
              : cn('bg-gray-100 text-gray-900', theirRadius)
          )}
        >
          {msg.content}
        </div>

        {/* Timestamp + read status — only on last of group */}
        {isLastInGroup && (
          <div className={cn('flex items-center gap-1 mt-0.5', isMe ? 'justify-end pr-1' : 'justify-start pl-1')}>
            <span className="text-xs text-gray-500">{time}</span>
            {isMe && (
              <CheckCheck className={cn('h-3 w-3', msg.read_at ? 'text-accent' : 'text-gray-500')} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main panel ─────────────────────────────────────────────────────────────

export default function ContactPanel({ onBack, selectedListing }: Props) {
  const { t } = useTranslation('common')
  const { user, profile } = useAuth()
  const [draft, setDraft] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, isSending, markAsRead } = useMessaging(threadId)

  // Find existing thread for this user + property
  useEffect(() => {
    if (!user) return
    setThreadId(null)

    async function findThread() {
      let query = supabase
        .from('message_threads')
        .select('id')
        .eq('contact_id', user!.id)
        .limit(1)

      if (selectedListing) {
        query = query.eq('property_id', selectedListing.id)
      }

      const { data } = await query.single()
      if (data) setThreadId(data.id)
    }

    findThread()
  }, [user, selectedListing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Mark as read when viewing
  useEffect(() => {
    if (threadId && messages.length > 0) {
      markAsRead()
    }
  }, [threadId, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    const el = e.target
    el.style.height = '36px'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  // Create thread + send first message
  async function handleSend() {
    if (!user || !draft.trim() || isSending || creating) return
    const content = draft.trim()

    if (threadId) {
      // Thread exists — just send
      try {
        await sendMessage({
          content,
          senderType: 'contact',
          senderName: profile?.full_name || user.email || 'Acheteur',
        })
        setDraft('')
        if (textareaRef.current) textareaRef.current.style.height = '36px'
      } catch { /* handled */ }
    } else {
      // Create thread first
      setCreating(true)
      try {
        const threadPayload: Record<string, unknown> = {
          contact_id: user.id,
          contact_name: profile?.full_name || user.email || 'Acheteur',
          contact_type: 'buyer',
          channel: 'internal',
          last_message: content.slice(0, 100),
          last_message_at: new Date().toISOString(),
          unread_count: 1,
        }

        if (selectedListing) {
          threadPayload.property_id = selectedListing.id
          threadPayload.property_title = `${selectedListing.address}, ${selectedListing.city}`
        }

        const { data: newThread, error } = await supabase
          .from('message_threads')
          .insert(threadPayload)
          .select('id')
          .single()

        if (error) throw error

        // Insert first message
        await supabase.from('messages').insert({
          thread_id: newThread.id,
          sender_id: user.id,
          sender_type: 'contact',
          sender_name: profile?.full_name || user.email || 'Acheteur',
          content,
        })

        setThreadId(newThread.id)
        setDraft('')
        if (textareaRef.current) textareaRef.current.style.height = '36px'
      } catch (err) {
        console.error('Failed to create thread:', err)
      } finally {
        setCreating(false)
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages for Messenger-style display
  function renderMessages() {
    if (messages.length === 0) return null

    return messages.map((msg, idx) => {
      const prevMsg = idx > 0 ? messages[idx - 1] : null
      const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null
      const msgDate = new Date(msg.created_at)
      const prevDate = prevMsg ? new Date(prevMsg.created_at) : null
      const showDaySep = !prevDate || msgDate.toDateString() !== prevDate.toDateString()

      const isFirstInGroup = !prevMsg || prevMsg.sender_type !== msg.sender_type || showDaySep
      const isLastInGroup = !nextMsg || nextMsg.sender_type !== msg.sender_type ||
        (nextMsg && new Date(nextMsg.created_at).toDateString() !== msgDate.toDateString())

      return (
        <div key={msg.id}>
          {showDaySep && <DaySeparator date={msgDate} />}
          {isFirstInGroup && idx > 0 && !showDaySep && <div className="h-2" />}
          <MessageBubble
            msg={msg}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
          />
        </div>
      )
    })
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-600 transition-colors cursor-pointer" aria-label="Retour">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <AgentAvatar size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">MEGGA</p>
          <p className="text-xs text-gray-500 truncate">
            {selectedListing ? `${selectedListing.address}, ${selectedListing.city}` : t('search.realEstateAgent')}
          </p>
        </div>
      </div>

      {/* ─── Logged-out onboarding ─── */}
      {!user ? (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="flex flex-col items-center text-center pt-6 pb-8 px-5">
            <img src="/illustrations/maggy/TeamWork.svg" alt="" className="w-64 h-52 mx-auto mb-5" loading="lazy" decoding="async" />
            <p className="text-base font-semibold text-gray-900 mb-1.5">Reste en contact avec un agent</p>
            <p className="text-[13px] text-gray-500 max-w-[280px] leading-relaxed mb-6">
              Pose tes questions, planifie une visite, ou demande une estimation — un agent MEGGA te répond directement dans ce fil.
            </p>

            {/* Chat teaser */}
            <div className="relative w-full max-w-[280px] mb-6 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.12)] text-left">
              <div className="flex items-end gap-2">
                <div className="shrink-0 h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <img src="/megga-gg.svg" alt="" className="h-4 w-4" />
                </div>
                <div className="max-w-[220px] rounded-[18px] rounded-bl-md bg-gray-100 px-3 py-2">
                  <p className="text-[13px] text-gray-900 leading-snug">Bonjour 👋 Je suis là pour t'aider à trouver le bien qui te correspond.</p>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-white shadow-[0_4px_10px_-3px_rgba(37,99,235,0.35)] border border-blue-100 flex items-center justify-center">
                <MessageSquare className="h-3.5 w-3.5 text-blue-500 animate-pulse" strokeWidth={2} />
              </div>
            </div>

            {/* Value props */}
            <div className="w-full max-w-[280px] space-y-2.5 mb-6 text-left">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="h-3.5 w-3.5 text-gray-900 mt-0.5 shrink-0" strokeWidth={2} />
                <span className="text-[12px] text-gray-600">Planifie des visites en quelques clics</span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-3.5 w-3.5 text-gray-900 mt-0.5 shrink-0" strokeWidth={2} />
                <span className="text-[12px] text-gray-600">Échange dans un espace sécurisé, hors email</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Building2 className="h-3.5 w-3.5 text-gray-900 mt-0.5 shrink-0" strokeWidth={2} />
                <span className="text-[12px] text-gray-600">Demande une estimation gratuite de ton bien</span>
              </div>
            </div>

            {/* Dual CTA */}
            <div className="flex flex-col items-center gap-2 w-full max-w-[260px]">
              <Link
                to="/signup"
                className="w-full inline-flex items-center justify-center h-10 px-5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer shadow-[0_4px_12px_-4px_rgba(15,23,42,0.25)]"
              >
                Créer un compte
              </Link>
              <Link
                to="/login"
                className="w-full inline-flex items-center justify-center h-10 text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
              >
                J'ai déjà un compte · Se connecter
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Property context card ─── */}
      {user && selectedListing && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100">
              {selectedListing.photos?.[0] ? (
                <img src={selectedListing.photos[0]} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-gray-500" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900">{formatCHF(selectedListing.price)}</p>
              <p className="text-xs text-gray-500 truncate">{selectedListing.address}, {selectedListing.city}</p>
              <p className="text-xs text-gray-500">
                {selectedListing.rooms > 0 && `${selectedListing.rooms}p.`}
                {selectedListing.rooms > 0 && selectedListing.surface_m2 > 0 && ' · '}
                {selectedListing.surface_m2 > 0 && `${selectedListing.surface_m2} m²`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Messages area (logged-in only) ─── */}
      {user && (
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <Send className="h-5 w-5 text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">{t('search.startConversation')}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-[220px]">
              {t('search.askAgentQuestions')}
            </p>

            {/* Quick suggestions */}
            <div className="flex flex-col gap-1.5 mt-4 w-full max-w-[240px]">
              {[
                t('search.suggestion.available'),
                t('search.suggestion.planVisit'),
                t('search.suggestion.extraCosts'),
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setDraft(suggestion)}
                  className="text-left text-xs text-gray-500 px-3 py-2 rounded-xl border border-gray-100 hover:border-gray-300 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {renderMessages()}
        <div ref={messagesEndRef} />
      </div>
      )}

      {/* ─── Input bar — Messenger style (logged-in only) ─── */}
      {user && (
      <div className="shrink-0 border-t border-gray-100 px-3 py-2.5">
        <div className={cn(
          'flex items-end gap-2 rounded-2xl border border-gray-200 px-3 py-1.5 transition-colors',
          'focus-within:border-accent/50'
        )}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={selectedListing ? t('search.yourMessage') : t('search.writeToAgent')}
            rows={1}
            className="flex-1 text-sm text-gray-900 bg-transparent resize-none outline-none min-h-[36px] max-h-[120px] py-1.5 placeholder:text-gray-400 leading-[1.4]"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || isSending || creating}
            className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-all mb-0.5',
              draft.trim()
                ? 'border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active cursor-pointer'
                : 'bg-gray-100 text-gray-500 cursor-not-allowed'
            )}
            aria-label={t('actions.send')}
          >
            {isSending || creating ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-1.5">
          {t('search.secureMessaging')}
        </p>
      </div>
      )}
    </div>
  )
}
