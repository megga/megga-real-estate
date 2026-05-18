// MEGGA CRM Sugar v2 — Inbox unifiée Gmail + Outlook
// Phase 3 mail : vue globale des messages des boîtes connectées de l'agent.
// Route : /dashboard/inbox

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CalIcon } from '@/components/crm-sugar/calendar/CalIcon'
import { useGmail, useGmailInbox } from '@/hooks/useGmail'
import { useOutlookMail, useOutlookInbox } from '@/hooks/useOutlookMail'
import type { EmailMessage } from '@/hooks/useGmail'
import { EmailComposerModal } from '@/components/crm-sugar-v3/contact-detail/EmailComposerModal'
import { EmailThreadModal } from '@/components/crm-sugar-v3/contact-detail/EmailThreadModal'

const DARK_TONE: DarkTone = 'meggaAi'

interface InboxMessage extends EmailMessage {
  provider: 'gmail' | 'outlook'
}

type Filter = 'all' | 'unread' | 'gmail' | 'outlook'

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `${diffMin} min`
  if (diffH < 24) return `${diffH} h`
  if (diffD < 7) return `${diffD} j`
  return d.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' })
}

export default function InboxSugarV2Page() {
  const navigate = useNavigate()
  const gmail = useGmail()
  const outlookMail = useOutlookMail()
  const gmailQuery = useGmailInbox(40)
  const outlookQuery = useOutlookInbox(40)
  const anyConnected = gmail.isConnected || outlookMail.isConnected
  const isLoading = gmailQuery.isLoading || outlookQuery.isLoading

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [reply, setReply] = useState<InboxMessage | null>(null)
  const [replyPrefillBody, setReplyPrefillBody] = useState<string | undefined>(undefined)
  const [openThread, setOpenThread] = useState<InboxMessage | null>(null)

  const messages = useMemo<InboxMessage[]>(() => {
    const merged: InboxMessage[] = []
    for (const m of gmailQuery.data ?? []) merged.push({ ...m, provider: 'gmail' })
    for (const m of outlookQuery.data ?? []) merged.push({ ...m, provider: 'outlook' })
    merged.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    return merged
  }, [gmailQuery.data, outlookQuery.data])

  const filtered = useMemo(() => {
    return messages.filter(m => {
      if (filter === 'unread' && !m.is_unread) return false
      if (filter === 'gmail' && m.provider !== 'gmail') return false
      if (filter === 'outlook' && m.provider !== 'outlook') return false
      if (search) {
        const q = search.toLowerCase()
        const hay = `${m.subject} ${m.from_name} ${m.from_address} ${m.snippet}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [messages, filter, search])

  const unreadCount = messages.filter(m => m.is_unread).length

  const onCmd = () => { /* placeholder */ }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'parcours': navigate('/dashboard/parcours'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'docs': navigate('/dashboard/documents'); break
      case 'inbox': navigate('/dashboard/inbox'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/reseau'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: sp.pageBg,
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>

      <SugarTopNav
        active="contacts"
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="contacts"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 40px 24px 0',
            gap: 14,
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: '#fff',
              borderRadius: 18,
              padding: '14px 18px',
              boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#7A8088',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                Boîte de réception
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#0B0C0E',
                  letterSpacing: -0.4,
                  marginTop: 6,
                  lineHeight: 1.1,
                }}
              >
                {messages.length} message{messages.length > 1 ? 's' : ''}
                {unreadCount > 0 && (
                  <span style={{ marginLeft: 10, fontSize: 14, color: '#EF4444', fontWeight: 700 }}>
                    · {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans les messages…"
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                border: '1px solid rgba(11,12,14,0.10)',
                background: '#F7F8FA',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                color: '#0B0C0E',
                width: 280,
              }}
            />

            <button
              onClick={() => {
                gmailQuery.refetch()
                outlookQuery.refetch()
              }}
              title="Rafraîchir"
              style={{
                height: 38,
                width: 38,
                borderRadius: 999,
                border: 0,
                background: '#F7F8FA',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <CalIcon name="chevR" size={14} stroke="#3A3D44" />
            </button>

            <button
              onClick={() => setComposerOpen(true)}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 999,
                border: 0,
                background: '#0B0C0E',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 6px 18px rgba(11,12,14,0.18)',
                flexShrink: 0,
              }}
            >
              <CalIcon name="plus" size={14} stroke="#fff" sw={2.4} />
              Nouveau message
            </button>
          </div>

          {/* Filtres */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              background: '#fff',
              borderRadius: 22,
              padding: 8,
              boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
              alignItems: 'center',
            }}
          >
            {([
              { id: 'all' as Filter, label: 'Tous', count: messages.length },
              { id: 'unread' as Filter, label: 'Non lus', count: unreadCount },
              { id: 'gmail' as Filter, label: 'Gmail', count: messages.filter(m => m.provider === 'gmail').length },
              { id: 'outlook' as Filter, label: 'Outlook', count: messages.filter(m => m.provider === 'outlook').length },
            ]).map(f => {
              const active = filter === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    height: 36,
                    padding: '0 16px',
                    borderRadius: 999,
                    border: 0,
                    background: active ? '#0B0C0E' : 'transparent',
                    color: active ? '#fff' : '#3A3D44',
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 600,
                    cursor: 'pointer',
                    transition: 'all .15s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {f.label}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      opacity: 0.6,
                    }}
                  >
                    {f.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Liste */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!anyConnected && (
              <div
                style={{
                  padding: 32,
                  borderRadius: 18,
                  background: '#fff',
                  textAlign: 'center',
                  boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0B0C0E', marginBottom: 6 }}>
                  Aucune boîte mail connectée
                </div>
                <div style={{ fontSize: 13, color: '#7A8088', marginBottom: 16, lineHeight: 1.5 }}>
                  Branchez Gmail ou Outlook Mail pour voir vos messages ici.
                </div>
                <button
                  onClick={() => navigate('/dashboard/settings')}
                  style={{
                    height: 38,
                    padding: '0 18px',
                    borderRadius: 999,
                    border: 0,
                    background: '#0B0C0E',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Aller dans les réglages
                </button>
              </div>
            )}

            {anyConnected && isLoading && (
              <div
                style={{
                  padding: 24,
                  borderRadius: 18,
                  background: '#fff',
                  fontSize: 13,
                  color: '#7A8088',
                  textAlign: 'center',
                  boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                }}
              >
                Chargement des messages…
              </div>
            )}

            {anyConnected && !isLoading && filtered.length === 0 && (
              <div
                style={{
                  padding: 24,
                  borderRadius: 18,
                  background: '#fff',
                  fontSize: 13,
                  color: '#7A8088',
                  textAlign: 'center',
                  boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                }}
              >
                {search ? `Aucun message ne contient "${search}".` : 'Aucun message à afficher.'}
              </div>
            )}

            {anyConnected && !isLoading && filtered.map(msg => (
              <button
                key={`${msg.provider}-${msg.id}`}
                onClick={() => setOpenThread(msg)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: '#fff',
                  border: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
                  borderLeft: `3px solid ${msg.provider === 'gmail' ? '#EA4335' : '#0078D4'}`,
                  transition: 'transform .15s, box-shadow .15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,23,42,0.07)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.03)'
                }}
              >
                {msg.is_unread && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: '#EF4444',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: '#F7F8FA',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#3A3D44',
                    flexShrink: 0,
                  }}
                >
                  {(msg.from_name || msg.from_address || '?').slice(0, 2).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      marginBottom: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: msg.is_unread ? 700 : 600,
                        color: '#0B0C0E',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {msg.from_name || msg.from_address}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#7A8088',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {relativeDate(msg.sent_at)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: msg.is_unread ? 600 : 500,
                      color: '#0B0C0E',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 2,
                    }}
                  >
                    {msg.subject || '(Sans objet)'}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#7A8088',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {msg.snippet}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>
      </div>

      {/* Composer (new message) */}
      <EmailComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
      />

      {/* Composer (reply) */}
      <EmailComposerModal
        open={!!reply}
        onClose={() => { setReply(null); setReplyPrefillBody(undefined) }}
        defaultTo={reply?.from_address ?? ''}
        defaultSubject={reply?.subject?.startsWith('Re:') ? reply.subject : `Re: ${reply?.subject || '(Sans objet)'}`}
        defaultBody={replyPrefillBody}
        replyToMessageId={reply?.id}
        forceProvider={reply?.provider}
      />

      {/* Thread view (read full conversation) */}
      <EmailThreadModal
        open={!!openThread}
        onClose={() => setOpenThread(null)}
        threadId={openThread?.thread_id ?? null}
        provider={openThread?.provider ?? null}
        markMessageIdAsRead={openThread?.is_unread ? openThread.id : undefined}
        onReply={(params) => {
          setOpenThread(null)
          // Convert ThreadModal reply params into InboxMessage-shaped state for the composer
          setReply({
            id: params.messageId,
            thread_id: openThread?.thread_id ?? '',
            from_address: params.to,
            from_name: '',
            to_addresses: [],
            cc_addresses: [],
            subject: params.subject,
            snippet: '',
            sent_at: new Date().toISOString(),
            is_unread: false,
            has_attachments: false,
            provider: params.provider,
          })
          setReplyPrefillBody(params.prefillBody)
        }}
      />
    </div>
  )
}
