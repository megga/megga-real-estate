/**
 * Thème de la console super-admin, aligné sur celui du CRM.
 *
 * Le CRM Sugar stocke sa préférence clair/sombre dans `megga.sugar.dark`
 * ('1' / '0', défaut = préférence système) ; le reste de l'app utilisait
 * `megga-theme` ('light' / 'dark'). Deux clés sans lien, donc deux réglages qui
 * divergeaient — bascule en sombre côté CRM, console restée en clair.
 *
 * La console adopte la clé Sugar. Elle continue de poser `data-theme` sur
 * `<html>`, puisque c'est ce que lisent les variables CSS des pages
 * (globals.css, re-teintes par admin-console.css) : même interrupteur que le
 * CRM, même noir.
 *
 * ⚠️ Les deux applications vivant sur des origines distinctes, leurs
 * `localStorage` ne sont PAS partagés : la préférence ne traverse pas, et c'est
 * assumé — c'est le prix de l'isolation. Ce qui est unifié, c'est la clé et le
 * comportement, pas la valeur.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const STORAGE_KEY = 'megga.sugar.dark'

interface AdminThemeState {
  dark: boolean
  setDark: (v: boolean) => void
  toggle: () => void
}

const AdminThemeContext = createContext<AdminThemeState | undefined>(undefined)

/** Lit la préférence Sugar (repli : préférence système). Même logique que les pages CRM. */
export function readSugarDark(): boolean {
  if (typeof window === 'undefined') return false
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === '1') return true
  if (saved === '0') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(readSugarDark)

  useEffect(() => {
    const root = document.documentElement
    if (dark) root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
    window.localStorage.setItem(STORAGE_KEY, dark ? '1' : '0')
  }, [dark])

  // Cross-onglet : deux consoles ouvertes suivent le même réglage.
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDarkState(readSugarDark())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const setDark = useCallback((v: boolean) => setDarkState(v), [])
  const toggle = useCallback(() => setDarkState(v => !v), [])

  return (
    <AdminThemeContext.Provider value={{ dark, setDark, toggle }}>
      {children}
    </AdminThemeContext.Provider>
  )
}

/** Accès au thème de la console. Lance si appelé hors du provider (bug de montage). */
export function useAdminTheme(): AdminThemeState {
  const ctx = useContext(AdminThemeContext)
  if (!ctx) throw new Error('useAdminTheme doit être appelé sous <AdminThemeProvider>')
  return ctx
}
