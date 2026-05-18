import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'

// ═══════════════════════════════════════════════════════════════════════════
// Static imports — STRICT minimum loaded with the main bundle (~boot shell).
// Tout le reste est lazy() pour réduire le payload initial sur /louer /acheter
// /home et les routes publiques à fort trafic SEO.
//
// Avant cette optimisation : ~30 components publics étaient eager, dont les
// 11 DesignSystem pages + TodaySugarPage (dashboard agent) — résultat : 153 KB
// JS inutilisé sur /louer d'après Lighthouse, FCP/LCP à 4.6s. Convertir tout
// le reste en lazy() ramène le main bundle à ~50 KB.
// ═══════════════════════════════════════════════════════════════════════════

// Shells/guards qui wrappent toutes les routes — doivent être disponibles
// avant le premier render pour éviter un flash de chargement.
import PasswordGate from '@/components/layout/PasswordGate'
import StaleBundleDetector from '@/components/layout/StaleBundleDetector'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import CookieBanner from '@/components/CookieBanner'

// Lazy-loaded public pages
// PropertyX public pages (anciennement eager — désormais lazy pour le SEO/LCP)
const PropertyXHomePage = lazy(() => import('@/pages/public/PropertyXHomePage'))
const PropertyXAboutPage = lazy(() => import('@/pages/public/PropertyXAboutPage'))
const PropertyXFAQPage = lazy(() => import('@/pages/public/PropertyXFAQPage'))
const PropertyXListingsPage = lazy(() => import('@/pages/public/PropertyXListingsPage'))
const PropertyXSinglePropertyPage = lazy(() => import('@/pages/public/PropertyXSinglePropertyPage'))
const PropertyXContactPage = lazy(() => import('@/pages/public/PropertyXContactPage'))
const PropertyXComingSoonPage = lazy(() => import('@/pages/public/PropertyXComingSoonPage'))
const PropertyXSubmitPropertyPage = lazy(() => import('@/pages/public/PropertyXSubmitPropertyPage'))
const PropertyXBlogPostPage = lazy(() => import('@/pages/public/PropertyXBlogPostPage'))
const PropertyXAgentProfilePage = lazy(() => import('@/pages/public/PropertyXAgentProfilePage'))

// Design System internes — pas dans le payload public initial
const PropertyXDesignSystemButtonsPage = lazy(() => import('@/pages/public/PropertyXDesignSystemButtonsPage'))
const PropertyXDesignSystemLinksPage = lazy(() => import('@/pages/public/PropertyXDesignSystemLinksPage'))
const PropertyXDesignSystemBadgesPage = lazy(() => import('@/pages/public/PropertyXDesignSystemBadgesPage'))
const PropertyXDesignSystemListsPage = lazy(() => import('@/pages/public/PropertyXDesignSystemListsPage'))
const PropertyXDesignSystemIconsPage = lazy(() => import('@/pages/public/PropertyXDesignSystemIconsPage'))
const PropertyXDesignSystemIconFontsPage = lazy(() => import('@/pages/public/PropertyXDesignSystemIconFontsPage'))
const PropertyXDesignSystemAvatarsPage = lazy(() => import('@/pages/public/PropertyXDesignSystemAvatarsPage'))
const PropertyXDesignSystemInputsPage = lazy(() => import('@/pages/public/PropertyXDesignSystemInputsPage'))
const PropertyXDesignSystemColorsPage = lazy(() => import('@/pages/public/PropertyXDesignSystemColorsPage'))
const PropertyXDesignSystemTypographyPage = lazy(() => import('@/pages/public/PropertyXDesignSystemTypographyPage'))
const PropertyXDesignSystemShadowsPage = lazy(() => import('@/pages/public/PropertyXDesignSystemShadowsPage'))

// Auth + blog v2 — lazy car secondary path
const BlogV2Page = lazy(() => import('@/pages/public/BlogV2Page'))
const LoginPage = lazy(() => import('@/pages/public/LoginPage'))
const AuthCallbackPage = lazy(() => import('@/pages/public/AuthCallbackPage'))

// Layout shells agent — lazy car ils ne wrappent que les routes dashboard
const AgentLayout = lazy(() => import('@/components/layout/AgentLayout'))
const AgentSugarLayout = lazy(() => import('@/components/layout/AgentSugarLayout'))

// Auth widgets — montés tardivement, peuvent être lazy
const FavoritesLoginPrompt = lazy(() => import('@/components/auth/FavoritesLoginPrompt'))

// Legacy + secondary public pages
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
const PropertyXLocationCmsPage = lazy(() => import('@/pages/public/PropertyXLocationCmsPage'))
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'))
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'))
const VisitManagePage = lazy(() => import('@/pages/public/VisitManagePage'))
const VisitFeedbackPage = lazy(() => import('@/pages/public/VisitFeedbackPage'))
const AgentDirectoryPage = lazy(() => import('@/pages/public/AgentDirectoryPage'))
const AgentProfilePage = lazy(() => import('@/pages/public/AgentProfilePage'))
const PropertyXAgencyProfilePage = lazy(() => import('@/pages/public/PropertyXAgencyProfilePage'))
const AgenciesPage = lazy(() => import('@/pages/public/AgenciesPage'))
const TodaySugarPage = lazy(() => import('@/pages/agent/TodaySugarPage'))

// Lazy-loaded agent pages
const DashboardSugarV4Page = lazy(() => import('@/pages/agent/DashboardSugarV4Page'))
const ContactImportPage = lazy(() => import('@/pages/agent/ContactImportPage'))
const ContactDetailSugarV3Page = lazy(() => import('@/pages/agent/ContactDetailSugarV3Page'))
const PipelineSugarV2Page = lazy(() => import('@/pages/agent/PipelineSugarV2Page'))
const ContactsSugarV2Page = lazy(() => import('@/pages/agent/ContactsSugarV2Page'))
const BiensSugarV2Page = lazy(() => import('@/pages/agent/BiensSugarV2Page'))
// Sprint 2 — Sugar v3 (port pixel-près handoff Bien + Deal + Visite)
const BienDetailSugarV3Page = lazy(() => import('@/pages/agent/BienDetailSugarV3Page'))
const DealDetailSugarV3Page = lazy(() => import('@/pages/agent/DealDetailSugarV3Page'))
const OfferModalSugarV3Page = lazy(() => import('@/pages/agent/OfferModalSugarV3Page'))
const VisitModalSugarV3Page = lazy(() => import('@/pages/agent/VisitModalSugarV3Page'))
const VisiteDetailSugarV3Page = lazy(() => import('@/pages/agent/VisiteDetailSugarV3Page'))
const VisitCompanionPage = lazy(() => import('@/pages/agent/VisitCompanionPage'))
// Sprint 3 — Import Lead IA (Sugar plein écran 2 étapes, extraction Claude)
const ImportLeadSugarV3Page = lazy(() => import('@/pages/agent/ImportLeadSugarV3Page'))
const MatchingSugarV2Page = lazy(() => import('@/pages/agent/MatchingSugarV2Page'))
const ParcoursSugarV2Page = lazy(() => import('@/pages/agent/ParcoursSugarV2Page'))
const CalendarSugarV2Page = lazy(() => import('@/pages/agent/CalendarSugarV2Page'))
const DocumentsSugarV2Page = lazy(() => import('@/pages/agent/DocumentsSugarV2Page'))
const SettingsSugarV2Page = lazy(() => import('@/pages/agent/SettingsSugarV2Page'))
const ListingFormPage = lazy(() => import('@/pages/agent/ListingFormPage'))
const WizardSugarV2Page = lazy(() => import('@/pages/agent/WizardSugarV2Page'))
const KycListSugarV2Page = lazy(() => import('@/pages/agent/KycListSugarV2Page'))
const KycDetailSugarV2Page = lazy(() => import('@/pages/agent/KycDetailSugarV2Page'))
const KycSugarV3Page = lazy(() => import('@/pages/agent/KycSugarV3Page'))
const AuditSugarPage = lazy(() => import('@/pages/agent/AuditSugarPage'))
const KycShowcasePage = lazy(() => import('@/pages/agent/KycShowcasePage'))
const ReseauSugarV2Page = lazy(() => import('@/pages/agent/ReseauSugarV2Page'))
const JulienSugarV2Page = lazy(() => import('@/pages/agent/JulienSugarV2Page'))
const MandateSignDemoPage = lazy(() => import('@/pages/dev/MandateSignDemoPage'))
const MfaShowcasePage = lazy(() => import('@/pages/dev/MfaShowcasePage'))
const SentryTestPage = lazy(() => import('@/pages/dev/SentryTestPage'))
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
              <Route path="/a-propos" element={<PropertyXAboutPage />} />
              <Route path="/faq" element={<PropertyXFAQPage />} />
              <Route path="/properties" element={<PropertyXListingsPage />} />
              <Route path="/propriete" element={<PropertyXSinglePropertyPage />} />
              <Route path="/propriete/:id" element={<PropertyXSinglePropertyPage />} />
              <Route path="/contact" element={<PropertyXContactPage />} />
              <Route path="/coming-soon" element={<PropertyXComingSoonPage />} />
              <Route path="/publier-bien" element={<PropertyXSubmitPropertyPage />} />
              <Route path="/blog" element={<BlogV2Page />} />
              <Route path="/blog/example" element={<PropertyXBlogPostPage />} />
              <Route path="/agent/example" element={<PropertyXAgentProfilePage />} />
              <Route path="/design-system/buttons" element={<PropertyXDesignSystemButtonsPage />} />
              <Route path="/design-system/links" element={<PropertyXDesignSystemLinksPage />} />
              <Route path="/design-system/badges" element={<PropertyXDesignSystemBadgesPage />} />
              <Route path="/design-system/lists" element={<PropertyXDesignSystemListsPage />} />
              <Route path="/design-system/icons" element={<PropertyXDesignSystemIconsPage />} />
              <Route path="/design-system/iconfonts" element={<PropertyXDesignSystemIconFontsPage />} />
              <Route path="/design-system/avatars" element={<PropertyXDesignSystemAvatarsPage />} />
              <Route path="/design-system/inputs" element={<PropertyXDesignSystemInputsPage />} />
              <Route path="/design-system/colors" element={<PropertyXDesignSystemColorsPage />} />
              <Route path="/design-system/typography" element={<PropertyXDesignSystemTypographyPage />} />
              <Route path="/design-system/shadows" element={<PropertyXDesignSystemShadowsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/listing/:id" element={<ListingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              {/* Marketplace publique — Property X design, branchée Supabase.
                  SearchPage (ancien design avec carte) reste accessible via
                  /acheter-legacy en attendant la v1.1 (toggle list/carte). */}
              <Route path="/acheter" element={<PropertyXListingsPage context="buy" />} />
              <Route path="/louer" element={<PropertyXListingsPage context="rent" />} />
              <Route path="/acheter-legacy" element={<SearchPage />} />
              <Route path="/louer-legacy" element={<LouerPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/vendre" element={<VendrePage />} />
              <Route path="/estimations" element={<EstimationsPage />} />
              <Route path="/estimer" element={<EstimationsPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/publier" element={<PublierPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/password" element={<PropertyXPasswordProtectedPage />} />
              <Route path="/properties-by-location" element={<PropertyXCityPropertiesPage />} />
              <Route path="/location" element={<PropertyXLocationCmsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/visite/:id/modifier" element={<VisitManagePage />} />
              <Route path="/visite/:id/feedback" element={<VisitFeedbackPage />} />
              <Route path="/agents" element={<AgentDirectoryPage />} />
              <Route path="/agents/:slug" element={<AgentProfilePage />} />
              <Route path="/agences" element={<AgenciesPage />} />
              <Route path="/agences/:slug" element={<PropertyXAgencyProfilePage />} />
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
              <Route path="/dev/sentry-test" element={<SentryTestPage />} />

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
                {/* Sprint 2 — Fiche Bien Sugar Pure (édition inline + AuditEvent) */}
                <Route path="listings/:id" element={<BienDetailSugarV3Page />} />
                {/* Sprint 2 — Fiche Deal Sugar Pure (stepper 8 + bannière KYC + offres) */}
                <Route path="transactions/:id" element={<DealDetailSugarV3Page />} />
                {/* Sprint 2 — Modal Offre / Contre-offre (Sugar plein écran 3 étapes) */}
                <Route path="transactions/:id/offre/:kind" element={<OfferModalSugarV3Page />} />
                {/* Sprint 2 — Modal Planifier Visite (Sugar plein écran 3 étapes) */}
                <Route path="visites/nouveau" element={<VisitModalSugarV3Page />} />
                {/* Sprint 2 — Fiche Visite (bon + rapport + mobile compagnon) */}
                <Route path="visites/:id" element={<VisiteDetailSugarV3Page />} />
                {/* Sprint 2 — Vue mobile compagnon /visites/:id/companion (responsive 375px) */}
                <Route path="visites/:id/companion" element={<VisitCompanionPage />} />
                {/* Sprint 3 — Import Lead IA (?text=...&returnTo=...) */}
                <Route path="import-lead" element={<ImportLeadSugarV3Page />} />
                <Route path="matching" element={<MatchingSugarV2Page />} />
                <Route path="parcours" element={<ParcoursSugarV2Page />} />
                <Route path="calendar" element={<CalendarSugarV2Page />} />
                <Route path="documents" element={<DocumentsSugarV2Page />} />
                <Route path="settings" element={<SettingsSugarV2Page />} />
                {/* Sprint 1 — Sugar v3 (port pixel-près handoff KYC + LBA) */}
                <Route path="kyc" element={<KycSugarV3Page />} />
                <Route path="kyc/:dossierId" element={<KycSugarV3Page />} />
                {/* Legacy V2 — gardé temporairement pour comparaison, à supprimer phase finale */}
                <Route path="kyc/showcase" element={<KycShowcasePage />} />
                <Route path="kyc/v2" element={<KycListSugarV2Page />} />
                <Route path="kyc/v2/:id" element={<KycDetailSugarV2Page />} />
                <Route path="reseau" element={<ReseauSugarV2Page />} />
                {/* Sprint 1 — Journal d'audit nLPD (livrable #4) */}
                <Route path="audit" element={<AuditSugarPage />} />
                <Route path="julien" element={<JulienSugarV2Page />} />
                {/* Sprint 4 — Dashboard Analytics Sugar v4 (Cockpit / Entonnoir / Objectif) */}
                <Route path="analytics" element={<DashboardSugarV4Page />} />
              </Route>

              {/* Agent dashboard (protected) — AgentLayout chrome pour les routes
                  partagées (import contact, wizard, docs, support, super-admin). */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AgentLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="contacts/import" element={<ContactImportPage />} />
                {/* Sprint 1 — Fiche contact Sugar v3 (livrable #3) */}
                <Route path="contacts/:id" element={<ContactDetailSugarV3Page />} />
                <Route path="marche/:externalId" element={<ExternalListingDetailPage />} />
                <Route path="listings/new" element={<WizardSugarV2Page />} />
                <Route path="listings/:id/edit" element={<ListingFormPage />} />
                <Route path="documents/generate" element={<DocumentGenerator />} />
                <Route path="documents/templates/new" element={<CustomTemplatePage />} />
                <Route path="documents/view" element={<DocumentViewer />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="support/:id" element={<SupportTicketDetailPage />} />

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
          {/* Widgets globaux : lazy avec fallback null car invisibles par défaut. */}
          <Suspense fallback={null}>
            <FavoritesLoginPrompt />
          </Suspense>
          <CookieBanner />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </PasswordGate>
  )
}
