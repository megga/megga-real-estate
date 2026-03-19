import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import HomePage from '@/pages/public/HomePage'
import SearchPage from '@/pages/public/SearchPage'
import LoginPage from '@/pages/public/LoginPage'
import RegisterPage from '@/pages/public/RegisterPage'
import AuthCallbackPage from '@/pages/public/AuthCallbackPage'
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
import OnboardingBuyerPP from '@/pages/onboarding/OnboardingBuyerPP'
import OnboardingBuyerPM from '@/pages/onboarding/OnboardingBuyerPM'
import OnboardingSellerPP from '@/pages/onboarding/OnboardingSellerPP'
import OnboardingSellerPM from '@/pages/onboarding/OnboardingSellerPM'
import SellerLayout from '@/pages/seller/SellerLayout'
import SellerDashboard from '@/pages/seller/SellerDashboard'
import SellerVisits from '@/pages/seller/SellerVisits'
import SellerOffers from '@/pages/seller/SellerOffers'
import SellerDocuments from '@/pages/seller/SellerDocuments'
import SellerMessages from '@/pages/seller/SellerMessages'
import BuyerLayout from '@/pages/buyer/BuyerLayout'
import BuyerDashboard from '@/pages/buyer/BuyerDashboard'
import BuyerFavorites from '@/pages/buyer/BuyerFavorites'
import BuyerSearches from '@/pages/buyer/BuyerSearches'
import BuyerAlerts from '@/pages/buyer/BuyerAlerts'
import BuyerMessages from '@/pages/buyer/BuyerMessages'
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
            <Route path="/acheter" element={<SearchPage />} />
            <Route path="/louer" element={<LouerPage />} />
            <Route path="/vendre" element={<VendrePage />} />
            <Route path="/estimations" element={<EstimationsPage />} />
            <Route path="/estimer" element={<EstimationsPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/publier" element={<PublierPage />} />
            <Route path="/aide" element={<HelpCenterPage />} />

            {/* Onboarding client */}
            <Route path="/onboarding/buyer/individual" element={<OnboardingBuyerPP />} />
            <Route path="/onboarding/buyer/company" element={<OnboardingBuyerPM />} />
            <Route path="/onboarding/seller/individual" element={<OnboardingSellerPP />} />
            <Route path="/onboarding/seller/company" element={<OnboardingSellerPM />} />

            {/* Buyer portal (protected — buyers) */}
            <Route path="/mon-espace" element={<ProtectedRoute allowedRoles={['buyer', 'seller', 'admin']}><BuyerLayout /></ProtectedRoute>}>
              <Route index element={<BuyerDashboard />} />
              <Route path="favoris" element={<BuyerFavorites />} />
              <Route path="recherches" element={<BuyerSearches />} />
              <Route path="alertes" element={<BuyerAlerts />} />
              <Route path="messages" element={<BuyerMessages />} />
            </Route>

            {/* Seller portal (protected — sellers only) */}
            <Route path="/seller" element={<ProtectedRoute allowedRoles={['seller', 'admin']}><SellerLayout /></ProtectedRoute>}>
              <Route index element={<SellerDashboard />} />
              <Route path="visits" element={<SellerVisits />} />
              <Route path="offers" element={<SellerOffers />} />
              <Route path="documents" element={<SellerDocuments />} />
              <Route path="messages" element={<SellerMessages />} />
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
