/**
 * Modale de confirmation du geste « Relancer un cron » (monitoring super-admin).
 *
 * Elle ne s'ouvre PAS sur une règle écrite ici : c'est `admin_cron_run_now` qui refuse
 * une première fois en posant `details.needs_confirm`, et l'écran ne fait qu'obéir. Le
 * mur vit en base pour une raison dite dans la RPC — une confirmation qui ne vivrait que
 * dans l'écran se contournerait par un appel direct. Recopier ici la liste des crons
 * « inertes » créerait un second juge, qui se périmerait au premier ajout.
 *
 * Le corps affiche le message du serveur VERBATIM (`message_fr` est le seul texte que
 * l'enveloppe §10.1 transporte) ; la phrase traduite n'est qu'un repli.
 */
import { useTranslation } from 'react-i18next'
import Modal from '@/components/ui/modal'
import { AdminGhostBtn, AdminSolidBtn } from '@/components/admin/kit/adminKit'
import { useAdminSugar } from '@/hooks/useAdminSugar'

/** Confirmation d'une relance sur un cron qui peut écrire à des clients ou des agents. */
export default function CronRunNowConfirm({ jobname, messageFr, pending, onConfirm, onClose }: {
  jobname: string
  /** Message du serveur ; vide = repli traduit. */
  messageFr: string
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()

  return (
    <Modal open onClose={onClose} title={t('monitoring.cronHealth.confirmTitle')} size="sm">
      <div className="p-5" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: sp.ink }}>
          {messageFr || t('monitoring.cronHealth.confirmFallback')}
        </p>
        <p style={{
          margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12, fontWeight: 700, color: sp.sub,
        }}>
          {jobname}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9 }}>
          <AdminGhostBtn onClick={onClose} disabled={pending}>{t('common.cancel')}</AdminGhostBtn>
          <AdminSolidBtn onClick={onConfirm} disabled={pending}>
            {t('monitoring.cronHealth.confirmCta')}
          </AdminSolidBtn>
        </div>
      </div>
    </Modal>
  )
}
