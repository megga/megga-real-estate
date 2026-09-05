/**
 * « Nouveau message » (README §4) : destinataires suggérés depuis les contacts,
 * objet, corps, pièces jointes, et un brouillon LOCAL enregistré à la fermeture.
 *
 * ⚠ La signature n'est pas ajoutée ici : `mail-send` lit
 * `profiles.email_signature` et la pose en pied du MIME. La recopier la
 * doublerait dans tous les messages.
 *
 * ⛔ Le composant est monté À L'OUVERTURE et démonté à la fermeture (le plan le
 * gardait monté et semait ses champs dans un effet). Deux raisons : un
 * `setState` synchrone dans un effet est signalé par `react-hooks/set-state-in-
 * effect` et coûte un rendu de plus ; surtout, l'état de saisie DOIT repartir de
 * zéro d'une ouverture à l'autre, et un `useState` d'initialisation le garantit
 * sans qu'aucune dépendance ne puisse l'oublier.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { blobToBase64, documentToBase64, type AgencyDocument } from '@/hooks/useAgencyDocuments'
import { parseRecipients, useMailContactSearch } from '@/hooks/useMailContactSearch'
import type { MailDraft } from '@/hooks/useMailDrafts'
import type { MailSendInput } from '@/hooks/useMailSend'
import { fileSizeLabel } from '@/lib/mail/format'
import { MailAttachPopover } from './MailAttachPopover'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

/** Une pièce en attente d'envoi : soit un fichier local, soit un document du dossier. */
interface Pending {
  key: string; name: string; size: number; mimeType: string
  source: { kind: 'file'; file: File } | { kind: 'doc'; doc: AgencyDocument }
}

interface Props {
  ms: MailSurfaces
  draft: MailDraft | null
  sending: boolean
  error: string | null
  /** Rend le contenu à enregistrer en brouillon, ou `null` si rien n'a été saisi. */
  onClose: (draft: { to: string; subject: string; body: string } | null) => void
  onSend: (input: MailSendInput) => void
}

/** Largeur de la carte et hauteur minimale du corps (README §4). */
const LARGEUR = 600
const CORPS_MIN = 170
/** Voile plus clair que le défaut : la modale se pose SUR la liste, sans l'effacer. */
const VOILE = 0.12
/** Le champ « À » se ferme après le clic sur une suggestion, pas pendant. */
const DELAI_FERMETURE_SUGGESTIONS = 150
const NOM_PIECE_MAX = 190

const adresseSaisie = (a: { name: string | null; email: string }) => (a.name ? `${a.name} <${a.email}>` : a.email)

export function MailComposeModal({ ms, draft, sending, error, onClose, onSend }: Props) {
  const { t } = useTranslation('messages')
  const [to, setTo] = useState(() => (draft?.to ?? []).map(adresseSaisie).join(', '))
  const [subject, setSubject] = useState(() => draft?.subject ?? '')
  const [body, setBody] = useState(() => draft?.body_text ?? '')
  const [atts, setAtts] = useState<Pending[]>([])
  const [popover, setPopover] = useState(false)
  const [suggest, setSuggest] = useState(false)
  const lastTerm = to.split(/[,;]/).pop()?.trim() ?? ''
  const hits = useMailContactSearch(suggest ? lastTerm : '')
  const rcpts = useMemo(() => parseRecipients(to), [to])
  const can = rcpts.length > 0 && subject.trim().length > 0 && !sending
  const field = { background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  // ⚠ Pas de `filter` + cast : `Array.prototype.filter` ne rétrécit pas le type
  // de l'union, et le cast qui compensait affirmait une forme que rien ne
  // vérifie. Un `flatMap` conditionnel, lui, se narrow tout seul.
  const docsChoisis = useMemo(() => new Set(atts.flatMap((a) => (a.source.kind === 'doc' ? [a.source.doc.id] : []))), [atts])

  const submit = async () => {
    const attachments = await Promise.all(atts.map(async (a) => {
      if (a.source.kind === 'file') return { filename: a.name, mime_type: a.mimeType, base64: await blobToBase64(a.source.file) }
      const d = await documentToBase64(a.source.doc.storage_path)
      return { filename: a.name, mime_type: d.mimeType, base64: d.base64 }
    }))
    onSend({ kind: 'new', to: rcpts, subject: subject.trim(), body_text: body, attachments, draft_id: draft?.id })
  }
  const close = () => onClose(to.trim() || subject.trim() || body.trim() ? { to, subject, body } : null)

  return (
    <MailModalShell ms={ms} open onClose={close} width={LARGEUR} ariaLabel={t('mail.compose.title')} veil={VOILE}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* 600 et non le 700 de la maquette : le cliquet de grammaire y plafonne. */}
        <h2 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, margin: 0 }}>{t('mail.compose.title')}</h2>
        <MailCloseButton ms={ms} onClick={close} label={t('mail.actions.close')} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-4xl)' }}>
        <div style={{ position: 'relative' }}>
          <input
            value={to}
            onChange={(e) => { setTo(e.target.value); setSuggest(true) }}
            onBlur={() => setTimeout(() => setSuggest(false), DELAI_FERMETURE_SUGGESTIONS)}
            placeholder={t('mail.compose.toPlaceholder')}
            aria-label={t('mail.compose.to')}
            autoFocus
            style={{ ...field, borderRadius: PILL, padding: 'var(--crm-space-lg) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)' }}
          />
          {suggest && (hits.data?.length ?? 0) > 0 && (
            <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 310, background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xs)', boxShadow: ms.solidShadow }}>
              {(hits.data ?? []).map((h) => (
                <button
                  key={h.id}
                  type="button"
                  role="option"
                  // ⚠ `onMouseDown` et non `onClick` : le `blur` du champ part
                  // AVANT le clic et démonterait la liste sous le curseur.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const parts = to.split(/[,;]/)
                    parts.pop()
                    setTo([...parts.map((x) => x.trim()).filter(Boolean), `${h.first_name} ${h.last_name} <${h.email}>`].join(', ') + ', ')
                    setSuggest(false)
                  }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  {h.first_name} {h.last_name} <span style={{ color: ms.mut }}>· {h.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('mail.compose.subject')}
          aria-label={t('mail.compose.subject')}
          style={{ ...field, borderRadius: PILL, padding: 'var(--crm-space-lg) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)' }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label={t('mail.compose.body')}
          style={{ ...field, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', minHeight: CORPS_MIN, resize: 'vertical', fontSize: 'var(--crm-text-md)', lineHeight: 1.6 }}
        />

        {atts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
            {atts.map((a) => (
              <span key={a.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)', background: ms.elev, border: `1px solid ${ms.bord}` }}>
                <span style={{ maxWidth: NOM_PIECE_MAX, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{fileSizeLabel(a.size)}</span>
                <button
                  type="button"
                  aria-label={t('mail.compose.removeAttachment')}
                  onClick={() => setAtts((l) => l.filter((x) => x.key !== a.key))}
                  style={{ background: 'none', border: 'none', color: ms.txt3, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                >
                  <MEIcon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Le motif du serveur, tel quel : `attachment_too_large_outlook` dit plus
            qu'un « échec de l'envoi » qui laisserait chercher la cause. */}
        {error && <div role="alert" style={{ fontSize: 'var(--crm-text-xs)', color: ms.dangerText }}>{error}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)', position: 'relative' }}>
        <button
          type="button"
          onClick={() => setPopover((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, transition: MAIL_TRANSITION }}
        >
          <MEIcon name="paperclip" size={14} /> {t('mail.compose.attach')}
        </button>
        {popover && (
          <MailAttachPopover
            ms={ms}
            chosenDocIds={docsChoisis}
            onFiles={(files) => setAtts((l) => [...l, ...files.map((f) => ({ key: `f-${f.name}-${f.size}-${Date.now()}`, name: f.name, size: f.size, mimeType: f.type || 'application/octet-stream', source: { kind: 'file' as const, file: f } }))])}
            onToggleDoc={(d) => setAtts((l) => (
              l.some((a) => a.source.kind === 'doc' && a.source.doc.id === d.id)
                ? l.filter((a) => !(a.source.kind === 'doc' && a.source.doc.id === d.id))
                : [...l, { key: `d-${d.id}`, name: d.name, size: d.size_bytes, mimeType: 'application/octet-stream', source: { kind: 'doc' as const, doc: d } }]
            ))}
            onClose={() => setPopover(false)}
          />
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={close}
          style={{ border: `1px solid ${ms.bord3}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, background: 'transparent', color: ms.txt3, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {t('mail.actions.cancel')}
        </button>
        <button
          type="button"
          disabled={!can}
          onClick={() => void submit()}
          style={{ background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: can ? 'pointer' : 'default', opacity: can ? 1 : 0.5, fontFamily: 'inherit', transition: MAIL_TRANSITION }}
        >
          {sending ? t('mail.actions.sending') : t('mail.actions.send')}
        </button>
      </div>
    </MailModalShell>
  )
}
