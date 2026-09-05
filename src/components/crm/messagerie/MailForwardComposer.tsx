/**
 * Le composeur de transfert (README §3 « Transfert ») : un destinataire, une
 * note facultative, et le rappel du message d'origine.
 *
 * ⚠ Un transfert N'EST PAS une réponse : `mail-send` ne pose ni `In-Reply-To` ni
 * `References` dessus, sans quoi le destinataire le verrait tomber dans une
 * conversation à laquelle il n'a jamais participé. Rien à faire ici, sinon ne
 * pas le présenter comme une réponse.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseRecipients } from '@/hooks/useMailContactSearch'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces; originalFrom: string; originalSubject: string; busy: boolean
  onCancel: () => void; onSend: (to: { name: string | null; email: string }[], note: string) => void
}

/** Champ destinataires (adresses libres), note, et rappel de l'original. */
export function MailForwardComposer({ ms, originalFrom, originalSubject, busy, onCancel, onSend }: Props) {
  const { t } = useTranslation('messages')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const rcpts = parseRecipients(to)
  const can = rcpts.length > 0 && !busy
  return (
    <div style={{ borderRadius: 'var(--crm-radius-xl)', background: ms.elev, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', marginTop: 'var(--crm-space-4xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder={t('mail.compose.toPlaceholder')}
        aria-label={t('mail.compose.to')}
        autoFocus
        style={{
          borderRadius: PILL, padding: 'var(--crm-space-lg) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)',
          background: ms.card, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', outline: 'none',
        }}
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('mail.read.forwardNote')}
        aria-label={t('mail.read.forwardNote')}
        style={{
          minHeight: 70, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
          fontSize: 'var(--crm-text-md)', lineHeight: 1.6, background: ms.card, border: `1px solid ${ms.bord}`,
          color: ms.ink, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
        }}
      />
      <div style={{ border: `1px solid ${ms.bord2}`, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-md) var(--crm-space-2xl)', fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>
        {t('mail.read.forwardOriginal')} · {originalFrom} · {originalSubject}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)' }}>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('mail.actions.cancel')}
        </button>
        <button
          type="button"
          disabled={!can}
          onClick={() => onSend(rcpts, note)}
          style={{
            background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL,
            padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500,
            cursor: can ? 'pointer' : 'default', opacity: can ? 1 : 0.5, fontFamily: 'inherit', transition: MAIL_TRANSITION,
          }}
        >
          {busy ? t('mail.actions.sending') : t('mail.actions.forward')}
        </button>
      </div>
    </div>
  )
}
