/**
 * Le sélecteur de boîte, en tête du rail (README §1a) : la boîte courante, la
 * liste des autres avec leurs non-lus, et l'entrée « Ajouter une boîte ».
 *
 * Une boîte qui n'est pas `active` affiche son MOTIF (autorisation à renouveler,
 * erreur de synchronisation, désactivée) en encre d'alerte plutôt que « non
 * synchronisée » : l'agent doit savoir quoi faire, pas seulement que ça ne va
 * pas.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { MailAccount } from '@/hooks/useMailAccounts'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  accounts: MailAccount[]
  unread: Record<string, number>
  currentId: string | null
  open: boolean
  onToggle: () => void
  onClose: () => void
  onSelect: (id: string) => void
  onAdd: () => void
}

/**
 * Les noms de fournisseur ne se traduisent pas : ce sont des marques, et
 * `i18next/no-literal-string` ne lit que les nœuds de TEXTE JSX — celles-ci
 * passent par une expression.
 */
const PROVIDER_LABEL: Record<MailAccount['provider'], string> = {
  gmail: 'Google Workspace',
  outlook: 'Outlook / Microsoft 365',
  imap: 'IMAP',
}

/** Le bouton de boîte courante et son menu. Se ferme au clic dehors. */
export function MailBoxSelector({ ms, accounts, unread, currentId, open, onToggle, onClose, onSelect, onAdd }: Props) {
  const { t } = useTranslation('messages')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  const current = accounts.find((a) => a.id === currentId) ?? null
  const desc = (a: MailAccount) =>
    a.status === 'active' ? `${PROVIDER_LABEL[a.provider]} · ${t('mail.box.synced')}` : t(`mail.box.status.${a.status}`)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
          padding: 'var(--crm-space-md) var(--crm-space-lg)', background: ms.elev, border: `1px solid ${ms.bord}`,
          borderRadius: 'var(--crm-radius-xl)', cursor: 'pointer', color: ms.ink, textAlign: 'left',
          fontFamily: 'inherit', transition: MAIL_TRANSITION,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = ms.dim }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = ms.bord }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>{t('mail.box.label')}</div>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current?.email ?? t('mail.box.none')}
          </div>
        </div>
        <MEIcon name="chevron-down" size={12} color={ms.mut} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, marginTop: 'var(--crm-space-2xs)',
            background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)',
            padding: 'var(--crm-space-2xs)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
            boxShadow: ms.shadow,
          }}
        >
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              onClick={() => { onSelect(a.id); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
                padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)',
                background: a.id === currentId ? ms.elev : 'transparent', border: 'none', cursor: 'pointer',
                color: ms.ink, textAlign: 'left', fontFamily: 'inherit', transition: MAIL_TRANSITION,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = a.id === currentId ? ms.elev : 'transparent' }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.email}
                </div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: a.status === 'active' ? ms.mut : ms.dangerText }}>{desc(a)}</div>
              </div>
              {(unread[a.id] ?? 0) > 0 && (
                <span
                  style={{
                    borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-sm)',
                    fontSize: 'var(--crm-text-xs)', fontWeight: 600, background: ms.accent, color: ms.accentInk,
                  }}
                >
                  {unread[a.id]}
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => { onAdd(); onClose() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
              padding: 'var(--crm-space-md) var(--crm-space-lg)', borderTop: `1px solid ${ms.bord2}`,
              background: 'transparent', border: 'none', borderRadius: 0, cursor: 'pointer', color: ms.txt3,
              fontSize: 'var(--crm-text-xs)', fontWeight: 500, fontFamily: 'inherit', transition: MAIL_TRANSITION,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = ms.ink }}
            onMouseLeave={(e) => { e.currentTarget.style.color = ms.txt3 }}
          >
            <MEIcon name="plus" size={12} /> {t('mail.add.cta')}
          </button>
        </div>
      )}
    </div>
  )
}
