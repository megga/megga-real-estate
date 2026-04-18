import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Send, Building2, CheckCheck, MessageSquare, ShieldCheck, CalendarDays } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useMessaging, type Message } from '@/hooks/useMessaging'
import { supabase } from '@/lib/supabase'
import { cn, formatCHF } from '@/lib/utils'
import PromptInputBar from '@/components/chat/PromptInputBar'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface Props {
  onBack?: () => void
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

export default function ContactPanel({ selectedListing }: Props) {
  const { t } = useTranslation('common')
  const { user, profile } = useAuth()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [prefill, setPrefill] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, isSending, markAsRead } = useMessaging(threadId)

  // Find existing thread for this user + property (buyer_user_id, nouveau modèle)
  useEffect(() => {
    if (!user) return
    setThreadId(null)

    async function findThread() {
      let query = supabase
        .from('message_threads')
        .select('id')
        .eq('buyer_user_id', user!.id)
        .limit(1)

      if (selectedListing) {
        query = query.eq('property_id', selectedListing.id)
      } else {
        query = query.is('property_id', null)
      }

      const { data } = await query.maybeSingle()
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

  // Send a message — creates the thread on first send
  const handleSend = useCallback(async (content: string) => {
    const trimmed = content.trim()
    if (!user || !trimmed || isSending || creating) return

    if (threadId) {
      try {
        await sendMessage({
          content: trimmed,
          senderType: 'contact',
          senderName: profile?.full_name || user.email || 'Acheteur',
        })
      } catch { /* handled */ }
      return
    }

    // First message — delegate to the buyer-init-thread Edge Function so
    // agency routing + upsert happen atomically under service_role.
    setCreating(true)
    try {
      const { data, error } = await supabase.functions.invoke('buyer-init-thread', {
        body: {
          content: trimmed,
          listing_id: selectedListing?.id ?? null,
        },
      })
      if (error) throw error
      if (data?.thread_id) setThreadId(data.thread_id)
    } catch (err) {
      console.error('Failed to create thread:', err)
    } finally {
      setCreating(false)
    }
  }, [user, profile, isSending, creating, threadId, selectedListing, sendMessage])

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
    <div className="relative flex flex-col h-full bg-white">

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
                to="/register"
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
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 shadow-[0_4px_12px_-4px_rgba(15,23,42,0.08)]">
              <Send className="h-5 w-5 text-gray-700" strokeWidth={1.75} />
            </div>
            <p className="text-base font-semibold text-gray-900">{t('search.startConversation')}</p>
            <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed max-w-[260px]">
              {t('search.askAgentQuestions')}
            </p>

            {/* Quick suggestions */}
            <div className="flex flex-col gap-1.5 mt-5 w-full max-w-[260px]">
              {[
                t('search.suggestion.available'),
                t('search.suggestion.planVisit'),
                t('search.suggestion.extraCosts'),
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setPrefill(suggestion)}
                  className="text-left text-[13px] text-gray-700 px-3.5 py-2.5 rounded-full border border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer shadow-[0_1px_2px_-1px_rgba(15,23,42,0.04)]"
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

      {/* ─── Input bar — reuse of the CRM agent PromptInputBar ─── */}
      {user && (
        <div className="shrink-0 px-3 pt-2 pb-3 flex justify-center">
          <div className="w-full max-w-[520px]">
            <PromptInputBar
              key={prefill /* force remount when a suggestion is picked */}
              initialValue={prefill}
              onSend={(message) => { setPrefill(''); handleSend(message) }}
              isLoading={isSending || creating}
              placeholder={selectedListing ? t('search.yourMessage') : t('search.writeToAgent')}
              showHints={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
