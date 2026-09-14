/**
 * « Déconnecter cette boîte ? » — la confirmation du × du sélecteur de boîtes (Julien,
 * 14.09.2026 : « il s'agit de la suppression, il faut une confirmation avant »).
 *
 * ⚠ C'était un `window.confirm`, choisi « par exception » : le geste part d'un POPOVER
 * qui se ferme au premier clic, et une modale portée devait donc vivre dans l'état de
 * l'écran. C'est ce qu'elle fait désormais (`modal.kind === 'disconnect'`), dans le cadre
 * comme les autres modales de l'écran — un dialogue natif, hors de la direction, passait
 * pour une alerte du navigateur sur le geste le plus destructeur de la Messagerie.
 *
 * Le paragraphe dit ce que le geste fait ET ce qu'il ne fait pas : les messages quittent
 * le CRM, les documents classés restent, la boîte reste intacte chez son fournisseur.
 * Sans lui, l'agent hésite ou détruit (même règle que `MailDeleteModal`).
 *
 * ⚠ Le focus s'ouvre sur « Annuler », premier bouton de la carte : Entrée par réflexe ne
 * déconnecte rien.
 */
import { useTranslation } from 'react-i18next'
import type { MailAccount } from '@/hooks/useMailAccounts'
import { MailModalShell } from './MailModalShell'
import { PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  /** La boîte visée ; `null` = modale fermée. */
  boite: MailAccount | null
  busy: boolean
  /** Le motif du serveur, tel quel : la modale reste ouverte sur un refus. */
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

/** Largeur de la carte et opacité du voile — celles de « Supprimer ce message ? ». */
const LARGEUR = 420
const VOILE = 0.14

export function MailDisconnectModal({ ms, boite, busy, error, onCancel, onConfirm }: Props) {
  const { t } = useTranslation('messages')
  return (
    <MailModalShell ms={ms} open={!!boite} onClose={onCancel} width={LARGEUR} ariaLabel={t('mail.box.disconnectTitle')} veil={VOILE}>
      <h2 style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 500, margin: 0 }}>{t('mail.box.disconnectTitle')}</h2>
      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ms.ink, marginTop: 'var(--crm-space-md)', overflowWrap: 'anywhere' }}>{boite?.email}</div>
      {boite?.display_name && <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{boite.display_name}</div>}
      <p style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, lineHeight: 1.6, marginTop: 'var(--crm-space-2xl)', marginBottom: 0 }}>{t('mail.box.disconnectBody')}</p>
      {error && <div role="alert" style={{ fontSize: 'var(--crm-text-xs)', color: ms.dangerText, marginTop: 'var(--crm-space-lg)' }}>{error}</div>}
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
            cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? t('mail.box.disconnecting') : t('mail.box.disconnect')}
        </button>
      </div>
    </MailModalShell>
  )
}
