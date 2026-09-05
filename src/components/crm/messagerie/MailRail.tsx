/**
 * La colonne gauche de l'écran (README §1) : sélecteur de boîte, « Nouveau
 * message », les cinq dossiers, puis les libellés de l'agence.
 *
 * ⚠ Les DOSSIERS sont des REQUÊTES, pas des colonnes (plan maître D8) : cliquer
 * « Archivé » ne déplace rien, il change le prédicat de `mail_list_threads`. Le
 * libellé, lui, est un filtre ADDITIF qui se désélectionne en le recliquant.
 *
 * ⚠ L'élément ACTIF porte l'accent (CLAUDE.md §3, décision du 10 août 2026) —
 * ici par sa surface creusée et son encre pleine, l'accent restant réservé au
 * bouton primaire et aux compteurs de non-lus, qui sont des APLATS.
 */
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { MailAccount } from '@/hooks/useMailAccounts'
import type { MailLabel } from '@/hooks/useMailLabels'
import type { MailFolderCounts } from '@/hooks/useMailThreads'
import type { MailFolder } from './mailState'
import { MailBoxSelector } from './MailBoxSelector'
import { MailLabelCreator } from './MailLabelCreator'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  accounts: MailAccount[]
  unread: Record<string, number>
  accountId: string | null
  boxOpen: boolean
  onToggleBox: () => void
  onCloseBox: () => void
  onSelectAccount: (id: string) => void
  onAddAccount: () => void
  onCompose: () => void
  folder: MailFolder
  onFolder: (f: MailFolder) => void
  counts: MailFolderCounts
  labels: MailLabel[]
  activeLabelId: string | null
  onLabel: (id: string) => void
  onLabelContext: (e: React.MouseEvent, id: string) => void
  creatorOpen: boolean
  editLabel: MailLabel | null
  onOpenCreator: () => void
  onCloseCreator: () => void
  onSaveLabel: (v: { name: string; color: string }) => void
  creatorBusy: boolean
}

const FOLDERS: { key: MailFolder; icon: MEIconName; label: string }[] = [
  { key: 'in', icon: 'inbox', label: 'mail.folders.in' },
  { key: 'arch', icon: 'archive', label: 'mail.folders.arch' },
  { key: 'star', icon: 'star', label: 'mail.folders.star' },
  { key: 'sent', icon: 'send', label: 'mail.folders.sent' },
  { key: 'draft', icon: 'file-text', label: 'mail.folders.draft' },
]

export function MailRail(p: Props) {
  const { t } = useTranslation('messages')
  const { ms } = p

  const row = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
    padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)',
    fontSize: 'var(--crm-text-md)', fontWeight: 500, color: active ? ms.ink : ms.txt3,
    cursor: 'pointer', width: '100%', textAlign: 'left' as const,
    background: active ? ms.elev : 'transparent', border: `1px solid ${active ? ms.bord : 'transparent'}`,
    fontFamily: 'inherit', transition: MAIL_TRANSITION,
  })
  const hover = (active: boolean) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { if (!active) e.currentTarget.style.background = ms.hover2 },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { if (!active) e.currentTarget.style.background = 'transparent' },
  })
  /** Compteur discret (archivés, brouillons, libellés) : il informe, il n'alerte pas. */
  const counter = (n: number) =>
    n > 0 ? <span style={{ marginLeft: 'auto', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{n}</span> : null

  return (
    <>
      <MailBoxSelector
        ms={ms}
        accounts={p.accounts}
        unread={p.unread}
        currentId={p.accountId}
        open={p.boxOpen}
        onToggle={p.onToggleBox}
        onClose={p.onCloseBox}
        onSelect={p.onSelectAccount}
        onAdd={p.onAddAccount}
      />

      <button
        type="button"
        onClick={p.onCompose}
        disabled={!p.accountId}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)',
          background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL,
          padding: 'var(--crm-space-lg) var(--crm-space-4xl)', fontSize: 'var(--crm-text-md)', fontWeight: 500,
          cursor: p.accountId ? 'pointer' : 'default', fontFamily: 'inherit', opacity: p.accountId ? 1 : 0.5,
          transition: MAIL_TRANSITION,
        }}
        onMouseEnter={(e) => { if (p.accountId) e.currentTarget.style.opacity = '0.92' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = p.accountId ? '1' : '0.5' }}
      >
        <MEIcon name="edit" size={14} /> {t('mail.compose.cta')}
      </button>

      <nav aria-label={t('mail.folders.aria')} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        {FOLDERS.map((f) => {
          const active = p.folder === f.key
          return (
            <button key={f.key} type="button" aria-current={active ? 'page' : undefined} onClick={() => p.onFolder(f.key)} style={row(active)} {...hover(active)}>
              <MEIcon name={f.icon} size={16} />
              <span>{t(f.label)}</span>
              {/* Seule la réception porte un APLAT d'accent : c'est le seul compteur qui appelle un geste. */}
              {f.key === 'in' && p.counts.inbox_unread > 0 && (
                <span
                  style={{
                    marginLeft: 'auto', borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-sm)',
                    fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: ms.accent, color: ms.accentInk,
                  }}
                >
                  {p.counts.inbox_unread}
                </span>
              )}
              {f.key === 'arch' && counter(p.counts.archived)}
              {f.key === 'draft' && counter(p.counts.drafts)}
            </button>
          )
        })}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 var(--crm-space-sm) 0 var(--crm-space-lg)' }}>
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>{t('mail.labels.title')}</span>
          <button
            type="button"
            title={t('mail.labels.new')}
            aria-label={t('mail.labels.new')}
            onClick={p.onOpenCreator}
            style={{
              marginLeft: 'auto', width: 22, height: 22, borderRadius: '50%', background: 'transparent', border: 'none',
              color: ms.txt3, cursor: 'pointer', display: 'grid', placeItems: 'center', transition: MAIL_TRANSITION,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover2 }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <MEIcon name="plus" size={12} />
          </button>
        </div>

        {p.creatorOpen && !p.editLabel && <MailLabelCreator ms={ms} onCancel={p.onCloseCreator} onSave={p.onSaveLabel} busy={p.creatorBusy} />}

        {p.labels.map((l) => {
          const active = p.activeLabelId === l.id
          // Renommer / recolorer remplace la LIGNE par le créateur : le libellé
          // reste à sa place dans la liste, on ne perd pas son rang de vue.
          if (p.creatorOpen && p.editLabel?.id === l.id) {
            return <MailLabelCreator key={l.id} ms={ms} initial={l} onCancel={p.onCloseCreator} onSave={p.onSaveLabel} busy={p.creatorBusy} />
          }
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={active}
              onClick={() => p.onLabel(l.id)}
              onContextMenu={(e) => { e.preventDefault(); p.onLabelContext(e, l.id) }}
              style={row(active)}
              {...hover(active)}
            >
              <span style={{ width: 9, height: 9, borderRadius: 'var(--crm-radius-2xs)', background: l.color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
              {counter(p.counts.label_counts[l.id] ?? 0)}
            </button>
          )
        })}
      </div>
    </>
  )
}
