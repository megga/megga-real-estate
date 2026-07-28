/**
 * Sous-arbre de routes de la console super-admin.
 *
 * Monté par le CRM sous `/dashboard/admin/*`.
 *
 * Les cibles de navigation du rail sont préfixées par `ADMIN_CONSOLE_PATH`
 * (cf. `AdminShell`) et NON relatives : sous un splat, le relatif dépend d'un
 * drapeau de routeur que le CRM n'active pas.
 *
 * Ce composant ne porte NI routeur NI providers : ils appartiennent à l'hôte,
 * `AdminThemeProvider` compris (posé par `AdminConsoleRoute`).
 */
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AdminShell from '@/components/admin/AdminShell'

const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminAgenciesPage = lazy(() => import('@/pages/admin/AdminAgenciesPage'))
const AdminAgencyDetailPage = lazy(() => import('@/pages/admin/AdminAgencyDetailPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminEndUsersPage = lazy(() => import('@/pages/admin/AdminEndUsersPage'))
const AdminMonitoringPage = lazy(() => import('@/pages/admin/AdminMonitoringPage'))
const AdminMarketplacePage = lazy(() => import('@/pages/admin/AdminMarketplacePage'))
const AdminCompliancePage = lazy(() => import('@/pages/admin/AdminCompliancePage'))
const AdminChangelogPage = lazy(() => import('@/pages/admin/AdminChangelogPage'))
const AdminFeatureFlagsPage = lazy(() => import('@/pages/admin/AdminFeatureFlagsPage'))
const AdminPlansPage = lazy(() => import('@/pages/admin/AdminPlansPage'))
const AdminLiveFeedPage = lazy(() => import('@/pages/admin/AdminLiveFeedPage'))
const AdminSecurityAuditPage = lazy(() => import('@/pages/admin/AdminSecurityAuditPage'))
const AdminNpsPage = lazy(() => import('@/pages/admin/AdminNpsPage'))
const AdminAutonomyPage = lazy(() => import('@/pages/admin/AdminAutonomyPage'))
const AdminToolUsagePage = lazy(() => import('@/pages/admin/AdminToolUsagePage'))
const AdminLearningPage = lazy(() => import('@/pages/admin/AdminLearningPage'))

/** Repli de chargement des chunks — neutre, aux couleurs de la console. */
function ChunkFallback() {
  return (
    <div className="p-6">
      <div className="h-6 w-40 rounded bg-theme-hover animate-pulse" />
    </div>
  )
}

export default function AdminConsoleRoutes() {
  return (
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
            <Route path="changelog" element={<AdminChangelogPage />} />
            <Route path="feature-flags" element={<AdminFeatureFlagsPage />} />
            <Route path="plans" element={<AdminPlansPage />} />
            <Route path="live" element={<AdminLiveFeedPage />} />
            <Route path="security" element={<AdminSecurityAuditPage />} />
            <Route path="nps" element={<AdminNpsPage />} />
            <Route path="autonomy" element={<AdminAutonomyPage />} />
            <Route path="tool-usage" element={<AdminToolUsagePage />} />
            <Route path="learning" element={<AdminLearningPage />} />
            {/* Inconnu → accueil de la console, relatif au point de montage. */}
            <Route path="*" element={<Navigate to="." replace />} />
          </Route>
        </Routes>
    </Suspense>
  )
}
