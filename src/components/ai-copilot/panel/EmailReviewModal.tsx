// Modal de revue-et-envoi d'un email rédigé par MEGGA AI (Partie 2, chantier 4).
// Human-in-the-loop : l'agent RELIT et ÉDITE (destinataire, objet, corps) puis
// envoie lui-même — jamais d'envoi auto (règle CLAUDE.md). Le destinataire est
// pré-rempli depuis la fiche contact ouverte (route), sinon l'agent le saisit.

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { useSendAgentEmail } from '@/hooks/useSendAgentEmail'
import { CpIcon } from './panelIcons'
import { revueKit, type AiPalette } from './aiPanel'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export interface EmailDraft {
  subject: string
  body: string
}

interface EmailReviewModalProps {
  open: boolean
  sp: AiPalette
  dark: boolean
  draft: EmailDraft
  /** Contact de la route (fiche ouverte) → pré-remplit le destinataire. */
  contactId?: string | null
  onClose: () => void
  onSent: () => void
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

export default function EmailReviewModal({ open, sp, dark, draft, contactId, onClose, onSent }: EmailReviewModalProps) {
  const toast = useToast()
  const refPiegeFocus = useFocusTrap(open, onClose)
  const sendEmail = useSendAgentEmail()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  // Planification (Resend `scheduled_at`, ≤ 30 j). scheduleMode off = envoi immédiat.
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')

  // Ré-initialise les champs à chaque ouverture / changement de brouillon.
  useEffect(() => {
    if (open) { setSubject(draft.subject); setBody(draft.body); setScheduleMode(false); setScheduleAt('') }
  }, [open, draft.subject, draft.body])

  // Pré-remplissage du destinataire depuis la fiche contact (si route contact).
  const { data: contact } = useQuery({
    queryKey: ['ai-email-contact', contactId],
    enabled: open && !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('email, first_name, last_name')
        .eq('id', contactId as string)
        .single()
      if (error) throw error
      return data as { email: string | null; first_name: string | null; last_name: string | null }
    },
  })
  useEffect(() => {
    if (open && contact?.email) setTo(contact.email)
  }, [open, contact?.email])

  if (!open) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const now = new Date()
  const minAt = toLocalInput(new Date(now.getTime() + 60_000))
  const maxAt = toLocalInput(new Date(now.getTime() + 30 * 86_400_000))
  const scheduleDate = scheduleAt ? new Date(scheduleAt) : null
  const scheduleValid = !!scheduleDate && scheduleDate.getTime() > now.getTime() && scheduleDate.getTime() <= now.getTime() + 30 * 86_400_000
  const scheduling = scheduleMode && scheduleValid

  const canSend = isEmail(to) && subject.trim().length > 0 && body.trim().length > 0 && !sendEmail.isPending && (!scheduleMode || scheduleValid)

  const send = async () => {
    if (!canSend) return
    const scheduledAt = scheduling && scheduleDate ? scheduleDate.toISOString() : undefined
    try {
      await sendEmail.mutateAsync({ to: to.trim(), subject: subject.trim(), body, scheduledAt })
      if (scheduledAt && scheduleDate) {
        toast.success('Envoi programmé', { description: scheduleDate.toLocaleString('fr-CH', { dateStyle: 'medium', timeStyle: 'short' }), duration: 3000 })
      } else {
        toast.success('Email envoyé', { description: to.trim(), duration: 2600 })
      }
      onSent()
      onClose()
    } catch (e) {
      toast.error("Échec de l'envoi", { description: e instanceof Error ? e.message : 'Réessayez.' })
    }
  }

  const K = revueKit(sp)

  const inputStyle = {
    width: '100%', border: K.champ.border, outline: 'none', background: K.champ.background,
    borderRadius: 12, padding: '11px 13px', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)',
    color: sp.ink, boxSizing: 'border-box',
  } as const

  return createPortal(
    <div
      onClick={onClose}
      style={{
        ...K.scrim,
        animation: 'emrFade .2s ease both', padding: 20,
      }}
    >
      <style>{`@keyframes emrFade{from{opacity:0}to{opacity:1}}@keyframes emrUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        ref={refPiegeFocus}
        role="dialog"
        aria-modal="true"
        aria-label="Envoyer l'email"
        style={{
          width: 'min(520px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: K.carte.background, borderRadius: K.carte.borderRadius, padding: '20px 22px 18px',
          boxShadow: K.carte.boxShadow,
          display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'emrUp .28s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={K.titre}>Envoyer l'email</span>
          <button onClick={onClose} title="Fermer" aria-label="Fermer" style={{
            width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer',
            background: 'transparent', display: 'grid', placeItems: 'center',
          }}>
            <CpIcon name="close" size={18} color={sp.sub} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={K.libelle}>À</span>
          <input
            type="email" value={to} onChange={(e) => setTo(e.target.value)}
            placeholder="destinataire@email.ch" style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={K.libelle}>Objet</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={K.libelle}>Message</span>
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)} rows={9}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, minHeight: 160 }}
          />
        </div>

        {/* Planification (facultative) — Resend `scheduled_at` */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setScheduleMode((v) => !v); if (!scheduleMode && !scheduleAt) setScheduleAt(minAt) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, border: 0, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: scheduleMode ? 600 : 500, color: scheduleMode ? sp.ink : sp.sub,
              background: 'transparent', padding: '4px 0',
            }}>
            <span style={{
              width: 18, height: 18, borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0,
              background: scheduleMode ? sp.accent : 'transparent',
              boxShadow: scheduleMode ? 'none' : `inset 0 0 0 1.5px ${sp.sub}`,
            }}>
              {scheduleMode && <CpIcon name="check" size={12} color={sp.onAccent} sw={2.6} />}
            </span>
            Programmer l'envoi
          </button>
          {scheduleMode && (
            <input
              type="datetime-local" value={scheduleAt} min={minAt} max={maxAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: 190 }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
          <span style={K.aide}>
            {scheduling ? 'Programmé — modifiable avant l’heure d’envoi.' : "Vous relisez avant l'envoi — rien n'est envoyé automatiquement."}
          </span>
          <button onClick={onClose} style={{
            height: 40, padding: '0 18px', borderRadius: 999, border: 0, cursor: 'pointer',
            ...K.boutonFantome,
            background: dark ? 'rgba(255,255,255,0.06)' : '#F1F4F8',
          }}>Annuler</button>
          <button onClick={send} disabled={!canSend} style={{
            height: 40, padding: '0 20px', borderRadius: 999, border: 0,
            cursor: canSend ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
            background: canSend ? sp.accent : sp.fillStrong,
            color: canSend ? sp.onAccent : sp.sub, display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <CpIcon name={scheduleMode ? 'calendar' : 'send'} size={15} color={canSend ? sp.onAccent : sp.sub} sw={2} />
            {sendEmail.isPending ? '…' : scheduleMode ? 'Programmer' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
