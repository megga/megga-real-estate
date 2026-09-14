/**
 * Le menu d'une ligne, au clic droit (README §2 « Menu contextuel de ligne ») :
 * ouvrir, lu / non lu, suivre, archiver, signaler comme spam, supprimer, puis le
 * classement par libellé.
 *
 * ⚠ Un fil au spam n'offre que ce qui a un sens pour du spam : le lire, le rendre à la
 * Réception, le supprimer. Le suivre, l'archiver ou le classer le ferait disparaître de
 * dossiers qui excluent le spam : le geste semblerait n'avoir rien fait.
 *
 * ⚠ Les libellés sont EXCLUSIFS (un seul par fil, D7) : recliquer celui du fil
 * le retire (`onLabel(null)`) au lieu d'en ajouter un second.
 *
 * ⚠ `position: fixed` porté sur `document.body` — la liste défile dans son
 * propre conteneur, un menu rendu dedans serait coupé. z-index 320, et un voile
 * transparent à 319 attrape le clic ailleurs : sans lui, un clic sur une ligne
 * ouvrirait le fil EN MÊME TEMPS qu'il ferme le menu.
 */
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import type { MailLabel } from '@/hooks/useMailLabels'
import type { MailThreadAction } from '@/hooks/useMailActions'
import { MAIL_TRANSITION, type MailSurfaces } from './mailTokens'
import { useFermetureMenu } from '@/hooks/useFermetureMenu'

interface Props {
  ms: MailSurfaces
  x: number
  y: number
  row: MailThreadRow
  labels: MailLabel[]
  onClose: () => void
  onOpen: () => void
  onAction: (a: MailThreadAction) => void
  onDelete: () => void
  /** « Signaler comme spam » ou « Ce n'est pas un spam », selon le fil. */
  onSpam: () => void
  onLabel: (id: string | null) => void
}

const LARGEUR = 220
const MARGE_DROITE = 240
const MARGE_BAS = 352

export function MailContextMenu({ ms, x, y, row, labels, onClose, onOpen, onAction, onDelete, onSpam, onLabel }: Props) {
  const { t } = useTranslation('messages')
  const ref = useRef<HTMLDivElement>(null)
  // Clic dehors et Échap ; armé au tick suivant — voir `useFermetureMenu`.
  useFermetureMenu(ref, onClose)

  const item = (label: string, fn: () => void, opts: { danger?: boolean; dot?: string } = {}) => (
    <button
      key={label}
      type="button"
      role="menuitem"
      onClick={() => { fn(); onClose() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', textAlign: 'left',
        padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)',
        background: 'transparent', border: 'none', color: opts.danger ? ms.dangerText : ms.ink,
        fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {opts.dot && <span style={{ width: 9, height: 9, borderRadius: 'var(--crm-radius-2xs)', background: opts.dot, flexShrink: 0 }} />}
      {label}
    </button>
  )

  return createPortal(
    <>
      <div onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 319 }} />
      <div
        ref={ref}
        role="menu"
        style={{
          position: 'fixed', left: Math.min(x, window.innerWidth - MARGE_DROITE), top: Math.min(y, window.innerHeight - MARGE_BAS),
          zIndex: 320, minWidth: LARGEUR, background: ms.solid, border: `1px solid ${ms.solidBorder}`,
          borderRadius: 'var(--crm-radius-xl)', boxShadow: ms.solidShadow, padding: 'var(--crm-space-2xs)',
          fontFamily: 'var(--crm-font)',
        }}
      >
        {item(t('mail.ctx.open'), onOpen)}
        {item(row.is_read ? t('mail.ctx.markUnread') : t('mail.ctx.markRead'), () => onAction(row.is_read ? 'mark_unread' : 'mark_read'))}
        {!row.is_spam && item(row.is_starred ? t('mail.ctx.unstar') : t('mail.ctx.star'), () => onAction(row.is_starred ? 'unstar' : 'star'))}
        {!row.is_spam && item(row.is_archived ? t('mail.ctx.unarchive') : t('mail.ctx.archive'), () => onAction(row.is_archived ? 'unarchive' : 'archive'))}
        {item(row.is_spam ? t('mail.ctx.notSpam') : t('mail.ctx.spam'), onSpam)}
        {item(t('mail.ctx.delete'), onDelete, { danger: true })}
        {!row.is_spam && (
          <>
            <div style={{ height: 1, background: ms.bord2, margin: 'var(--crm-space-2xs) 0' }} />
            <div style={{ padding: 'var(--crm-space-2xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>
              {t('mail.labels.title')}
            </div>
            {labels.map((l) => item(l.name, () => onLabel(row.label_id === l.id ? null : l.id), { dot: l.color }))}
          </>
        )}
      </div>
    </>,
    document.body,
  )
}
