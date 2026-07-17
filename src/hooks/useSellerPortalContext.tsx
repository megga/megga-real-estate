/**
 * Contexte React portant le `SellerPortalData` résolu à toute la page portail
 * vendeur, pour éviter de le faire ruisseler en props dans chaque sous-section.
 */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react'
import type { SellerPortalData } from '@/lib/mockSellerData'

const SellerPortalContext = createContext<SellerPortalData | null>(null)

/** Fournit le `SellerPortalData` chargé à l'arbre de la page portail. */
export function SellerPortalProvider({ data, children }: { data: SellerPortalData; children: React.ReactNode }) {
  return (
    <SellerPortalContext.Provider value={data}>
      {children}
    </SellerPortalContext.Provider>
  )
}

/** Accède au `SellerPortalData` du contexte ; lève si utilisé hors provider. */
export function useSellerPortalData(): SellerPortalData {
  const ctx = useContext(SellerPortalContext)
  if (!ctx) throw new Error('useSellerPortalData must be used inside SellerPortalProvider')
  return ctx
}
