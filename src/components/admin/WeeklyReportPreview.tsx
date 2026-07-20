/**
 * Bouton super-admin déclenchant l'envoi immédiat du rapport hebdomadaire
 * (edge function `weekly-report`). État transitoire sending → sent (retour à
 * l'état neutre après 5 s) ; échec silencieux si la fonction n'est pas déployée.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, CheckCircle } from 'lucide-react'
import { LoadingCircle1 as Loader2 } from '@/components/icons'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

/** Bouton « envoyer maintenant » avec libellé/icône reflétant l'état d'envoi. */
export default function WeeklyReportPreview() {
  const { t } = useTranslation('admin')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSendNow() {
    setSending(true)
    try {
      await supabase.functions.invoke('weekly-report')
      setSent(true)
      setTimeout(() => setSent(false), 5000)
    } catch {
      // Edge Function not deployed
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      onClick={handleSendNow}
      disabled={sending}
      title={t('weeklyReport.description')}
      className={cn(
        'h-9 px-3.5 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors',
        sent
          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-500/20'
          : 'border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
      )}
    >
      {sending ? (
        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('weeklyReport.sending')}</>
      ) : sent ? (
        <><CheckCircle className="h-3.5 w-3.5" /> {t('weeklyReport.sent')}</>
      ) : (
        <><Send className="h-3.5 w-3.5" /> {t('weeklyReport.sendNow')}</>
      )}
    </button>
  )
}
