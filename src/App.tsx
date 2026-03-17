import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import SkipToContent from '@/components/layout/SkipToContent'
import Toaster from '@/components/ui/toaster'
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
import SettingsPage from '@/pages/agent/SettingsPage'
import ListingsPage from '@/pages/agent/ListingsPage'
import ListingFormPage from '@/pages/agent/ListingFormPage'
import KycPage from '@/pages/agent/KycPage'
import MessagesPage from '@/pages/agent/MessagesPage'
import CalendarPage from '@/pages/agent/CalendarPage'

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
          <SkipToContent />
          <Toaster />
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/listing/:id" element={<ListingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

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
              <Route path="kyc" element={<KycPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
