// MEGGA CRM Sugar v3 — Compose Email Modal (Phase 2 mail)
// Plein écran modal pour rédiger un email depuis la fiche contact.
// Auto-append signature email (table profiles.email_signature) côté Edge Function.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { SgBlackPill, SgGhostPill, SgCircleBtn } from '../primitives'
import { useGmail } from '@/hooks/useGmail'
import { useOutlookMail } from '@/hooks/useOutlookMail'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

interface Props {
  open: boolean
  onClose: () => void
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  replyToMessageId?: string
  /** Force le provider d'envoi. Si absent, on prend le premier connecté (gmail prio). */
  forceProvider?: 'gmail' | 'outlook'
}

export function EmailComposerModal({
  open,
  onClose,
  defaultTo,
  defaultSubject,
  defaultBody,
  replyToMessageId,
  forceProvider,
}: Props) {
  const { user } = useAuth()
  const gmail = useGmail()
  const outlookMail = useOutlookMail()

  // Auto-pick provider : Gmail si connecté, sinon Outlook, sinon aucun
  const availableProvider: 'gmail' | 'outlook' | null = forceProvider
    ? (forceProvider === 'gmail' && gmail.isConnected) || (forceProvider === 'outlook' && outlookMail.isConnected)
      ? forceProvider
      : null
    : gmail.isConnected
      ? 'gmail'
      : outlookMail.isConnected
        ? 'outlook'
        : null

  const [to, setTo] = useState(defaultTo ?? '')
  const [subject, setSubject] = useState(defaultSubject ?? '')
  const [body, setBody] = useState(defaultBody ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentToast, setSentToast] = useState(false)

  // Récupère la signature du profil pour afficher un aperçu
  const { data: signature } = useQuery({
    queryKey: ['profile-signature', user?.id],
    queryFn: async (): Promise<string | null> => {
      if (!user?.id) return null
      const { data } = await supabase
        .from('profiles')
        .select('email_signature')
        .eq('id', user.id)
        .single()
      return data?.email_signature ?? null
    },
    enabled: !!user?.id && open,
    staleTime: 5 * 60 * 1000,
  })

  // Reset les champs à chaque ouverture (sauf défauts fournis par le parent)
  useEffect(() => {
    if (open) {
      setTo(defaultTo ?? '')
      setSubject(defaultSubject ?? '')
      setBody(defaultBody ?? '')
      setError(null)
    }
  }, [open, defaultTo, defaultSubject, defaultBody])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSend = async () => {
    if (!availableProvider) {
      setError('Aucune boîte mail connectée. Branche Gmail ou Outlook dans Réglages → Intégrations.')
      return
    }
    if (!to.trim()) {
      setError('Destinataire manquant.')
      return
    }
    if (!subject.trim()) {
      setError('Objet manquant.')
      return
    }
    if (!body.trim()) {
      setError('Le message est vide.')
      return
    }

    setSending(true)
    setError(null)
    try {
      const params = {
        to: to.split(',').map(s => s.trim()).filter(Boolean),
        subject: subject.trim(),
        body_text: body,
        reply_to_message_id: replyToMessageId,
      }
      if (availableProvider === 'gmail') {
        await gmail.sendMessage(params)
      } else {
        await outlookMail.sendMessage(params)
      }
      setSentToast(true)
      setTimeout(() => {
        setSentToast(false)
        onClose()
      }, 1200)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(msg)
    } finally {
      setSending(false)
    }
  }

  const providerLabel = availableProvider === 'gmail'
    ? `Gmail · ${gmail.gmailEmail ?? ''}`
    : availableProvider === 'outlook'
      ? `Outlook · ${outlookMail.outlookEmail ?? ''}`
      : 'Aucune boîte connectée'

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
        animation: 'sgEcFadeIn .2s ease both',
        fontFamily: SugarV3.font,
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes sgEcFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sgEcScaleIn {
          from { opacity: 0; transform: scale(.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes sgEcToastIn {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SugarV3.card,
          borderRadius: 24,
          width: 680,
          maxWidth: '94%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(11,12,14,0.30)',
          animation: 'sgEcScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${'rgba(11,12,14,0.08)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: availableProvider === 'gmail' ? '#FFE9E5' : availableProvider === 'outlook' ? '#E5EFFB' : SugarV3.cardSubtle,
              display: 'grid',
              placeItems: 'center',
              color: availableProvider === 'gmail' ? '#EA4335' : availableProvider === 'outlook' ? '#0078D4' : SugarV3.muted,
              flexShrink: 0,
            }}
          >
            <SgIcon name="mail" size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: SugarV3.ink, letterSpacing: -0.3 }}>
              Nouveau message
            </div>
            <div style={{ fontSize: 11.5, color: SugarV3.muted, fontWeight: 500, marginTop: 1 }}>
              Envoyé via {providerLabel}
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
            gap: 12,
          }}
        >
          {!availableProvider && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: '#FEF3C7',
                color: '#92400E',
                fontSize: 12.5,
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              Aucune boîte mail n'est connectée. Va dans <em>Réglages → Intégrations</em>{' '}
              pour brancher Gmail ou Outlook Mail.
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 50,
                fontSize: 12,
                fontWeight: 700,
                color: SugarV3.muted,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              À
            </span>
            <input
              type="text"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="nom@exemple.com (sépare par virgules pour plusieurs)"
              style={{
                flex: 1,
                height: 44,
                padding: '0 14px',
                borderRadius: 10,
                border: `1px solid ${'rgba(11,12,14,0.08)'}`,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                color: SugarV3.ink,
                background: '#fff',
              }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 50,
                fontSize: 12,
                fontWeight: 700,
                color: SugarV3.muted,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              Objet
            </span>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Sujet du message"
              style={{
                flex: 1,
                height: 44,
                padding: '0 14px',
                borderRadius: 10,
                border: `1px solid ${'rgba(11,12,14,0.08)'}`,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                color: SugarV3.ink,
                background: '#fff',
              }}
            />
          </label>

          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Écris ton message…"
            rows={10}
            style={{
              padding: 14,
              borderRadius: 10,
              border: `1px solid ${'rgba(11,12,14,0.08)'}`,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              color: SugarV3.ink,
              background: '#fff',
              resize: 'vertical',
              minHeight: 180,
              lineHeight: 1.6,
            }}
          />

          {signature && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: SugarV3.cardSubtle,
                borderLeft: `3px solid ${SugarV3.ink}`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: SugarV3.muted,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Signature auto-ajoutée
              </div>
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  color: SugarV3.inkSoft,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {signature}
              </pre>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: '#FEE2E2',
                color: '#991B1B',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${'rgba(11,12,14,0.08)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            background: SugarV3.cardSubtle,
          }}
        >
          <SgGhostPill onClick={onClose}>Annuler</SgGhostPill>
          <SgBlackPill
            onClick={handleSend}
            icon={
              <SgIcon
                name={sending ? 'refresh' : 'send'}
                size={14}
                stroke="#fff"
                sw={2}
              />
            }
          >
            {sending ? 'Envoi…' : 'Envoyer'}
          </SgBlackPill>
        </div>
      </div>

      {/* Toast succès */}
      {sentToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#10B981',
            color: '#fff',
            padding: '14px 26px',
            borderRadius: 999,
            fontSize: 13.5,
            fontWeight: 700,
            boxShadow: '0 10px 30px rgba(16,185,129,0.35)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'sgEcToastIn .25s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          <SgIcon name="check" size={15} stroke="#fff" sw={2.4} />
          Message envoyé
        </div>
      )}
    </div>,
    document.body,
  )
}
