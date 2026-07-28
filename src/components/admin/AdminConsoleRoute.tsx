/**
 * Garde de la console quand elle est montée DANS le CRM (`/dashboard/admin/*`).
 *
 * Un non-super-admin est ramené à son tableau de bord — pas d'écran mort : il
 * est déjà dans le CRM, il n'y a rien à lui expliquer.
 *
 * Chaque entrée est tracée (`admin_log_console_entry`), comme du temps où la
 * console avait son propre domaine — mais à la granularité de l'entrée, pas du
 * chargement de page : on entre et on sort d'ici sans jamais recharger.
 */
import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { AdminThemeProvider } from '@/components/admin/AdminThemeProvider'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { logConsoleEntry } from '@/lib/adminConsoleAudit'
import AdminConsoleRoutes from '@/components/admin/AdminConsoleRoutes'
import BootSplash from '@/components/layout/BootSplash'

export default function AdminConsoleRoute() {
  const { checking, allowed } = useSuperAdminGate()

  // Une ligne d'audit par ENTRÉE dans la console : ce composant est monté en y
  // entrant, démonté en la quittant. Le garde est une ref plutôt qu'un drapeau
  // de module — il faut arrêter la double exécution d'effet de StrictMode (la
  // ref survit, l'instance n'étant pas détruite) sans pour autant museler les
  // entrées suivantes, ce que faisait le drapeau de module.
  const loggedRef = useRef(false)
  useEffect(() => {
    if (!allowed || loggedRef.current) return
    loggedRef.current = true
    void logConsoleEntry()
  }, [allowed])

  if (checking) return <BootSplash />
  // Pas super-admin : retour au CRM. Le vrai verrou reste en base — les 91
  // gardes `is_super_admin()` des RPC — cette redirection n'est que l'UI.
  if (!allowed) return <Navigate to="/dashboard" replace />

  return (
    <AdminThemeProvider>
      <AdminConsoleRoutes />
    </AdminThemeProvider>
  )
}
