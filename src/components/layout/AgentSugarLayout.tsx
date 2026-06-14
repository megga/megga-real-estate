import { Outlet } from 'react-router-dom'
import { ThemeProvider } from '@/hooks/useTheme'
import { CopilotContextProvider } from '@/hooks/useCopilotContext'
import ImpersonateBanner from '@/components/admin/ImpersonateBanner'
import NpsSurvey from '@/components/feedback/NpsSurvey'
import CrmSugarSearchHost from '@/components/crm-sugar/search/CrmSugarSearchHost'

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
 *  - ImpersonateBanner (super-admin must always see they are impersonating)
 *  - NpsSurvey (user feedback flow)
 */
export default function AgentSugarLayout() {
  return (
    <ThemeProvider>
      <CopilotContextProvider>
        <ImpersonateBanner />
        <Outlet />
        <CrmSugarSearchHost />
        <NpsSurvey />
      </CopilotContextProvider>
    </ThemeProvider>
  )
}
