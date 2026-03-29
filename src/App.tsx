import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'

// Static imports — shell + most-visited pages (loaded immediately)
import HomePage from '@/pages/public/HomePage'
import LoginPage from '@/pages/public/LoginPage'
import RegisterPage from '@/pages/public/RegisterPage'
import AuthCallbackPage from '@/pages/public/AuthCallbackPage'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import PasswordGate from '@/components/layout/PasswordGate'
import AgentLayout from '@/components/layout/AgentLayout'
import ActionBoardPage from '@/pages/agent/ActionBoardPage'

// Lazy-loaded public pages
const SearchPage = lazy(() => import('@/pages/public/SearchPage'))
const ListingPage = lazy(() => import('@/pages/public/ListingPage'))
const LouerPage = lazy(() => import('@/pages/public/LouerPage'))
const VendrePage = lazy(() => import('@/pages/public/VendrePage'))
const EstimationsPage = lazy(() => import('@/pages/public/EstimationsPage'))
const ServicesPage = lazy(() => import('@/pages/public/ServicesPage'))
const PublierPage = lazy(() => import('@/pages/public/PublierPage'))
const ResetPasswordPage = lazy(() => import('@/pages/public/ResetPasswordPage'))
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'))
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'))
const VisitManagePage = lazy(() => import('@/pages/public/VisitManagePage'))
const VisitFeedbackPage = lazy(() => import('@/pages/public/VisitFeedbackPage'))

// Lazy-loaded agent pages (except ActionBoardPage which is static)
const DashboardPage = lazy(() => import('@/pages/agent/DashboardPage'))
const ContactsPage = lazy(() => import('@/pages/agent/ContactsPage'))
const ContactImportPage = lazy(() => import('@/pages/agent/ContactImportPage'))
const ContactDetailPage = lazy(() => import('@/pages/agent/ContactDetailPage'))
const PipelinePage = lazy(() => import('@/pages/agent/PipelinePage'))
const SettingsPage = lazy(() => import('@/pages/agent/SettingsPage'))
const MatchingPage = lazy(() => import('@/pages/agent/MatchingPage'))
const ListingsPage = lazy(() => import('@/pages/agent/ListingsPage'))
const ListingFormPage = lazy(() => import('@/pages/agent/ListingFormPage'))
const KycListPage = lazy(() => import('@/pages/agent/KycListPage'))
const KycDetailPage = lazy(() => import('@/pages/agent/KycDetailPage'))
const ChatPage = lazy(() => import('@/pages/agent/ChatPage'))
const CalendarPage = lazy(() => import('@/pages/agent/CalendarPage'))
const AutomationPage = lazy(() => import('@/pages/agent/AutomationPage'))
const TemplatesPage = lazy(() => import('@/pages/agent/TemplatesPage'))
const DocumentGenerator = lazy(() => import('@/pages/agent/DocumentGenerator'))
const DocumentViewer = lazy(() => import('@/pages/agent/DocumentViewer'))
const CustomTemplatePage = lazy(() => import('@/pages/agent/CustomTemplatePage'))
const ExternalListingDetailPage = lazy(() => import('@/pages/agent/ExternalListingDetailPage'))

// Lazy-loaded seller portal pages
const SellerLayout = lazy(() => import('@/pages/particulier/SellerLayout'))
const PortalGateway = lazy(() => import('@/pages/particulier/PortalGateway'))
const MonDossierPage = lazy(() => import('@/pages/particulier/MonDossierPage'))
const MesVisitesPage = lazy(() => import('@/pages/particulier/MesVisitesPage'))
const MesOffresPage = lazy(() => import('@/pages/particulier/MesOffresPage'))
const MesDocumentsPage = lazy(() => import('@/pages/particulier/MesDocumentsPage'))
const MesMessagesPage = lazy(() => import('@/pages/particulier/MesMessagesPage'))
const AnalysePage = lazy(() => import('@/pages/particulier/AnalysePage'))
const MonProfilPage = lazy(() => import('@/pages/particulier/MonProfilPage'))
const AcceptInvitePage = lazy(() => import('@/pages/public/AcceptInvitePage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-5 w-5 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <PasswordGate>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/listing/:id" element={<ListingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/acheter" element={<SearchPage />} />
              <Route path="/louer" element={<LouerPage />} />
              <Route path="/vendre" element={<VendrePage />} />
              <Route path="/estimations" element={<EstimationsPage />} />
              <Route path="/estimer" element={<EstimationsPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/publier" element={<PublierPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/visite/:id/modifier" element={<VisitManagePage />} />
              <Route path="/visite/:id/feedback" element={<VisitFeedbackPage />} />
              <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />

              {/* Portail vendeur — accès direct (dev/test) */}
              <Route path="/portail" element={<SellerLayout />}>
                <Route index element={<MonDossierPage />} />
                <Route path="visites" element={<MesVisitesPage />} />
                <Route path="offres" element={<MesOffresPage />} />
                <Route path="documents" element={<MesDocumentsPage />} />
                <Route path="messages" element={<MesMessagesPage />} />
                <Route path="analyse" element={<AnalysePage />} />
                <Route path="profil" element={<MonProfilPage />} />
              </Route>

              {/* Portail vendeur — accès tokénisé (production) */}
              <Route path="/portail/:token" element={<PortalGateway />}>
                <Route index element={<MonDossierPage />} />
                <Route path="visites" element={<MesVisitesPage />} />
                <Route path="offres" element={<MesOffresPage />} />
                <Route path="documents" element={<MesDocumentsPage />} />
                <Route path="messages" element={<MesMessagesPage />} />
                <Route path="analyse" element={<AnalysePage />} />
              </Route>

              {/* Agent dashboard (protected) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AgentLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<ActionBoardPage />} />
                <Route path="analytics" element={<DashboardPage />} />
                <Route path="contacts" element={<ContactsPage />} />
                <Route path="contacts/import" element={<ContactImportPage />} />
                <Route path="contacts/:id" element={<ContactDetailPage />} />
                <Route path="pipeline" element={<PipelinePage />} />
                <Route path="matching" element={<MatchingPage />} />
                <Route path="marche/:externalId" element={<ExternalListingDetailPage />} />
                <Route path="listings" element={<ListingsPage />} />
                <Route path="listings/new" element={<ListingFormPage />} />
                <Route path="listings/:id/edit" element={<ListingFormPage />} />
                <Route path="kyc" element={<KycListPage />} />
                <Route path="kyc/:id" element={<KycDetailPage />} />
                <Route path="messages" element={<ChatPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="automation" element={<AutomationPage />} />
                <Route path="documents" element={<TemplatesPage />} />
                <Route path="documents/generate" element={<DocumentGenerator />} />
                <Route path="documents/templates/new" element={<CustomTemplatePage />} />
                <Route path="documents/view" element={<DocumentViewer />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </PasswordGate>
  )
}
