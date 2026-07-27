/**
 * Point d'entrée du bundle de la console super-admin (admin.megga.ch).
 * Jumeau de `main.tsx`, sans PostHog : une console interne n'a pas d'analytics
 * produit à collecter. Sentry est gardé (erreurs d'exploitation).
 *
 * Avant tout rendu : reprise de la session passée par le CRM (cf. adminEntry).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/i18n'
import { initSentry } from '@/lib/sentry'
import { supabase, REMEMBER_KEY } from '@/lib/supabase'
import { readHandoverFromHash } from '@/lib/adminEntry'
import AdminApp from './AdminApp'
import './styles/globals.css'
// APRÈS globals.css : re-teinte les variables de thème sur la palette Sugar
// (même spécificité, l'ordre décide). Voir l'en-tête du fichier.
import './styles/admin-console.css'

initSentry()

/**
 * La session de la console meurt avec l'onglet.
 *
 * On réutilise l'aiguillage « Se souvenir de moi » du client Supabase : à
 * `false`, les jetons partent en sessionStorage au lieu de localStorage. C'est
 * ce qui garantit qu'on ne peut pas REVENIR sur la console sans repasser par le
 * CRM — sinon le premier passage suffirait à s'installer durablement, et la
 * console redeviendrait une porte d'entrée autonome.
 *
 * Posé AVANT toute écriture de jeton, sans quoi `setSession` viserait le mauvais
 * magasin.
 */
function scopeSessionToTab() {
  try { window.localStorage.setItem(REMEMBER_KEY, 'false') } catch { /* mode privé */ }
}

/**
 * Lit la session passée dans le fragment, l'efface de la barre d'adresse et de
 * l'historique, puis l'installe. Renvoie `true` si un passage a eu lieu.
 *
 * L'effacement (`replaceState`) est fait AVANT l'installation, et hors du
 * `try` de `setSession` : même si l'installation échoue, les jetons ne doivent
 * pas rester dans l'historique du navigateur.
 */
async function consumeHandover(): Promise<boolean> {
  const handover = readHandoverFromHash(window.location.hash)
  if (!handover) return false

  window.history.replaceState(null, '', window.location.pathname + window.location.search)

  const { error } = await supabase.auth.setSession(handover)
  if (error) {
    // Jeton périmé ou révoqué : la console rendra son écran « depuis le CRM ».
    console.warn('[console] reprise de session refusée :', error.message)
    return false
  }
  return true
}

async function boot() {
  scopeSessionToTab()
  await consumeHandover()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  )
}

void boot()
