/**
 * Point d'entrée de l'application React (bundle Vite). Monte <App/> dans #root
 * sous StrictMode et amorce la télémétrie : Sentry seul, inconditionnel car
 * opérationnel (pas de gate de consentement).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/i18n'
import { initSentry } from '@/lib/sentry'
import App from './App'
import './styles/globals.css'
import './components/crm-sugar-v3/responsive.css'

// Initialize Sentry error tracking (essential/operational — no user consent gate)
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
