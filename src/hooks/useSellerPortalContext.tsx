import { createContext, useContext } from 'react'
import type { SellerPortalData } from '@/lib/mockSellerData'

const SellerPortalContext = createContext<SellerPortalData | null>(null)

export function SellerPortalProvider({ data, children }: { data: SellerPortalData; children: React.ReactNode }) {
  return (
    <SellerPortalContext.Provider value={data}>
      {children}
    </SellerPortalContext.Provider>
  )
}

export function useSellerPortalData(): SellerPortalData {
  const ctx = useContext(SellerPortalContext)
  if (!ctx) throw new Error('useSellerPortalData must be used inside SellerPortalProvider')
  return ctx
}
