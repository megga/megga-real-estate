import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import ResponsiveRoute from '@/components/crm-mobile/shell/ResponsiveRoute'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence } from 'motion/react'
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
import StaleBundleDetector from '@/components/layout/StaleBundleDetector'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import CookieBanner from '@/components/CookieBanner'
import { ToastProvider } from '@/components/ui/Toast'
import LanguageChangeOverlay from '@/components/ui/LanguageChangeOverlay'
import SmartPageLoader from '@/components/skeletons/SmartPageLoader'

// Lazy-loaded public pages
// Property X storefront pages were removed — the public storefront on
// megga.ch is now the static V3 HTML site (sites/property-preview), overlaid
// at the deploy root by the npm postbuild hook. The Px* atom library under
// src/components/propertyx/ stays (used by the CRM, auth and skeletons).

// Sprint 4.7.C — Parcours client KYC Magic Link (public, sans compte MEGGA)
const KycPublicPage = lazy(() => import('@/pages/public/KycPublicPage'))
// Sprint 4.7.D — Rendu PDF tokenisé pour Cloudflare Browser Rendering (rapport KYC WhatsApp)
const KycReportRenderPage = lazy(() => import('@/pages/public/KycReportRenderPage'))

// Auth — lazy car secondary path.
// Le MODAL DE CONNEXION est désormais servi par la vitrine (megga.ch/login,
// câblé Supabase). L'app ne garde que la TUYAUTERIE du flux : /auth/callback
// (retour OAuth/e-mail) et /auth/forgot-password/reset (cible des e-mails de
// réinitialisation envoyés par la vitrine). Les écrans de login/signup internes
// (ancienne direction) redirigent vers la vitrine — voir VitrineLoginRedirect.
const AuthCallbackPage = lazy(() => import('@/pages/public/AuthCallbackPage'))
const AuthSetNewPasswordPage = lazy(() =>
  import('@/pages/public/AuthBentoPage').then((m) => ({ default: m.AuthSetNewPasswordPage })),
)

// Layout shells agent — lazy car ils ne wrappent que les routes dashboard
const AgentLayout = lazy(() => import('@/components/layout/AgentLayout'))
const AgentSugarLayout = lazy(() => import('@/components/layout/AgentSugarLayout'))

// CRM mobile (responsive < 768px) — branché par écran via ResponsiveRoute
const MobileMorePage = lazy(() => import('@/components/crm-mobile/more/MobileMorePage'))
const MobileTodayPage = lazy(() => import('@/components/crm-mobile/today/MobileTodayPage'))
const MobilePipelinePage = lazy(() => import('@/components/crm-mobile/pipeline/MobilePipelinePage'))
const MobileDealDetailPage = lazy(() => import('@/components/crm-mobile/deal/MobileDealDetailPage'))
const MobileMatchingPage = lazy(() => import('@/components/crm-mobile/matching/MobileMatchingPage'))
const MobileAgendaPage = lazy(() => import('@/components/crm-mobile/agenda/MobileAgendaPage'))
const MobileBiensPage = lazy(() => import('@/components/crm-mobile/biens/MobileBiensPage'))
const MobileBienVitrinePage = lazy(() => import('@/components/crm-mobile/bien/MobileBienVitrinePage'))

// Auth widgets — montés tardivement, peuvent être lazy
const FavoritesLoginPrompt = lazy(() => import('@/components/auth/FavoritesLoginPrompt'))
// Intercom Messenger — support unique (boote globalement, anonyme puis identifié)
const IntercomMessenger = lazy(() => import('@/components/IntercomMessenger'))

// Secondary public pages conservées dans l'app CRM.
// Marketplace publique + ancien site marketing (About, Contact, Sell, Estimates,
// Services, Publish, Privacy, Agents, Agencies, Blog) + direction Property X :
// EXTRAITS du repo (2026-06-08) et archivés hors GitHub. Ces URLs redirigent
// désormais vers la nouvelle vitrine (MarketplaceDisabledRedirect → megga.ch).
const ResetPasswordPage = lazy(() => import('@/pages/public/ResetPasswordPage'))
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'))
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'))
const VisitManagePage = lazy(() => import('@/pages/public/VisitManagePage'))
const VisitFeedbackPage = lazy(() => import('@/pages/public/VisitFeedbackPage'))
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
const VisitDetailSugarV3Page = lazy(() => import('@/pages/agent/VisitDetailSugarV3Page'))
// VisitCompanionPage removed — the mobile companion view contained only
// non-functional UI (mic recording / photo capture / signature / sentiment
// cards with no persistence). The route + page were removed; real on-site
// visit capture is a separate sprint.
// Sprint 3 — Import Lead IA (Sugar plein écran 2 étapes, extraction Claude)
const ImportLeadSugarV3Page = lazy(() => import('@/pages/agent/ImportLeadSugarV3Page'))
const MatchingAtelierPage = lazy(() => import('@/pages/agent/MatchingAtelierPage'))
const JourneySugarV2Page = lazy(() => import('@/pages/agent/JourneySugarV2Page'))
const CalendarSugarV2Page = lazy(() => import('@/pages/agent/CalendarSugarV2Page'))
const SettingsSugarV2Page = lazy(() => import('@/pages/agent/SettingsSugarV2Page'))
const ListingFormPage = lazy(() => import('@/pages/agent/ListingFormPage'))
const WizardSugarV2Page = lazy(() => import('@/pages/agent/WizardSugarV2Page'))
const KycSugarV3Page = lazy(() => import('@/pages/agent/KycSugarV3Page'))
// Sprint 4.4 — Export PDF dossier KYC (route print-friendly, hors layout agent)
const KycExportPage = lazy(() => import('@/pages/agent/KycExportPage'))
const AuditSugarPage = lazy(() => import('@/pages/agent/AuditSugarPage'))
const JulienSugarV2Page = lazy(() => import('@/pages/agent/JulienSugarV2Page'))
const MeggaXStyleGuidePage = lazy(() => import('@/pages/dev/MeggaXStyleGuidePage'))
const MandateSignDemoPage = lazy(() => import('@/pages/dev/MandateSignDemoPage'))
const MfaShowcasePage = lazy(() => import('@/pages/dev/MfaShowcasePage'))
const SentryTestPage = lazy(() => import('@/pages/dev/SentryTestPage'))
const D0ConfiguringDemoPage = lazy(() => import('@/pages/dev/D0ConfiguringDemoPage'))
const MatchingAtelierDemoPage = lazy(() => import('@/pages/dev/MatchingAtelierDemoPage'))
const D0ActivationDemoPage = lazy(() => import('@/pages/dev/D0ActivationDemoPage'))
const MobileShowcasePage = lazy(() => import('@/pages/dev/MobileShowcasePage'))
const ExternalListingDetailPage = lazy(() => import('@/pages/agent/ExternalListingDetailPage'))
const OnboardingWizardPage = lazy(() => import('@/pages/agent/OnboardingWizardPage'))
const PremierJourPage = lazy(() => import('@/pages/agent/PremierJourPage'))

// Lazy-loaded seller portal — page unique « Votre vente » (lecture seule, lien personnel).
// PortalDevWrapper (mock) et PortalGateway (token) rendent désormais VotreVentePage.
const PortalDevWrapper = lazy(() => import('@/pages/particulier/PortalDevWrapper'))
const PortalGateway = lazy(() => import('@/pages/particulier/PortalGateway'))
const AcceptInvitePage = lazy(() => import('@/pages/public/AcceptInvitePage'))
// Compte ACHETEUR retiré (pivot CRM-first) — page + composants archivés hors
// repo le 2026-06-08. /account → /dashboard. market_listings ne sert plus que
// le Matching agent.

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
const GlossaryPage = lazy(() => import('@/pages/public/GlossaryPage'))
// Lazy-loaded super-admin pages
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminAgenciesPage = lazy(() => import('@/pages/admin/AdminAgenciesPage'))
const AdminAgencyDetailPage = lazy(() => import('@/pages/admin/AdminAgencyDetailPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
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

// Admin guard
import SuperAdminGuard from '@/components/admin/SuperAdminGuard'

// `PageLoader` (the generic centered spinner) replaced by `<SmartPageLoader>`
// which picks a route-specific skeleton matching the page being loaded.
// SmartPageLoader uses useLocation, so it must live inside <BrowserRouter>.

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

/**
 * `<AnimatedRoutes>` wraps `<Routes>` in `<AnimatePresence>` SOLELY so that
 * `layoutId`-based shared-element transitions work across route boundaries.
 *
 * As of the "remove route-level transitions" pass, pages no longer fade or
 * slide on navigation — feedback showed the 220 ms cross-fade made the CRM
 * feel sluggish and the marketplace feel app-ified. Linear / Notion /
 * Vercel / Stripe all ship with INSTANT route changes for the same reason.
 *
 * What remains:
 *   - Shared-element transition on the marketplace card → property hero
 *     (PxListingsGrid.tsx ↔ PxSinglePropertyHero.tsx, layoutId on the photo)
 *   - Shared-element transition on the CRM bien row → BnDetailOverlay
 *     (same render tree — overlay is a conditional mount, not a route)
 *   - Every other iOS-feel atom (Sheet, Toast, Pressable taps, segmented
 *     control pill, parallax, shimmer, etc.) — those are surface-local and
 *     don't depend on PageTransition.
 *
 * `mode="popLayout"` keeps the exiting subtree mounted just long enough for
 * framer-motion to interpolate any `layoutId` pair between source and target.
 * It is intentionally the ONLY transition behaviour at this level.
 */
// Param-preserving redirects — <Navigate> doesn't interpolate :id, so wrap
// useParams + Navigate when a legacy FR route needs to keep its dynamic segment.
function VisitModifyRedirect() {
  const { id } = useParams()
  return <Navigate to={`/visit/${id}/edit`} replace />
}
function VisitFeedbackRedirect() {
  const { id } = useParams()
  return <Navigate to={`/visit/${id}/feedback`} replace />
}
function PortalTokenRedirect() {
  // Page unique : tout sous-chemin token (legacy ou bookmark) retombe sur /portal/:token.
  const { token } = useParams()
  return <Navigate to={token ? `/portal/${token}` : '/portal'} replace />
}
function HelpCategoryRedirect() {
  const { category } = useParams()
  return <Navigate to={`/help/${category}`} replace />
}
function HelpArticleRedirect() {
  const { category, slug } = useParams()
  return <Navigate to={`/help/${category}/${slug}`} replace />
}
function DashboardVisitRedirect() {
  const { id } = useParams()
  return <Navigate to={`/dashboard/visits/${id}`} replace />
}
function DashboardMarketRedirect() {
  const { externalId } = useParams()
  return <Navigate to={`/dashboard/market/${externalId}`} replace />
}
// Pivot CRM-first (juin 2026): la marketplace PUBLIQUE est désactivée. Les routes
// d'affichage des annonces (/buy /rent /propriete/:id /search /listing/:id…)
// redirigent vers la vitrine megga.ch. market_listings + le cron Flatfox + le
// matching (edge matching-engine, include_market) restent INTACTS — seul
// l'affichage public est coupé. Réversible : restaurer les <Route> d'origine.
// Redirection externe (autre domaine) → window.location, pas <Navigate>.
const VITRINE_URL = 'https://megga.ch'
function MarketplaceDisabledRedirect() {
  if (typeof window !== 'undefined') window.location.replace(VITRINE_URL)
  return null
}
// Le modèle de connexion vit sur la vitrine (megga.ch/login, câblé Supabase).
// Les écrans de login/signup internes (ancienne direction) y redirigent. La
// tuyauterie (/auth/callback, /auth/forgot-password/reset) reste dans l'app.
const VITRINE_LOGIN_URL = 'https://megga.ch/login'
function VitrineLoginRedirect() {
  if (typeof window !== 'undefined') window.location.replace(VITRINE_LOGIN_URL)
  return null
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    // popLayout — preserved for shared-element transitions only.
    <AnimatePresence mode="popLayout" initial={false}>
      <Routes location={location} key={location.pathname}>
              {/* Public storefront (home, about, properties, contact, FAQ,
                  blog, agents, property single, design-system…) is served by
                  the static V3 HTML site (sites/property-preview) on megga.ch.
                  This React app is deployed separately on app.megga.ch, where
                  "/" lands on the dashboard (which bounces to login if needed). */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {/* Marketplace publique DÉSACTIVÉE (pivot CRM-first juin 2026) →
                  vitrine megga.ch. market_listings + cron Flatfox + matching
                  (edge matching-engine) intacts ; l'écran marché INTERNE du CRM
                  (/dashboard/market/:externalId) reste actif. */}
              <Route path="/search" element={<MarketplaceDisabledRedirect />} />
              {/* Marketplace property detail — the Property X art direction
                  (PxSingleProperty* sections), data-connected via useListingDetail.
                  The whole marketplace (cards, preview modal/panel, favourites,
                  saved searches, "similar listings" carousels, lightbox share link,
                  SEO canonical) points at /propriete/:id. A bare /propriete (no id)
                  isn't a real property, so it redirects to the search. */}
              <Route path="/propriete/:id" element={<MarketplaceDisabledRedirect />} />
              <Route path="/propriete" element={<MarketplaceDisabledRedirect />} />
              {/* Legacy /listing/:id (back-compat) → vitrine (marketplace désactivée). */}
              <Route path="/listing/:id" element={<MarketplaceDisabledRedirect />} />
              {/* Legacy /login + /register → redirect to the new bento auth.
                  Old code/CTA still works; the new modal owns the experience. */}
              {/* Connexion = vitrine (megga.ch/login). Tous les écrans de login /
                  inscription internes (ancienne direction) y redirigent. */}
              <Route path="/login" element={<VitrineLoginRedirect />} />
              <Route path="/register" element={<VitrineLoginRedirect />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/login" element={<VitrineLoginRedirect />} />
              <Route path="/auth/login/link-sent" element={<VitrineLoginRedirect />} />
              <Route path="/auth/login/error" element={<VitrineLoginRedirect />} />
              <Route path="/auth/signup" element={<VitrineLoginRedirect />} />
              <Route path="/auth/signup/verify-email" element={<VitrineLoginRedirect />} />
              <Route path="/auth/forgot-password" element={<VitrineLoginRedirect />} />
              <Route path="/auth/forgot-password/sent" element={<VitrineLoginRedirect />} />
              {/* TUYAUTERIE conservée : cible des e-mails de réinitialisation
                  envoyés par la vitrine (megga-auth.js → /auth/forgot-password/reset). */}
              <Route path="/auth/forgot-password/reset" element={<AuthSetNewPasswordPage />} />
              {/* Legacy FR auth routes → vitrine (sauf redefinir = tuyauterie reset). */}
              <Route path="/auth/connexion" element={<VitrineLoginRedirect />} />
              <Route path="/auth/connexion/lien-envoye" element={<VitrineLoginRedirect />} />
              <Route path="/auth/connexion/erreur" element={<VitrineLoginRedirect />} />
              <Route path="/auth/inscription" element={<VitrineLoginRedirect />} />
              <Route path="/auth/inscription/email-verifier" element={<VitrineLoginRedirect />} />
              <Route path="/auth/mot-de-passe-oublie" element={<VitrineLoginRedirect />} />
              <Route path="/auth/mot-de-passe-oublie/envoye" element={<VitrineLoginRedirect />} />
              <Route path="/auth/mot-de-passe-oublie/redefinir" element={<Navigate to="/auth/forgot-password/reset" replace />} />
              {/* Sprint 4.7.C — Parcours client KYC self-service via lien magique */}
              <Route path="/kyc/:token" element={<KycPublicPage />} />
              {/* Sprint 4.7.D — Rendu PDF tokenisé (Cloudflare Browser Rendering → WhatsApp) */}
              <Route path="/kyc-report/:token" element={<KycReportRenderPage />} />
              {/* Marketplace publique désactivée → vitrine. (SearchPage/RentPage
                  conservés en lazy import pour réactivation Sprint 7.) */}
              <Route path="/search-legacy" element={<MarketplaceDisabledRedirect />} />
              <Route path="/rent-legacy" element={<MarketplaceDisabledRedirect />} />
              <Route path="/buy" element={<MarketplaceDisabledRedirect />} />
              <Route path="/rent" element={<MarketplaceDisabledRedirect />} />
              <Route path="/acheter" element={<MarketplaceDisabledRedirect />} />
              <Route path="/louer" element={<MarketplaceDisabledRedirect />} />
              {/* Ancien site marketing (Property X) extrait et archivé hors GitHub
                  (2026-06-08). Ces URLs redirigent vers la nouvelle vitrine. */}
              <Route path="/about" element={<MarketplaceDisabledRedirect />} />
              <Route path="/contact" element={<MarketplaceDisabledRedirect />} />
              <Route path="/sell" element={<MarketplaceDisabledRedirect />} />
              <Route path="/estimates" element={<MarketplaceDisabledRedirect />} />
              <Route path="/estimate" element={<MarketplaceDisabledRedirect />} />
              <Route path="/services" element={<MarketplaceDisabledRedirect />} />
              <Route path="/publish" element={<MarketplaceDisabledRedirect />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/visit/:id/edit" element={<VisitManagePage />} />
              <Route path="/visit/:id/feedback" element={<VisitFeedbackPage />} />
              <Route path="/agents" element={<MarketplaceDisabledRedirect />} />
              <Route path="/agents/:slug" element={<MarketplaceDisabledRedirect />} />
              <Route path="/agencies" element={<MarketplaceDisabledRedirect />} />
              <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />

              {/* Legacy FR routes — 301 redirects preserve bookmarks + external links. */}
              <Route path="/acheter-legacy" element={<Navigate to="/search-legacy" replace />} />
              <Route path="/louer-legacy" element={<Navigate to="/rent-legacy" replace />} />
              <Route path="/vendre" element={<Navigate to="/sell" replace />} />
              <Route path="/estimations" element={<Navigate to="/estimates" replace />} />
              <Route path="/estimer" element={<Navigate to="/estimate" replace />} />
              <Route path="/publier" element={<Navigate to="/publish" replace />} />
              <Route path="/visite/:id/modifier" element={<VisitModifyRedirect />} />
              <Route path="/visite/:id/feedback" element={<VisitFeedbackRedirect />} />
              <Route path="/agences" element={<Navigate to="/agencies" replace />} />

              {/* Compte ACHETEUR (favoris, recherches sauvegardées, messagerie) —
                  DÉSACTIVÉ. Focus 100% CRM : market_listings ne sert plus que le
                  Matching. /account + /compte → /dashboard (les agents ont déjà
                  leur espace ; plus aucune surface acheteur). Réversible. */}
              <Route path="/account" element={<Navigate to="/dashboard" replace />} />
              <Route path="/compte" element={<Navigate to="/dashboard" replace />} />

              {/* Help Center */}
              <Route path="/help" element={<HelpCenterPage />} />
              <Route path="/help/start" element={<HelpStartPage />} />
              <Route path="/help/contact" element={<HelpContactPage />} />
              <Route path="/help/status" element={<HelpStatusPage />} />
              <Route path="/help/changelog" element={<HelpChangelogPage />} />
              <Route path="/help/shortcuts" element={<HelpShortcutsPage />} />
              <Route path="/help/compliance" element={<HelpCompliancePage />} />
              <Route path="/help/limits" element={<HelpLimitsPage />} />
              <Route path="/help/resources" element={<HelpResourcesPage />} />
              <Route path="/help/glossary" element={<GlossaryPage />} />
              <Route path="/help/:category" element={<HelpCategoryPage />} />
              <Route path="/help/:category/:slug" element={<HelpArticlePage />} />
              {/* Legacy FR help routes */}
              <Route path="/aide" element={<Navigate to="/help" replace />} />
              <Route path="/aide/demarrage" element={<Navigate to="/help/start" replace />} />
              <Route path="/aide/contact" element={<Navigate to="/help/contact" replace />} />
              <Route path="/aide/statut" element={<Navigate to="/help/status" replace />} />
              <Route path="/aide/nouveautes" element={<Navigate to="/help/changelog" replace />} />
              <Route path="/aide/raccourcis" element={<Navigate to="/help/shortcuts" replace />} />
              <Route path="/aide/conformite" element={<Navigate to="/help/compliance" replace />} />
              <Route path="/aide/limites" element={<Navigate to="/help/limits" replace />} />
              <Route path="/aide/ressources" element={<Navigate to="/help/resources" replace />} />
              <Route path="/aide/glossaire" element={<Navigate to="/help/glossary" replace />} />
              <Route path="/aide/:category" element={<HelpCategoryRedirect />} />
              <Route path="/aide/:category/:slug" element={<HelpArticleRedirect />} />

              {/* Seller portal — page unique « Votre vente » (dev/test, mock data). */}
              <Route path="/portal" element={<PortalDevWrapper />} />
              {/* Legacy FR portal routes → page unique */}
              <Route path="/portail" element={<Navigate to="/portal" replace />} />
              <Route path="/portail/visites" element={<Navigate to="/portal" replace />} />
              <Route path="/portail/offres" element={<Navigate to="/portal" replace />} />
              <Route path="/portail/documents" element={<Navigate to="/portal" replace />} />
              <Route path="/portail/messages" element={<Navigate to="/portal" replace />} />
              <Route path="/portail/analyse" element={<Navigate to="/portal" replace />} />
              <Route path="/portail/profil" element={<Navigate to="/portal" replace />} />

              {/* Dev showcase routes (no auth) */}
              <Route path="/design-system/megga-x" element={<MeggaXStyleGuidePage />} />
              <Route path="/dev/mandate-sign" element={<MandateSignDemoPage />} />
              {/* Atelier Matching — démo QA visuelle (mocks handoff, zéro écriture) */}
              <Route path="/dev/matching-atelier" element={<MatchingAtelierDemoPage />} />
              <Route path="/dev/mfa" element={<MfaShowcasePage />} />
              <Route path="/dev/sentry-test" element={<SentryTestPage />} />
              <Route path="/dev/configuring" element={<D0ConfiguringDemoPage />} />
              <Route path="/dev/activation" element={<D0ActivationDemoPage />} />
              <Route path="/dev/mobile" element={<MobileShowcasePage />} />

              {/* Seller portal — accès tokenisé (production), page unique « Votre vente ».
                  Les anciens sous-chemins (visits/offers/…) retombent sur la page. */}
              <Route path="/portal/:token" element={<PortalGateway />} />
              <Route path="/portal/:token/*" element={<PortalTokenRedirect />} />
              {/* Legacy FR portal tokenized routes — keep magic links in emails working. */}
              <Route path="/portail/:token" element={<PortalTokenRedirect />} />
              <Route path="/portail/:token/visites" element={<PortalTokenRedirect />} />
              <Route path="/portail/:token/offres" element={<PortalTokenRedirect />} />
              <Route path="/portail/:token/documents" element={<PortalTokenRedirect />} />
              <Route path="/portail/:token/messages" element={<PortalTokenRedirect />} />
              <Route path="/portail/:token/analyse" element={<PortalTokenRedirect />} />

              {/* Onboarding wizard (protected, no sidebar) */}
              <Route
                path="/dashboard/onboarding"
                element={
                  <ProtectedRoute skipOnboardingCheck>
                    <OnboardingWizardPage />
                  </ProtectedRoute>
                }
              />

              {/* Premier jour — calibrage IA + atterrissage Aujourd'hui (one-shot)
                  Se joue immédiatement après l'onboarding, avant la première
                  session CRM. Voir handoff-premier-jour. */}
              <Route
                path="/dashboard/premier-jour"
                element={
                  <ProtectedRoute skipOnboardingCheck>
                    <PremierJourPage />
                  </ProtectedRoute>
                }
              />

              {/* Sprint 4.4 — Export PDF dossier KYC (protected, no layout — print-friendly) */}
              <Route
                path="/dashboard/kyc/:dossierId/export"
                element={
                  <ProtectedRoute>
                    <KycExportPage />
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
                <Route index element={<ResponsiveRoute desktop={<TodaySugarPage />} mobile={<MobileTodayPage />} />} />
                <Route path="pipeline" element={<ResponsiveRoute desktop={<PipelineSugarV2Page />} mobile={<MobilePipelinePage />} />} />
                <Route path="contacts" element={<ContactsSugarV2Page />} />
                {/* Mes biens — mobile (< 768px) : galerie portefeuille (P7). */}
                <Route path="listings" element={<ResponsiveRoute desktop={<BiensSugarV2Page />} mobile={<MobileBiensPage />} />} />
                {/* Sprint 2 — Fiche Bien Sugar Pure (édition inline + AuditEvent).
                    Mobile (< 768px) : fiche lecture seule (P7). */}
                <Route path="listings/:id" element={<ResponsiveRoute desktop={<BienDetailSugarV3Page />} mobile={<MobileBienVitrinePage />} />} />
                {/* Sprint 2 — Fiche Deal Sugar Pure (stepper 8 + bannière KYC + offres) */}
                <Route path="transactions/:id" element={<ResponsiveRoute desktop={<DealDetailSugarV3Page />} mobile={<MobileDealDetailPage />} />} />
                {/* Sprint 2 — Modal Offre / Contre-offre (Sugar plein écran 3 étapes) */}
                <Route path="transactions/:id/offre/:kind" element={<OfferModalSugarV3Page />} />
                {/* Sprint 2 — Modal Planifier Visite (Sugar plein écran 3 étapes) */}
                <Route path="visits/new" element={<VisitModalSugarV3Page />} />
                {/* Sprint 2 — Fiche Visite (bon + rapport) */}
                <Route path="visits/:id" element={<VisitDetailSugarV3Page />} />
                {/* Legacy FR */}
                <Route path="visites/nouveau" element={<Navigate to="/dashboard/visits/new" replace />} />
                <Route path="visites/:id" element={<DashboardVisitRedirect />} />
                {/* Sprint 3 — Import Lead IA (?text=...&returnTo=...) */}
                <Route path="import-lead" element={<ImportLeadSugarV3Page />} />
                {/* Atelier Matching — triptyque plein écran (handoff juin 2026).
                    Deep-links : ?annonce=p:<id>|m:<id> · ?contact=<id>.
                    Mobile (< 768px) : inbox acheteurs + focus (P5). */}
                <Route path="matching" element={<ResponsiveRoute desktop={<MatchingAtelierPage />} mobile={<MobileMatchingPage />} />} />
                <Route path="journey" element={<JourneySugarV2Page />} />
                <Route path="parcours" element={<Navigate to="/dashboard/journey" replace />} />
                {/* Agenda — mobile (< 768px) : jour liste + time-block (P6). */}
                <Route path="calendar" element={<ResponsiveRoute desktop={<CalendarSugarV2Page />} mobile={<MobileAgendaPage />} />} />
                <Route path="settings" element={<SettingsSugarV2Page />} />
                {/* Sprint 1 — Sugar v3 (port pixel-près handoff KYC + LBA) */}
                <Route path="kyc" element={<KycSugarV3Page />} />
                <Route path="kyc/:dossierId" element={<KycSugarV3Page />} />
                {/* Réseau inter-agences — hors périmètre v1 (page conservée, route neutralisée) */}
                <Route path="network" element={<Navigate to="/dashboard" replace />} />
                <Route path="reseau" element={<Navigate to="/dashboard" replace />} />
                {/* Sprint 1 — Journal d'audit nLPD (livrable #4) */}
                <Route path="audit" element={<AuditSugarPage />} />
                <Route path="julien" element={<JulienSugarV2Page />} />
                {/* Sprint 4 — Dashboard Analytics Sugar v4 (Cockpit / Entonnoir / Objectif) */}
                <Route path="analytics" element={<DashboardSugarV4Page />} />
                {/* Hub « Plus » mobile-only — desktop redirige vers Réglages */}
                <Route
                  path="more"
                  element={
                    <ResponsiveRoute
                      desktop={<Navigate to="/dashboard/settings" replace />}
                      mobile={<MobileMorePage />}
                    />
                  }
                />
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
                <Route path="market/:externalId" element={<ExternalListingDetailPage />} />
                <Route path="marche/:externalId" element={<DashboardMarketRedirect />} />
                <Route path="listings/new" element={<WizardSugarV2Page />} />
                <Route path="listings/:id/edit" element={<ListingFormPage />} />

                {/* Super-Admin routes */}
                <Route path="admin" element={<SuperAdminGuard><AdminDashboardPage /></SuperAdminGuard>} />
                <Route path="admin/agencies" element={<SuperAdminGuard><AdminAgenciesPage /></SuperAdminGuard>} />
                <Route path="admin/agencies/:id" element={<SuperAdminGuard><AdminAgencyDetailPage /></SuperAdminGuard>} />
                <Route path="admin/users" element={<SuperAdminGuard><AdminUsersPage /></SuperAdminGuard>} />
                <Route path="admin/monitoring" element={<SuperAdminGuard><AdminMonitoringPage /></SuperAdminGuard>} />
                <Route path="admin/marketplace" element={<SuperAdminGuard><AdminMarketplacePage /></SuperAdminGuard>} />
                <Route path="admin/compliance" element={<SuperAdminGuard><AdminCompliancePage /></SuperAdminGuard>} />
                <Route path="admin/changelog" element={<SuperAdminGuard><AdminChangelogPage /></SuperAdminGuard>} />
                <Route path="admin/feature-flags" element={<SuperAdminGuard><AdminFeatureFlagsPage /></SuperAdminGuard>} />
                <Route path="admin/plans" element={<SuperAdminGuard><AdminPlansPage /></SuperAdminGuard>} />
                <Route path="admin/live" element={<SuperAdminGuard><AdminLiveFeedPage /></SuperAdminGuard>} />
                <Route path="admin/security" element={<SuperAdminGuard><AdminSecurityAuditPage /></SuperAdminGuard>} />
                <Route path="admin/nps" element={<SuperAdminGuard><AdminNpsPage /></SuperAdminGuard>} />
                <Route path="admin/autonomy" element={<SuperAdminGuard><AdminAutonomyPage /></SuperAdminGuard>} />
                <Route path="admin/tool-usage" element={<SuperAdminGuard><AdminToolUsagePage /></SuperAdminGuard>} />
                <Route path="admin/learning" element={<SuperAdminGuard><AdminLearningPage /></SuperAdminGuard>} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <StaleBundleDetector />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            {/* Masks the layout reflow during i18n.changeLanguage() — 350ms
                frosted-glass shimmer overlay, listens to languageChanged event. */}
            <LanguageChangeOverlay />
            <ErrorBoundary>
              <Suspense fallback={<SmartPageLoader />}>
                <AnimatedRoutes />
              </Suspense>
            </ErrorBoundary>
            {/* Widgets globaux : lazy avec fallback null car invisibles par défaut. */}
            <Suspense fallback={null}>
              <FavoritesLoginPrompt />
              <IntercomMessenger />
            </Suspense>
            <CookieBanner />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
