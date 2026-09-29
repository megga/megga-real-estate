// MEGGA CRM — Refonte « Aujourd'hui » · contexte de navigation de l'écran.
// Remplace la globale `window.__crmNavigate` du proto par un contexte React
// propre : navigate(id) → navigation inter-écrans (ex. « Ouvrir dans le
// calendrier », dans l'aperçu d'un rendez-vous → Calendrier).

import { createContext, useContext } from 'react'

export interface TodayNav {
  /** `id` = cible logique (contact-detail, deal-detail, visite-detail…).
   *  `ref` = identifiant réel de la ligne visée. Sans `ref`, la cible retombe
   *  sur sa LISTE plutôt que sur un bouton mort — c'est la règle du dépôt :
   *  « un bouton qui ne fait rien doit disparaître ». */
  navigate: (id: string, ref?: string) => void
}

const TodayNavContext = createContext<TodayNav>({
  navigate: () => {},
})

export const TodayNavProvider = TodayNavContext.Provider

export function useTodayNav(): TodayNav {
  return useContext(TodayNavContext)
}
