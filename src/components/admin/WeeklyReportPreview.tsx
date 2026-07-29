/**
 * Bouton super-admin déclenchant l'envoi immédiat du rapport hebdomadaire
 * (edge function `weekly-report`). État transitoire sending → sent (retour à
 * l'état neutre après 5 s), échec signalé par un toast.
 *
 * Rendu par `AdminGhostBtn` (kit Sugar) : l'état « envoyé » n'a plus de fond
 * teinté, il se lit à la teinte du libellé et de l'icône — Sugar ne colore pas
 * une surface pour dire un statut.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, CheckCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useToast } from '@/components/ui/Toast'
import { AdminGhostBtn, AdminIc } from '@/components/admin/kit/adminKit'

/** Bouton « envoyer maintenant » avec libellé/icône reflétant l'état d'envoi. */
export default function WeeklyReportPreview() {
  const { t } = useTranslation('admin')
  const { sp, tones } = useAdminSugar()
  const toast = useToast()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSendNow() {
    setSending(true)
    try {
      // `functions.invoke` ne LÈVE pas quand la fonction répond en erreur : elle
      // rend `{ error }`. Le `catch` ne se déclenchait donc jamais et le bouton
      // affichait « envoyé » quel que soit le sort réel du rapport.
      const { error } = await supabase.functions.invoke('weekly-report')
      if (error) {
        toast.error(t('weeklyReport.failed'))
        return
      }
      setSent(true)
      setTimeout(() => setSent(false), 5000)
    } catch {
      // Panne réseau ou fonction absente : `invoke` lève pour de bon ici.
      toast.error(t('weeklyReport.failed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <AdminGhostBtn
      onClick={handleSendNow}
      disabled={sending}
      title={t('weeklyReport.description')}
      style={{ color: sent ? tones.ok : sp.ink }}
    >
      {sending ? (
        <>
          {/* Le spin reste une classe utilitaire : `AdminIc` prend un style, pas de className. */}
          <span className="animate-spin" style={{ display: 'grid' }}>
            <AdminIc icon={Loader2} size={15} color={sp.sub} />
          </span>
          {t('weeklyReport.sending')}
        </>
      ) : sent ? (
        <>
          <AdminIc icon={CheckCircle} size={15} color={tones.ok} />
          {t('weeklyReport.sent')}
        </>
      ) : (
        <>
          <AdminIc icon={Send} size={15} color={sp.ink} />
          {t('weeklyReport.sendNow')}
        </>
      )}
    </AdminGhostBtn>
  )
}
