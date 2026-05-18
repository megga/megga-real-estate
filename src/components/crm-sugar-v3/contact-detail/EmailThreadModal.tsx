// MEGGA CRM Sugar v3 — Email Thread Modal (Phase 4 mail)
// Affiche la conversation complète d'un thread Gmail ou Outlook avec
// body texte, pièces jointes (metadata uniquement), bouton "Répondre",
// et marquage auto comme lu à l'ouverture.

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import DOMPurify from 'dompurify'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { SgGhostPill, SgBlackPill, SgCircleBtn } from '../primitives'
import { useGmail, useGmailThread } from '@/hooks/useGmail'
import { useOutlookMail, useOutlookThread } from '@/hooks/useOutlookMail'
import type { EmailAttachment } from '@/hooks/useGmail'

/**
 * Config DOMPurify pour les emails HTML reçus :
 * - Strip <script>, <iframe>, on* event handlers (par défaut DOMPurify)
 * - Strip <link rel="stylesheet"> et <style> qui pourraient injecter du JS via expressions
 * - Force target="_blank" + rel="noopener noreferrer" sur tous les <a> via hook
 * - Bloque les images data: et javascript: dans src
 */
function sanitizeEmailHtml(raw: string): string {
  if (typeof window === 'undefined') return ''
  // Hook : forcer target="_blank" et rel safe sur tous les liens externes
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if ('target' in node && node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  const clean = DOMPurify.sanitize(raw, {
    FORBID_TAGS: ['style', 'link', 'meta', 'script', 'iframe'],
    FORBID_ATTR: ['style'], // pas de style inline — couleurs marketing souvent moches en dark mode
    ALLOW_DATA_ATTR: false,
  })
  DOMPurify.removeAllHooks()
  return clean
}

interface Props {
  open: boolean
  onClose: () => void
  threadId: string | null
  provider: 'gmail' | 'outlook' | null
  /** Optionnel : id du message à marquer lu à l'ouverture (single-message mark) */
  markMessageIdAsRead?: string
  onReply?: (params: { messageId: string; subject: string; to: string; provider: 'gmail' | 'outlook' }) => void
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export function EmailThreadModal({
  open,
  onClose,
  threadId,
  provider,
  markMessageIdAsRead,
  onReply,
}: Props) {
  const gmail = useGmail()
  const outlookMail = useOutlookMail()
  const gmailThread = useGmailThread(provider === 'gmail' ? threadId : null)
  const outlookThread = useOutlookThread(provider === 'outlook' ? threadId : null)

  const messages = useMemo(() => {
    if (provider === 'gmail') return gmailThread.data ?? []
    if (provider === 'outlook') return outlookThread.data ?? []
    return []
  }, [provider, gmailThread.data, outlookThread.data])

  const isLoading = (provider === 'gmail' && gmailThread.isLoading) ||
                    (provider === 'outlook' && outlookThread.isLoading)

  const [marked, setMarked] = useState(false)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

  /**
   * Télécharge une pièce jointe via le provider courant.
   * Convertit le base64 en Blob, génère un lien <a download> temporaire,
   * et déclenche le download natif. Le browser sandboxe le fichier.
   */
  const handleDownload = async (messageId: string, att: EmailAttachment) => {
    if (!provider || !att.attachment_id) return
    const key = `${messageId}-${att.attachment_id}`
    setDownloadingKey(key)
    try {
      const fetcher = provider === 'gmail' ? gmail.downloadAttachment : outlookMail.downloadAttachment
      const result = await fetcher({ message_id: messageId, attachment_id: att.attachment_id })
      // Convert base64 → binary → Blob
      const binary = atob(result.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: att.mime_type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      // Erreur silencieuse au niveau modal — le button revient à l'état idle
      console.error('[EmailThreadModal] attachment download failed', e)
    } finally {
      setDownloadingKey(null)
    }
  }

  // Auto-mark as read à l'ouverture (best effort, non bloquant)
  useEffect(() => {
    if (!open || !markMessageIdAsRead || marked) return
    if (provider === 'gmail') {
      gmail.markAsRead({ message_id: markMessageIdAsRead, is_read: true }).catch(() => {})
    } else if (provider === 'outlook') {
      outlookMail.markAsRead({ message_id: markMessageIdAsRead, is_read: true }).catch(() => {})
    }
    setMarked(true)
  }, [open, markMessageIdAsRead, marked, provider, gmail, outlookMail])

  // Reset marked when closed
  useEffect(() => {
    if (!open) setMarked(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !threadId || !provider) return null

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
  const threadSubject = messages[0]?.subject ?? '(Sans objet)'

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(11,12,14,0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: SugarV3.font,
        animation: 'tmFadeIn .2s ease both',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes tmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tmScaleIn {
          from { opacity: 0; transform: scale(.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SugarV3.card,
          borderRadius: 24,
          width: 760,
          maxWidth: '94%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(11,12,14,0.30)',
          animation: 'tmScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(11,12,14,0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: provider === 'gmail' ? '#FFE9E5' : '#E5EFFB',
              color: provider === 'gmail' ? '#EA4335' : '#0078D4',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <SgIcon name="mail" size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: SugarV3.ink,
                letterSpacing: -0.3,
                marginBottom: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {threadSubject}
            </div>
            <div style={{ fontSize: 12, color: SugarV3.muted, fontWeight: 500 }}>
              {messages.length} message{messages.length > 1 ? 's' : ''} · {provider === 'gmail' ? 'Gmail' : 'Outlook'}
            </div>
          </div>
          <SgCircleBtn
            icon={<SgIcon name="close" size={15} stroke={SugarV3.inkSoft} />}
            onClick={onClose}
            title="Fermer"
            size={36}
          />
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: SugarV3.bg,
          }}
        >
          {isLoading && (
            <div style={{ padding: 24, fontSize: 13, color: SugarV3.muted, textAlign: 'center' }}>
              Chargement de la conversation…
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div style={{ padding: 24, fontSize: 13, color: SugarV3.muted, textAlign: 'center' }}>
              Aucun message dans ce thread.
            </div>
          )}

          {!isLoading && messages.map((msg, idx) => (
            <div
              key={msg.id}
              style={{
                background: SugarV3.card,
                borderRadius: 16,
                padding: '18px 20px',
                boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: SugarV3.cardSubtle,
                    color: SugarV3.ink,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(msg.from_name || msg.from_address || '?').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: SugarV3.ink }}>
                    {msg.from_name || msg.from_address}
                  </div>
                  <div style={{ fontSize: 11.5, color: SugarV3.muted, fontWeight: 500 }}>
                    {msg.from_address && msg.from_name ? msg.from_address + ' · ' : ''}
                    {formatFullDate(msg.sent_at)}
                  </div>
                </div>
                {idx === messages.length - 1 && onReply && (
                  <button
                    onClick={() => onReply({
                      messageId: msg.id,
                      subject: msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject || '(Sans objet)'}`,
                      to: msg.from_address,
                      provider,
                    })}
                    style={{
                      height: 30,
                      padding: '0 14px',
                      borderRadius: 999,
                      border: 0,
                      background: SugarV3.ink,
                      color: '#fff',
                      fontFamily: 'inherit',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <SgIcon name="send" size={11} stroke="#fff" sw={2} />
                    Répondre
                  </button>
                )}
              </div>

              {msg.to_addresses.length > 0 && (
                <div
                  style={{
                    fontSize: 11.5,
                    color: SugarV3.muted,
                    fontWeight: 500,
                    marginBottom: 10,
                  }}
                >
                  À : {msg.to_addresses.join(', ')}
                  {msg.cc_addresses.length > 0 && (
                    <> · Cc : {msg.cc_addresses.join(', ')}</>
                  )}
                </div>
              )}

              {msg.body_html ? (
                <div
                  className="megga-email-html"
                  style={{
                    fontSize: 13.5,
                    color: SugarV3.inkSoft,
                    lineHeight: 1.65,
                    fontFamily: 'inherit',
                    wordBreak: 'break-word',
                  }}
                  // HTML déjà sanitisé par DOMPurify (forbidden tags: script/iframe/style/link,
                  // pas d'inline style, links forcés target=_blank rel=noopener)
                  dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(msg.body_html) }}
                />
              ) : (
                <div
                  style={{
                    fontSize: 13.5,
                    color: SugarV3.inkSoft,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.body_text || msg.snippet || '(Message vide)'}
                </div>
              )}

              {msg.attachments && msg.attachments.length > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: '1px solid rgba(11,12,14,0.06)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: SugarV3.muted,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Pièces jointes · {msg.attachments.length}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {msg.attachments.map((att, ai) => {
                      const canDownload = !!att.attachment_id
                      const downloading = downloadingKey === `${msg.id}-${att.attachment_id}`
                      return (
                        <button
                          key={`${msg.id}-att-${ai}`}
                          disabled={!canDownload || downloading}
                          onClick={() => canDownload && handleDownload(msg.id, att)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            borderRadius: 10,
                            background: SugarV3.cardSubtle,
                            fontSize: 12,
                            color: SugarV3.ink,
                            fontWeight: 600,
                            border: 0,
                            fontFamily: 'inherit',
                            textAlign: 'left',
                            cursor: canDownload && !downloading ? 'pointer' : 'default',
                            opacity: canDownload ? 1 : 0.6,
                            transition: 'background .15s',
                          }}
                          onMouseEnter={e => {
                            if (canDownload && !downloading) {
                              e.currentTarget.style.background = '#EDEFF3'
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = SugarV3.cardSubtle
                          }}
                          title={canDownload ? 'Télécharger' : 'Téléchargement indisponible'}
                        >
                          <SgIcon
                            name={downloading ? 'refresh' : 'download'}
                            size={14}
                            stroke={SugarV3.inkSoft}
                          />
                          <span style={{
                            flex: 1,
                            minWidth: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {att.filename}
                          </span>
                          <span style={{ fontSize: 11, color: SugarV3.muted, fontWeight: 500 }}>
                            {formatSize(att.size)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {lastMessage && onReply && (
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid rgba(11,12,14,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              background: SugarV3.cardSubtle,
            }}
          >
            <SgGhostPill onClick={onClose}>Fermer</SgGhostPill>
            <SgBlackPill
              onClick={() => onReply({
                messageId: lastMessage.id,
                subject: lastMessage.subject?.startsWith('Re:') ? lastMessage.subject : `Re: ${lastMessage.subject || '(Sans objet)'}`,
                to: lastMessage.from_address,
                provider,
              })}
              icon={<SgIcon name="send" size={13} stroke="#fff" sw={2} />}
            >
              Répondre
            </SgBlackPill>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
