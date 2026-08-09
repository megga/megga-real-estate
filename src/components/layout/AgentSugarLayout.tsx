/**
 * Layout des pages CRM Sugar v2 (route parente des surfaces agent). Volontairement
 * dépouillé : ni sidebar, ni breadcrumb, ni bottom bar — les pages Sugar portent
 * leur propre chrome. Fournit thème + contexte copilote, la bannière
 * d'impersonation, le « push » du contenu quand le panneau MEGGA AI est ouvert,
 * le gate identité légale (étape 2 KYB) qui redirige vers /dashboard/identite
 * tant que le dirigeant n'a pas soumis l'identité de son agence, et le bandeau
 * du garde LAB (étape 5, tâche 4, LabGuardBanner) qui rappelle sur toutes les
 * pages tant que l'agence n'est pas vérifiée.
 */
import { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { CopilotContextProvider } from '@/hooks/useCopilotContext'
import { useAiPanel } from '@/hooks/useAiPanel'
import { COPILOT_WIDTH } from '@/components/ai-copilot/panel/aiPanel'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import ImpersonateBanner from '@/components/admin/ImpersonateBanner'
import LabGuardBanner from '@/components/layout/LabGuardBanner'
import BootSplash from '@/components/layout/BootSplash'
import OnboardingCallBanner from '@/components/layout/OnboardingCallBanner'
import CrmSugarSearchHost from '@/components/crm-sugar/search/CrmSugarSearchHost'
import { useIdentityGate, shouldRedirectToIdentityGate, shouldHoldForIdentityGate, IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'

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
  const pageBg = crmSugarPalette(dark).pageBg

  // Gate identité légale (étape 2 KYB) : tant que useIdentityGate() n'a pas
  // positivement résolu l'état à 'required', on NE redirige PAS — garde-fou 1
  // de l'incident P0 c830f9a9 (« boucle onboarding »). shouldRedirectToIdentityGate
  // refuse en plus de rediriger /dashboard/identite vers elle-même (garde-fou 2) :
  // sans ce second garde-fou, la page qui doit justement lever le statut 'required'
  // ne pourrait jamais se monter.
  const mustRedirectToIdentity = shouldRedirectToIdentityGate(identityGateStatus, location.pathname)
  // …et tant que le statut n'est pas résolu, on ne rend PAS le CRM non plus :
  // sans ça, le tableau de bord s'affichait une fraction de seconde avant que la
  // lecture agence ne réponde 'required' et ne renvoie sur le wizard d'identité.
  // On prolonge l'écran d'arrivée — le même que celui de ProtectedRoute, donc la
  // bascule ne se voit pas — plutôt que d'ouvrir une porte qu'on va refermer.
  //
  // UNE SEULE FOIS, et c'est essentiel : retenir l'écran remplace l'<Outlet/>,
  // donc DÉMONTE la page et son état. Un retour à 'loading' après coup ferait
  // repartir le wizard d'identité de zéro en pleine saisie (cf. le JSDoc de
  // shouldHoldForIdentityGate). Une fois le gate résolu, on ne retient plus rien.
  const [gateResolvedOnce, setGateResolvedOnce] = useState(false)
  useEffect(() => {
    if (identityGateStatus !== 'loading') setGateResolvedOnce(true)
  }, [identityGateStatus])
  const holdForIdentity = shouldHoldForIdentityGate(identityGateStatus, gateResolvedOnce)

  return (
    // flex column pleine hauteur (correctif revue, point mineur) : les bandeaux
    // (Impersonate/LabGuard) et la zone de contenu se PARTAGENT 100vh au lieu de
    // s'empiler chacun leur propre ancrage minimal indépendant — un bandeau (qui a
    // sa propre hauteur) suivi d'une zone de contenu qui réclamait ELLE AUSSI
    // min-height:100vh dépassait la fenêtre et produisait un ascenseur de page
    // parasite sur un écran par ailleurs court (KycLabGuard bloqué, cf. son
    // en-tête). flex:'1 1 auto' sur la zone de contenu lui donne une hauteur
    // DÉFINIE (règle flexbox : un flex-item résout une taille définie même quand
    // son conteneur n'a qu'un min-height) — c'est ce qui permet à
    // KycBlockedScreen/LoadingScreen d'utiliser min-h-full plutôt que min-h-screen
    // et de s'ajuster sous un bandeau au lieu de l'ignorer. Comportement inchangé
    // en l'absence de bandeau (cas courant) : un seul enfant flexible occupe toute
    // la hauteur, comme avant.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ImpersonateBanner />
      <LabGuardBanner />
      {/* Après le garde LAB : celui-ci parle d'un dossier bloqué, celui-là d'un
          rendez-vous à prendre. Le blocage passe d'abord. */}
      <OnboardingCallBanner />
      {/* Le panneau MEGGA AI « pousse » le contenu de travail vers la gauche
          quand il est ouvert (COPILOT_WIDTH = panneau + gouttières). */}
      <div
        style={{
          transition: 'padding-right .42s cubic-bezier(.2,.8,.2,1)',
          paddingRight: isOpen ? COPILOT_WIDTH : 0,
          background: pageBg,
          flex: '1 1 auto',
        }}
      >
        {holdForIdentity
          ? <BootSplash />
          : mustRedirectToIdentity
            ? <Navigate to={IDENTITY_GATE_ROUTE} replace />
            : <Outlet />}
      </div>
      <CrmSugarSearchHost />
      {/* Le panneau MEGGA AI est monté dans App.tsx (au-dessus de <Routes>)
          pour persister à la navigation ; ici on ne fait que « pousser » le contenu. */}
    </div>
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
