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
import DashboardPage from '@/pages/agent/DashboardPage'
import ContactsPage from '@/pages/agent/ContactsPage'
import ContactDetailPage from '@/pages/agent/ContactDetailPage'
import PipelinePage from '@/pages/agent/PipelinePage'
import ListingsPage from '@/pages/agent/ListingsPage'
import ListingFormPage from '@/pages/agent/ListingFormPage'
import KycListPage from '@/pages/agent/KycListPage'
import KycDetailPage from '@/pages/agent/KycDetailPage'
import MessagesPage from '@/pages/agent/MessagesPage'
import CalendarPage from '@/pages/agent/CalendarPage'
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

            {/* Onboarding client (public) */}
            <Route path="/onboarding/buyer/individual" element={<OnboardingBuyerPP />} />
            <Route path="/onboarding/buyer/company" element={<OnboardingBuyerPM />} />
            <Route path="/onboarding/seller/individual" element={<OnboardingSellerPP />} />
            <Route path="/onboarding/seller/company" element={<OnboardingSellerPM />} />

            {/* Seller portal */}
            <Route path="/seller" element={<SellerLayout />}>
              <Route index element={<SellerDashboard />} />
              <Route path="visits" element={<SellerVisits />} />
              <Route path="offers" element={<SellerOffers />} />
              <Route path="documents" element={<SellerDocuments />} />
              <Route path="messages" element={<SellerMessages />} />
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
              <Route index element={<DashboardPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="contacts/:id" element={<ContactDetailPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="listings" element={<ListingsPage />} />
              <Route path="listings/new" element={<ListingFormPage />} />
              <Route path="kyc" element={<KycListPage />} />
              <Route path="kyc/:id" element={<KycDetailPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="calendar" element={<CalendarPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
