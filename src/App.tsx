/**
 * Racine de l'app CRM (app.megga.ch) : providers globaux (React Query, Auth,
 * Toast, panneau IA) + table de routage complète.
 *
 * Presque toutes les pages sont en lazy() — seuls les shells/guards restent
 * statiques — pour garder le main bundle minimal. La marketplace publique est
 * désactivée (pivot CRM-first) : ses routes redirigent vers la vitrine megga.ch.
 * Route racine « / » → /dashboard.
 */
import { Fragment, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import ResponsiveRoute from '@/components/crm-mobile/shell/ResponsiveRoute'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import { AiPanelProvider } from '@/hooks/useAiPanel'

// ═══════════════════════════════════════════════════════════════════════════
// Static imports — STRICT minimum loaded with the main bundle (~boot shell).
// Tout le reste est lazy() pour réduire le payload initial sur /louer /acheter
// /home et les routes publiques à fort trafic SEO.
//
// Avant cette optimisation : ~30 components publics étaient eager, dont les
// 11 pages DesignSystem (depuis retirées) + TodaySugarPage (dashboard agent) — résultat : 153 KB
// JS inutilisé sur /louer d'après Lighthouse, FCP/LCP à 4.6s. Convertir tout
// le reste en lazy() ramène le main bundle à ~50 KB.
// ═══════════════════════════════════════════════════════════════════════════

// Shells/guards qui wrappent toutes les routes — doivent être disponibles
// avant le premier render pour éviter un flash de chargement.
import StaleBundleDetector from '@/components/layout/StaleBundleDetector'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import { ToastProvider } from '@/components/ui/Toast'
import AdminConsoleRoute from '@/components/admin/AdminConsoleRoute'
import ImpersonationHandoff from '@/components/admin/ImpersonationHandoff'
import SmartPageLoader from '@/components/skeletons/SmartPageLoader'

// Lazy-loaded public pages
// Property X storefront pages were removed — megga.ch now serves the static
// MEGGA vitrine (sites/megga-vitrine), overlaid at the deploy root by the npm
// postbuild hook. Only the Property X icon
// system remains under src/components/propertyx/ (MEIcon/PxIconFont/
// PxSocialIcon/PxWhatsAppButton + PX.* tokens), used across the CRM.

// Sprint 4.7.C — Parcours client KYC Magic Link (public, sans compte MEGGA)
const KycPublicPage = lazy(() => import('@/pages/public/KycPublicPage'))
const AppointmentManagePage = lazy(() => import('@/pages/public/AppointmentManagePage'))
// Réception acheteur — page publique par token (boucle de match, refonte juil. 2026)
const BuyerReceptionPage = lazy(() => import('@/pages/public/BuyerReceptionPage'))
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
const AgentSugarLayout = lazy(() => import('@/components/layout/AgentSugarLayout'))
// Étape 5 KYB, tâche 4 — garde LAB plein sur les routes kyc/* (layout-route, aucun path propre).
const KycLabGuard = lazy(() => import('@/components/layout/KycLabGuard'))

// CRM mobile (responsive < 768px) — branché par écran via ResponsiveRoute
const MobileMorePage = lazy(() => import('@/components/crm-mobile/more/MobileMorePage'))
const MobileTodayPage = lazy(() => import('@/components/crm-mobile/today/MobileTodayPage'))
const MobilePipelinePage = lazy(() => import('@/components/crm-mobile/pipeline/MobilePipelinePage'))
const MobileDealDetailPage = lazy(() => import('@/components/crm-mobile/deal/MobileDealDetailPage'))
const MobileMatchingPage = lazy(() => import('@/components/crm-mobile/matching/MobileMatchingPage'))
const MobileAgendaPage = lazy(() => import('@/components/crm-mobile/agenda/MobileAgendaPage'))
const MobileBiensPage = lazy(() => import('@/components/crm-mobile/biens/MobileBiensPage'))
const MobileBienVitrinePage = lazy(() => import('@/components/crm-mobile/bien/MobileBienVitrinePage'))
const MobileWizardPage = lazy(() => import('@/components/crm-mobile/wizard/MobileWizardPage'))
const MobileContactsListPage = lazy(() => import('@/components/crm-mobile/contacts/MobileContactsListPage'))
const MobileNewContactPage = lazy(() => import('@/components/crm-mobile/contacts/MobileNewContactPage'))
const MobileContactDetailPage = lazy(() => import('@/components/crm-mobile/contacts/MobileContactDetailPage'))
const MobileAnalyticsPage = lazy(() => import('@/components/crm-mobile/analytics/MobileAnalyticsPage'))
const MobileJourneyPage = lazy(() => import('@/components/crm-mobile/journey/MobileJourneyPage'))
const MobileKycListPage = lazy(() => import('@/components/crm-mobile/kyc/MobileKycListPage'))
const MobileKycDetailPage = lazy(() => import('@/components/crm-mobile/kyc/MobileKycDetailPage'))
const MobileSettingsPage = lazy(() => import('@/components/crm-mobile/settings/MobileSettingsPage'))

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
const ContactDetailSugarV3Page = lazy(() => import('@/pages/agent/ContactDetailSugarV3Page'))
const PipelineSugarV2Page = lazy(() => import('@/pages/agent/PipelineSugarV2Page'))
const ContactsSugarV2Page = lazy(() => import('@/pages/agent/ContactsSugarV2Page'))
const BiensSugarV2Page = lazy(() => import('@/pages/agent/BiensSugarV2Page'))
// Sprint 2 — Sugar v3 (port pixel-près handoff Bien + Deal + Visite)
const BienDetailSugarV4Page = lazy(() => import('@/pages/agent/BienDetailSugarV4Page'))
const DealDetailSugarV4Page = lazy(() => import('@/pages/agent/DealDetailSugarV4Page'))
const OfferModalSugarV3Page = lazy(() => import('@/pages/agent/OfferModalSugarV3Page'))
const VisitModalSugarV3Page = lazy(() => import('@/pages/agent/VisitModalSugarV3Page'))
const VisitDetailSugarV3Page = lazy(() => import('@/pages/agent/VisitDetailSugarV3Page'))
// VisitCompanionPage removed — the mobile companion view contained only
// non-functional UI (mic recording / photo capture / signature / sentiment
// cards with no persistence). The route + page were removed; real on-site
// visit capture is a separate sprint.
// Sprint 3 — Import Lead IA (Sugar plein écran 2 étapes, extraction Claude)
const ImportLeadSugarV3Page = lazy(() => import('@/pages/agent/ImportLeadSugarV3Page'))
const MatchingPagerPage = lazy(() => import('@/pages/agent/MatchingPagerPage'))
const JourneySugarV2Page = lazy(() => import('@/pages/agent/JourneySugarV2Page'))
const CalendarSugarV2Page = lazy(() => import('@/pages/agent/CalendarSugarV2Page'))
const SettingsSugarV2Page = lazy(() => import('@/pages/agent/SettingsSugarV2Page'))
const ListingFormPage = lazy(() => import('@/pages/agent/ListingFormPage'))
const WizardSugarV2Page = lazy(() => import('@/pages/agent/WizardSugarV2Page'))
const KycSugarV3Page = lazy(() => import('@/pages/agent/KycSugarV3Page'))
// Refonte KYC (handoff) — onboarding « Première ouverture » (empty-state).
const KycOnboardingPage = lazy(() => import('@/pages/agent/KycOnboardingPage'))
// Sprint 4.4 — Export PDF dossier KYC (route print-friendly, hors layout agent)
const KycExportPage = lazy(() => import('@/pages/agent/KycExportPage'))
// Étape 2 KYB — gate identité légale (/dashboard/identite). Desktop : coquille
// du wizard (IdentitySugarPage, tâche 3 le remplit). Mobile : invitation à
// terminer sur ordinateur (IdentityMobileNotice), hors périmètre v1.
const IdentitySugarPage = lazy(() => import('@/pages/agent/IdentitySugarPage'))
const IdentityMobileNotice = lazy(() => import('@/pages/agent/IdentityMobileNotice'))
// Étape 3 KYB — suite immédiate du wizard d'identité : réserver l'appel d'accueil
// avec l'équipe MEGGA. Écran passable, jamais bloquant.
const OnboardingCallPage = lazy(() => import('@/pages/agent/OnboardingCallPage'))
const OnboardingCallManagePage = lazy(() => import('@/pages/public/OnboardingCallManagePage'))
const AuditSugarPage = lazy(() => import('@/pages/agent/AuditSugarPage'))
const JulienSugarV2Page = lazy(() => import('@/pages/agent/JulienSugarV2Page'))
const MeggaXStyleGuidePage = lazy(() => import('@/pages/dev/MeggaXStyleGuidePage'))
const SentryTestPage = lazy(() => import('@/pages/dev/SentryTestPage'))
const MatchingAtelierDemoPage = lazy(() => import('@/pages/dev/MatchingAtelierDemoPage'))
const MobileShowcasePage = lazy(() => import('@/pages/dev/MobileShowcasePage'))
const BiensShowcasePage = lazy(() => import('@/pages/dev/BiensShowcasePage'))
const ContactsShowcasePage = lazy(() => import('@/pages/dev/ContactsShowcasePage'))
// Aperçu du parcours d'onboarding — DEV seulement (cf. sa route plus bas, et son
// en-tête pour les trois murs qui rendent ce parcours autrement inatteignable).
// Le ternaire n'est pas décoratif : `import.meta.env.DEV` est remplacé par `false`
// au build, l'import dynamique tombe dans une branche morte, et le chunk cesse
// d'être émis. Un `lazy()` inconditionnel, lui, produisait bien un
// `OnboardingPreviewPage-*.js` dans dist/ — jamais chargé, mais livré.
const OnboardingPreviewPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/dev/OnboardingPreviewPage'))
  : () => null
// MEGGA AI — panneau docké monté AU-DESSUS de <Routes>, hors de l'arbre de routage
// pour survivre au remount de navigation : le panneau + la conversation
// persistent d'une page à l'autre (suivi de contexte, chantier 5).
const CopilotPanel = lazy(() => import('@/components/ai-copilot/panel/CopilotPanel'))
const ExternalListingDetailPage = lazy(() => import('@/pages/agent/ExternalListingDetailPage'))

const AcceptInvitePage = lazy(() => import('@/pages/public/AcceptInvitePage'))
// Compte ACHETEUR retiré (pivot CRM-first) — page + composants archivés hors
// repo le 2026-06-08. /account → /dashboard. market_listings ne sert plus que
// le Matching agent.

// Centre d'aide : plus de page SPA — tout `/help/*` redirige vers Intercom
// (cf. HelpCenterRedirect plus bas).
// Les pages super-admin ne sont plus dans ce bundle : elles vivent dans
// la console super-admin, montée sous /dashboard/admin. Voir src/lib/adminEntry.ts.


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
 * `<AppRoutes>` rend la table de routage TELLE QUELLE : aucune clé sur
 * `<Routes>`, aucun `<AnimatePresence>` au-dessus.
 *
 * Les deux y ont été un temps — l'`AnimatePresence` pour interpoler des
 * `layoutId` d'une route à l'autre (carte marketplace → hero de bien, ligne de
 * bien → overlay). Ces composants ont été retirés avec la marketplace et la
 * refonte Sugar ; les `layoutId` survivants sont tous INTRA-arbre (carte de deal
 * du pipeline, photo galerie ↔ ligne galerie, indicateur d'onglet mobile) et
 * n'ont donc besoin de rien à ce niveau.
 *
 * Ce qui restait, en revanche, coûtait cher : `key={location.pathname}`
 * détruisait et recréait TOUT l'arbre protégé à chaque changement de page
 * (ProtectedRoute, sa frontière Suspense, le layout, le ThemeProvider, le
 * contexte copilote, la page). Une frontière Suspense neuve oblige React à
 * commiter son fallback même en transition — d'où un écran de chargement plein
 * cadre entre deux pages CRM, malgré `v7_startTransition`. Sans la clé, la
 * frontière est PRÉSERVÉE d'une route sœur à l'autre : React garde la page
 * précédente à l'écran pendant le téléchargement du chunk, et l'écran de
 * chargement disparaît.
 *
 * Les transitions de page (fondu/glissement) ont été retirées à part, sur retour
 * d'usage : Linear / Notion / Vercel / Stripe changent de route instantanément.
 * Les animations locales (Sheet, Toast, taps, voile de langue…) portent leur
 * propre `AnimatePresence` et ne dépendent pas de ce niveau.
 */

/**
 * Force le remontage d'une feuille dont l'IDENTITÉ vient de l'URL.
 *
 * Sans clé sur `<Routes>`, passer de `/dashboard/contacts/a` à `.../b` garde le
 * même élément monté : seuls les params changent, et l'état local de la page
 * (brouillons d'édition, page du pager, défilement) survivrait d'une fiche à
 * l'autre. On rétablit ici la sémantique d'avant — mais SEULEMENT sur la
 * feuille, donc sans remonter le shell ni la frontière Suspense.
 */
function ByParam({ children }: { children: React.ReactNode }) {
  const params = useParams()
  return <Fragment key={Object.values(params).join('/')}>{children}</Fragment>
}
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
// Portail vendeur RETIRÉ (2026-07-26). La fonctionnalité n'a jamais servi : la
// table `seller_portals` comptait 0 ligne depuis sa création, aucun lien personnel
// n'a donc jamais été envoyé, et l'UI de création avait déjà disparu de la fiche
// contact. Les URLs `/portal*` et `/portail*` redirigent vers la vitrine plutôt
// que de rendre un 404, comme les routes marketplace du pivot CRM-first.
// Redirection externe (autre domaine) → window.location, pas <Navigate>.
function SellerPortalRemovedRedirect() {
  if (typeof window !== 'undefined') window.location.replace(VITRINE_URL)
  return null
}
// Centre d'aide : le corpus vit dans Intercom (18 articles FR+EN, maintenus via
// `scripts/intercom-content.mjs`). Les 12 pages SPA `/help/*` étaient un second
// corpus figé, hérité de l'ancien site public — retirées le 2026-07-20 : elles se
// périmaient en silence et rendaient le chrome vitrine dans l'app CRM.
// Toutes les anciennes URLs (`/help/*`, `/aide/*`) atterrissent sur le vrai centre.
const HELP_CENTER_URL = 'https://intercom.help/megga/fr'
function HelpCenterRedirect() {
  if (typeof window !== 'undefined') window.location.replace(HELP_CENTER_URL)
  return null
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

function AppRoutes() {
  return (
    <Routes>
              {/* Public storefront (home, about, properties, contact, FAQ,
                  blog, agents, property single, design-system…) is served by
                  the static MEGGA vitrine (sites/megga-vitrine) on megga.ch.
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
              {/* Réception acheteur — sélection de biens transmise par lien privé (boucle de match) */}
              <Route path="/reception/:token" element={<BuyerReceptionPage />} />
              {/* Gestion par le client de son RDV de vérification KYC (jeton k='appt').
                  Le jeton porte déjà l'id du rendez-vous : pas d'id dans l'URL. */}
              <Route path="/rendez-vous/:token" element={<AppointmentManagePage />} />
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
              {/* Lien personnel de l'appel d'accueil : le jeton est la capability,
                  aucune session requise (cf. get_onboarding_call_by_token).

                  ⚠ `/rendez-vous-accueil/` et NON `/rendez-vous/` : ce dernier est déjà
                  pris, plus haut dans ce même fichier, par AppointmentManagePage (RDV de
                  vérification KYC, jeton émis par appointment-book). React Router retient
                  la PREMIÈRE route qui matche — cette page-ci était donc injoignable
                  depuis sa création, et chaque lien « replanifier ou annuler » des e-mails
                  d'appel d'accueil atterrissait sur l'écran KYC, qui interrogeait sa
                  propre RPC avec un jeton qu'elle ne connaît pas. Constaté le 04.08.2026
                  en essayant d'ouvrir la page.

                  Les trois edge functions qui construisent ce lien (onboarding-call-book,
                  -manage, -reminder) ont été alignées dans le même changement : le chemin
                  vit à quatre endroits, il doit bouger aux quatre. */}
              <Route path="/rendez-vous-accueil/:token" element={<OnboardingCallManagePage />} />
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

              {/* Centre d'aide → Intercom. Le catch-all `*` couvre les anciens
                  sous-chemins (start, glossary, :category/:slug…) ; idem pour /aide. */}
              <Route path="/help" element={<HelpCenterRedirect />} />
              <Route path="/help/*" element={<HelpCenterRedirect />} />
              <Route path="/aide" element={<HelpCenterRedirect />} />
              <Route path="/aide/*" element={<HelpCenterRedirect />} />

              {/* Portail vendeur RETIRÉ — toutes ses URLs partent vers la vitrine.
                  Deux splats suffisent là où il y avait 13 routes. */}
              <Route path="/portal" element={<SellerPortalRemovedRedirect />} />
              <Route path="/portal/*" element={<SellerPortalRemovedRedirect />} />
              <Route path="/portail" element={<SellerPortalRemovedRedirect />} />
              <Route path="/portail/*" element={<SellerPortalRemovedRedirect />} />

              {/* Dev showcase routes (no auth) */}
              <Route path="/design-system/megga-x" element={<MeggaXStyleGuidePage />} />
              {/* Atelier Matching — démo QA visuelle (mocks handoff, zéro écriture) */}
              <Route path="/dev/matching-atelier" element={<MatchingAtelierDemoPage />} />
              <Route path="/dev/sentry-test" element={<SentryTestPage />} />
              <Route path="/dev/mobile" element={<MobileShowcasePage />} />
              {/* Mes biens sans session : ProtectedRoute renvoie sinon vers la PRODUCTION. */}
              <Route path="/dev/biens" element={<BiensShowcasePage />} />
              {/* Contacts — même raison, même idiome (liste, fiche, premier lancement, import). */}
              <Route path="/dev/contacts" element={<ContactsShowcasePage />} />
              {/* Onboarding — la SEULE de ces routes à être conditionnée au mode dev.
                  Les autres ne montrent que des maquettes ; celle-ci monte les écrans
                  réels avec l'écriture entre étapes neutralisée (IdentityShellPreview),
                  ce qui n'a aucune raison d'exister dans un bundle déployé. */}
              {import.meta.env.DEV && (
                <Route path="/dev/onboarding" element={<OnboardingPreviewPage />} />
              )}


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
                {/* La console vit DANS le CRM depuis juillet 2026 : plus d'onglet,
                    plus de passage de session par fragment, et l'URL redevient
                    rechargeable et partageable. Le splat `*` est requis — la
                    console monte son propre <Routes> relatif dessous.

                    Sous la coquille Sugar, qui ne rend aucun chrome : la
                    console porte le sien. */}
                <Route path="admin/*" element={<AdminConsoleRoute />} />
                <Route path="pipeline" element={<ResponsiveRoute desktop={<PipelineSugarV2Page />} mobile={<MobilePipelinePage />} />} />
                {/* Contacts — mobile (< 768px) : liste (P8). */}
                <Route path="contacts" element={<ResponsiveRoute desktop={<ContactsSugarV2Page />} mobile={<MobileContactsListPage />} />} />
                {/* Création contact — mobile only (desktop : modale dans le pager). */}
                <Route path="contacts/new" element={<ResponsiveRoute desktop={<Navigate to="/dashboard/contacts" replace />} mobile={<MobileNewContactPage />} />} />
                {/* Import de contacts — porté sous Sugar (chrome auto-porté). */}
                {/* Portées depuis AgentLayout : elles épousent le pager Sugar. */}
                <Route path="market/:externalId" element={<ByParam><ExternalListingDetailPage /></ByParam>} />
                <Route path="marche/:externalId" element={<DashboardMarketRedirect />} />
                <Route path="listings/new" element={<ResponsiveRoute desktop={<WizardSugarV2Page />} mobile={<MobileWizardPage />} />} />
                <Route path="listings/:id/edit" element={<ByParam><ListingFormPage /></ByParam>} />
                {/* Fiche contact — pager 2 pages (refonte Claude Design juil. 2026).
                    Sous AgentSugarLayout (chrome Sugar auto-porté) pour cohérence
                    liste↔fiche. Mobile (< 768px) : fiche détail P8/2. */}
                <Route path="contacts/:id" element={<ByParam><ResponsiveRoute desktop={<ContactDetailSugarV3Page />} mobile={<MobileContactDetailPage />} /></ByParam>} />
                {/* Mes biens — mobile (< 768px) : galerie portefeuille (P7). */}
                <Route path="listings" element={<ResponsiveRoute desktop={<BiensSugarV2Page />} mobile={<MobileBiensPage />} />} />
                {/* Sprint 2 — Fiche Bien Sugar Pure (édition inline + AuditEvent).
                    Mobile (< 768px) : fiche lecture seule (P7). */}
                <Route path="listings/:id" element={<ByParam><ResponsiveRoute desktop={<BienDetailSugarV4Page />} mobile={<MobileBienVitrinePage />} /></ByParam>} />
                {/* Sprint 2 — Fiche Deal Sugar Pure (stepper 8 + bannière KYC + offres) */}
                <Route path="transactions/:id" element={<ByParam><ResponsiveRoute desktop={<DealDetailSugarV4Page />} mobile={<MobileDealDetailPage />} /></ByParam>} />
                {/* Sprint 2 — Modal Offre / Contre-offre (Sugar plein écran 3 étapes) */}
                <Route path="transactions/:id/offre/:kind" element={<ByParam><OfferModalSugarV3Page /></ByParam>} />
                {/* Sprint 2 — Modal Planifier Visite (Sugar plein écran 3 étapes) */}
                <Route path="visits/new" element={<VisitModalSugarV3Page />} />
                {/* Sprint 2 — Fiche Visite (bon + rapport) */}
                <Route path="visits/:id" element={<ByParam><VisitDetailSugarV3Page /></ByParam>} />
                {/* Legacy FR */}
                <Route path="visites/nouveau" element={<Navigate to="/dashboard/visits/new" replace />} />
                <Route path="visites/:id" element={<DashboardVisitRedirect />} />
                {/* Sprint 3 — Import Lead IA (?text=...&returnTo=...) */}
                <Route path="import-lead" element={<ImportLeadSugarV3Page />} />
                {/* Matching — pager vertical (refonte Claude Design juil. 2026) :
                    page 0 = atelier triptyque « par score » · page 1 = recherche
                    hybride du marché (vente + location). Deep-links portés par
                    l'atelier : ?annonce=p:<id>|m:<id> · ?contact=<id>.
                    Mobile (< 768px) : inbox acheteurs + focus. */}
                <Route path="matching" element={<ResponsiveRoute desktop={<MatchingPagerPage />} mobile={<MobileMatchingPage />} />} />
                {/* Parcours — mobile (< 768px) : dossiers en vue panoramique (P9). */}
                <Route path="journey" element={<ResponsiveRoute desktop={<JourneySugarV2Page />} mobile={<MobileJourneyPage />} />} />
                <Route path="parcours" element={<Navigate to="/dashboard/journey" replace />} />
                {/* Agenda — mobile (< 768px) : jour liste + time-block (P6). */}
                <Route path="calendar" element={<ResponsiveRoute desktop={<CalendarSugarV2Page />} mobile={<MobileAgendaPage />} />} />
                {/* Réglages — mobile (< 768px) : hub de réglages (P9). */}
                <Route path="settings" element={<ResponsiveRoute desktop={<SettingsSugarV2Page />} mobile={<MobileSettingsPage />} />} />
                {/* Sprint 1 — Sugar v3 (port pixel-près handoff KYC + LBA) */}
                {/* Étape 5 KYB, tâche 4 — garde LAB plein : KycLabGuard (layout-route, aucun
                    path propre) remplace ces trois routes par un écran de blocage tant que
                    agencies.verification_status n'est ni auto_validated ni validated.
                    Regroupées sous un seul <Route> parent pour ne monter le garde qu'une fois. */}
                <Route element={<KycLabGuard />}>
                  {/* KYC — pager 2 pages (Dossiers · Vigie). Mobile (< 768px) : liste (P9). */}
                  <Route path="kyc" element={<ResponsiveRoute desktop={<KycSugarV3Page />} mobile={<MobileKycListPage />} />} />
                  {/* Onboarding « Première ouverture » (desktop) — refonte KYC. */}
                  <Route
                    path="kyc/bienvenue"
                    element={<ResponsiveRoute desktop={<KycOnboardingPage />} mobile={<Navigate to="/dashboard/kyc" replace />} />}
                  />
                  {/* Détail dossier KYC — fiche en overlay (desktop) ; mobile : 4 onglets (P9). */}
                  <Route path="kyc/:dossierId" element={<ByParam><ResponsiveRoute desktop={<KycSugarV3Page />} mobile={<MobileKycDetailPage />} /></ByParam>} />
                </Route>
                {/* Étape 2 KYB — gate identité légale (useIdentityGate redirige ici depuis
                    AgentSugarLayout tant que agencies.identity_submitted_at est nul).
                    Mobile (< 768px) : la saisie se termine sur ordinateur uniquement. */}
                <Route path="identite" element={<ResponsiveRoute desktop={<IdentitySugarPage />} mobile={<IdentityMobileNotice />} />} />
                {/* Étape 3 KYB — réservation de l'appel d'accueil, à la sortie du wizard. */}
                <Route path="rendez-vous-accueil" element={<OnboardingCallPage />} />
                {/* Réseau inter-agences — hors périmètre v1 (route neutralisée ; NetworkSugarV2Page retirée) */}
                <Route path="network" element={<Navigate to="/dashboard" replace />} />
                <Route path="reseau" element={<Navigate to="/dashboard" replace />} />
                {/* Onboarding post-login supprimé (juil. 2026) — anciens liens/onglets ouverts → dashboard */}
                <Route path="onboarding" element={<Navigate to="/dashboard" replace />} />
                <Route path="premier-jour" element={<Navigate to="/dashboard" replace />} />
                {/* Sprint 1 — Journal d'audit nLPD (livrable #4) */}
                <Route path="audit" element={<AuditSugarPage />} />
                <Route path="julien" element={<JulienSugarV2Page />} />
                {/* Sprint 4 — Dashboard Analytics Sugar v4 (Cockpit / Entonnoir / Objectif) */}
                {/* Analytics — mobile (< 768px) : cockpit commission (P9). */}
                <Route path="analytics" element={<ResponsiveRoute desktop={<DashboardSugarV4Page />} mobile={<MobileAnalyticsPage />} />} />
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

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

// Rend le panneau MEGGA AI uniquement sur les routes CRM (/dashboard). Monté
// HORS de <Routes> → stable à la navigation (le panneau et
// sa conversation ne se ferment plus quand on change de page). Lazy + Suspense
// null car le panneau est invisible tant qu'il n'est pas ouvert.
function CopilotPanelHost() {
  const { pathname } = useLocation()
  if (!pathname.startsWith('/dashboard')) return null
  return (
    <Suspense fallback={null}>
      <CopilotPanel />
    </Suspense>
  )
}

/** Point d'entrée : empile les providers globaux autour des routes et des widgets globaux (cookies, Intercom, panneau IA). */
export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <StaleBundleDetector />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            {/* Aucun voile de bascule de langue ici, et c'est délibéré (3 août 2026).
                `<LanguageChangeOverlay>` occupait cette place : 350 ms de verre dépoli
                plein écran par `languageChanged`. Or l'événement partait DEUX fois par
                choix — les sélecteurs appelaient `changeLanguage()` avant que le bundle
                existe —, soit ~1 s de veille opaque mesurée pour 60 ms de travail réel,
                avec un passage par le français au milieu. Le voile masquait ce défaut ;
                `switchLanguage()` (src/i18n/index.ts) le supprime à la source, en
                chargeant avant de basculer. Ce qui reste à couvrir est le seul
                téléchargement, et se couvre là où il se voit : un squelette DANS la
                surface concernée, jamais un voile sur toute l'application. */}
            <AiPanelProvider>
              <ErrorBoundary>
                <Suspense fallback={<SmartPageLoader />}>
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
              {/* Panneau MEGGA AI — stable au-dessus de <Routes> (persiste à la nav). */}
              <CopilotPanelHost />
              {/* Reprise d'une impersonation ouverte depuis la console admin. */}
              <ImpersonationHandoff />
            </AiPanelProvider>
            {/* Widgets globaux : lazy avec fallback null car invisibles par défaut. */}
            <Suspense fallback={null}>
              <FavoritesLoginPrompt />
              <IntercomMessenger />
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
