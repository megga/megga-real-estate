/**
 * Le composeur de réponse, sous le fil (README §3 « Composeur de réponse »).
 *
 * ⚠ Il ne prend PAS de destinataire : `mail-send` le déduit du message auquel on
 * répond (`reply_to`, à défaut `from_email`). Le demander ici l'exposerait à
 * être modifié — une réponse envoyée ailleurs que dans le fil n'est plus une
 * réponse.
 *
 * ⚠ La signature n'est pas ajoutée ici : `mail-send` la lit dans
 * `profiles.email_signature` et la pose en pied. La recopier la doublerait.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props { ms: MailSurfaces; toName: string; busy: boolean; error: string | null; onCancel: () => void; onSend: (text: string) => void }

/** Zone de saisie + « Annuler » / « Envoyer ». Le texte vit ici, pas dans l'état d'écran. */
export function MailReplyComposer({ ms, toName, busy, error, onCancel, onSend }: Props) {
  const { t } = useTranslation('messages')
  const [text, setText] = useState('')
  const can = text.trim().length > 0 && !busy
  return (
    <div style={{ borderRadius: 'var(--crm-radius-xl)', background: ms.elev, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', marginTop: 'var(--crm-space-4xl)' }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, marginBottom: 'var(--crm-space-md)' }}>
        {t('mail.read.replyTo')}{' '}
        {/* ⚠ `<span>` et non `<b>` : le preflight Tailwind rend `bolder`, qui vaut
            700 sur un parent à 500 — une graisse que la source ne déclare pas et
            que le cliquet de grammaire ne pourrait pas voir. */}
        <span style={{ color: ms.ink, fontWeight: 600 }}>{toName}</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        aria-label={t('mail.read.replyBody')}
        style={{
          width: '100%', minHeight: 110, boxSizing: 'border-box', borderRadius: 'var(--crm-radius-lg)',
          padding: 'var(--crm-space-lg) var(--crm-space-2xl)', fontSize: 'var(--crm-text-md)', lineHeight: 1.6,
          background: ms.card, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-md)' }}>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('mail.actions.cancel')}
        </button>
        <button
          type="button"
          disabled={!can}
          onClick={() => onSend(text)}
          style={{
            background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL,
            padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500,
            cursor: can ? 'pointer' : 'default', opacity: can ? 1 : 0.5, fontFamily: 'inherit', transition: MAIL_TRANSITION,
          }}
        >
          {busy ? t('mail.actions.sending') : t('mail.actions.send')}
        </button>
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 'var(--crm-space-md)', fontSize: 'var(--crm-text-xs)', color: ms.dangerText }}>
          {error}
        </div>
      )}
    </div>
  )
}
