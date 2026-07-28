/**
 * Garde de la console quand elle est montée DANS le CRM (`/dashboard/admin/*`).
 *
 * Jumelle d'`AdminAuthGate`, mais sans son cul-de-sac : sur le domaine dédié, un
 * visiteur sans session doit lire « ouvrez depuis le CRM » parce qu'il n'y a rien
 * d'autre à lui proposer. Ici il EST dans le CRM — la seule réponse sensée à un
 * non-super-admin est de le ramener à son tableau de bord, sans écran mort.
 *
 * L'audit est le même (`admin_log_console_entry`) et vient de la même fonction :
 * l'ouverture de la console reste tracée où qu'elle se produise.
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
