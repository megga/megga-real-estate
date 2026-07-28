/**
 * Racine de la console super-admin (admin.megga.ch) : providers + routage des
 * 16 surfaces d'administration.
 *
 * Application SÉPARÉE du CRM (bundle, origine, session). Elle partage le code
 * de `src/` — hooks Supabase, tokens de thème, icônes — mais ne charge ni le
 * routeur du CRM, ni le panneau MEGGA AI, ni Intercom, ni les analytics : une
 * console interne n'a rien à envoyer à Google, et l'agent n'a rien à recevoir
 * de l'admin.
 *
 * Les routes sont à la RACINE (`/users`, `/agencies/:id`…) : l'ancien préfixe
 * `/dashboard/admin` n'a plus de sens hors du CRM.
 */
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
// Le thème vit ICI et non dans `AdminConsoleRoutes` : `AdminAuthGate` le
// consomme et se trouve au-dessus. Deux providers imbriqués donneraient deux
// états, donc une bascule clair/sombre qui n'en repeindrait qu'un.
import { AdminThemeProvider } from '@/components/admin/AdminThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import AdminAuthGate from '@/components/admin/AdminAuthGate'
import AdminConsoleRoutes from '@/components/admin/AdminConsoleRoutes'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

export default function AdminApp() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AdminThemeProvider>
            <ToastProvider>
              <ErrorBoundary>
                <AdminAuthGate>
                  <AdminConsoleRoutes />
                </AdminAuthGate>
              </ErrorBoundary>
            </ToastProvider>
          </AdminThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
