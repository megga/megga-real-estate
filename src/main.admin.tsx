/**
 * Point d'entrée du bundle de la console super-admin (admin.megga.ch).
 * Jumeau de `main.tsx`, sans PostHog : une console interne n'a pas d'analytics
 * produit à collecter. Sentry est gardé (erreurs d'exploitation).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/i18n'
import { initSentry } from '@/lib/sentry'
import AdminApp from './AdminApp'
import './styles/globals.css'
// APRÈS globals.css : re-teinte les variables de thème sur la palette Sugar
// (même spécificité, l'ordre décide). Voir l'en-tête du fichier.
import './styles/admin-console.css'

initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
