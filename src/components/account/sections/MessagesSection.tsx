import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useAuth } from '@/hooks/useAuth'
import { useMessaging } from '@/hooks/useMessaging'
import { useIsMobile } from '@/hooks/useMediaQuery'
import EmptyState from '../EmptyState'
import { MessageIcon, AttachIcon, SendIcon, ChevronRightIcon } from '../icons'

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffH < 1) return "à l'instant"
  if (diffH < 24) return `il y a ${diffH} h`
  const diffDays = Math.floor(diffH / 24)
  if (diffDays === 1) return 'hier'
  if (diffDays < 7) return `il y a ${diffDays} j`
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })
}

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-CH', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MessagesSection() {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const { t } = useTranslation('compte')
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('megga_open_msg')
    } catch {
      return null
    }
  })
  const [showThread, setShowThread] = useState(false)
  const [draft, setDraft] = useState('')
  const threadEndRef = useRef<HTMLDivElement>(null)

  const { threads, messages, sendMessage, markAsRead, isSending } = useMessaging(selectedId)
  const selected = threads.find((t) => t.id === selectedId) ?? threads[0] ?? null

  // Auto-select first thread when none chosen (desktop only — mobile starts on list)
  useEffect(() => {
    if (!selectedId && threads.length > 0 && !isMobile) {
      setSelectedId(threads[0].id)
    }
  }, [threads, selectedId, isMobile])

  // Mark as read on selection
  useEffect(() => {
    if (selected && selected.unread_count > 0) {
      void markAsRead()
    }
  }, [selectedId, selected, markAsRead])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollTop = threadEndRef.current.scrollHeight
    }
  }, [messages.length, selectedId])

  if (threads.length === 0) {
    return (
      <EmptyState
        icon={<MessageIcon size={28} />}
        title={t('empty.messages.title')}
        body={t('empty.messages.body')}
        cta={t('empty.messages.cta')}
        ctaHref="/rent"
      />
    )
  }

  // On mobile, show only list OR only thread (toggle via showThread + selected)
  const mobileShowList = isMobile && !showThread
  const mobileShowThread = isMobile && showThread && selected

  if (isMobile && !selected && threads.length > 0) {
    // Selected was reset; ensure list is visible
    if (showThread) setShowThread(false)
  }
  if (!selected && !isMobile) return null

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    const senderName = profile?.full_name || user?.email || 'Vous'
    await sendMessage({ content: text, senderType: 'contact', senderName })
    setDraft('')
  }

  const myUserId = user?.id

  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        background: '#fff',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 360px) 1fr',
        height: isMobile ? 'calc(100vh - 240px)' : 'calc(100vh - 220px)',
        minHeight: 520,
      }}
    >
      {/* List column */}
      <div
        style={{
          borderRight: isMobile ? 'none' : `1px solid ${T.border}`,
          background: T.page,
          display: mobileShowList || !isMobile ? 'flex' : 'none',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontFamily: T.fontStack,
              fontSize: 13,
              fontWeight: 700,
              color: T.ink,
            }}
          >
            Conversations
          </span>
          <span
            style={{
              fontFamily: T.fontStack,
              fontSize: 11,
              color: T.muted,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {threads.length}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {threads.map((t, i) => {
            const isSel = selected.id === t.id
            const unread = t.unread_count > 0
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedId(t.id)
                  if (isMobile) setShowThread(true)
                }}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '14px 16px',
                  border: 'none',
                  borderBottom: i < threads.length - 1 ? `1px solid ${T.border}` : 'none',
                  borderLeft: isSel ? `3px solid ${T.ink}` : '3px solid transparent',
                  background: isSel ? '#fff' : unread ? T.accentSoft : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.12s ease',
                  fontFamily: T.fontStack,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    flexShrink: 0,
                    background: T.ink,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: T.fontStack,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                  }}
                >
                  {t.avatar_initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      marginBottom: 2,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span
                        style={{
                          fontFamily: T.fontStack,
                          fontSize: 13,
                          fontWeight: 700,
                          color: T.ink,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.contact_name}
                      </span>
                      {unread && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            background: T.danger,
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        fontFamily: T.fontStack,
                        fontSize: 10,
                        color: T.muted,
                        flexShrink: 0,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatTime(t.last_message_at)}
                    </span>
                  </div>
                  {t.property_title && (
                    <div
                      style={{
                        fontFamily: T.fontStack,
                        fontSize: 11,
                        color: T.muted,
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t.property_title}
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: T.fontStack,
                      fontSize: 12,
                      color: unread ? T.ink : T.soft,
                      fontWeight: unread ? 600 : 500,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {t.last_message ?? '—'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Thread column */}
      <div
        style={{
          display: mobileShowThread || !isMobile ? 'flex' : 'none',
          flexDirection: 'column',
          minHeight: 0,
          background: '#fff',
        }}
      >
        <div
          style={{
            padding: '14px 22px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {isMobile && (
            <button
              type="button"
              onClick={() => setShowThread(false)}
              aria-label="Retour aux conversations"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: T.ink,
                marginLeft: -8,
                flexShrink: 0,
              }}
            >
              <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}>
                <ChevronRightIcon size={18} />
              </span>
            </button>
          )}
          {selected && (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                flexShrink: 0,
                background: T.ink,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: T.fontStack,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.4,
              }}
            >
              {selected.avatar_initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 15,
                fontWeight: 700,
                color: T.ink,
                letterSpacing: -0.1,
              }}
            >
              {selected?.contact_name}
            </div>
            <div style={{ fontFamily: T.fontStack, fontSize: 12, color: T.muted }}>
              {selected?.contact_type === 'buyer' ? 'Acheteur' : 'Vendeur'}
            </div>
          </div>
          {selected?.property_title && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.section,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                maxWidth: 240,
              }}
            >
              <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted }}>
                Bien associé
              </div>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.ink,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selected?.property_title}
              </div>
            </div>
          )}
        </div>

        <div
          ref={threadEndRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '22px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'linear-gradient(180deg, #FAFBFD 0%, #fff 100%)',
          }}
        >
          {messages.map((m) => {
            const isMe = m.sender_id === myUserId
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    maxWidth: '72%',
                    padding: '10px 14px',
                    borderRadius: 14,
                    borderBottomRightRadius: isMe ? 4 : 14,
                    borderBottomLeftRadius: isMe ? 14 : 4,
                    background: isMe ? T.ink : '#fff',
                    color: isMe ? '#fff' : T.ink,
                    border: isMe ? 'none' : `1px solid ${T.border}`,
                    fontFamily: T.fontStack,
                    fontSize: 13,
                    lineHeight: 1.5,
                    boxShadow: isMe ? 'none' : '0 1px 2px rgba(14,20,16,0.04)',
                  }}
                >
                  {m.content}
                </div>
                <span
                  style={{
                    fontFamily: T.fontStack,
                    fontSize: 10,
                    color: T.muted,
                    padding: '0 6px',
                  }}
                >
                  {formatBubbleTime(m.created_at)}
                </span>
              </div>
            )
          })}
        </div>

        <div
          style={{
            borderTop: `1px solid ${T.border}`,
            padding: '14px 18px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            background: '#fff',
          }}
        >
          <button
            type="button"
            title="Joindre un fichier (bientôt)"
            disabled
            style={{
              width: 38,
              height: 38,
              border: `1px solid ${T.border}`,
              background: '#fff',
              color: T.muted,
              cursor: 'not-allowed',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AttachIcon size={15} />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder={`Répondre à ${selected?.contact_name ?? ''}...`}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: '10px 14px',
              fontFamily: T.fontStack,
              fontSize: 13,
              color: T.ink,
              outline: 'none',
              maxHeight: 120,
              lineHeight: 1.5,
              background: T.section,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = T.ink
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = T.border
            }}
          />
          <button
            onClick={() => void send()}
            disabled={!draft.trim() || isSending}
            style={{
              height: 40,
              padding: '0 18px',
              borderRadius: 999,
              border: 'none',
              background: draft.trim() && !isSending ? T.ink : T.section,
              color: draft.trim() && !isSending ? '#fff' : T.muted,
              fontFamily: T.fontStack,
              fontSize: 13,
              fontWeight: 700,
              cursor: draft.trim() && !isSending ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.15s ease',
            }}
          >
            Envoyer <SendIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
