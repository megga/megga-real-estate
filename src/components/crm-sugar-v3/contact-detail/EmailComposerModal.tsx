// MEGGA CRM Sugar v3 — Compose Email Modal (Phase 2 mail)
// Plein écran modal pour rédiger un email depuis la fiche contact.
// Auto-append signature email (table profiles.email_signature) côté Edge Function.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { SgBlackPill, SgGhostPill, SgCircleBtn } from '../primitives'
import { useGmail } from '@/hooks/useGmail'
import { useOutlookMail } from '@/hooks/useOutlookMail'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import type { SendMessageAttachment } from '@/hooks/useGmail'
import { EMAIL_TEMPLATES, interpolateTemplate, type EmailTemplate } from '@/lib/email-templates'

// Limite raisonnable côté client. Gmail accepte 25 Mo total / message, Outlook 150 Mo.
// On garde la plus stricte par défaut + une marge pour le base64 (overhead +33%).
const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024 // 18 MB par fichier
const MAX_TOTAL_BYTES = 24 * 1024 * 1024     // 24 MB total avant base64 (≈ 32 MB après)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Convertit un File en SendMessageAttachment (base64 standard).
 * Utilise FileReader.readAsDataURL pour récupérer un Data-URL, dont on extrait
 * la partie base64 après la virgule.
 */
async function fileToAttachment(file: File): Promise<SendMessageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',', 2)[1] ?? ''
      resolve({
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        data: base64,
      })
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

interface TemplateContext {
  contactFirstName?: string | null
  contactLastName?: string | null
  contactEmail?: string | null
  propertyTitle?: string | null
  propertyAddress?: string | null
  visitDate?: string | null
  visitTime?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  replyToMessageId?: string
  /** Force le provider d'envoi. Si absent, on prend le premier connecté (gmail prio). */
  forceProvider?: 'gmail' | 'outlook'
  /** Contexte pour interpoler les templates (variables {{contact.first_name}} etc.) */
  templateContext?: TemplateContext
}

export function EmailComposerModal({
  open,
  onClose,
  defaultTo,
  defaultSubject,
  defaultBody,
  replyToMessageId,
  forceProvider,
  templateContext,
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
  const [attachments, setAttachments] = useState<Array<SendMessageAttachment & { sizeBytes: number }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  /** Applique un template au composer en interpolant le contexte fourni. */
  const applyTemplate = (tpl: EmailTemplate) => {
    const interpolationCtx = {
      contact: {
        first_name: templateContext?.contactFirstName ?? '',
        last_name: templateContext?.contactLastName ?? '',
        email: templateContext?.contactEmail ?? '',
      },
      property: {
        title: templateContext?.propertyTitle ?? '',
        address: templateContext?.propertyAddress ?? '',
      },
      visit: {
        date: templateContext?.visitDate ?? '',
        time: templateContext?.visitTime ?? '',
      },
    }
    setSubject(interpolateTemplate(tpl.subject, interpolationCtx))
    setBody(interpolateTemplate(tpl.body, interpolationCtx))
    setTemplatesOpen(false)
  }

  // Récupère la signature du profil pour afficher un aperçu.
  // enabled ne dépend QUE de user?.id (pas de `open`) pour stabiliser l'ordre
  // des hooks de useQuery — sinon React Query change ses subscriptions internes
  // quand `enabled` flippe, ce qui décale l'ordre des hooks des composants
  // mountés.
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
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Reset les champs à chaque ouverture (sauf défauts fournis par le parent)
  useEffect(() => {
    if (open) {
      setTo(defaultTo ?? '')
      setSubject(defaultSubject ?? '')
      setBody(defaultBody ?? '')
      setError(null)
      setAttachments([])
    }
  }, [open, defaultTo, defaultSubject, defaultBody])

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const newOnes: Array<SendMessageAttachment & { sizeBytes: number }> = []
    const totalCurrent = attachments.reduce((s, a) => s + a.sizeBytes, 0)
    let runningTotal = totalCurrent
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`"${file.name}" dépasse la limite de ${formatSize(MAX_ATTACHMENT_BYTES)} par fichier.`)
        continue
      }
      if (runningTotal + file.size > MAX_TOTAL_BYTES) {
        setError(`Limite totale ${formatSize(MAX_TOTAL_BYTES)} atteinte — "${file.name}" ignoré.`)
        break
      }
      try {
        const att = await fileToAttachment(file)
        newOnes.push({ ...att, sizeBytes: file.size })
        runningTotal += file.size
      } catch (e) {
        setError(`Échec de la lecture de "${file.name}".`)
        console.error('[EmailComposerModal] file read error', e)
      }
    }
    if (newOnes.length > 0) {
      setAttachments(prev => [...prev, ...newOnes])
      // Ne pas écraser l'erreur si elle vient d'être set par une limite dépassée
    }
    // Reset l'input pour permettre de re-uploader le même fichier
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

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
        attachments: attachments.map(({ filename, mime_type, data }) => ({
          filename,
          mime_type,
          data,
        })),
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
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setTemplatesOpen(v => !v)}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 999,
                border: 0,
                background: SugarV3.cardSubtle,
                color: SugarV3.ink,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Insérer un modèle d'email"
            >
              <SgIcon name="sparkle" size={12} stroke={SugarV3.ink} sw={2} />
              Modèles
              <SgIcon name="chevDown" size={11} stroke={SugarV3.ink} sw={2.2} />
            </button>
            {templatesOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: 340,
                  maxHeight: 380,
                  overflow: 'auto',
                  background: '#fff',
                  borderRadius: 14,
                  boxShadow: '0 16px 40px rgba(11,12,14,0.20), 0 4px 12px rgba(11,12,14,0.08)',
                  border: '1px solid rgba(11,12,14,0.08)',
                  zIndex: 20,
                  padding: 6,
                }}
              >
                {EMAIL_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      border: 0,
                      borderRadius: 10,
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = SugarV3.cardSubtle }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: SugarV3.ink,
                        marginBottom: 2,
                      }}
                    >
                      {tpl.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: SugarV3.muted,
                        fontWeight: 500,
                        lineHeight: 1.4,
                      }}
                    >
                      {tpl.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
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

          {/* Attachments — drop zone + liste */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={e => handleAddFiles(e.target.files)}
              style={{ display: 'none' }}
            />
            {attachments.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px dashed rgba(11,12,14,0.18)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: SugarV3.muted,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <SgIcon name="plus" size={13} stroke={SugarV3.muted} sw={2.2} />
                Ajouter une pièce jointe
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: SugarV3.muted,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Pièces jointes · {attachments.length}</span>
                  <span>
                    {formatSize(attachments.reduce((s, a) => s + a.sizeBytes, 0))} / {formatSize(MAX_TOTAL_BYTES)}
                  </span>
                </div>
                {attachments.map((att, idx) => (
                  <div
                    key={`${att.filename}-${idx}`}
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
                    }}
                  >
                    <SgIcon name="file" size={13} stroke={SugarV3.inkSoft} />
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
                      {formatSize(att.sizeBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      title="Retirer"
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        border: 0,
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        color: SugarV3.muted,
                      }}
                    >
                      <SgIcon name="close" size={11} stroke={SugarV3.muted} sw={2.2} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 999,
                    border: 0,
                    background: SugarV3.cardSubtle,
                    color: SugarV3.ink,
                    fontFamily: 'inherit',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    alignSelf: 'flex-start',
                  }}
                >
                  <SgIcon name="plus" size={11} stroke={SugarV3.ink} sw={2.2} />
                  Ajouter encore
                </button>
              </div>
            )}
          </div>

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
