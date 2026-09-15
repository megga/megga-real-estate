/**
 * « Supprimer ce message ? » (README §5) — ou « ces N messages ? », depuis la sélection de la
 * liste (15.09.2026) : trois objets nommés, puis « et N autres ». On confirme ce qu'on voit.
 *
 * ⚠ La mention légale n'est pas un ornement : elle dit ce que le geste NE fait
 * pas. Le fil part à la corbeille du fournisseur ; la conservation de dix ans de
 * la LBA porte sur le DOSSIER (`documents`, `kyc_cases`), pas sur la boîte, qui
 * n'en est qu'une copie effaçable. Sans cette phrase, l'agent hésite ou détruit.
 */
import { useTranslation } from 'react-i18next'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import { MailModalShell } from './MailModalShell'
import { PILL, type MailSurfaces } from './mailTokens'

/** `rows` vide : la modale est fermée. */
interface Props { ms: MailSurfaces; rows: MailThreadRow[]; busy: boolean; onCancel: () => void; onConfirm: () => void }

/** Les objets nommés dans la confirmation d'un lot ; les autres sont comptés. */
const NOMMES = 3

/** Largeur de la carte et opacité du voile (README §5). */
const LARGEUR = 400
const VOILE = 0.14

export function MailDeleteModal({ ms, rows, busy, onCancel, onConfirm }: Props) {
  const { t } = useTranslation('messages')
  const row = rows[0]
  const plusieurs = rows.length > 1
  const titre = plusieurs ? t('mail.delete.titleMany', { count: rows.length }) : t('mail.delete.title')
  const ellipse = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
  return (
    <MailModalShell ms={ms} open={rows.length > 0} onClose={onCancel} width={LARGEUR} ariaLabel={titre} veil={VOILE}>
      <h2 style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 500, margin: 0 }}>{titre}</h2>
      {plusieurs ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--crm-space-md) 0 0', fontSize: 'var(--crm-text-sm)', color: ms.txt3 }}>
          {rows.slice(0, NOMMES).map((r) => <li key={r.id} style={ellipse}>{r.subject || t('mail.row.noSubject')}</li>)}
          {rows.length > NOMMES && <li style={{ color: ms.mut, fontSize: 'var(--crm-text-xs)' }}>{t('mail.delete.andMore', { count: rows.length - NOMMES })}</li>}
        </ul>
      ) : (
        <>
          <div style={{ fontSize: 'var(--crm-text-sm)', color: ms.txt3, marginTop: 'var(--crm-space-md)' }}>{row?.subject || t('mail.row.noSubject')}</div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{row?.from_name || row?.from_email}</div>
        </>
      )}
      <p style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, lineHeight: 1.6, marginTop: 'var(--crm-space-2xl)' }}>{t(plusieurs ? 'mail.delete.legalMany' : 'mail.delete.legal')}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('mail.actions.cancel')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          style={{
            background: ms.danger, color: ms.dangerInk, border: 'none', borderRadius: PILL,
            padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
          }}
        >
          {t('mail.ctx.delete')}
        </button>
      </div>
    </MailModalShell>
  )
}
