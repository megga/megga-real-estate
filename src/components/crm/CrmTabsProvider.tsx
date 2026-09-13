/**
 * Le fournisseur de la pile d'onglets — dix lignes, et rien d'autre.
 *
 * ⚠ POURQUOI CE FICHIER EXISTE, alors que toute la logique est ailleurs. La règle
 * `react-refresh/only-export-components` est en ERREUR dans ce dépôt : un module
 * qui exporte un composant ne peut rien exporter d'autre. Or la machine des
 * onglets doit exposer huit hooks (`useCrmTabs`, `useTabScopedState`,
 * `useTabLabel`, `useTabDirty`, `useCrmTabBadges`…) que les écrans appellent.
 * Les deux ne peuvent donc pas cohabiter. Le découpage suit la contrainte de
 * l'outillage — la logique reste entière dans `useCrmTabs.tsx`, ici on ne fait
 * que la brancher sur le contexte.
 *
 * Il est monté dans `AgentLayout`, seul endroit du CRM qui ne se remonte pas à
 * la navigation.
 */

import type { ReactNode } from 'react'
import { CrmTabsCtx, useCrmTabsMachine } from '@/hooks/useCrmTabs'
import { useAuth } from '@/hooks/useAuth'

/**
 * La machine remonte à chaque couple compte/agence (`key`, audit S11) : aucune
 * pile en mémoire, aucun onglet fermé, aucun drapeau « non enregistré » ne
 * survit à son compte ni à son agence. C'est une CEINTURE : un changement de
 * compte recharge déjà la page (useAuth) — elle sert surtout au même compte qui
 * change d'agence, dont la pile nomme les clients de l'ancienne.
 */
export function CrmTabsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  return (
    <MachineOnglets key={`${user?.id ?? 'anon'}:${profile?.agency_id ?? 'aucune'}`}>{children}</MachineOnglets>
  )
}

function MachineOnglets({ children }: { children: ReactNode }) {
  const api = useCrmTabsMachine()
  return <CrmTabsCtx.Provider value={api}>{children}</CrmTabsCtx.Provider>
}
