/**
 * La lecture d'un fil (README §3) : retour, objet et pastille de libellé,
 * bandeau « Adresse non rattachée », bandeau d'expéditeur, corps assaini,
 * pièces jointes, messages suivants, composeurs, barre d'actions.
 *
 * ⚠ Le bandeau de rattachement ne s'affiche QUE si le fil n'a pas de contact :
 * c'est le seul endroit de l'écran d'où l'agent peut apprendre une adresse au
 * CRM (D11), et il disparaît dès que le rattachement est fait.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import type { MailAttachmentRow, MailMessageRow } from '@/hooks/useMailThread'
import type { MailLabel } from '@/hooks/useMailLabels'
import { displayAddress, fileSizeLabel, initialsOf, mailDateLabel } from '@/lib/mail/format'
import { MailBodyFrame } from './MailBodyFrame'
import { MailReplyComposer } from './MailReplyComposer'
import { MailForwardComposer } from './MailForwardComposer'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces; lang: string; boxEmail: string
  thread: MailThreadRow; messages: MailMessageRow[]; label: MailLabel | null
  composer: 'none' | 'reply' | 'forward'; sending: boolean; sendError: string | null
  onBack: () => void; onReply: () => void; onForward: () => void; onCancelComposer: () => void
  onSendReply: (text: string, inReplyTo: MailMessageRow) => void
  onSendForward: (to: { name: string | null; email: string }[], note: string, original: MailMessageRow) => void
  onArchive: () => void; onDelete: () => void
  onOpenAttachment: (a: MailAttachmentRow) => void
  onLinkContact: (email: string, name: string | null) => void
}

/** Pastille d'avatar de l'expéditeur (README §3 : cercle de 38 px). */
const AVATAR = 38

export function MailReader(p: Props) {
  const { t } = useTranslation('messages')
  const { ms } = p
  const first = p.messages[0]
  // Répondre et transférer visent le DERNIER message entrant, pas le premier du
  // fil : sur un échange long, le premier est souvent le nôtre.
  const inboundLast = [...p.messages].reverse().find((m) => m.direction === 'inbound') ?? first

  // ⛔ L'AFFORDANCE PRIMAIRE PORTE L'ACCENT AU REPOS (CLAUDE.md §3, décision du
  // 10 août 2026). Elle ne le prenait qu'au SURVOL et affichait l'encre au
  // repos : c'est la grammaire de Sugar, où « l'accent EST l'encre » — une
  // direction supprimée. Le prix n'est pas cosmétique : un bouton qui ne se
  // distingue qu'une fois la souris dessus ne se distingue ni au clavier, ni
  // au doigt, ni pour qui parcourt l'écran des yeux.
  //
  // La forme est celle de « Envoyer » du composer, à l'identique — deux
  // affordances primaires du même module ne peuvent pas avoir deux dessins.
  // La bordure reste à 1 px, accent sur accent, pour que la géométrie s'aligne
  // sur les boutons secondaires de la même barre ; `border: none` les
  // décalerait de 2 px.
  const btn = (label: string, onClick: () => void, opts: { primary?: boolean; danger?: boolean; right?: boolean } = {}) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${opts.primary ? ms.accent : ms.bord3}`, borderRadius: PILL,
        padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)',
        fontWeight: opts.primary ? 600 : 500,
        background: opts.primary ? ms.accent : 'transparent',
        color: opts.primary ? ms.accentInk : ms.txt3, cursor: 'pointer', fontFamily: 'inherit',
        marginLeft: opts.right ? 'auto' : undefined, transition: MAIL_TRANSITION,
      }}
      onMouseEnter={(e) => {
        if (opts.danger) { e.currentTarget.style.borderColor = ms.dangerText; e.currentTarget.style.color = ms.dangerText }
        // Le primaire porte déjà l'accent : le survol l'APPROFONDIT, il ne
        // l'introduit pas. Même idiome que les boutons accent du CRM, qui
        // modulent l'opacité plutôt que d'inventer une seconde teinte.
        else if (opts.primary) { e.currentTarget.style.opacity = '0.88' }
        else { e.currentTarget.style.borderColor = ms.ink; e.currentTarget.style.color = ms.ink }
      }}
      onMouseLeave={(e) => {
        if (opts.primary) { e.currentTarget.style.opacity = '1'; return }
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = ms.bord3
        e.currentTarget.style.color = ms.txt3
      }}
    >
      {label}
    </button>
  )

  // ⚠ Les pièces `is_inline` sont ÉCARTÉES de la barre : ce sont les images du
  // corps (`cid:`), que rien ne résout encore (maître §9) — les lister ferait
  // passer une signature en logo pour un document à classer.
  const attachmentChips = (m: MailMessageRow) => m.mail_attachments.filter((a) => !a.is_inline).length > 0 && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-2xl)' }}>
      {m.mail_attachments.filter((a) => !a.is_inline).map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => p.onOpenAttachment(a)}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', border: `1px solid ${ms.bord}`,
            background: ms.elev, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-md) var(--crm-space-2xl)',
            fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: ms.ink, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION,
          }}
        >
          <MEIcon name="paperclip" size={13} color={ms.accentText} /> {a.filename}{' '}
          <span style={{ color: ms.mut, fontSize: 'var(--crm-text-xs)' }}>{fileSizeLabel(a.size_bytes)}</span>
          {/* Déjà classée au dossier : la coche évite de la classer deux fois. */}
          {a.document_id && <MEIcon name="check" size={12} color={ms.successText} />}
        </button>
      ))}
    </div>
  )

  // Un fil sans message n'est pas une erreur : le cache du fil peut arriver vide
  // le temps que la synchronisation le remplisse.
  if (!first) return null
  const senderName = first.from_name || first.from_email || ''

  return (
    <div className="scrollbar-hide" style={{ padding: 'var(--crm-space-6xl) var(--crm-space-7xl) var(--crm-space-7xl)', overflowY: 'auto', minHeight: 0, flex: 1 }}>
      <button
        type="button"
        onClick={p.onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-md)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, transition: MAIL_TRANSITION }}
        onMouseEnter={(e) => { e.currentTarget.style.color = ms.ink }}
        onMouseLeave={(e) => { e.currentTarget.style.color = ms.txt3 }}
      >
        <MEIcon name="chevron-left" size={14} /> {t('mail.read.back')}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-2xl)' }}>
        {/* ⚠ 600 et non le 700 de la maquette : la grammaire MEGGA X plafonne à
            600 (cliquet `megga-x-grammar`), et l'objet est déjà le plus grand
            corps de l'écran. */}
        <h1 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, margin: 0 }}>{p.thread.subject || t('mail.row.noSubject')}</h1>
        {p.label && (
          <span style={{ borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: p.label.color, color: ms.pillInk(p.label.color) }}>
            {p.label.name}
          </span>
        )}
      </div>

      {!p.thread.contact_id && inboundLast.from_email && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) var(--crm-space-2xl)', border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-lg)', fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>
          {t('mail.read.unlinked', { email: inboundLast.from_email })}
          <button
            type="button"
            onClick={() => p.onLinkContact(inboundLast.from_email ?? '', inboundLast.from_name)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: ms.accentText, fontWeight: 600, fontSize: 'var(--crm-text-xs)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('mail.link.cta')}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', paddingBottom: 'var(--crm-space-2xl)', borderBottom: `1px solid ${ms.bord2}`, marginTop: 'var(--crm-space-2xl)' }}>
        <div aria-hidden style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>
          {initialsOf(first.from_name, first.from_email ?? '')}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{senderName}</div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.read.to', { box: p.boxEmail })}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>{mailDateLabel(first.sent_at, new Date(), p.lang)}</div>
      </div>

      <MailBodyFrame ms={ms} html={first.body_html} text={first.body_text} truncated={first.body_truncated} />
      {attachmentChips(first)}

      {p.messages.slice(1).map((m) => (
        <div key={m.id} style={{ borderRadius: 'var(--crm-radius-xl)', background: ms.elev, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', marginTop: 'var(--crm-space-2xl)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, marginBottom: 'var(--crm-space-md)' }}>
            {m.direction === 'outbound' ? `${t('mail.read.me')} → ${m.to.map(displayAddress).join(', ')}` : (m.from_name || m.from_email)} · {mailDateLabel(m.sent_at, new Date(), p.lang)}
          </div>
          {m.body_html
            ? <MailBodyFrame ms={ms} html={m.body_html} text={m.body_text} truncated={m.body_truncated} />
            : <div style={{ fontSize: 'var(--crm-text-md)', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: ms.txt2 }}>{m.body_text}</div>}
          {attachmentChips(m)}
        </div>
      ))}

      {p.composer === 'reply' && (
        <MailReplyComposer ms={ms} toName={inboundLast.from_name || inboundLast.from_email || ''} busy={p.sending} error={p.sendError} onCancel={p.onCancelComposer} onSend={(text) => p.onSendReply(text, inboundLast)} />
      )}
      {p.composer === 'forward' && (
        <MailForwardComposer ms={ms} originalFrom={inboundLast.from_name || inboundLast.from_email || ''} originalSubject={p.thread.subject ?? ''} busy={p.sending} error={p.sendError} onCancel={p.onCancelComposer} onSend={(to, note) => p.onSendForward(to, note, inboundLast)} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-7xl)' }}>
        {btn(t('mail.read.reply'), p.onReply, { primary: true })}
        {btn(t('mail.read.forward'), p.onForward)}
        {btn(p.thread.is_archived ? t('mail.ctx.unarchive') : t('mail.ctx.archive'), p.onArchive)}
        {btn(t('mail.ctx.delete'), p.onDelete, { danger: true, right: true })}
      </div>
    </div>
  )
}
