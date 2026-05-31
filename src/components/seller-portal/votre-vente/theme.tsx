/* eslint-disable react-refresh/only-export-components */
// Contexte de thème de l'espace vendeur : expose la palette Sugar Pure active
// (claire/sombre) à tous les composants — remplace le `window.SELLER_SP` de la maquette.
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { SellerSP } from './tokens'

interface SellerThemeValue {
  SP: SellerSP
  dark: boolean
  setDark: (v: boolean) => void
}

const SellerThemeContext = createContext<SellerThemeValue | null>(null)

export function SellerThemeProvider({
  value,
  children,
}: {
  value: SellerThemeValue
  children: ReactNode
}) {
  return <SellerThemeContext.Provider value={value}>{children}</SellerThemeContext.Provider>
}

export function useSellerTheme(): SellerThemeValue {
  const ctx = useContext(SellerThemeContext)
  if (!ctx) throw new Error('useSellerTheme must be used inside SellerThemeProvider')
  return ctx
}

/** Raccourci : palette Sugar Pure active. */
export function useSP(): SellerSP {
  return useSellerTheme().SP
}
