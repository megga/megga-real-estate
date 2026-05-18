// MEGGA CRM Sugar v3 — Card Emails Gmail/Outlook
// Affiche les derniers messages échangés avec le contact (lecture seule).
// Source : Edge Functions gmail-sync / outlook-mail-sync (action list_by_contact)
// agrégées via les hooks useGmailMessagesForContact / useOutlookMailMessagesForContact.

import { useMemo, useState } from 'react'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycGhostPill, KycSection } from '../primitives'
import { useGmail, useGmailMessagesForContact } from '@/hooks/useGmail'
import { useOutlookMail, useOutlookMailMessagesForContact } from '@/hooks/useOutlookMail'
import type { EmailMessage } from '@/hooks/useGmail'
import { EmailComposerModal } from './EmailComposerModal'
import { EmailThreadModal } from './EmailThreadModal'

interface Props {
  contactId: string
  contactEmail: string | null
}

interface DisplayMessage extends EmailMessage {
  provider: 'gmail' | 'outlook'
}

interface ReplyContext {
  messageId: string
  provider: 'gmail' | 'outlook'
  subject: string
  to: string
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  if (diffH < 24) return `il y a ${diffH} h`
  if (diffD < 7) return `il y a ${diffD} j`
  return date.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function CdEmailsCard({ contactId, contactEmail }: Props) {
  const gmail = useGmail()
  const outlookMail = useOutlookMail()
  const anyConnected = gmail.isConnected || outlookMail.isConnected

  const [reply, setReply] = useState<ReplyContext | null>(null)
  const [openThread, setOpenThread] = useState<DisplayMessage | null>(null)

  const gmailQuery = useGmailMessagesForContact(
    gmail.isConnected ? contactEmail : null,
    contactId,
  )
  const outlookQuery = useOutlookMailMessagesForContact(
    outlookMail.isConnected ? contactEmail : null,
    contactId,
  )

  const messages = useMemo<DisplayMessage[]>(() => {
    const merged: DisplayMessage[] = []
    for (const m of gmailQuery.data ?? []) merged.push({ ...m, provider: 'gmail' })
    for (const m of outlookQuery.data ?? []) merged.push({ ...m, provider: 'outlook' })
    merged.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    return merged.slice(0, 10)
  }, [gmailQuery.data, outlookQuery.data])

  const isLoading = gmailQuery.isLoading || outlookQuery.isLoading

  // ─── Cas 1 : aucune intégration mail connectée ───
  if (!anyConnected) {
    return (
      <KycSection
        title="Emails"
        eyebrow="Aucune boîte mail connectée"
      >
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: SugarV3.cardSubtle,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: SugarV3.card,
              display: 'grid',
              placeItems: 'center',
              color: SugarV3.muted,
              flexShrink: 0,
            }}
          >
            <SgIcon name="mail" size={18} stroke={SugarV3.muted} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: SugarV3.ink }}>
              Connectez Gmail ou Outlook Mail
            </div>
            <div style={{ fontSize: 12, color: SugarV3.muted, marginTop: 2, lineHeight: 1.5 }}>
              Pour voir ici les emails échangés avec ce contact, branchez votre boîte
              dans <em>Réglages → Intégrations</em>.
            </div>
          </div>
        </div>
      </KycSection>
    )
  }

  // ─── Cas 2 : contact sans email ───
  if (!contactEmail) {
    return (
      <KycSection title="Emails" eyebrow="Adresse manquante">
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: SugarV3.cardSubtle,
            fontSize: 13,
            color: SugarV3.muted,
            lineHeight: 1.6,
          }}
        >
          Ce contact n'a pas d'adresse email enregistrée. Ajoutez-en une pour activer
          la synchronisation Gmail / Outlook.
        </div>
      </KycSection>
    )
  }

  // ─── Cas 3 : loading ───
  if (isLoading) {
    return (
      <KycSection title="Emails" eyebrow="Chargement…">
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: SugarV3.cardSubtle,
            fontSize: 13,
            color: SugarV3.muted,
          }}
        >
          Récupération des derniers messages…
        </div>
      </KycSection>
    )
  }

  // ─── Cas 4 : zéro message ───
  if (messages.length === 0) {
    return (
      <KycSection
        title="Emails"
        eyebrow={`Adresse : ${contactEmail}`}
      >
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            background: SugarV3.cardSubtle,
            fontSize: 13,
            color: SugarV3.muted,
            lineHeight: 1.6,
          }}
        >
          Aucun email échangé avec cette adresse dans les 100 derniers messages.
        </div>
      </KycSection>
    )
  }

  // ─── Cas 5 : liste des messages ───
  return (
    <KycSection
      title="Emails"
      eyebrow={`${messages.length} message${messages.length > 1 ? 's' : ''} · ${contactEmail}`}
      action={
        <KycGhostPill
          size="sm"
          icon={<SgIcon name="refresh" size={13} stroke={SugarV3.inkSoft} />}
          onClick={() => {
            gmailQuery.refetch()
            outlookQuery.refetch()
          }}
        >
          Rafraîchir
        </KycGhostPill>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map(msg => (
          <div
            key={`${msg.provider}-${msg.id}`}
            onClick={() => setOpenThread(msg)}
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: SugarV3.cardSubtle,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              borderLeft: `3px solid ${msg.provider === 'gmail' ? '#EA4335' : '#0078D4'}`,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {msg.subject || '(Sans objet)'}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: SugarV3.muted,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {formatRelativeDate(msg.sent_at)}
              </div>
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: SugarV3.muted,
                fontWeight: 500,
              }}
            >
              <span style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 10 }}>
                {msg.provider}
              </span>
              {' · '}
              {msg.from_name || msg.from_address}
              {msg.is_unread && (
                <span
                  style={{
                    marginLeft: 8,
                    display: 'inline-block',
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: '#EF4444',
                    color: '#fff',
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                  }}
                >
                  Non lu
                </span>
              )}
            </div>
            {msg.snippet && (
              <div
                style={{
                  fontSize: 12.5,
                  color: SugarV3.inkSoft,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {msg.snippet}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setReply({
                    messageId: msg.id,
                    provider: msg.provider,
                    subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject || '(Sans objet)'}`,
                    to: msg.from_address,
                  })
                }}
                style={{
                  height: 28,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: 0,
                  background: '#fff',
                  color: SugarV3.ink,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: '0 1px 2px rgba(11,12,14,0.08)',
                }}
              >
                <SgIcon name="send" size={11} stroke={SugarV3.ink} sw={2} />
                Répondre
              </button>
            </div>
          </div>
        ))}
      </div>

      <EmailComposerModal
        open={!!reply}
        onClose={() => setReply(null)}
        defaultTo={reply?.to ?? ''}
        defaultSubject={reply?.subject ?? ''}
        replyToMessageId={reply?.messageId}
        forceProvider={reply?.provider}
      />

      <EmailThreadModal
        open={!!openThread}
        onClose={() => setOpenThread(null)}
        threadId={openThread?.thread_id ?? null}
        provider={openThread?.provider ?? null}
        markMessageIdAsRead={openThread?.is_unread ? openThread.id : undefined}
        onReply={(params) => {
          setOpenThread(null)
          setReply({
            messageId: params.messageId,
            provider: params.provider,
            subject: params.subject,
            to: params.to,
          })
        }}
      />
    </KycSection>
  )
}
