/**
 * « Supprimer ce message ? » (README §5).
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

interface Props { ms: MailSurfaces; row: MailThreadRow | null; busy: boolean; onCancel: () => void; onConfirm: () => void }

/** Largeur de la carte et opacité du voile (README §5). */
const LARGEUR = 400
const VOILE = 0.14

export function MailDeleteModal({ ms, row, busy, onCancel, onConfirm }: Props) {
  const { t } = useTranslation('messages')
  return (
    <MailModalShell ms={ms} open={!!row} onClose={onCancel} width={LARGEUR} ariaLabel={t('mail.delete.title')} veil={VOILE}>
      <h2 style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 500, margin: 0 }}>{t('mail.delete.title')}</h2>
      <div style={{ fontSize: 'var(--crm-text-sm)', color: ms.txt3, marginTop: 'var(--crm-space-md)' }}>{row?.subject || t('mail.row.noSubject')}</div>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{row?.from_name || row?.from_email}</div>
      <p style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, lineHeight: 1.6, marginTop: 'var(--crm-space-2xl)' }}>{t('mail.delete.legal')}</p>
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
