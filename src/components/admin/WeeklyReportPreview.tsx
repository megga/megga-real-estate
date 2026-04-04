import { useState } from 'react'
import { Mail, Send, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function WeeklyReportPreview() {
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
    <div className="rounded-xl border border-theme-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-admin-accent" />
          <h3 className="text-sm font-semibold text-theme-primary">Rapport hebdomadaire</h3>
        </div>
        <button
          onClick={handleSendNow}
          disabled={sending}
          className={cn(
            'h-8 px-3 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors',
            sent
              ? 'bg-emerald-500/10 text-emerald-600'
              : 'border border-theme-border text-theme-secondary hover:text-admin-accent hover:border-admin-accent'
          )}
        >
          {sending ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Envoi...</>
          ) : sent ? (
            <><CheckCircle className="h-3 w-3" /> Envoye</>
          ) : (
            <><Send className="h-3 w-3" /> Envoyer maintenant</>
          )}
        </button>
      </div>
      <p className="text-xs text-theme-secondary">
        Un rapport automatique est envoye chaque lundi a 8h aux super-admins.
        Il resume les KPIs de la semaine : agences, utilisateurs, transactions, KYC, erreurs.
      </p>
      <p className="text-[10px] text-theme-muted mt-2">
        Deployer : supabase functions deploy weekly-report
      </p>
    </div>
  )
}
