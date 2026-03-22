import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/i18n'
import { initPostHog } from '@/lib/posthog'
import App from './App'
import './styles/globals.css'

// Initialize PostHog analytics (only if VITE_POSTHOG_KEY is set)
initPostHog()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
