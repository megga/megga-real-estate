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

            {/* Agent dashboard (protected — agents only) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['agent', 'admin', 'manager', 'assistant']}>
                  <AgentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="contacts/:id" element={<ContactDetailPage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              {/* Future routes: listings, kyc, messages, calendar, settings */}
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
