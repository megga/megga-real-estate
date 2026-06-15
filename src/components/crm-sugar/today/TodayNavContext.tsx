// MEGGA CRM — Refonte « Aujourd'hui » · contexte de navigation du pager.
// Remplace les globales `window.__crmNavigate` / `window.__todayGoTo` du proto
// par un contexte React propre :
//   - navigate(id)   → navigation inter-écrans (ex. Agenda « Tout voir » → Calendrier)
//   - goToPage(i)    → pagination du pager (ex. Mode Focus → page Catalogue)

import { createContext, useContext } from 'react'

export interface TodayNav {
  navigate: (id: string) => void
  goToPage: (page: number) => void
}

const TodayNavContext = createContext<TodayNav>({
  navigate: () => {},
  goToPage: () => {},
})

export const TodayNavProvider = TodayNavContext.Provider

export function useTodayNav(): TodayNav {
  return useContext(TodayNavContext)
}
