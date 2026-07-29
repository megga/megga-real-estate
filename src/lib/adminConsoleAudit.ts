/**
 * Journal d'ouverture de la console super-admin (`admin_log_console_entry`).
 *
 * Vit dans son propre module : un fichier de composants ne peut pas exporter
 * autre chose sans casser le rafraîchissement à chaud
 * (`react-refresh/only-export-components`, erreur bloquante en CI).
 *
 * La fonction écrit une ligne, sans dédoublonner — c'est `AdminConsoleRoute`
 * qui décide de la granularité, une entrée dans la console valant une ligne.
 * Le compteur a vécu ici, à l'échelle du module, du temps où la console était
 * une application à part : un chargement de page valait alors une ouverture.
 * Depuis la refusion, on entre et on sort de la console sans jamais recharger,
 * et ce compteur ne laissait plus passer que la première entrée de la session.
 */
import { supabase } from '@/lib/supabase'
import { Sentry } from '@/lib/sentry'

/**
 * Journalise une ouverture. Best-effort : un échec n'enferme pas l'admin dehors
 * (une relance, puis on abandonne).
 *
 * L'échec part chez Sentry, PAS dans la console : une écriture d'arrière-plan
 * non bloquante ne doit pas se présenter comme une erreur de page. Elle ferait
 * échouer la garde « zéro erreur console » de la suite e2e-admin, qui a raison
 * de traiter une erreur console comme bloquante.
 */
export async function logConsoleEntry() {
  const write = (retry: boolean) =>
    supabase.rpc('admin_log_console_entry', {
      p_metadata: retry
        ? { origin: window.location.origin, retry: true }
        : { origin: window.location.origin },
    })

  const first = await write(false)
  if (!first.error) return
  const second = await write(true)
  if (!second.error) return

  Sentry.captureMessage(`[admin] audit d'ouverture de console refusé : ${second.error.message}`, 'warning')
  if (import.meta.env.DEV) console.warn('[admin] audit entry failed:', second.error.message)
}
