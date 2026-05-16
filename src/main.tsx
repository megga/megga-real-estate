import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/i18n'
import { initPostHogIfConsented } from '@/lib/posthog'
import App from './App'
import './styles/globals.css'
import './components/crm-sugar-v3/responsive.css'

// Initialize PostHog analytics only if the user has consented (LPD-C3)
initPostHogIfConsented()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
