/**
 * Point d'entrée de l'application React (bundle Vite). Monte <App/> dans #root
 * sous StrictMode et amorce la télémétrie : Sentry inconditionnel (opérationnel),
 * PostHog gaté au consentement LPD.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/i18n'
import { applyDetectedLanguage } from '@/lib/geoLanguage'
import { initPostHogIfConsented } from '@/lib/posthog'
import { initSentry } from '@/lib/sentry'
import App from './App'
import './styles/globals.css'
import './components/crm-sugar-v3/responsive.css'

// Initialize Sentry error tracking (essential/operational — no user consent gate)
initSentry()

// Initialize PostHog analytics only if the user has consented (LPD-C3)
initPostHogIfConsented()

// Langue déduite du pays, UNIQUEMENT au tout premier contact (aucune préférence
// stockée, aucun `?lang=`). Hors du rendu et sans `await` : un hôte lent ne doit
// pas retarder le premier écran, et un échec ne doit rien casser — le CRM
// démarre en français, comme avant. Au niveau module, donc une seule fois :
// StrictMode ferait partir deux requêtes depuis un effet.
//
// Production seulement. L'endpoint `/api/geo` vit dans le worker de megga.ch,
// une AUTRE origine que celle du CRM : hors production on interroge donc le
// megga.ch en ligne, dont le worker déployé peut ne pas encore porter la route.
// Le navigateur journalise alors lui-même un refus CORS — impossible à étouffer
// depuis le `catch` de fetchGeoLanguage — et 35 tests E2E qui exigent une console
// vierge tombent. Détecter la langue n'a de toute façon aucun sens face à une IP
// de runner CI ou de poste de dev.
if (import.meta.env.PROD) void applyDetectedLanguage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
