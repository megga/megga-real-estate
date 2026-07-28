/**
 * Garde de la console quand elle est montée DANS le CRM (`/dashboard/admin/*`).
 *
 * Un non-super-admin est ramené à son tableau de bord — pas d'écran mort : il
 * est déjà dans le CRM, il n'y a rien à lui expliquer.
 *
 * L'ouverture reste tracée (`admin_log_console_entry`), comme du temps où la
 * console avait son propre domaine.
 */
import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { AdminThemeProvider } from '@/components/admin/AdminThemeProvider'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { logConsoleEntry } from '@/lib/adminConsoleAudit'
import AdminConsoleRoutes from '@/components/admin/AdminConsoleRoutes'
import BootSplash from '@/components/layout/BootSplash'

export default function AdminConsoleRoute() {
  const { checking, allowed } = useSuperAdminGate()

  useEffect(() => {
    if (allowed) void logConsoleEntry()
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
