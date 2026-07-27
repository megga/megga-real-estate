/**
 * Layout des pages CRM Sugar v2 (route parente des surfaces agent). Volontairement
 * dépouillé : ni sidebar, ni breadcrumb, ni bottom bar — les pages Sugar portent
 * leur propre chrome. Fournit thème + contexte copilote, la bannière
 * d'impersonation, le « push » du contenu quand le panneau MEGGA AI est ouvert,
 * et le gate identité légale (étape 2 KYB) qui redirige vers /dashboard/identite
 * tant que le dirigeant n'a pas soumis l'identité de son agence.
 */
import { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { CopilotContextProvider } from '@/hooks/useCopilotContext'
import { useAiPanel } from '@/hooks/useAiPanel'
import { COPILOT_WIDTH } from '@/components/ai-copilot/panel/aiPanel'
import { crmSugarPalette, sugarThemeTokens, SUGAR_DARK_TONE } from '@/components/crm-sugar/tokens'
import ImpersonateBanner from '@/components/admin/ImpersonateBanner'
import CrmSugarSearchHost from '@/components/crm-sugar/search/CrmSugarSearchHost'
import { useIdentityGate, shouldRedirectToIdentityGate, IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'

/** Lit la préférence de thème sombre Sugar (fallback : préférence système). */
// Mode sombre Sugar (même clé localStorage que les pages). Réactif : `storage`
// (cross-onglet) + relecture courte tant que le panneau est ouvert (le fond de
// la gouttière du push doit suivre le thème Sugar, pas le thème app `data-theme`).
function readSugarDark(): boolean {
  if (typeof window === 'undefined') return false
  const s = window.localStorage.getItem('megga.sugar.dark')
  if (s === '1') return true
  if (s === '0') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * AgentSugarLayout — barebones wrapper for Sugar v2 CRM pages.
 *
 * Unlike AgentLayout, it does NOT render a sidebar, breadcrumb, mobile header
 * or bottom tab bar. The Sugar pages provide their own chrome
 * (SugarTopNav + SugarIconRail) that is glassy and full-bleed.
 *
 * Kept utilities:
 *  - ThemeProvider (so toggling clair/sombre stays in sync with the rest of
 *    the app's CSS variables, even though Sugar uses its own tokens)
 *  - CopilotContextProvider (kept for cross-page MEGGA AI context)
 *  - Push du contenu quand le panneau MEGGA AI est ouvert (le panneau lui-même
 *    est monté dans App.tsx, au-dessus de <Routes>, pour persister à la nav)
 *  - ImpersonateBanner (super-admin must always see they are impersonating)
 *  - Identity gate (useIdentityGate) — swaps <Outlet/> for a <Navigate> to
 *    /dashboard/identite while status === 'required'. Never redirects on an
 *    unresolved ('loading') status, and never redirects the identity route
 *    to itself (shouldRedirectToIdentityGate) — see the P0 incident notes on
 *    the gate call below.
 */
function AgentSugarInner() {
  const { isOpen } = useAiPanel()
  const { status: identityGateStatus } = useIdentityGate()
  const location = useLocation()
  const [dark, setDark] = useState(readSugarDark)
  useEffect(() => {
    const sync = () => setDark(readSugarDark())
    // Relecture IMMÉDIATE à chaque passage : ce layout ne se remonte plus à la
    // navigation (les routes ne sont plus keyées par pathname), donc la valeur
    // lue au montage peut dater de plusieurs écrans — une bascule clair/sombre
    // faite depuis le rail d'une page n'est pas notifiée dans le même onglet
    // (`storage` ne concerne que les autres). Sans ça, la gouttière du push
    // s'ouvrirait à l'ancienne teinte.
    sync()
    window.addEventListener('storage', sync)
    let id: number | undefined
    if (isOpen) id = window.setInterval(sync, 400)
    return () => { window.removeEventListener('storage', sync); if (id) window.clearInterval(id) }
  }, [isOpen])
  // Fond Sugar de la page courante → peint la gouttière réservée par le push
  // (sinon elle laisserait voir le fond `body` blanc, dépareillé en mode sombre).
  const pageBg = crmSugarPalette(sugarThemeTokens(dark), dark, SUGAR_DARK_TONE).pageBg

  // Gate identité légale (étape 2 KYB) : tant que useIdentityGate() n'a pas
  // positivement résolu l'état à 'required', on NE redirige PAS — garde-fou 1
  // de l'incident P0 c830f9a9 (« boucle onboarding »). shouldRedirectToIdentityGate
  // refuse en plus de rediriger /dashboard/identite vers elle-même (garde-fou 2) :
  // sans ce second garde-fou, la page qui doit justement lever le statut 'required'
  // ne pourrait jamais se monter.
  const mustRedirectToIdentity = shouldRedirectToIdentityGate(identityGateStatus, location.pathname)

  return (
    <>
      <ImpersonateBanner />
      {/* Le panneau MEGGA AI « pousse » le contenu de travail vers la gauche
          quand il est ouvert (COPILOT_WIDTH = panneau + gouttières). */}
      <div
        style={{
          transition: 'padding-right .42s cubic-bezier(.2,.8,.2,1)',
          paddingRight: isOpen ? COPILOT_WIDTH : 0,
          background: pageBg,
          minHeight: '100vh',
        }}
      >
        {mustRedirectToIdentity ? <Navigate to={IDENTITY_GATE_ROUTE} replace /> : <Outlet />}
      </div>
      <CrmSugarSearchHost />
      {/* Le panneau MEGGA AI est monté dans App.tsx (au-dessus de <Routes>)
          pour persister à la navigation ; ici on ne fait que « pousser » le contenu. */}
    </>
  )
}

/** Enrobe le layout interne des providers thème + contexte copilote. */
export default function AgentSugarLayout() {
  return (
    <ThemeProvider>
      <CopilotContextProvider>
        <AgentSugarInner />
      </CopilotContextProvider>
    </ThemeProvider>
  )
}
