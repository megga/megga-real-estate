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
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import { AdminThemeProvider } from '@/components/admin/AdminThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import AdminAuthGate from '@/components/admin/AdminAuthGate'
import AdminShell from '@/components/admin/AdminShell'

const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminAgenciesPage = lazy(() => import('@/pages/admin/AdminAgenciesPage'))
const AdminAgencyDetailPage = lazy(() => import('@/pages/admin/AdminAgencyDetailPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminEndUsersPage = lazy(() => import('@/pages/admin/AdminEndUsersPage'))
const AdminMonitoringPage = lazy(() => import('@/pages/admin/AdminMonitoringPage'))
const AdminMarketplacePage = lazy(() => import('@/pages/admin/AdminMarketplacePage'))
const AdminCompliancePage = lazy(() => import('@/pages/admin/AdminCompliancePage'))
const AdminKybReviewPage = lazy(() => import('@/pages/admin/AdminKybReviewPage'))
const AdminChangelogPage = lazy(() => import('@/pages/admin/AdminChangelogPage'))
const AdminFeatureFlagsPage = lazy(() => import('@/pages/admin/AdminFeatureFlagsPage'))
const AdminPlansPage = lazy(() => import('@/pages/admin/AdminPlansPage'))
const AdminLiveFeedPage = lazy(() => import('@/pages/admin/AdminLiveFeedPage'))
const AdminSecurityAuditPage = lazy(() => import('@/pages/admin/AdminSecurityAuditPage'))
const AdminNpsPage = lazy(() => import('@/pages/admin/AdminNpsPage'))
const AdminAutonomyPage = lazy(() => import('@/pages/admin/AdminAutonomyPage'))
const AdminToolUsagePage = lazy(() => import('@/pages/admin/AdminToolUsagePage'))
const AdminLearningPage = lazy(() => import('@/pages/admin/AdminLearningPage'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

/** Repli de chargement des chunks — neutre, aux couleurs de la console. */
function ChunkFallback() {
  return (
    <div className="p-6">
      <div className="h-6 w-40 rounded bg-theme-hover animate-pulse" />
    </div>
  )
}

export default function AdminApp() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AdminThemeProvider>
            <ToastProvider>
              <ErrorBoundary>
                <AdminAuthGate>
                  <Suspense fallback={<ChunkFallback />}>
                    <Routes>
                      <Route element={<AdminShell />}>
                        <Route index element={<AdminDashboardPage />} />
                        <Route path="agencies" element={<AdminAgenciesPage />} />
                        <Route path="agencies/:id" element={<AdminAgencyDetailPage />} />
                        <Route path="users" element={<AdminUsersPage />} />
                        <Route path="end-users" element={<AdminEndUsersPage />} />
                        <Route path="monitoring" element={<AdminMonitoringPage />} />
                        <Route path="marketplace" element={<AdminMarketplacePage />} />
                        <Route path="compliance" element={<AdminCompliancePage />} />
                        <Route path="kyb-review" element={<AdminKybReviewPage />} />
                        <Route path="changelog" element={<AdminChangelogPage />} />
                        <Route path="feature-flags" element={<AdminFeatureFlagsPage />} />
                        <Route path="plans" element={<AdminPlansPage />} />
                        <Route path="live" element={<AdminLiveFeedPage />} />
                        <Route path="security" element={<AdminSecurityAuditPage />} />
                        <Route path="nps" element={<AdminNpsPage />} />
                        <Route path="autonomy" element={<AdminAutonomyPage />} />
                        <Route path="tool-usage" element={<AdminToolUsagePage />} />
                        <Route path="learning" element={<AdminLearningPage />} />
                        {/* Anciennes URLs internes au CRM, encore dans des favoris. */}
                        <Route path="dashboard/admin/*" element={<Navigate to="/" replace />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </AdminAuthGate>
              </ErrorBoundary>
            </ToastProvider>
          </AdminThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
