import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'

// Static imports — shell + most-visited pages (loaded immediately)
import HomePage from '@/pages/public/HomePage'
import PropertyXHomePage from '@/pages/public/PropertyXHomePage'
import PropertyXAboutPage from '@/pages/public/PropertyXAboutPage'
import PropertyXFAQPage from '@/pages/public/PropertyXFAQPage'
import PropertyXListingsPage from '@/pages/public/PropertyXListingsPage'
import PropertyXSinglePropertyPage from '@/pages/public/PropertyXSinglePropertyPage'
import PropertyXContactPage from '@/pages/public/PropertyXContactPage'
import PropertyXComingSoonPage from '@/pages/public/PropertyXComingSoonPage'
import PropertyXSubmitPropertyPage from '@/pages/public/PropertyXSubmitPropertyPage'
import PropertyXBlogPostPage from '@/pages/public/PropertyXBlogPostPage'
import PropertyXAgentProfilePage from '@/pages/public/PropertyXAgentProfilePage'
import BlogV2Page from '@/pages/public/BlogV2Page'
import LoginPage from '@/pages/public/LoginPage'
// RegisterPage removed — registration is now handled by the email-first LoginPage
import AuthCallbackPage from '@/pages/public/AuthCallbackPage'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import PasswordGate from '@/components/layout/PasswordGate'
import StaleBundleDetector from '@/components/layout/StaleBundleDetector'
import AgentLayout from '@/components/layout/AgentLayout'
import AgentSugarLayout from '@/components/layout/AgentSugarLayout'
import TodaySugarPage from '@/pages/agent/TodaySugarPage'
import FavoritesLoginPrompt from '@/components/auth/FavoritesLoginPrompt'
import CookieBanner from '@/components/CookieBanner'

// Lazy-loaded public pages
const SearchPage = lazy(() => import('@/pages/public/SearchPage'))
const ListingPage = lazy(() => import('@/pages/public/ListingPage'))
const AboutPage = lazy(() => import('@/pages/public/AboutPage'))
const LouerPage = lazy(() => import('@/pages/public/LouerPage'))
const VendrePage = lazy(() => import('@/pages/public/VendrePage'))
const EstimationsPage = lazy(() => import('@/pages/public/EstimationsPage'))
const ServicesPage = lazy(() => import('@/pages/public/ServicesPage'))
const PublierPage = lazy(() => import('@/pages/public/PublierPage'))
const ResetPasswordPage = lazy(() => import('@/pages/public/ResetPasswordPage'))
const PropertyXPasswordProtectedPage = lazy(() => import('@/pages/public/PropertyXPasswordProtectedPage'))
const PropertyXCityPropertiesPage = lazy(() => import('@/pages/public/PropertyXCityPropertiesPage'))
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'))
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'))
const VisitManagePage = lazy(() => import('@/pages/public/VisitManagePage'))
const VisitFeedbackPage = lazy(() => import('@/pages/public/VisitFeedbackPage'))
const AgentDirectoryPage = lazy(() => import('@/pages/public/AgentDirectoryPage'))
const AgentProfilePage = lazy(() => import('@/pages/public/AgentProfilePage'))
const AgencyProfilePage = lazy(() => import('@/pages/public/AgencyProfilePage'))
const AgenciesPage = lazy(() => import('@/pages/public/AgenciesPage'))

// Lazy-loaded agent pages (except ActionBoardPage which is static)
const DashboardPage = lazy(() => import('@/pages/agent/DashboardPage'))
const ContactsPage = lazy(() => import('@/pages/agent/ContactsPage'))
const ContactImportPage = lazy(() => import('@/pages/agent/ContactImportPage'))
const ContactDetailPage = lazy(() => import('@/pages/agent/ContactDetailPage'))
const PipelinePage = lazy(() => import('@/pages/agent/PipelinePage'))
const PipelineSugarV2Page = lazy(() => import('@/pages/agent/PipelineSugarV2Page'))
const ContactsSugarV2Page = lazy(() => import('@/pages/agent/ContactsSugarV2Page'))
const BiensSugarV2Page = lazy(() => import('@/pages/agent/BiensSugarV2Page'))
const MatchingSugarV2Page = lazy(() => import('@/pages/agent/MatchingSugarV2Page'))
const ParcoursSugarV2Page = lazy(() => import('@/pages/agent/ParcoursSugarV2Page'))
const CalendarSugarV2Page = lazy(() => import('@/pages/agent/CalendarSugarV2Page'))
const DocumentsSugarV2Page = lazy(() => import('@/pages/agent/DocumentsSugarV2Page'))
const SettingsSugarV2Page = lazy(() => import('@/pages/agent/SettingsSugarV2Page'))
const SettingsPage = lazy(() => import('@/pages/agent/SettingsPage'))
const MatchingPage = lazy(() => import('@/pages/agent/MatchingPage'))
const ListingsPage = lazy(() => import('@/pages/agent/ListingsPage'))
const ListingFormPage = lazy(() => import('@/pages/agent/ListingFormPage'))
const WizardSugarV2Page = lazy(() => import('@/pages/agent/WizardSugarV2Page'))
const KycListPage = lazy(() => import('@/pages/agent/KycListPage'))
const KycDetailPage = lazy(() => import('@/pages/agent/KycDetailPage'))
const KycListSugarV2Page = lazy(() => import('@/pages/agent/KycListSugarV2Page'))
const KycDetailSugarV2Page = lazy(() => import('@/pages/agent/KycDetailSugarV2Page'))
const KycShowcasePage = lazy(() => import('@/pages/agent/KycShowcasePage'))
const ReseauSugarV2Page = lazy(() => import('@/pages/agent/ReseauSugarV2Page'))
const JulienSugarV2Page = lazy(() => import('@/pages/agent/JulienSugarV2Page'))
const MandateSignDemoPage = lazy(() => import('@/pages/dev/MandateSignDemoPage'))
const MfaShowcasePage = lazy(() => import('@/pages/dev/MfaShowcasePage'))
const CalendarPage = lazy(() => import('@/pages/agent/CalendarPage'))
const TemplatesPage = lazy(() => import('@/pages/agent/TemplatesPage'))
const DocumentGenerator = lazy(() => import('@/pages/agent/DocumentGenerator'))
const DocumentViewer = lazy(() => import('@/pages/agent/DocumentViewer'))
const CustomTemplatePage = lazy(() => import('@/pages/agent/CustomTemplatePage'))
const ExternalListingDetailPage = lazy(() => import('@/pages/agent/ExternalListingDetailPage'))
const OnboardingWizardPage = lazy(() => import('@/pages/agent/OnboardingWizardPage'))

// Lazy-loaded seller portal pages
const PortalDevWrapper = lazy(() => import('@/pages/particulier/PortalDevWrapper'))
const PortalGateway = lazy(() => import('@/pages/particulier/PortalGateway'))
const MonDossierPage = lazy(() => import('@/pages/particulier/MonDossierPage'))
const MesVisitesPage = lazy(() => import('@/pages/particulier/MesVisitesPage'))
const MesOffresPage = lazy(() => import('@/pages/particulier/MesOffresPage'))
const MesDocumentsPage = lazy(() => import('@/pages/particulier/MesDocumentsPage'))
const MesMessagesPage = lazy(() => import('@/pages/particulier/MesMessagesPage'))
const AnalysePage = lazy(() => import('@/pages/particulier/AnalysePage'))
const MonProfilPage = lazy(() => import('@/pages/particulier/MonProfilPage'))
const AcceptInvitePage = lazy(() => import('@/pages/public/AcceptInvitePage'))
const ComptePage = lazy(() => import('@/pages/public/ComptePage'))

// Lazy-loaded help center pages
const HelpCenterPage = lazy(() => import('@/pages/public/HelpCenterPage'))
const HelpCategoryPage = lazy(() => import('@/pages/public/HelpCategoryPage'))
const HelpArticlePage = lazy(() => import('@/pages/public/HelpArticlePage'))
const HelpStartPage = lazy(() => import('@/pages/public/HelpStartPage'))
const HelpContactPage = lazy(() => import('@/pages/public/HelpContactPage'))
const HelpStatusPage = lazy(() => import('@/pages/public/HelpStatusPage'))
const HelpChangelogPage = lazy(() => import('@/pages/public/HelpChangelogPage'))
const HelpShortcutsPage = lazy(() => import('@/pages/public/HelpShortcutsPage'))
const HelpCompliancePage = lazy(() => import('@/pages/public/HelpCompliancePage'))
const HelpLimitsPage = lazy(() => import('@/pages/public/HelpLimitsPage'))
const HelpResourcesPage = lazy(() => import('@/pages/public/HelpResourcesPage'))
const GlossairePage = lazy(() => import('@/pages/public/GlossairePage'))
const TicketStatusPage = lazy(() => import('@/pages/public/TicketStatusPage'))
const TicketFeedbackPage = lazy(() => import('@/pages/public/TicketFeedbackPage'))

// Lazy-loaded admin support pages
const SupportPage = lazy(() => import('@/pages/agent/SupportPage'))
const SupportTicketDetailPage = lazy(() => import('@/pages/agent/SupportTicketDetailPage'))

// Lazy-loaded super-admin pages
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminAgenciesPage = lazy(() => import('@/pages/admin/AdminAgenciesPage'))
const AdminAgencyDetailPage = lazy(() => import('@/pages/admin/AdminAgencyDetailPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminMonitoringPage = lazy(() => import('@/pages/admin/AdminMonitoringPage'))
const AdminMarketplacePage = lazy(() => import('@/pages/admin/AdminMarketplacePage'))
const AdminCompliancePage = lazy(() => import('@/pages/admin/AdminCompliancePage'))
const AdminSupportPage = lazy(() => import('@/pages/admin/AdminSupportPage'))
const AdminChangelogPage = lazy(() => import('@/pages/admin/AdminChangelogPage'))
const AdminFeatureFlagsPage = lazy(() => import('@/pages/admin/AdminFeatureFlagsPage'))
const AdminPlansPage = lazy(() => import('@/pages/admin/AdminPlansPage'))
const AdminLiveFeedPage = lazy(() => import('@/pages/admin/AdminLiveFeedPage'))
const AdminSecurityAuditPage = lazy(() => import('@/pages/admin/AdminSecurityAuditPage'))
const AdminNpsPage = lazy(() => import('@/pages/admin/AdminNpsPage'))

// Admin guard
import SuperAdminGuard from '@/components/admin/SuperAdminGuard'

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-5 w-5 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
    </div>
  )
}

// Defensive defaults for a reliable UX after long idles / sleep / wake:
//
// - networkMode: 'always'
//     Chrome occasionally reports `navigator.onLine = false` after sleep/wake,
//     WiFi↔4G switches, VPN toggles, or DevTools "Offline" mode. In the default
//     'online' mode, TanStack pauses queries until `onLine` flips back to true
//     — which can get stuck, leaving the page on eternal skeletons with no
//     network request and no console error. 'always' fires regardless.
//
// - refetchOnWindowFocus: true
//     When the user wakes the laptop / returns to the tab after 15+ min,
//     Chrome aggressively evicts in-memory state. We need TanStack to
//     proactively re-fetch as soon as the tab regains focus, otherwise
//     the user sees empty skeletons forever. Combined with a 2-min
//     staleTime, this only fires when the data is actually stale —
//     no thrash when the user Alt-Tabs every 30s.
//
// - refetchOnReconnect: true (default)
//     Complements the focus handler: if the network hiccup is what
//     happened, the reconnect event triggers the refetch.
//
// - staleTime: 2 min (was 5 min)
//     Aligns with how quickly apartment listings change in practice;
//     also ensures that after a short sleep, data is considered stale
//     and gets refreshed on focus.
//
// - retry: 1 with short backoff
//     Fail fast on real errors so the UI surfaces an error state the user
//     can act on (retry button), instead of spinning indefinitely.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      networkMode: 'always',
    },
    mutations: {
      networkMode: 'always',
      retry: 0,
    },
  },
})

export default function App() {
  return (
    <PasswordGate>
    <StaleBundleDetector />
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<PropertyXHomePage />} />
              <Route path="/home-legacy" element={<HomePage />} />
              <Route path="/a-propos" element={<PropertyXAboutPage />} />
              <Route path="/faq" element={<PropertyXFAQPage />} />
              <Route path="/properties" element={<PropertyXListingsPage />} />
              <Route path="/propriete" element={<PropertyXSinglePropertyPage />} />
              <Route path="/contact" element={<PropertyXContactPage />} />
              <Route path="/coming-soon" element={<PropertyXComingSoonPage />} />
              <Route path="/publier-bien" element={<PropertyXSubmitPropertyPage />} />
              <Route path="/blog" element={<BlogV2Page />} />
              <Route path="/blog/example" element={<PropertyXBlogPostPage />} />
              <Route path="/agent/example" element={<PropertyXAgentProfilePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/listing/:id" element={<ListingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              {/* /acheter pointe temporairement sur AboutPage (Property X
                  Properties template) — SearchPage reste accessible via
                  /acheter-legacy le temps de l'A/B */}
              <Route path="/acheter" element={<AboutPage />} />
              <Route path="/acheter-legacy" element={<SearchPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/louer" element={<LouerPage />} />
              <Route path="/vendre" element={<VendrePage />} />
              <Route path="/estimations" element={<EstimationsPage />} />
              <Route path="/estimer" element={<EstimationsPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/publier" element={<PublierPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/password" element={<PropertyXPasswordProtectedPage />} />
              <Route path="/properties-by-location" element={<PropertyXCityPropertiesPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/visite/:id/modifier" element={<VisitManagePage />} />
              <Route path="/visite/:id/feedback" element={<VisitFeedbackPage />} />
              <Route path="/agents" element={<AgentDirectoryPage />} />
              <Route path="/agents/:slug" element={<AgentProfilePage />} />
              <Route path="/agences" element={<AgenciesPage />} />
              <Route path="/agences/:slug" element={<AgencyProfilePage />} />
              <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />

              {/* Mon compte — public-side dashboard (favoris, recherches, messagerie, profil) */}
              <Route
                path="/compte"
                element={
                  <ProtectedRoute>
                    <ComptePage />
                  </ProtectedRoute>
                }
              />

              {/* Help Center */}
              <Route path="/aide" element={<HelpCenterPage />} />
              <Route path="/aide/demarrage" element={<HelpStartPage />} />
              <Route path="/aide/contact" element={<HelpContactPage />} />
              <Route path="/aide/statut" element={<HelpStatusPage />} />
              <Route path="/aide/nouveautes" element={<HelpChangelogPage />} />
              <Route path="/aide/raccourcis" element={<HelpShortcutsPage />} />
              <Route path="/aide/conformite" element={<HelpCompliancePage />} />
              <Route path="/aide/limites" element={<HelpLimitsPage />} />
              <Route path="/aide/ressources" element={<HelpResourcesPage />} />
              <Route path="/aide/glossaire" element={<GlossairePage />} />
              <Route path="/aide/:category" element={<HelpCategoryPage />} />
              <Route path="/aide/:category/:slug" element={<HelpArticlePage />} />

              {/* Support tickets (public) */}
              <Route path="/support/:ticketNumber" element={<TicketStatusPage />} />
              <Route path="/support/:ticketNumber/feedback" element={<TicketFeedbackPage />} />

              {/* Portail vendeur — accès direct (dev/test) — wraps in
                  SellerPortalProvider with MOCK_SELLER_DATA so child pages
                  don't crash with "useSellerPortalData must be used inside
                  SellerPortalProvider" (audit bug A2). */}
              <Route path="/portail" element={<PortalDevWrapper />}>
                <Route index element={<MonDossierPage />} />
                <Route path="visites" element={<MesVisitesPage />} />
                <Route path="offres" element={<MesOffresPage />} />
                <Route path="documents" element={<MesDocumentsPage />} />
                <Route path="messages" element={<MesMessagesPage />} />
                <Route path="analyse" element={<AnalysePage />} />
                <Route path="profil" element={<MonProfilPage />} />
              </Route>

              {/* Dev showcase routes (no auth) */}
              <Route path="/dev/mandate-sign" element={<MandateSignDemoPage />} />
              <Route path="/dev/mfa" element={<MfaShowcasePage />} />

              {/* Portail vendeur — accès tokénisé (production) */}
              <Route path="/portail/:token" element={<PortalGateway />}>
                <Route index element={<MonDossierPage />} />
                <Route path="visites" element={<MesVisitesPage />} />
                <Route path="offres" element={<MesOffresPage />} />
                <Route path="documents" element={<MesDocumentsPage />} />
                <Route path="messages" element={<MesMessagesPage />} />
                <Route path="analyse" element={<AnalysePage />} />
              </Route>

              {/* Onboarding wizard (protected, no sidebar) */}
              <Route
                path="/dashboard/onboarding"
                element={
                  <ProtectedRoute skipOnboardingCheck>
                    <OnboardingWizardPage />
                  </ProtectedRoute>
                }
              />

              {/* Tier 3 — Sugar v2 Today screen (no traditional sidebar chrome) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AgentSugarLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<TodaySugarPage />} />
                <Route path="pipeline" element={<PipelineSugarV2Page />} />
                <Route path="contacts" element={<ContactsSugarV2Page />} />
                <Route path="listings" element={<BiensSugarV2Page />} />
                <Route path="listings-legacy" element={<ListingsPage />} />
                <Route path="matching" element={<MatchingSugarV2Page />} />
                <Route path="parcours" element={<ParcoursSugarV2Page />} />
                <Route path="calendar" element={<CalendarSugarV2Page />} />
                <Route path="documents" element={<DocumentsSugarV2Page />} />
                <Route path="settings" element={<SettingsSugarV2Page />} />
                <Route path="kyc" element={<KycListSugarV2Page />} />
                <Route path="kyc/showcase" element={<KycShowcasePage />} />
                <Route path="kyc/:id" element={<KycDetailSugarV2Page />} />
                <Route path="reseau" element={<ReseauSugarV2Page />} />
                <Route path="julien" element={<JulienSugarV2Page />} />
              </Route>

              {/* Agent dashboard (protected) — AgentLayout chrome for legacy CRM pages */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AgentLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="analytics" element={<DashboardPage />} />
                <Route path="contacts-legacy" element={<ContactsPage />} />
                <Route path="contacts/import" element={<ContactImportPage />} />
                <Route path="contacts/:id" element={<ContactDetailPage />} />
                <Route path="pipeline-legacy" element={<PipelinePage />} />
                <Route path="matching-legacy" element={<MatchingPage />} />
                <Route path="marche/:externalId" element={<ExternalListingDetailPage />} />
                <Route path="listings/new" element={<WizardSugarV2Page />} />
                <Route path="listings/:id/edit" element={<ListingFormPage />} />
                <Route path="kyc-legacy" element={<KycListPage />} />
                <Route path="kyc-legacy/:id" element={<KycDetailPage />} />
                <Route path="calendar-legacy" element={<CalendarPage />} />
                <Route path="documents-legacy" element={<TemplatesPage />} />
                <Route path="documents/generate" element={<DocumentGenerator />} />
                <Route path="documents/templates/new" element={<CustomTemplatePage />} />
                <Route path="documents/view" element={<DocumentViewer />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="support/:id" element={<SupportTicketDetailPage />} />
                <Route path="settings-legacy" element={<SettingsPage />} />

                {/* Super-Admin routes */}
                <Route path="admin" element={<SuperAdminGuard><AdminDashboardPage /></SuperAdminGuard>} />
                <Route path="admin/agencies" element={<SuperAdminGuard><AdminAgenciesPage /></SuperAdminGuard>} />
                <Route path="admin/agencies/:id" element={<SuperAdminGuard><AdminAgencyDetailPage /></SuperAdminGuard>} />
                <Route path="admin/users" element={<SuperAdminGuard><AdminUsersPage /></SuperAdminGuard>} />
                <Route path="admin/monitoring" element={<SuperAdminGuard><AdminMonitoringPage /></SuperAdminGuard>} />
                <Route path="admin/marketplace" element={<SuperAdminGuard><AdminMarketplacePage /></SuperAdminGuard>} />
                <Route path="admin/compliance" element={<SuperAdminGuard><AdminCompliancePage /></SuperAdminGuard>} />
                <Route path="admin/support" element={<SuperAdminGuard><AdminSupportPage /></SuperAdminGuard>} />
                <Route path="admin/changelog" element={<SuperAdminGuard><AdminChangelogPage /></SuperAdminGuard>} />
                <Route path="admin/feature-flags" element={<SuperAdminGuard><AdminFeatureFlagsPage /></SuperAdminGuard>} />
                <Route path="admin/plans" element={<SuperAdminGuard><AdminPlansPage /></SuperAdminGuard>} />
                <Route path="admin/live" element={<SuperAdminGuard><AdminLiveFeedPage /></SuperAdminGuard>} />
                <Route path="admin/security" element={<SuperAdminGuard><AdminSecurityAuditPage /></SuperAdminGuard>} />
                <Route path="admin/nps" element={<SuperAdminGuard><AdminNpsPage /></SuperAdminGuard>} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <FavoritesLoginPrompt />
          <CookieBanner />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </PasswordGate>
  )
}
