/**
 * Journal d'ouverture de la console super-admin (`admin_log_console_entry`).
 *
 * Vit dans son propre module : un fichier de composants ne peut pas exporter
 * autre chose sans casser le rafraîchissement à chaud
 * (`react-refresh/only-export-components`, erreur bloquante en CI).
 */
import { supabase } from '@/lib/supabase'
import { Sentry } from '@/lib/sentry'

// Une seule ligne d'audit par chargement de page : un chargement = une ouverture
// de console, ce qui est la granularité voulue.
let entryLogged = false

/**
 * Journalise l'ouverture. Best-effort : un échec n'enferme pas l'admin dehors
 * (une relance, puis on abandonne).
 *
 * L'échec part chez Sentry, PAS dans la console : une écriture d'arrière-plan
 * non bloquante ne doit pas se présenter comme une erreur de page. Elle ferait
 * échouer la garde « zéro erreur console » de la suite e2e-admin, qui a raison
 * de traiter une erreur console comme bloquante.
 */
export async function logConsoleEntry() {
  if (entryLogged) return
  entryLogged = true
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
