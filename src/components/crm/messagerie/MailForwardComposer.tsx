/**
 * Le composeur de transfert (README §3 « Transfert ») : ses destinataires — en capsules,
 * comme « Nouveau message » —, une note facultative, et le rappel du message d'origine.
 *
 * ⚠ Un transfert N'EST PAS une réponse : `mail-send` ne pose ni `In-Reply-To` ni
 * `References` dessus, sans quoi le destinataire le verrait tomber dans une
 * conversation à laquelle il n'a jamais participé. Rien à faire ici, sinon ne
 * pas le présenter comme une réponse.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adresseValide, ajouterDestinataires, decouperDestinataires } from '@/lib/mail/compose'
import type { MailAddress } from '@/lib/mail/format'
import { MailRecipientField } from './MailRecipientField'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces; originalFrom: string; originalSubject: string; busy: boolean
  /** ⛔ L'échec d'un envoi doit se voir ICI : le composeur reste ouvert avec le texte. */
  error: string | null
  onCancel: () => void; onSend: (to: MailAddress[], note: string) => void
}

/** Champ destinataires, note, et rappel de l'original. */
export function MailForwardComposer({ ms, originalFrom, originalSubject, busy, error, onCancel, onSend }: Props) {
  const { t } = useTranslation('messages')
  const [to, setTo] = useState<MailAddress[]>([])
  const [texte, setTexte] = useState('')
  const [note, setNote] = useState('')
  // Les capsules, plus l'adresse tapée qu'on n'a pas validée : « Transférer » cliqué juste
  // après la frappe part avec elle.
  const rcpts = ajouterDestinataires(to, decouperDestinataires(texte))
  const can = rcpts.length > 0 && rcpts.every((a) => adresseValide(a.email)) && !busy
  // Comme « Nouveau message » : seules les capsules en alerte s'annoncent, pas la frappe.
  const invalides = to.filter((a) => !adresseValide(a.email)).length
  return (
    <div style={{ borderRadius: 'var(--crm-radius-xl)', background: ms.elev, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', marginTop: 'var(--crm-space-4xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
      <MailRecipientField
        ms={ms}
        prefixe={t('mail.compose.toShort')}
        libelle={t('mail.compose.to')}
        valeur={to}
        texte={texte}
        onChange={(liste, reste) => { setTo(liste); setTexte(reste) }}
        autoFocus
        placeholder={t('mail.compose.toPlaceholder')}
        fond={ms.card}
      />
      {invalides > 0 && <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.dangerText }}>{t('mail.compose.invalidHint', { count: invalides })}</div>}
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
      {error && (
        <div role="alert" style={{ marginTop: 'var(--crm-space-md)', fontSize: 'var(--crm-text-xs)', color: ms.dangerText }}>
          {error}
        </div>
      )}
    </div>
  )
}
