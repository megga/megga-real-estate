import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import HomePage from '@/pages/public/HomePage'
import SearchPage from '@/pages/public/SearchPage'
import LoginPage from '@/pages/public/LoginPage'
import RegisterPage from '@/pages/public/RegisterPage'
import AuthCallbackPage from '@/pages/public/AuthCallbackPage'
import ResetPasswordPage from '@/pages/public/ResetPasswordPage'
import ListingPage from '@/pages/public/ListingPage'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AgentLayout from '@/components/layout/AgentLayout'
import ActionBoardPage from '@/pages/agent/ActionBoardPage'
import DashboardPage from '@/pages/agent/DashboardPage'
import ContactsPage from '@/pages/agent/ContactsPage'
import ContactDetailPage from '@/pages/agent/ContactDetailPage'
import PipelinePage from '@/pages/agent/PipelinePage'
import MatchingPage from '@/pages/agent/MatchingPage'
import AutomationPage from '@/pages/agent/AutomationPage'
import ListingsPage from '@/pages/agent/ListingsPage'
import ListingFormPage from '@/pages/agent/ListingFormPage'
import KycListPage from '@/pages/agent/KycListPage'
import KycDetailPage from '@/pages/agent/KycDetailPage'
import MessagesPage from '@/pages/agent/MessagesPage'
import CalendarPage from '@/pages/agent/CalendarPage'
import SettingsPage from '@/pages/agent/SettingsPage'
import TemplatesPage from '@/pages/agent/TemplatesPage'
import DocumentGenerator from '@/pages/agent/DocumentGenerator'
import DocumentViewer from '@/pages/agent/DocumentViewer'
import ParticulierLayout from '@/pages/particulier/ParticulierLayout'
import MonDossierPage from '@/pages/particulier/MonDossierPage'
import MesDocumentsPage from '@/pages/particulier/MesDocumentsPage'
import MesMessagesPage from '@/pages/particulier/MesMessagesPage'
import MonProfilPage from '@/pages/particulier/MonProfilPage'
import LouerPage from '@/pages/public/LouerPage'
import VendrePage from '@/pages/public/VendrePage'
import EstimationsPage from '@/pages/public/EstimationsPage'
import ServicesPage from '@/pages/public/ServicesPage'
import PublierPage from '@/pages/public/PublierPage'
import NotFoundPage from '@/pages/public/NotFoundPage'
import HelpCenterPage from '@/pages/public/HelpCenterPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/listing/:id" element={<ListingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/acheter" element={<SearchPage />} />
            <Route path="/louer" element={<LouerPage />} />
            <Route path="/vendre" element={<VendrePage />} />
            <Route path="/estimations" element={<EstimationsPage />} />
            <Route path="/estimer" element={<EstimationsPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/publier" element={<PublierPage />} />
            <Route path="/aide" element={<HelpCenterPage />} />

            {/* Particulier portal (protected — buyers/sellers/particuliers) */}
            <Route path="/mon-espace" element={<ProtectedRoute allowedRoles={['buyer', 'seller', 'particulier']}><ParticulierLayout /></ProtectedRoute>}>
              <Route index element={<MonDossierPage />} />
              <Route path="documents" element={<MesDocumentsPage />} />
              <Route path="messages" element={<MesMessagesPage />} />
              <Route path="profil" element={<MonProfilPage />} />
            </Route>

            {/* Agent dashboard (protected — agents only) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['agent', 'admin', 'manager', 'assistant']}>
                  <AgentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ActionBoardPage />} />
              <Route path="stats" element={<DashboardPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="contacts/:id" element={<ContactDetailPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="matching" element={<MatchingPage />} />
              <Route path="automation" element={<AutomationPage />} />
              <Route path="listings" element={<ListingsPage />} />
              <Route path="listings/new" element={<ListingFormPage />} />
              <Route path="listings/:id/edit" element={<ListingFormPage />} />
              <Route path="kyc" element={<KycListPage />} />
              <Route path="kyc/:id" element={<KycDetailPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="templates/generate" element={<DocumentGenerator />} />
              <Route path="documents/view" element={<DocumentViewer />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
