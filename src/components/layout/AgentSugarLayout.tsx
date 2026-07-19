/**
 * Layout des pages CRM Sugar v2 (route parente des surfaces agent). Volontairement
 * dépouillé : ni sidebar, ni breadcrumb, ni bottom bar — les pages Sugar portent
 * leur propre chrome. Fournit thème + contexte copilote, la bannière
 * d'impersonation et le « push » du contenu quand le panneau MEGGA AI est ouvert.
 */
import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { CopilotContextProvider } from '@/hooks/useCopilotContext'
import { useAiPanel } from '@/hooks/useAiPanel'
import { COPILOT_WIDTH } from '@/components/ai-copilot/panel/aiPanel'
import { CRM_TOKENS, crmSugarPalette } from '@/components/crm-sugar/tokens'
import ImpersonateBanner from '@/components/admin/ImpersonateBanner'
import CrmSugarSearchHost from '@/components/crm-sugar/search/CrmSugarSearchHost'

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
 *    est monté dans App.tsx, au-dessus des Routes keyées, pour persister à la nav)
 *  - ImpersonateBanner (super-admin must always see they are impersonating)
 */
function AgentSugarInner() {
  const { isOpen } = useAiPanel()
  const [dark, setDark] = useState(readSugarDark)
  useEffect(() => {
    const sync = () => setDark(readSugarDark())
    window.addEventListener('storage', sync)
    let id: number | undefined
    if (isOpen) id = window.setInterval(sync, 400)
    return () => { window.removeEventListener('storage', sync); if (id) window.clearInterval(id) }
  }, [isOpen])
  // Fond Sugar de la page courante → peint la gouttière réservée par le push
  // (sinon elle laisserait voir le fond `body` blanc, dépareillé en mode sombre).
  const pageBg = crmSugarPalette(dark ? CRM_TOKENS.dark : CRM_TOKENS.light, dark, 'meggaAi').pageBg
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
        <Outlet />
      </div>
      <CrmSugarSearchHost />
      {/* Le panneau MEGGA AI est monté dans App.tsx (au-dessus des Routes keyées)
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
