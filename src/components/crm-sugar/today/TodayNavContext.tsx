// MEGGA CRM — Refonte « Aujourd'hui » · contexte de navigation du pager.
// Remplace les globales `window.__crmNavigate` / `window.__todayGoTo` du proto
// par un contexte React propre :
//   - navigate(id)   → navigation inter-écrans (ex. Agenda « Tout voir » → Calendrier)
//   - goToPage(i)    → pagination du pager (ex. Mode Focus → page Catalogue)

import { createContext, useContext } from 'react'

export interface TodayNav {
  /** `id` = cible logique (contact-detail, deal-detail, visite-detail…).
   *  `ref` = identifiant réel de la ligne visée. Sans `ref`, la cible retombe
   *  sur sa LISTE plutôt que sur un bouton mort — c'est la règle du dépôt :
   *  « un bouton qui ne fait rien doit disparaître ». */
  navigate: (id: string, ref?: string) => void
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
